const WebSocket = require('ws');
const findFreePorts = require('find-free-ports');
const net = require('net');
const EventEmitter = require('events');

class VncDesktop extends EventEmitter {
  constructor(log, config) {
    super();
    this.log = log;
    this.config = config;
    this.wss = null;
  }

  async connect() {
    const { host, port } = this.config;
    const proxyPorts = await findFreePorts(1, { startPort: 6900 });
    const proxyPort = proxyPorts[0];

    this.wss = new WebSocket.Server({ port: proxyPort });

    this.wss.on('connection', (ws) => {
      this.log.info('New WebSocket connection');

      const vncSocket = net.createConnection(port, host, () => {
        this.log.info(`Connected to VNC server`);
        this.emit('connected');
      });

      ws.on('message', (message) => {
        if (vncSocket.readyState === 'open') {
          vncSocket.write(message);
        }
      });

      vncSocket.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      ws.on('close', () => {
        this.log.info('WebSocket connection closed');
        this.emit('disconnected');
        vncSocket.end();
      });

      vncSocket.on('close', () => {
        this.log.info('VNC connection closed');
        this.emit('disconnected');
        ws.close();
      });

      vncSocket.on('error', (err) => {
        this.log.error('VNC socket error:', err.message);
        this.emit('error', `VNC socket error: ${err.message}`);
        ws.close();
      });

      ws.on('error', (err) => {
        this.log.error('WebSocket error:', err.message);
        this.emit('error', `WebSocket error: ${err.message}`);
        vncSocket.end();
      });
    });

    this.log.info(`WebSocket proxy is running on ws://localhost:${proxyPort}`);
    return { proxyPort };
  }

  async disconnect() {
    if (this.wss) {
      this.wss.close(() => {
        this.log.info('WebSocket server closed');
      });
      this.wss = null;
    }
  }

  getWss() {
    return this.wss;
  }
}

module.exports = { VncDesktop };
