/**
 * Telnet Terminal Connector - Plugin version
 *
 * Migrated from src-electron/runtime/connectors/terminal/telnet.js
 */
const { Telnet } = require('telnet-client');
const { ProxyService } = require('../../../src-electron/services/proxyService');
const { TerminalRuntimeApi } = require('../../../src-electron/runtime/interfaces/terminalRuntimeApi');

class TelnetSession extends TerminalRuntimeApi {
  constructor(log, config) {
    super();
    this.log = log;
    this._initialConfig = config || null;
    this.client = null;
    this._inputBuffer = '';
    this._connected = false;
  }

  async connect(options = {}) {
    const { proxy, secretRepo, ...connConfig } = options;

    this.client = new Telnet();

    if (proxy && proxy.id) {
      this.log.info(`Telnet session: Using proxy ${proxy.name || proxy.id}`);
      const proxyService = new ProxyService(this.log);
      const sock = await proxyService.createProxyConnection(
        proxy,
        connConfig.host,
        connConfig.port || 23,
        secretRepo
      );
      connConfig.sock = sock;
      this.log.info('Telnet session: Proxy tunnel established');
    }

    await this.client.connect(connConfig);
    this.log.info('Telnet connection established');

    this.client.on('data', (data) => {
      this.emit('output', { data: data.toString() });
    });

    this._connected = true;
    this.emit('output', { data: 'Connected to Telnet server.' });
  }

  async write(data) {
    if (!this.client) return false;

    if (data === '\r') {
      if (this._inputBuffer) {
        this.client.send(this._inputBuffer).catch(() => {});
      }
      this._inputBuffer = '';
    } else if (data === '\x7F' || data === '\b') {
      if (this._inputBuffer.length > 0) {
        this._inputBuffer = this._inputBuffer.slice(0, -1);
      }
    } else {
      this._inputBuffer += data;
    }
    return true;
  }

  async resize(cols, rows) {
  }

  async close() {
    if (this.client) {
      this.client.end();
      this.client = null;
      this._connected = false;
    }
  }

  async exec(command) {
    if (!this._initialConfig && !this.client) throw new Error('No telnet config available for exec');

    const config = this._initialConfig;
    let telnet = this.client;
    let ownsConnection = false;

    if (!telnet) {
      telnet = new Telnet();
      await telnet.connect(config);
      ownsConnection = true;
    }

    if (telnet.state !== 'standby') {
      await new Promise((resolve) => {
        const fallback = setTimeout(resolve, 3000);
        telnet.once('ready', () => { clearTimeout(fallback); resolve(); });
      });
    }

    try {
      return await new Promise((resolve) => {
        let collected = '';
        const onData = (data) => { collected += data.toString(); };
        telnet.on('data', onData);

        const timer = setTimeout(() => {
          telnet.removeListener('data', onData);
          resolve({ stdout: collected, stderr: '', exitCode: 0 });
        }, 15000);

        telnet.socket.write(command + '\r\n', () => {});
      });
    } finally {
      if (ownsConnection) {
        telnet.end();
      }
    }
  }
}

module.exports = { TelnetSession };
