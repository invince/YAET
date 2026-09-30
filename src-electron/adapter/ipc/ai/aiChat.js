const { ipcMain } = require('electron');
const { fetchModels, callChat } = require('../../ai/aiClient');
const { getToolDefinitions } = require('../../ai/toolDefinitions');
const { functionCallLoop } = require('../../ai/functionLoop');

const lastSentTimestamps = new Map();

// P1-1: one in-flight agent run per chat. stop()/switch/new-chat aborts the
// controller; the loop, the HTTP call and pending tools all observe it.
// Opened ai_* sessions are intentionally KEPT (visible, closable by user).
const aiControllers = new Map();

function aiKey(chatSessionId) {
  return chatSessionId || 'default';
}

function abortAiRun(chatSessionId) {
  const c = aiControllers.get(aiKey(chatSessionId));
  if (c) {
    try { c.abort(); } catch (_) {}
    aiControllers.delete(aiKey(chatSessionId));
  }
}

function initAiIpcHandler(log) {
  ipcMain.handle('ai.fetch-models', async (event, { apiUrl, token }) => {
    return fetchModels(log, apiUrl, token);
  });
}

function initAiChatIpcHandler(log, getSettings) {
  ipcMain.handle('ai.send-chat', async (event, { apiUrl, token, model, messages, chatSessionId }) => {
    // P1-1: pure chat joins the same cancellation map so stop() aborts it too.
    const settings = getSettings ? getSettings() : null;
    const timeoutMs = Math.max(10000, Number(settings?.ai?.requestTimeoutMs) || 120000);
    abortAiRun(chatSessionId);
    const controller = new AbortController();
    aiControllers.set(aiKey(chatSessionId), controller);
    try {
      return await callChat(log, apiUrl, token, model, messages.slice(), { signal: controller.signal, timeoutMs });
    } finally {
      if (aiControllers.get(aiKey(chatSessionId)) === controller) aiControllers.delete(aiKey(chatSessionId));
    }
  });
}

function initAiToolsIpcHandler(log, runtime, getSettings) {
  ipcMain.handle('ai.send-with-tools', async (event, { apiUrl, token, model, messages, crossSessionAccess, useContext, chatSessionId, activeTabId }) => {
    const toolDefs = getToolDefinitions();
    const settings = getSettings ? getSettings() : null;
    const useContextSetting = useContext !== false && settings?.ai?.useContext !== false;
    if (useContextSetting) {
      injectSessionContext(runtime, messages, getSettings, crossSessionAccess, chatSessionId, activeTabId);
    }
    // activeTabId rides along so local_execute can inherit the user's shell cwd
    // (see toolDefinitions.js) instead of running in the app's home directory.
    const sessionContext = { crossSessionAccess, useContext: useContextSetting, chatSessionId, activeTabId, downloadDir: settings?.ai?.downloadDir || null };
    const sendEvent = (data) => {
      try { event.sender.send('ai.tool-progress', data); } catch (_) {}
    };
    // P1-1: clamp defensively — settings file is hand-editable.
    const timeoutMs = Math.max(10000, Number(settings?.ai?.requestTimeoutMs) || 120000);
    // P1-1C: whole-run context budget (depth cap stops LONG runs, this stops FAT ones).
    const maxLoopTokens = Math.max(4000, Number(settings?.ai?.maxLoopTokens) || 100000);
    // A new run for the same chat replaces the previous one.
    abortAiRun(chatSessionId);
    const controller = new AbortController();
    aiControllers.set(aiKey(chatSessionId), controller);
    try {
      return await functionCallLoop(log, runtime, apiUrl, token, model, messages, toolDefs, 0, sendEvent, sessionContext, { signal: controller.signal, timeoutMs, maxLoopTokens });
    } finally {
      if (aiControllers.get(aiKey(chatSessionId)) === controller) aiControllers.delete(aiKey(chatSessionId));
    }
  });
  ipcMain.on('ai.cancel-chat', (event, { chatSessionId } = {}) => {
    abortAiRun(chatSessionId);
  });
}

// NOTE: this injects session buffers as a system message: AI-owned sessions
// plus the user's ACTIVE tab (incremental, same mechanism). The renderer no
// longer pushes full xterm text in agent mode; pure-chat/ACP modes push a
// bounded tail themselves (see ai-chat.component.ts :: sendMessage()).
//
// Raw pty bytes carry ANSI color/OSC sequences (e.g. `\x1b[01;34m/ai\x1b[00m$`).
// They are stripped before injection: otherwise the prompt preview slice(-40)
// yields escape soup instead of the path, and the model answers from stale
// conversation history.
function stripAnsi(s) {
  return String(s || '')
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '') // OSC (window title etc.)
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')           // CSI (colors, ?2004h, …)
    .replace(/\x1b[()][0-9A-B]/g, '')                 // charset selection
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ''); // leftover controls
}

