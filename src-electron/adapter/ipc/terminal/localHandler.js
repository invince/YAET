const { ipcMain } = require('electron');
const { LocalTerminalSession } = require('../../../runtime/connectors/terminal/local');

function initLocalTerminalIpcHandler(settings, log, terminalMap, registry) {

  ipcMain.on('session.open.terminal.local', (event, data) => {
    const session = new LocalTerminalSession(log);

    session.on('output', ({ data: output }) => {
      event.sender.send('terminal.output', { id: data.terminalId, data: output });
    });

    session.connect(data.config || {}).then(() => {
      terminalMap.set(data.terminalId, {
        type: 'local',
        process: session.process,
        callback: (input) => session.write(input),
      });
      if (registry) registry.register(data.terminalId, 'local', 'user', session);
    }).catch((err) => {
      event.sender.send('error', { category: 'local', id: data.terminalId, error: err.message });
    });
  });

  ipcMain.on('session.close.terminal.local', (event, data) => {
    const entry = registry ? registry.get(data.terminalId) : null;
    const session = entry ? entry.session : null;
    if (session) session.close();
    if (registry) registry.unregister(data.terminalId);
  });
}

module.exports = { initLocalTerminalIpcHandler };
