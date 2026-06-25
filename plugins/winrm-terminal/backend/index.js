/**
 * WinRM Terminal Plugin - Backend Entry
 *
 * Migrated from src-electron/adapter/ipc/terminal/winRMHandler.js
 */
const { WinRMSession } = require('./winRM.connector');

function register(context) {
  const { ipcMain, logger, sessionRegistry, terminalMap, runtimeAPI } = context;

  const projectRequire = context.projectRequire;

  const api = typeof runtimeAPI === 'function' ? runtimeAPI() : runtimeAPI;
  if (api) {
    api.registerConnector('WIN_RM_TERMINAL', (log) => {
      return new WinRMSession(log, projectRequire);
    });
    api.registerConfigResolver('WIN_RM_TERMINAL', (connProfile, { secretId, secretRepo }) => {
      const config = {
        host: connProfile.host,
        port: connProfile.port || 5985,
        executionPolicy: 'Bypass',
        noProfile: true,
      };
      const sid = secretId || connProfile.secretId;
      if (connProfile.authType === 'login' || connProfile.authType === 'LOGIN') {
        config.username = connProfile.login;
        config.password = connProfile.password;
      } else if ((connProfile.authType === 'secret' || connProfile.authType === 'SECRET' || secretId) && sid) {
        const secrets = typeof secretRepo === 'function' ? secretRepo() : secretRepo;
        if (secrets && secrets.secrets) {
          const secret = secrets.secrets.find(s => s.id === sid);
          if (secret) {
            if (secret.secretType === 'LOGIN_PASSWORD' || secret.secretType === 'login_password') {
              config.username = secret.login;
              config.password = secret.password;
            } else if (secret.secretType === 'PASSWORD_ONLY' || secret.secretType === 'password_only') {
              config.password = secret.password;
              if (secret.login) config.username = secret.login;
            }
          }
        }
      } else if (connProfile.login) {
        config.username = connProfile.login;
      }
      return config;
    });
  }

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
          resize: (cols, rows) => session.process?.resize(cols, rows),
          close: () => { try { session.close(); } catch { /* ignore */ } },
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
