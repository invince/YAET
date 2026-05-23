const { ipcMain } = require('electron');
const { LocalTerminalService } = require('../../services/localTerminalService');

let localTerminalService = null;
const sessionSenders = new Map();

function initLocalTerminalIpcHandler(settings, log, terminalMap) {
  localTerminalService = new LocalTerminalService(log);

  localTerminalService.on('output', ({ id, data }) => {
    const sender = sessionSenders.get(id);
    if (sender) sender.send('terminal.output', { id, data });
  });

  ipcMain.on('session.close.terminal.local', (event, data) => {
    localTerminalService.disconnect(data.terminalId);
    sessionSenders.delete(data.terminalId);
  });

  ipcMain.on('session.open.terminal.local', (event, data) => {
    sessionSenders.set(data.terminalId, event.sender);

    const session = localTerminalService.connect(data.config || {}, {
      id: data.terminalId,
    });

    terminalMap.set(data.terminalId, {
      type: 'local',
      process: session.process,
      callback: (data) => localTerminalService.write(data.terminalId, data),
    });
  });
}

module.exports = { initLocalTerminalIpcHandler };
