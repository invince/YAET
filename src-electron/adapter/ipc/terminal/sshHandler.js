const { ipcMain } = require('electron');
const { SshTerminalSession } = require('../../../runtime/connectors/terminal/ssh');

function initSSHTerminalIpcHandler(log, terminalMap, proxyRepo, secretRepo, registry) {

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
    });

    try {
      let proxy = null;
      if (data.proxyId && proxyRepo) {
        const proxies = proxyRepo();
        if (proxies && proxies.proxies) {
          proxy = proxies.proxies.find(p => p.id === data.proxyId);
        }
      }

      await session.connect({
        ...data.config,
        proxy,
        secretRepo,
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

      if (registry) registry.register(data.terminalId, 'ssh', 'user', session);
    } catch (error) {
      event.sender.send('error', {
        category: 'ssh',
        id: data.terminalId,
        error: error.message,
      });
    }
  });

  ipcMain.on('session.close.terminal.ssh', (event, data) => {
    const entry = registry ? registry.get(data.terminalId) : null;
    const session = entry ? entry.session : null;
    if (session) session.close();
    if (registry) registry.unregister(data.terminalId);
  });
}

module.exports = { initSSHTerminalIpcHandler };
