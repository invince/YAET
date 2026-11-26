const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const { startProxy } = require('./rdp.proxy');

function isValidHostname(hostname) {
  return typeof hostname === 'string' &&
    hostname.length > 0 &&
    hostname.length <= 253 &&
    /^[a-zA-Z0-9.\-_:]+$/.test(hostname);
}

function register(context) {
  const { ipcMain, logger, sessionRegistry } = context;

  const getRegistry = () => (typeof sessionRegistry === 'function' ? sessionRegistry() : sessionRegistry);
  const proxies = new Map();

  // Windows keeps using the built-in mstsc launcher.
  ipcMain.on('session.open.rd.rdp', (event, { hostname, options }) => {
    if (process.platform !== 'win32') {
      logger.warn('[rdp-remote-desktop] mstsc is Windows-only, use the embedded IronRDP session');
      return;
    }
    launchMSTSC(hostname, options);
  });

  function launchMSTSC(hostname, options = {}) {
    if (!isValidHostname(hostname)) {
      logger.error(`Invalid hostname rejected: ${hostname}`);
      return;
    }
    logger.info('Starting mstsc...');
    const args = [`/v:${hostname}`];
    if (options.fullscreen) args.push('/f');
    if (options.admin) args.push('/admin');

    const child = spawn('mstsc', args, {
      stdio: 'ignore',
      shell: false,
    });
    child.on('error', (error) => {
      logger.error(`Error launching MSTSC: ${error.message}`);
    });
  }

  // Non-Windows platforms embed IronRDP (WASM) and need a WS -> TCP proxy.
  ipcMain.handle('session.open.rd.rdp.wasm', async (event, { id, host, port }) => {
    if (!isValidHostname(host)) {
      throw new Error(`Invalid hostname: ${host}`);
    }
    const targetPort = Number(port) || 3389;

    await stopProxy(id);

    const proxy = await startProxy(logger, { host, port: targetPort }, id);
    const emitter = new EventEmitter();
    emitter.disconnect = () => stopProxy(id);
    emitter.isAlive = () => proxies.has(id);
    proxies.set(id, { proxy, emitter });
    const registry = getRegistry();
    if (registry) {
      registry.register(id, 'rdp', 'user', emitter);
    }
    return proxy.port;
  });

  ipcMain.on('session.disconnect.rd.rdp', (event, { id }) => {
    stopProxy(id).catch((e) => logger.debug(`[rdp-remote-desktop] disconnect error: ${e.message}`));
  });

  async function stopProxy(id) {
    const entry = proxies.get(id);
    if (entry) {
      proxies.delete(id);
      entry.emitter.emit('disconnect');
      try {
        await entry.proxy.close();
      } catch (e) {
        logger.debug(`[rdp-remote-desktop] proxy close error: ${e.message}`);
      }
    }
    const registry = getRegistry();
    if (registry) registry.unregister(id);
  }

  logger.info('[rdp-remote-desktop] Plugin registered');
}

module.exports = { register };
