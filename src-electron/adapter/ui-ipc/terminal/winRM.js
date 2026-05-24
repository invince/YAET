const { ipcMain } = require('electron');
const { WinRMService } = require('../../../services/winrmService');

let winrmService = null;
const sessionSenders = new Map();

function initWinRmIpcHandler(settings, log, terminalMap) {
  winrmService = new WinRMService(log);

  winrmService.on('output', ({ id, data }) => {
    const sender = sessionSenders.get(id);
    if (sender) sender.send('terminal.output', { id, data });
  });

  winrmService.on('error', ({ id, error }) => {
    const sender = sessionSenders.get(id);
    if (sender) sender.send('error', { category: 'winrm', id, error });
  });

  winrmService.on('opened', ({ id }) => {
    const sender = sessionSenders.get(id);
    if (sender) sender.send('terminal.opened', { id });
  });

  winrmService.on('closed', ({ id }) => {
    sessionSenders.delete(id);
  });

  ipcMain.on('session.open.terminal.winrm', (event, data) => {
    if (process.platform !== 'win32') {
      log.error('WinRM is only supported on Windows platforms.');
      event.sender.send('error', {
        category: 'winrm',
        error: 'WinRM is only supported on Windows platforms.',
      });
      return;
    }

    sessionSenders.set(data.terminalId, event.sender);

    const session = winrmService.connect(data.config, {
      id: data.terminalId,
      initPath: data.initPath,
      initCmd: data.initCmd,
      settings,
    });

    terminalMap.set(data.terminalId, {
      type: 'winrm',
      process: session.process,
      callback: (data) => winrmService.write(data.terminalId, data),
    });
  });

  ipcMain.on('session.close.terminal.winrm', (event, data) => {
    winrmService.disconnect(data.terminalId);
    sessionSenders.delete(data.terminalId);
  });
}

module.exports = { initWinRmIpcHandler };
