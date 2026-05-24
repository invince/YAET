const { Telnet } = require('telnet-client');
const { ProxyService } = require('../../../services/proxyService');
const { TerminalRuntimeApi } = require('../../interfaces/terminalRuntimeApi');

class TelnetSession extends TerminalRuntimeApi {
  constructor(log, config) {
    super();
    this.log = log;
    this._initialConfig = config || null;
    this.client = null;
    this._inputBuffer = '';
    this._isLoginPrompt = false;
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
      const message = data.toString();
      if (message.toLowerCase().includes('login:') || message.toLowerCase().includes('username:')) {
        this._isLoginPrompt = true;
      }
      this.emit('output', { data: message });
    });

    this._connected = true;
    this.emit('output', { data: 'Connected to Telnet server.' });
  }

  async write(data) {
    if (!this.client) return false;

    if (data === '\r') {
      if (this._isLoginPrompt) {
        this._isLoginPrompt = false;
      }
      await this.client.send(this._inputBuffer);
      this.emit('output', { data: '\r' });
      this._inputBuffer = '';
    } else if (data === '\x7F' || data === '\b') {
      if (this._inputBuffer.length > 0) {
        this._inputBuffer = this._inputBuffer.slice(0, -1);
        this.emit('output', { data: '\b \b' });
      }
    } else {
      this._inputBuffer += data;
      if (!this._isLoginPrompt) {
        this.emit('output', { data });
      }
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

    try {
      const shellPrompt = await telnet.exec(command, { timeout: 15000 });
      const stdout = shellPrompt || '';
      return { stdout, stderr: '', exitCode: 0 };
    } catch (err) {
      if (err.message && err.message.includes('timeout')) {
        return { stdout: '', stderr: err.message, exitCode: 1 };
      }
      throw err;
    } finally {
      if (ownsConnection) {
        telnet.end();
      }
    }
  }
}

module.exports = { TelnetSession };
