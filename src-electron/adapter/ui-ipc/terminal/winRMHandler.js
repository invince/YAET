const { ipcMain } = require('electron');
const { WinRMSession } = require('../../../runtime/connectors/terminal/winRM');

const sessions = new Map();

function initWinRmIpcHandler(settings, log, terminalMap) {

  ipcMain.on('session.open.terminal.winrm', (event, data) => {
    if (process.platform !== 'win32') {
      log.error('WinRM is only supported on Windows platforms.');
      event.sender.send('error', {
        category: 'winrm',
        error: 'WinRM is only supported on Windows platforms.',
      });
      return;
    }

    const session = new WinRMSession(log);

    session.on('output', ({ data: output }) => {
      event.sender.send('terminal.output', { id: data.terminalId, data: output });
    });

    session.on('error', ({ error }) => {
      event.sender.send('error', { category: 'winrm', id: data.terminalId, error });
    });

    session.on('opened', () => {
      event.sender.send('terminal.opened', { id: data.terminalId });
    });

    session.connect({
      ...data.config,
      settings,
      initPath: data.initPath,
      initCmd: data.initCmd,
    }).then(() => {
      terminalMap.set(data.terminalId, {
        type: 'winrm',
        process: session.process,
        callback: (input) => session.write(input),
      });
      sessions.set(data.terminalId, session);
    }).catch((err) => {
      event.sender.send('error', { category: 'winrm', id: data.terminalId, error: err.message });
    });
  });

  ipcMain.on('session.close.terminal.winrm', (event, data) => {
    const session = sessions.get(data.terminalId);
    if (session) session.close();
    sessions.delete(data.terminalId);
  });
}

module.exports = { initWinRmIpcHandler };
