const { ipcMain } = require('electron');
const { WinRMSession } = require('../../../runtime/connectors/terminal/winRM');

function initWinRmIpcHandler(settings, log, terminalMap, registry) {

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
      if (registry) registry.register(data.terminalId, 'winrm', 'user', session);
    }).catch((err) => {
      event.sender.send('error', { category: 'winrm', id: data.terminalId, error: err.message });
    });
  });

  ipcMain.on('session.close.terminal.winrm', (event, data) => {
    const entry = registry ? registry.get(data.terminalId) : null;
    const session = entry ? entry.session : null;
    if (session) session.close();
    if (registry) registry.unregister(data.terminalId);
  });
}

module.exports = { initWinRmIpcHandler };
