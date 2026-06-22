/**
 * WinRM Terminal Plugin - Backend Entry
 *
 * Migrated from src-electron/adapter/ipc/terminal/winRMHandler.js
 */
const { WinRMSession } = require('./winRM.connector');

function register(context) {
  const { ipcMain, logger, sessionRegistry, terminalMap } = context;

  ipcMain.on('session.open.terminal.winrm', async (event, data) => {
    if (process.platform !== 'win32') {
      logger.error('WinRM is only supported on Windows platforms.');
      event.sender.send('error', {
        category: 'winrm',
        error: 'WinRM is only supported on Windows platforms.',
      });
      return;
    }

    const session = new WinRMSession(logger, context.projectRequire);

    session.on('output', ({ data: output }) => {
      event.sender.send('terminal.output', { id: data.terminalId, data: output });
    });

    session.on('error', ({ error }) => {
      event.sender.send('error', { category: 'winrm', id: data.terminalId, error });
    });

    session.on('opened', () => {
      event.sender.send('terminal.opened', { id: data.terminalId });
    });

    try {
      const getSettings = typeof context.settings === 'function' ? context.settings : () => context.settings;
      const settings = getSettings();

      await session.connect({
        ...data.config,
        settings,
        initPath: data.initPath,
        initCmd: data.initCmd,
        rows: data.rows,
        cols: data.cols,
      });

      if (terminalMap) {
        terminalMap.set(data.terminalId, {
          type: 'winrm',
          process: session.process,
          callback: (input) => session.write(input),
        });
      }

      const registry = typeof sessionRegistry === 'function' ? sessionRegistry() : sessionRegistry;
      if (registry) registry.register(data.terminalId, 'winrm', 'user', session);
    } catch (err) {
      event.sender.send('error', { category: 'winrm', id: data.terminalId, error: err.message });
    }
  });

  ipcMain.on('session.close.terminal.winrm', (event, data) => {
    const registry = typeof sessionRegistry === 'function' ? sessionRegistry() : sessionRegistry;
    const entry = registry ? registry.get(data.terminalId) : null;
    if (entry?.session) entry.session.close();
    if (registry) registry.unregister(data.terminalId);
  });

  logger.info('[winrm-terminal] Plugin registered');
}

module.exports = { register };
