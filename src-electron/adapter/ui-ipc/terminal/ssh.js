const { ipcMain } = require('electron');
const { SshTerminalSession } = require('../../../runtime/connectors/terminal/ssh');

const sessions = new Map();

function initSSHTerminalIpcHandler(log, terminalMap, getProxies, getSecrets) {

  ipcMain.on('session.open.terminal.ssh', async (event, data) => {
    const session = new SshTerminalSession(log);

    session.on('output', ({ data: output }) => {
      event.sender.send('terminal.output', { id: data.terminalId, data: output });
    });

    session.on('error', ({ error }) => {
      event.sender.send('error', { category: 'ssh', id: data.terminalId, error });
    });

    session.on('disconnect', ({ error }) => {
      event.sender.send('session.disconnect.terminal.ssh', { id: data.terminalId, error: !!error });
      sessions.delete(data.terminalId);
    });

    try {
      let proxy = null;
      if (data.proxyId && getProxies) {
        const proxies = getProxies();
        if (proxies && proxies.proxies) {
          proxy = proxies.proxies.find(p => p.id === data.proxyId);
        }
      }

      await session.connect({
        ...data.config,
        proxy,
        getSecrets,
        id: data.terminalId,
        initPath: data.initPath,
        initCmd: data.initCmd,
        rows: data.terminalId ? terminalMap.get(data.terminalId)?.rows : undefined,
        cols: data.terminalId ? terminalMap.get(data.terminalId)?.cols : undefined,
      });

      terminalMap.set(data.terminalId, {
        type: 'ssh',
        process: session.conn,
        stream: session.stream,
        callback: (input) => session.write(input),
      });

      sessions.set(data.terminalId, session);
    } catch (error) {
      event.sender.send('error', {
        category: 'ssh',
        id: data.terminalId,
        error: error.message,
      });
      sessions.delete(data.terminalId);
    }
  });

  ipcMain.on('session.close.terminal.ssh', (event, data) => {
    const session = sessions.get(data.terminalId);
    if (session) session.close();
    sessions.delete(data.terminalId);
  });
}

module.exports = { initSSHTerminalIpcHandler };
