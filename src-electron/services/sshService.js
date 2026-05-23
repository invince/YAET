const { Client } = require('ssh2');
const { ProxyService } = require('./proxyService');
const EventEmitter = require('events');

class SSHService extends EventEmitter {
  constructor(log) {
    super();
    this.log = log;
    this.proxyService = new ProxyService(log);
    this.sessions = new Map();
  }

  async connect(config, options = {}) {
    const { id, proxyId, initPath, initCmd, getProxies, getSecrets } = options;
    const conn = new Client();
    const sshConfig = { ...config };

    sshConfig.debug = (info) => {
      this.log.info('SSH DEBUG:', info);
    };

    if (proxyId && getProxies && getSecrets) {
      try {
        this.log.info(`SSH connection ${id}: Using proxy ${proxyId}`);
        const proxies = getProxies();
        if (proxies && proxies.proxies) {
          const proxy = proxies.proxies.find(p => p.id === proxyId);
          if (proxy) {
            this.log.info(`SSH connection ${id}: Found proxy ${proxy.name} (type: ${proxy.type})`);
            const sock = await this.proxyService.createProxyConnection(
              proxy,
              sshConfig.host,
              sshConfig.port || 22,
              getSecrets
            );
            sshConfig.sock = sock;
            this.log.info(`SSH connection ${id}: Proxy tunnel established`);
          }
        }
      } catch (error) {
        this.log.error(`SSH connection ${id}: Failed to establish proxy connection:`, error);
        this.emit('error', { id, error: `Proxy connection failed: ${error.message}` });
        throw error;
      }
    }

    return new Promise((resolve, reject) => {
      conn.on('ready', () => {
        this.log.info('SSH connection ready for id:', id);
        const shellOptions = { term: 'xterm-256color' };

        conn.shell(shellOptions, (err, stream) => {
          if (err) {
            this.log.error('Error starting shell:', err);
            reject(err);
            return;
          }
          this.log.info('Shell started for id:', id);

          if (initPath) {
            stream.write(`cd ${initPath.replace(/[\r\n]/g, '')}\n`);
          }
          if (initCmd) {
            stream.write(`${initCmd.replace(/[\r\n]/g, '')}\n`);
          }

          stream.on('data', (data) => {
            this.emit('output', { id, data: data.toString() });
          });

          const session = {
            type: 'ssh',
            process: conn,
            stream: stream,
          };

          this.sessions.set(id, session);

          if (options.rows && options.cols) {
            stream.setWindow(options.rows, options.cols, null, null);
          }

          resolve(session);
        });
      });

      conn.connect(sshConfig);

      conn.on('error', (err) => {
        this.log.error('SSH connection error for id:', id, err);
        this.emit('error', { id, error: `SSH connection error: ${err.message}` });
        if (!this.sessions.has(id)) reject(err);
      });

      conn.on('end', () => {
        this.log.info('SSH connection ended for id:', id);
      });

      conn.on('close', (hadError) => {
        this.log.info(`SSH connection closed for id: ${id}, hadError: ${hadError}`);
        this.emit('disconnect', { id, error: hadError });
        this.sessions.delete(id);
      });
    });
  }

  disconnect(id) {
    const session = this.sessions.get(id);
    if (session && session.process) {
      session.process.end();
    }
    this.sessions.delete(id);
    this.log.info('SSH connection ' + id + ' closed');
  }

  write(id, data) {
    const session = this.sessions.get(id);
    if (session && session.stream) {
      session.stream.write(data);
      return true;
    }
    this.log.info('SSH terminal not found for id:', id);
    return false;
  }

  resize(id, cols, rows) {
    const session = this.sessions.get(id);
    if (session && session.stream) {
      session.stream.setWindow(rows, cols, null, null);
    } else if (!session) {
      this.sessions.set(id, { cols, rows });
    }
  }
}

module.exports = { SSHService };
