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
    const sessionContext = { crossSessionAccess, useContext: useContextSetting, chatSessionId, downloadDir: settings?.ai?.downloadDir || null };
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

  for (const s of sessions) {
    const data = registry.read(s.id);
    if (!data) continue;
    // P1-2: user terminal is labeled distinctly from AI-owned sessions.
    const tag = s.owner === 'user' ? 'user-terminal' : s.type;

    if (enabled) {
      if (!data.running) {
        lines.push(`[${tag}] id=${s.id} — disconnected`);
        if (level >= 2) lastSentTimestamps.set(s.id, now);
        continue;
      }

      const hasOutput = data.output && data.output.length > 0;

      if (idleSummary && !hasOutput) {
        lines.push(`[${tag}] id=${s.id} — IDLE, ready for input`);
        if (level >= 2) lastSentTimestamps.set(s.id, now);
        continue;
      }

      if (idleSummary && hasOutput) {
        const lastOut = data.output[data.output.length - 1].data;
        if (/[$#>%:]\s*$/.test(lastOut)) {
          const preview = lastOut.trim().slice(-40);
          lines.push(`[${tag}] id=${s.id} — state: INPUT_REQUIRED, prompt: "${preview}"`);
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
        const output = newOutput.map(o => o.data).join('');
        lines.push(`[${tag}] id=${s.id} output="${output}"`);
        lastSentTimestamps.set(s.id, now);
        continue;
      }
    }

    const output = data.output.map(o => o.data).join('');
    lines.push(`[${tag}] id=${s.id} running=${data.running} output="${output}"`);
  }

  if (lines.length === 0) return;

  let context = `Active terminal sessions:\n${lines.join('\n')}`;

  if (enabled) {
    const estimatedTokens = Math.ceil(context.length / 4);
    if (estimatedTokens > maxTokens) {
      while (lines.length > 0 && Math.ceil(context.length / 4) > maxTokens) {
        lines.pop();
        context = `Active terminal sessions:\n${lines.join('\n')}`;
      }
      if (lines.length === 0) return;
    }
  }

  messages.unshift({ role: 'system', content: context });
}

module.exports = { initAiIpcHandler, initAiChatIpcHandler, initAiToolsIpcHandler };