function injectSessionContext(runtime, messages, getSettings, crossSessionAccess, chatSessionId, activeTabId) {
  const registry = runtime?.sessionRegistry;
  if (!registry) return;

  const settings = getSettings?.()?.ai?.contextOptimization;
  const enabled = settings?.enabled !== false;
  const idleSummary = settings?.idleSummary !== false;
  const level = settings?.level ?? 2;
  const maxTokens = settings?.maxContextTokens ?? 4000;

  let sessions = registry.list().filter(s => s.owner === 'ai');
  if (!crossSessionAccess) {
    sessions = sessions.filter(s => (!chatSessionId || s.chatSessionId === chatSessionId));
  }
  // P1-2: the user's active tab rides the same incremental mechanism.
  // It is always in scope (it's what the user is looking at) regardless of
  // crossSessionAccess, and goes FIRST so token truncation drops AI sessions
  // before it. Unregistered ids (non-terminal tabs) are skipped silently.
  if (activeTabId) {
    const active = registry.get(activeTabId);
    if (active && active.owner === 'user' && !sessions.some(s => s.id === active.id)) {
      sessions.unshift({ id: active.id, type: active.type, owner: 'user', chatSessionId: active.chatSessionId });
    }
  }
  if (sessions.length === 0) {
    // P1-4: still prune — dead sessions leave no sessions behind to trigger it.
    for (const id of lastSentTimestamps.keys()) {
      if (!registry.get(id)) lastSentTimestamps.delete(id);
    }
    return;
  }

  // P1-4: lastSentTimestamps is process-global while sessions come and go.
  // Cap defensively (prune above already dropped dead ids).
  if (lastSentTimestamps.size > 1000) {
    const ids = [...lastSentTimestamps.keys()].slice(0, lastSentTimestamps.size - 1000);
    for (const id of ids) lastSentTimestamps.delete(id);
  }

  const lines = [];
  const now = Date.now();
  // Authoritative cwd of the user's active shell (follows `cd`). Kept aside
  // so it is ALWAYS injected — even when no new terminal output exists and
  // the incremental branches below produce zero lines.
  let userCwd = '';

  for (const s of sessions) {
    const data = registry.read(s.id);
    if (!data) continue;
    // P1-2: user terminal is labeled distinctly from AI-owned sessions.
    const tag = s.owner === 'user' ? 'user-terminal' : s.type;
    // The user's shell cwd (follows `cd`): without it the model runs
    // local_execute (app home dir) and reports the WRONG directory.
    let cwdSuffix = '';
    if (s.owner === 'user') {
      try {
        const cwd = registry.get(s.id)?.session?.getShellCwd?.();
        if (cwd) {
          cwdSuffix = ` cwd=${cwd}`;
          if (!userCwd) userCwd = cwd;
        }
      } catch { /* ignore — line works without cwd too */ }
    }

    if (enabled) {
      if (!data.running) {
        lines.push(`[${tag}] id=${s.id}${cwdSuffix} — disconnected`);
        if (level >= 2) lastSentTimestamps.set(s.id, now);
        continue;
      }

      const hasOutput = data.output && data.output.length > 0;

      if (idleSummary && !hasOutput) {
        lines.push(`[${tag}] id=${s.id}${cwdSuffix} — IDLE, ready for input`);
        if (level >= 2) lastSentTimestamps.set(s.id, now);
        continue;
      }

      if (idleSummary && hasOutput) {
        // Match + preview on STRIPPED text: raw pty bytes end with color
        // resets, so the raw slice would be escape soup, not the path.
        const lastOut = stripAnsi(data.output[data.output.length - 1].data);
        if (/[$#>%:]\s*$/.test(lastOut)) {
          const preview = lastOut.trim().slice(-60);
          lines.push(`[${tag}] id=${s.id}${cwdSuffix} — state: INPUT_REQUIRED, prompt: "${preview}"`);
          if (level >= 2) lastSentTimestamps.set(s.id, now);
          continue;
        }
      }

      if (level >= 2) {
        const lastSent = lastSentTimestamps.get(s.id) || 0;
        // Buffer entries are {ts, data} (sessionRegistry.js); accept
        // `timestamp` too for forward-compat. (The old `o.timestamp`-only
        // read never matched, so incremental injection was silently dead.)
        const newOutput = data.output.filter(o => ((o.ts ?? o.timestamp) || 0) > lastSent);
        if (newOutput.length === 0) continue;
        // Cap + strip: a full `ls`/log dump must not flood the context.
        const output = stripAnsi(newOutput.map(o => o.data).join('')).slice(-6000);
        lines.push(`[${tag}] id=${s.id}${cwdSuffix} output="${output}"`);
        lastSentTimestamps.set(s.id, now);
        continue;
      }
    }

    const output = stripAnsi(data.output.map(o => o.data).join('')).slice(-6000);
    lines.push(`[${tag}] id=${s.id}${cwdSuffix} running=${data.running} output="${output}"`);
  }

  // No fresh lines (e.g. nothing new since the last question) — still ground
  // the model in the CURRENT directory, otherwise it answers from stale chat
  // history (e.g. repeats the previous `/ai` after the user cd'd to /ai/tools).
  if (lines.length === 0) {
    if (!userCwd) return;
    messages.unshift({
      role: 'system',
      content: `User's active terminal cwd: ${userCwd} — "current folder" questions refer to this directory.`,
    });
    return;
  }

  const cwdNote = userCwd
    ? `\nUser's active terminal cwd: ${userCwd} — "current folder" questions refer to this directory; local_execute already runs there.`
    : '';
  let context = `Active terminal sessions:\n${lines.join('\n')}${cwdNote}`;

  if (enabled) {
    const estimatedTokens = Math.ceil(context.length / 4);
    if (estimatedTokens > maxTokens) {
      while (lines.length > 0 && Math.ceil(context.length / 4) > maxTokens) {
        lines.pop();
        context = `Active terminal sessions:\n${lines.join('\n')}${cwdNote}`;
      }
      if (lines.length === 0) return;
    }
  }

  messages.unshift({ role: 'system', content: context });
}

module.exports = { initAiIpcHandler, initAiChatIpcHandler, initAiToolsIpcHandler, injectSessionContext, stripAnsi };
