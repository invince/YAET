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

function initAiToolsIpcHandler(log, runtime) {
  ipcMain.handle('ai.send-with-tools', async (event, { apiUrl, token, model, messages }) => {
    const toolDefs = getToolDefinitions();
    return functionCallLoop(log, runtime, apiUrl, token, model, messages, toolDefs, 0);
  });
}

module.exports = { initAiIpcHandler, initAiChatIpcHandler, initAiToolsIpcHandler };
