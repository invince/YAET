const { ipcMain } = require('electron');
const { fetchModels, callChat } = require('../../ai/aiClient');
const { getToolDefinitions } = require('../../ai/toolDefinitions');
const { functionCallLoop } = require('../../ai/functionLoop');

const lastSentTimestamps = new Map();

function initAiIpcHandler(log) {
  ipcMain.handle('ai.fetch-models', async (event, { apiUrl, token }) => {
    return fetchModels(log, apiUrl, token);
  });
}

function initAiChatIpcHandler(log) {
  ipcMain.handle('ai.send-chat', async (event, { apiUrl, token, model, messages }) => {
    return callChat(log, apiUrl, token, model, messages);
  });
}

function initAiToolsIpcHandler(log, runtime, getSettings) {
  ipcMain.handle('ai.send-with-tools', async (event, { apiUrl, token, model, messages, crossSessionAccess, useContext, chatSessionId }) => {
    const toolDefs = getToolDefinitions();
    const settings = getSettings ? getSettings() : null;
    const useContextSetting = useContext !== false && settings?.ai?.useContext !== false;
    if (useContextSetting) {
      injectSessionContext(runtime, messages, getSettings, crossSessionAccess, chatSessionId);
    }
    const sessionContext = { crossSessionAccess, useContext: useContextSetting, chatSessionId };
    const sendEvent = (data) => {
      try { event.sender.send('ai.tool-progress', data); } catch (_) {}
    };
    return functionCallLoop(log, runtime, apiUrl, token, model, messages, toolDefs, 0, sendEvent, sessionContext);
  });
}

// NOTE: this injects session buffer + status summary as a system message.
// There is a parallel injection on the renderer side:
//   src/app/components/ai-chat/ai-chat.component.ts :: sendMessage()
//   which injects xterm full content as a user message.
function injectSessionContext(runtime, messages, getSettings, crossSessionAccess, chatSessionId) {
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
  if (sessions.length === 0) return;

  const lines = [];
  const now = Date.now();

  for (const s of sessions) {
    const data = registry.read(s.id);
    if (!data) continue;

    if (enabled) {
      if (!data.running) {
        lines.push(`[${s.type}] id=${s.id} — disconnected`);
        if (level >= 2) lastSentTimestamps.set(s.id, now);
        continue;
      }

      const hasOutput = data.output && data.output.length > 0;

      if (idleSummary && !hasOutput) {
        lines.push(`[${s.type}] id=${s.id} — IDLE, ready for input`);
        if (level >= 2) lastSentTimestamps.set(s.id, now);
        continue;
      }

      if (idleSummary && hasOutput) {
        const lastOut = data.output[data.output.length - 1].data;
        if (/[$#>%:]\s*$/.test(lastOut)) {
          const preview = lastOut.trim().slice(-40);
          lines.push(`[${s.type}] id=${s.id} — state: INPUT_REQUIRED, prompt: "${preview}"`);
          if (level >= 2) lastSentTimestamps.set(s.id, now);
          continue;
        }
      }

      if (level >= 2) {
        const lastSent = lastSentTimestamps.get(s.id) || 0;
        const newOutput = data.output.filter(o => (o.timestamp || 0) > lastSent);
        if (newOutput.length === 0) continue;
        const output = newOutput.map(o => o.data).join('');
        lines.push(`[${s.type}] id=${s.id} output="${output}"`);
        lastSentTimestamps.set(s.id, now);
        continue;
      }
    }

    const output = data.output.map(o => o.data).join('');
    lines.push(`[${s.type}] id=${s.id} running=${data.running} output="${output}"`);
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
