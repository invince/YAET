const { ipcMain } = require('electron');
const { TelnetService } = require('../../../services/telnetService');

let telnetService = null;
const sessionSenders = new Map();

function initTelnetIpcHandler(log, terminalMap, getProxies, getSecrets) {
  telnetService = new TelnetService(log);

  telnetService.on('output', ({ id, data }) => {
    const sender = sessionSenders.get(id);
    if (sender) sender.send('terminal.output', { id, data });
  });

  telnetService.on('error', ({ id, error }) => {
    const sender = sessionSenders.get(id);
    if (sender) sender.send('error', { category: 'telnet', id, error });
  });

  ipcMain.on('session.open.terminal.telnet', async (event, data) => {
    sessionSenders.set(data.terminalId, event.sender);

    try {
      const session = await telnetService.connect(data.config, {
        id: data.terminalId,
        proxyId: data.proxyId,
        getProxies,
        getSecrets,
      });

      terminalMap.set(data.terminalId, {
        type: 'telnet',
        process: session.process,
        callback: (input) => telnetService.write(data.terminalId, input),
      });
    } catch (error) {
      event.sender.send('error', {
        category: 'telnet',
        id: data.terminalId,
        error: error.message,
      });
      sessionSenders.delete(data.terminalId);
    }
  });

  ipcMain.on('session.close.terminal.telnet', (event, data) => {
    telnetService.disconnect(data.terminalId);
    sessionSenders.delete(data.terminalId);
  });
}

module.exports = { initTelnetIpcHandler };
