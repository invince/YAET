const WebSocket = require('ws');
const findFreePorts = require('find-free-ports');
const net = require('net');
const tls = require('tls');
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
    const [freePort] = await findFreePorts(1, { startPort: 6900 });

    this.wss = new WebSocket.Server({ port: freePort });

    this.wss.on('connection', async (ws) => {
      this.log.info('New WebSocket connection for SPICE');

      const onConnect = () => {
        this.log.info(`TCP/TLS connection established to ${host}:${port}`);
        this.emit('connected');
      };

      let spiceSocket;
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
        }
      });

      spiceSocket.on('data', (data) => {
        this.log.info(`SPICE received ${data.length} bytes from server`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      ws.on('close', () => {
        this.log.info('WebSocket connection closed');
        this.emit('disconnected');
        spiceSocket.end();
      });

      spiceSocket.on('close', () => {
        this.log.info('SPICE connection closed');
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

  getWss() {
    return this.wss;
  }
}

module.exports = { SpiceDesktop };
