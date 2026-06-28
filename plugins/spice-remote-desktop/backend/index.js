const { SpiceDesktop } = require('./spice.connector');

const sessionSenders = new Map();

function register(context) {
  const { ipcMain, logger, sessionRegistry, runtimeAPI } = context;

  const api = typeof runtimeAPI === 'function' ? runtimeAPI() : runtimeAPI;
  if (api) {
    api.registerConnector('SPICE_REMOTE_DESKTOP', (log, config) => {
      return new SpiceDesktop(log, config);
    });
    api.registerConfigResolver('SPICE_REMOTE_DESKTOP', (connProfile) => {
      return {
        host: connProfile.host,
        port: connProfile.port || 5900,
      };
    });
  }

  ipcMain.handle('session.open.rd.spice', async (event, { id, host, port, tls }) => {
    sessionSenders.set(id, event.sender);
    logger.info(`SPICE config received: host="${host}" port=${port} tls=${!!tls}`);
    const desktop = new SpiceDesktop(logger, { host, port, tls: !!tls });

    desktop.on('connected', () => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('session.connect.rd.spice', { id });
    });

    desktop.on('disconnected', () => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('session.disconnect.rd.spice', { id });
    });

    desktop.on('error', (error) => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('error', { category: 'spice', id, error });
    });

    const { proxyPort: wsPort } = await desktop.connect();
    const registry = typeof sessionRegistry === 'function'
      ? sessionRegistry() : sessionRegistry;
    if (registry) registry.register(id, 'spice', 'user', desktop);
    return wsPort;
  });

  ipcMain.on('session.disconnect.rd.spice', (event, { id }) => {
    const registry = typeof sessionRegistry === 'function'
      ? sessionRegistry() : sessionRegistry;
    const entry = registry ? registry.get(id) : null;
    const desktop = entry ? entry.session : null;
    if (desktop) desktop.disconnect();
    if (registry) registry.unregister(id);
    sessionSenders.delete(id);
  });

  logger.info('[spice-remote-desktop] Plugin registered');
}

module.exports = { register };
