/**
 * Telnet Terminal Plugin - Backend Entry
 *
 * Migrated from src-electron/adapter/ipc/terminal/telnetHandler.js
 */
const { TelnetSession } = require('./telnet.connector');

function register(context) {
  const { ipcMain, logger, sessionRegistry, terminalMap } = context;

  ipcMain.on('session.open.terminal.telnet', async (event, data) => {
    const session = new TelnetSession(logger);

    session.on('output', ({ data: output }) => {
      event.sender.send('terminal.output', { id: data.terminalId, data: output });
    });

    session.on('error', ({ error }) => {
      event.sender.send('error', { category: 'telnet', id: data.terminalId, error });
    });

    try {
      let proxy = null;
      if (data.proxyId && context.proxyService) {
        const proxies = typeof context.proxyService === 'function'
          ? context.proxyService() : context.proxyService;
        if (proxies?.proxies) {
          proxy = proxies.proxies.find(p => p.id === data.proxyId);
        }
      }

      const secretRepo = typeof context.secretService === 'function'
        ? context.secretService() : context.secretService;

      await session.connect({
        ...data.config,
        proxy,
        secretRepo,
      });

      if (terminalMap) {
        terminalMap.set(data.terminalId, {
          type: 'telnet',
          process: session.client,
          callback: (input) => session.write(input),
        });
      }

      const registry = typeof sessionRegistry === 'function'
        ? sessionRegistry() : sessionRegistry;
      if (registry) registry.register(data.terminalId, 'telnet', 'user', session);
    } catch (error) {
      event.sender.send('error', {
        category: 'telnet',
        id: data.terminalId,
        error: error.message,
      });
    }
  });

  ipcMain.on('session.close.terminal.telnet', (event, data) => {
    const registry = typeof sessionRegistry === 'function'
      ? sessionRegistry() : sessionRegistry;
    const entry = registry?.get(data.terminalId);
    if (entry?.session) entry.session.close();
    registry?.unregister(data.terminalId);
  });

  logger.info('[telnet-terminal] Plugin registered');
}

module.exports = { register };
