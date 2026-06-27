/**
 * SSH Terminal Plugin - Backend Entry
 *
 * Registers IPC handlers for SSH terminal sessions.
 * Migrated from src-electron/adapter/ipc/terminal/sshHandler.js
 */
const { SshTerminalSession } = require('./ssh.connector');

function register(context) {
  const { ipcMain, logger, sessionRegistry, runtimeAPI } = context;

  const api = typeof runtimeAPI === 'function' ? runtimeAPI() : runtimeAPI;
  if (api) {
    api.registerConnector('SSH_TERMINAL', (log, config) => {
      return new SshTerminalSession(log, config);
    });
  }

  // terminalMap is the shared map used by terminalHandler.js for resize/input routing
  const terminalMap = context.terminalMap;

  ipcMain.on('session.open.terminal.ssh', async (event, data) => {
    const session = new SshTerminalSession(logger);

    session.on('output', ({ data: output }) => {
      event.sender.send('terminal.output', { id: data.id, data: output });
    });

    session.on('error', ({ error }) => {
      event.sender.send('error', { category: 'ssh', id: data.id, error });
    });

    session.on('disconnect', ({ error }) => {
      event.sender.send('session.disconnect.terminal.ssh', { id: data.id, error: !!error });
    });

    try {
      let proxy = null;
      if (data.proxyId && context.proxyService) {
        const proxies = typeof context.proxyService === 'function' ? context.proxyService() : context.proxyService;
        if (proxies && proxies.proxies) {
          proxy = proxies.proxies.find(p => p.id === data.proxyId);
        }
      }

      const secretRepo = typeof context.secretService === 'function' ? context.secretService() : context.secretService;

      await session.connect({
        ...data.config,
        proxy,
        secretRepo,
        id: data.id,
        initPath: data.initPath,
        initCmd: data.initCmd,
        rows: data.rows,
        cols: data.cols,
      });

      const registry = typeof sessionRegistry === 'function' ? sessionRegistry() : sessionRegistry;
      if (registry) registry.register(data.id, 'ssh', 'user', session);

      // Also register in terminalMap for shared terminalHandler.js (resize/input)
      if (terminalMap) {
        terminalMap.set(data.id, {
          type: 'ssh',
          process: session.conn,
          stream: session.stream,
          callback: (input) => session.write(input),
          resize: (cols, rows) => session.stream?.setWindow(rows, cols, null, null),
          close: () => { try { session.close(); } catch { /* ignore */ } },
        });
      }
    } catch (error) {
      event.sender.send('error', {
        category: 'ssh',
        id: data.id,
        error: error.message,
      });
    }
  });

  ipcMain.on('session.close.terminal.ssh', (event, data) => {
    const registry = typeof sessionRegistry === 'function' ? sessionRegistry() : sessionRegistry;
    const entry = registry ? registry.get(data.id) : null;
    const session = entry ? entry.session : null;
    if (session) session.close();
    if (registry) registry.unregister(data.id);
  });

  logger.info('[ssh-terminal] Plugin registered');
}

module.exports = { register };
