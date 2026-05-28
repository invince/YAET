const { SocksClient } = require('socks');
const net = require('net');
const EventEmitter = require('events');

class ProxyService extends EventEmitter {
  constructor(log) {
    super();
    this.log = log;
  }

  getProxyUrl(proxy, secretRepo) {
    if (!proxy) return null;

    let proxyUrl = '';

    if (proxy.secretId) {
      const secrets = secretRepo();
      if (secrets && secrets.secrets) {
        const secret = secrets.secrets.find(s => s.id === proxy.secretId);
        if (secret && secret.login && secret.password) {
          const username = encodeURIComponent(secret.login);
          const password = encodeURIComponent(secret.password);
          proxyUrl = `http://${username}:${password}@${proxy.host}:${proxy.port}`;
          return proxyUrl;
        } else {
          this.log.warn('Secret found for proxy but missing login/password credentials');
        }
      } else {
        this.log.warn('Proxy has secretId but secrets not available');
      }
    }

    return `http://${proxy.host}:${proxy.port}`;
  }

  async createSOCKSConnection(proxy, targetHost, targetPort, secretRepo) {
    if (!proxy) throw new Error('Proxy configuration is required');

    let socksVersion = 5;
    if (proxy.type === 'SOCKS4') socksVersion = 4;

    const options = {
      proxy: {
        host: proxy.host,
        port: proxy.port,
        type: socksVersion
      },
      command: 'connect',
      destination: {
        host: targetHost,
        port: targetPort
      }
    };

    if (proxy.secretId) {
      const secrets = secretRepo();
      if (secrets && secrets.secrets) {
        const secret = secrets.secrets.find(s => s.id === proxy.secretId);
        if (secret && secret.login && secret.password) {
          options.proxy.userId = secret.login;
          options.proxy.password = secret.password;
          this.log.info(`Using authenticated SOCKS${socksVersion} proxy: ${proxy.host}:${proxy.port}`);
        } else {
          this.log.warn('Proxy has secretId but secret not found or incomplete');
        }
      }
    } else {
      this.log.info(`Using SOCKS${socksVersion} proxy: ${proxy.host}:${proxy.port}`);
    }

    try {
      const info = await SocksClient.createConnection(options);
      return info.socket;
    } catch (error) {
      this.log.error(`Failed to create SOCKS connection: ${error.message}`);
      throw error;
    }
  }

  createHTTPProxyConnection(proxy, targetHost, targetPort, secretRepo) {
    return new Promise((resolve, reject) => {
      const proxySocket = net.connect(proxy.port, proxy.host, () => {
        this.log.info(`Connected to HTTP proxy: ${proxy.host}:${proxy.port}`);

        let authHeader = '';
        if (proxy.secretId) {
          const secrets = secretRepo();
          if (secrets && secrets.secrets) {
            const secret = secrets.secrets.find(s => s.id === proxy.secretId);
            if (secret && secret.login && secret.password) {
              const credentials = Buffer.from(`${secret.login}:${secret.password}`).toString('base64');
              authHeader = `Proxy-Authorization: Basic ${credentials}\r\n`;
              this.log.info('Using authenticated HTTP proxy');
            }
          }
        }

        const connectRequest =
          `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
          `Host: ${targetHost}:${targetPort}\r\n` +
          authHeader +
          `\r\n`;

        proxySocket.write(connectRequest);

        let responseData = '';
        const onData = (data) => {
          responseData += data.toString();
          if (responseData.includes('\r\n\r\n')) {
            proxySocket.removeListener('data', onData);
            const statusLine = responseData.split('\r\n')[0];
            const statusCode = parseInt(statusLine.split(' ')[1]);
            if (statusCode === 200) {
              this.log.info(`HTTP CONNECT tunnel established to ${targetHost}:${targetPort}`);
              resolve(proxySocket);
            } else {
              proxySocket.destroy();
              this.log.error(`HTTP proxy CONNECT failed. Status: ${statusCode}`);
              reject(new Error(`HTTP proxy CONNECT failed with status ${statusCode}: ${statusLine}`));
            }
          }
        };
        proxySocket.on('data', onData);
      });

      proxySocket.on('error', (err) => {
        this.log.error(`HTTP proxy connection error: ${err.message}`);
        reject(err);
      });

      proxySocket.on('timeout', () => {
        proxySocket.destroy();
        reject(new Error('HTTP proxy connection timeout'));
      });

      proxySocket.setTimeout(30000);
    });
  }

  async createProxyConnection(proxy, targetHost, targetPort, secretRepo) {
    if (!proxy) throw new Error('Proxy configuration is required');

    if (proxy.type === 'HTTP') {
      return await this.createHTTPProxyConnection(proxy, targetHost, targetPort, secretRepo);
    } else if (proxy.type === 'SOCKS4' || proxy.type === 'SOCKS5') {
      return await this.createSOCKSConnection(proxy, targetHost, targetPort, secretRepo);
    } else {
      throw new Error(`Unsupported proxy type: ${proxy.type}`);
    }
  }
}

module.exports = { ProxyService };
