const WebSocket = require('ws');
const findFreePorts = require('find-free-ports');
const net = require('net');
const EventEmitter = require('events');

class VNCService extends EventEmitter {
  constructor(log) {
    super();
    this.log = log;
    this.vncMap = new Map();
  }

  async startProxy(id, host, port) {
    const proxyPorts = await findFreePorts(1, { startPort: 6900 });
    const proxyPort = proxyPorts[0];

    const wss = new WebSocket.Server({ port: proxyPort });

    wss.on('connection', (ws) => {
      this.log.info('New WebSocket connection');

      this.log.info(`Connect to VNC server ${host}:${port}`);

      const vncSocket = net.createConnection(port, host, () => {
        this.log.info(`Connected to VNC server`);
        this.emit('connected', { id });
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
        this.emit('disconnected', { id });
        vncSocket.end();
      });

      vncSocket.on('close', () => {
        this.log.info('VNC connection closed');
        this.emit('disconnected', { id });
        ws.close();
      });

      vncSocket.on('error', (err) => {
        this.log.error('VNC socket error:', err.message);
        this.emit('error', { id, error: `VNC socket error: ${err.message}` });
        ws.close();
      });

      ws.on('error', (err) => {
        this.log.error('WebSocket error:', err.message);
        this.emit('error', { id, error: `WebSocket error: ${err.message}` });
        vncSocket.end();
      });
    });

    this.log.info(`WebSocket proxy is running on ws://localhost:${proxyPort}`);
    this.vncMap.set(id, wss);

    return proxyPort;
  }

  stopProxy(id) {
    const vncClient = this.vncMap.get(id);
    if (vncClient) {
      vncClient.close(() => {
        this.log.info(`WebSocket server for ID: ${id} closed`);
      });
      this.vncMap.delete(id);
    }
  }
}

module.exports = { VNCService };
