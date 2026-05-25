const { ipcMain } = require('electron');
const { fetchModels, callChat } = require('../../ai/aiClient');
const { getToolDefinitions } = require('../../ai/toolDefinitions');
const { functionCallLoop } = require('../../ai/functionLoop');

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
  ipcMain.handle('ai.send-with-tools', async (event, { apiUrl, token, model, messages }) => {
    const toolDefs = getToolDefinitions();
    const settings = getSettings ? getSettings() : null;
    const useContext = settings?.ai?.useContext !== false;
    if (useContext) {
      injectSessionContext(runtime, messages);
    }
    const sessionToolNames = ['terminal_open', 'session_list', 'session_read', 'session_write'];
    const oneShotToolNames = ['terminal_execute', 'local_execute'];
    const activeDefs = useContext
      ? toolDefs.filter(t => !oneShotToolNames.includes(t.function.name))
      : toolDefs.filter(t => !sessionToolNames.includes(t.function.name));
    return functionCallLoop(log, runtime, apiUrl, token, model, messages, activeDefs, 0);
  });
}

function injectSessionContext(runtime, messages) {
  const registry = runtime?.sessionRegistry;
  if (!registry) return;

  const sessions = registry.list();
  if (sessions.length === 0) return;

  const lines = [];
  for (const s of sessions) {
    const data = registry.read(s.id);
    if (!data) continue;
    const output = data.output.map(o => o.data).join('');
    lines.push(`[${s.type}] id=${s.id} running=${data.running} output="${output}"`);
  }
  if (lines.length === 0) return;

  const context = `Active terminal sessions:\n${lines.join('\n')}`;
  messages.unshift({ role: 'system', content: context });
}

module.exports = { initAiIpcHandler, initAiChatIpcHandler, initAiToolsIpcHandler };
