const { VncDesktop } = require('./vnc.connector');

const sessionSenders = new Map();

function register(context) {
  const { ipcMain, logger, sessionRegistry, runtimeAPI } = context;

  const api = typeof runtimeAPI === 'function' ? runtimeAPI() : runtimeAPI;
  if (api) {
    api.registerConnector('VNC_REMOTE_DESKTOP', (log, config) => {
      return new VncDesktop(log, config);
    });
  }

  ipcMain.handle('session.open.rd.vnc', async (event, { id, host, port }) => {
    sessionSenders.set(id, event.sender);
    const desktop = new VncDesktop(logger, { host, port });

    desktop.on('connected', () => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('session.connect.rd.vnc', { id });
    });

    desktop.on('disconnected', () => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('session.disconnect.rd.vnc', { id });
    });

    desktop.on('error', (error) => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('error', { category: 'vnc', id, error });
    });

    const { proxyPort } = await desktop.connect();
    const registry = typeof sessionRegistry === 'function'
      ? sessionRegistry() : sessionRegistry;
    if (registry) registry.register(id, 'vnc', 'user', desktop);
    return proxyPort;
  });

  ipcMain.on('session.disconnect.rd.vnc', (event, { id }) => {
    const registry = typeof sessionRegistry === 'function'
      ? sessionRegistry() : sessionRegistry;
    const entry = registry ? registry.get(id) : null;
    const desktop = entry ? entry.session : null;
    if (desktop) desktop.disconnect();
    if (registry) registry.unregister(id);
    sessionSenders.delete(id);
  });

  logger.info('[vnc-remote-desktop] Plugin registered');
}

module.exports = { register };
