const EventEmitter = require('events');

class SpiceDesktop extends EventEmitter {
  constructor(log, config) {
    super();
    this.log = log;
    this.config = config;
    this.wss = null;
  }

  async connect() {
    const { host, port, tls: useTls } = this.config;
    const WebSocket = this._ws;
    const findFreePorts = this._findFreePorts;
    const net = this._net;
    const tls = this._tls;
    const [freePort] = await findFreePorts(1, { startPort: 6900 });

    this.wss = new WebSocket.Server({ port: freePort });

    this.wss.on('connection', async (ws) => {
      this.log.info('New WebSocket connection for SPICE');

      let spiceSocket;
      let messageBuffer = [];

      const flushBuffer = () => {
        if (messageBuffer.length > 0) {
          this.log.info(`Flushing ${messageBuffer.length} buffered message(s)`);
          for (const msg of messageBuffer) {
            spiceSocket.write(msg);
          }
          messageBuffer = [];
        }
      };

      const onConnect = () => {
        this.log.info(`TCP/TLS connection established to ${host}:${port}`);
        flushBuffer();
        this.emit('connected');
      };

      try {
        if (useTls) {
          spiceSocket = tls.connect({ host, port, rejectUnauthorized: false }, onConnect);
        } else {
          spiceSocket = net.createConnection(port, host, onConnect);
        }
      } catch (err) {
        this.log.error('SPICE connection error:', err.message);
        this.emit('error', `SPICE connection error: ${err.message}`);
        try { ws.close(); } catch (e) { }
        return;
      }

      ws.on('message', (message) => {
        if (spiceSocket && spiceSocket.readyState === 'open') {
          spiceSocket.write(message);
        } else {
          messageBuffer.push(message);
        }
      });

      spiceSocket.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      ws.on('close', () => {
        this.log.info('WebSocket connection closed');
        this.emit('disconnected');
        messageBuffer = [];
        spiceSocket.end();
      });

      spiceSocket.on('close', () => {
        this.log.info('SPICE connection closed');
        messageBuffer = [];
        spiceSocket.end();
        try { ws.close(); } catch (e) { }
      });

      spiceSocket.on('error', (err) => {
        this.log.error('SPICE socket error:', err.message);
        this.emit('error', `SPICE socket error: ${err.message}`);
        try { ws.close(); } catch (e) { }
      });

      ws.on('error', (err) => {
        this.log.error('WebSocket error:', err.message);
        this.emit('error', `WebSocket error: ${err.message}`);
        spiceSocket.end();
      });
    });

    this.log.info(`SPICE WebSocket proxy running on ws://localhost:${freePort}`);
    return { proxyPort: freePort };
  }

  async disconnect() {
    if (this.wss) {
      this.wss.close(() => {
        this.log.info('SPICE WebSocket server closed');
      });
      this.wss = null;
    }
  }
}

function register(context) {
  const { ipcMain, logger } = context;
  const pr = context.projectRequire;

  const sessionSenders = new Map();
  const listeners = new Map();

  ipcMain.handle('session.open.rd.spice', async (event, { id, host, port, tls }) => {
    sessionSenders.set(id, event.sender);
    logger.info(`SPICE: host="${host}" port=${port} tls=${!!tls}`);

    const desktop = new SpiceDesktop(logger, { host, port, tls: !!tls });
    desktop._ws = pr('ws');
    desktop._findFreePorts = pr('find-free-ports');
    desktop._net = pr('net');
    desktop._tls = pr('tls');

    const onConnected = () => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('session.connect.rd.spice', { id });
    };

    const onDisconnected = () => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('session.disconnect.rd.spice', { id });
    };

    const onError = (error) => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('error', { category: 'spice', id, error });
    };

    desktop.on('connected', onConnected);
    desktop.on('disconnected', onDisconnected);
    desktop.on('error', onError);

    const { proxyPort } = await desktop.connect();
    listeners.set(id, { desktop, onConnected, onDisconnected, onError });
    return proxyPort;
  });

  ipcMain.on('session.disconnect.rd.spice', (event, { id }) => {
    const entry = listeners.get(id);
    if (entry) {
      entry.desktop.removeListener('connected', entry.onConnected);
      entry.desktop.removeListener('disconnected', entry.onDisconnected);
      entry.desktop.removeListener('error', entry.onError);
      entry.desktop.disconnect();
      listeners.delete(id);
    }
    sessionSenders.delete(id);
  });

  logger.info('[spice-remote-desktop] Plugin registered');
}

module.exports = { register };
