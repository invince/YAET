/**
 * Telnet Terminal Plugin - Backend Entry
 *
 * Migrated from src-electron/adapter/ipc/terminal/telnetHandler.js
 */
const { TelnetSession } = require('./telnet.connector');

function register(context) {
  const { ipcMain, logger, sessionRegistry, terminalMap, runtimeAPI } = context;

  const api = typeof runtimeAPI === 'function' ? runtimeAPI() : runtimeAPI;
  if (api) {
    api.registerConnector('TELNET_TERMINAL', (log, config) => {
      return new TelnetSession(log, config);
    });
    api.registerConfigResolver('TELNET_TERMINAL', (connProfile, { secretId, secretRepo }) => {
      const config = {
        host: connProfile.host,
        port: connProfile.port || 23,
        negotiationMandatory: false,
        timeout: 15000,
        loginPrompt: /[Ll]ogin|[Uu]ser(|name)[:\s]*$/i,
        passwordPrompt: /[Pp]ass(word|wd)?[:\s]*$/i,
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
          resize: (cols, rows) => { /* telnet doesn't support pty resize */ },
          close: () => { try { session.close(); } catch { /* ignore */ } },
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
