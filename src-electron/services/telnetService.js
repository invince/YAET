const { Telnet } = require('telnet-client');
const { ProxyService } = require('./proxyService');
const EventEmitter = require('events');

class TelnetService extends EventEmitter {
  constructor(log) {
    super();
    this.log = log;
    this.proxyService = new ProxyService(log);
    this.sessions = new Map();
  }

  async connect(config, options = {}) {
    const { id, proxyId, getProxies, getSecrets } = options;
    const telnetClient = new Telnet();
    const connConfig = { ...config };

    if (proxyId && getProxies && getSecrets) {
      try {
        this.log.info(`Telnet connection ${id}: Using proxy ${proxyId}`);
        const proxies = getProxies();
        if (proxies && proxies.proxies) {
          const proxy = proxies.proxies.find(p => p.id === proxyId);
          if (proxy) {
            this.log.info(`Telnet connection ${id}: Found proxy ${proxy.name} (type: ${proxy.type})`);
            const sock = await this.proxyService.createProxyConnection(
              proxy,
              connConfig.host,
              connConfig.port || 23,
              getSecrets
            );
            connConfig.sock = sock;
            this.log.info(`Telnet connection ${id}: Proxy tunnel established`);
          }
        }
      } catch (error) {
        this.log.error(`Telnet connection ${id}: Failed to establish proxy connection:`, error);
        this.emit('error', { id, error: `Proxy connection failed: ${error.message}` });
        throw error;
      }
    }

    await telnetClient.connect(connConfig);

    this.log.info(`Telnet connection ${id} established`);

    let isLoginPrompt = false;
    let inputBuffer = '';

    telnetClient.on('data', (data) => {
      const message = data.toString();
      if (message.toLowerCase().includes('login:') || message.toLowerCase().includes('username:')) {
        isLoginPrompt = true;
      }
      this.emit('output', { id, data: message });
    });

    const session = {
      type: 'telnet',
      process: telnetClient,
      callback: (data) => {
        if (data === '\r') {
          if (isLoginPrompt) {
            isLoginPrompt = false;
          } else {
            inputBuffer += '\r';
          }
          telnetClient.send(inputBuffer).catch((err) => {
            this.log.error(`Error sending data: ${err.message}`);
            this.emit('error', { id, error: `Send failed: ${err.message}` });
          });
          this.emit('output', { id, data: '\r' });
          inputBuffer = '';
        } else if (data === '\x7F' || data === '\b') {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            this.emit('output', { id, data: '\b \b' });
          }
        } else {
          inputBuffer += data;
          if (!isLoginPrompt) {
            this.emit('output', { id, data: data.toString() });
          }
        }
      },
    };

    this.sessions.set(id, session);
    this.emit('output', { id, data: 'Connected to Telnet server.' });
    return session;
  }

  disconnect(id) {
    const session = this.sessions.get(id);
    if (session && session.process) {
      session.process.end();
    }
    this.sessions.delete(id);
    this.log.info('Telnet connection ' + id + ' closed');
  }

  write(id, data) {
    const session = this.sessions.get(id);
    if (session && session.callback) {
      session.callback(data);
      return true;
    }
    return false;
  }
}

module.exports = { TelnetService };
