const { ipcMain } = require('electron');
const { SSHService } = require('../../services/sshService');

let sshService = null;
const sessionSenders = new Map();

function initSSHTerminalIpcHandler(log, terminalMap, getProxies, getSecrets) {
  sshService = new SSHService(log);

  sshService.on('output', ({ id, data }) => {
    const sender = sessionSenders.get(id);
    if (sender) sender.send('terminal.output', { id, data });
  });

  sshService.on('error', ({ id, error }) => {
    const sender = sessionSenders.get(id);
    if (sender) sender.send('error', { category: 'ssh', id, error });
  });

  sshService.on('disconnect', ({ id, error }) => {
    const sender = sessionSenders.get(id);
    if (sender) sender.send('session.disconnect.terminal.ssh', { id, error: !!error });
    sessionSenders.delete(id);
  });

  ipcMain.on('session.close.terminal.ssh', (event, data) => {
    sshService.disconnect(data.terminalId);
    sessionSenders.delete(data.terminalId);
  });

  ipcMain.on('session.open.terminal.ssh', async (event, data) => {
    sessionSenders.set(data.terminalId, event.sender);

    try {
      await sshService.connect(data.config, {
        id: data.terminalId,
        proxyId: data.proxyId,
        initPath: data.initPath,
        initCmd: data.initCmd,
        getProxies,
        getSecrets,
        rows: data.terminalId ? terminalMap.get(data.terminalId)?.rows : undefined,
        cols: data.terminalId ? terminalMap.get(data.terminalId)?.cols : undefined,
      });

      const session = sshService.sessions.get(data.terminalId);
      if (session) {
        terminalMap.set(data.terminalId, {
          type: 'ssh',
          process: session.process,
          stream: session.stream,
          callback: (input, id) => sshService.write(id, input),
        });
      }
    } catch (error) {
      event.sender.send('error', {
        category: 'ssh',
        id: data.terminalId,
        error: error.message,
      });
      sessionSenders.delete(data.terminalId);
    }
  });
}

module.exports = { initSSHTerminalIpcHandler };
