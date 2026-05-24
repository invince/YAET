const { ipcMain } = require('electron');
const { LocalTerminalSession } = require('../../../runtime/connectors/terminal/local');

const sessions = new Map();

function initLocalTerminalIpcHandler(settings, log, terminalMap) {

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
      sessions.set(data.terminalId, session);
    }).catch((err) => {
      event.sender.send('error', { category: 'local', id: data.terminalId, error: err.message });
    });
  });

  ipcMain.on('session.close.terminal.local', (event, data) => {
    const session = sessions.get(data.terminalId);
    if (session) session.close();
    sessions.delete(data.terminalId);
  });
}

module.exports = { initLocalTerminalIpcHandler };
