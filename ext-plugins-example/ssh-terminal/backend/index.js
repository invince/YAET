/**
 * Demo SSH Plugin — Backend (self-contained)
 *
 * Uses its own SSH connector, no dependency on bundled plugins.
 */
const {SshTerminalSession} = require('./ssh.connector');

function register(context) {
  const {ipcMain, logger, sessionRegistry} = context;
  const terminalMap = context.terminalMap;

  ipcMain.on('session.open.terminal.ssh', async (event, data) => {
    const session = new SshTerminalSession(logger, context.projectRequire);

    session.on('output', ({data: output}) => {
      event.sender.send('terminal.output', {id: data.terminalId, data: output});
    });

    session.on('error', ({error}) => {
      event.sender.send('error', {category: 'ssh', id: data.terminalId, error});
    });

    session.on('disconnect', ({error}) => {
      event.sender.send('session.disconnect.terminal.ssh', {id: data.terminalId, error: !!error});
    });

    try {
      let proxy = null;
      if (data.proxyId && context.proxyService) {
        const proxies = typeof context.proxyService === 'function' ? context.proxyService() : context.proxyService;
        if (proxies && proxies.proxies) proxy = proxies.proxies.find(p => p.id === data.proxyId);
      }

      const secretRepo = typeof context.secretService === 'function' ? context.secretService() : context.secretService;

      const proxyService = typeof context.proxyService === 'function' ? context.proxyService() : context.proxyService;

      await session.connect({
        ...data.config, proxy, proxyService, secretRepo, id: data.terminalId,
        initPath: data.initPath, initCmd: data.initCmd,
        rows: data.rows, cols: data.cols,
      });

      const registry = typeof sessionRegistry === 'function' ? sessionRegistry() : sessionRegistry;
      if (registry) registry.register(data.terminalId, 'ssh', 'user', session);

      if (terminalMap) {
        terminalMap.set(data.terminalId, {
          type: 'ssh', process: session.conn, stream: session.stream,
          callback: (input) => session.write(input),
        });
      }
    } catch (error) {
      event.sender.send('error', {category: 'ssh', id: data.terminalId, error: error.message});
    }
  });

  ipcMain.on('session.close.terminal.ssh', (event, data) => {
    const registry = typeof sessionRegistry === 'function' ? sessionRegistry() : sessionRegistry;
    const entry = registry ? registry.get(data.terminalId) : null;
    if (entry?.session) entry.session.close();
    if (registry) registry.unregister(data.terminalId);
  });

  logger.info('[ssh-terminal] Plugin registered');
}

module.exports = {register};
