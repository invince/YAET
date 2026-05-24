const { Client } = require('ssh2');
const { ProxyService } = require('../../../services/proxyService');
const { TerminalRuntimeApi } = require('../../interfaces/terminalRuntimeApi');

class SshTerminalSession extends TerminalRuntimeApi {
  constructor(log, sshConfig) {
    super();
    this.log = log;
    this._initialConfig = sshConfig || null;
    this.conn = null;
    this.stream = null;
    this._connected = false;
  }

  async connect(options = {}) {
    const merged = { ...(this._initialConfig || {}), ...options };
    const { proxy, getSecrets, initPath, initCmd, rows, cols, id, ...sshConfig } = merged;

    sshConfig.debug = (info) => {
      this.log.info('SSH DEBUG:', info);
    };

    if (proxy && proxy.id) {
      try {
        this.log.info(`SSH session: Using proxy ${proxy.name || proxy.id}`);
        const proxyService = new ProxyService(this.log);
        const sock = await proxyService.createProxyConnection(
          proxy,
          sshConfig.host,
          sshConfig.port || 22,
          getSecrets
        );
        sshConfig.sock = sock;
        this.log.info('SSH session: Proxy tunnel established');
      } catch (error) {
        this.log.error('SSH session: Proxy connection failed:', error);
        this.emit('error', { error: `Proxy connection failed: ${error.message}` });
        throw error;
      }
    }

    return new Promise((resolve, reject) => {
      const conn = new Client();

      conn.on('ready', () => {
        this.log.info('SSH session ready');
        conn.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            this.log.error('Error starting shell:', err);
            reject(err);
            return;
          }
          this.log.info('SSH shell started');

          if (initPath) {
            stream.write(`cd ${initPath.replace(/[\r\n]/g, '')}\n`);
          }
          if (initCmd) {
            stream.write(`${initCmd.replace(/[\r\n]/g, '')}\n`);
          }

          stream.on('data', (data) => {
            this.emit('output', { data: data.toString() });
          });

          if (rows && cols) {
            stream.setWindow(rows, cols, null, null);
          }

          this.conn = conn;
          this.stream = stream;
          this._connected = true;
          resolve();
        });
      });

      conn.on('error', (err) => {
        this.log.error('SSH session connection error:', err);
        this.emit('error', { error: `SSH connection error: ${err.message}` });
        if (!this._connected) reject(err);
      });

      conn.on('close', (hadError) => {
        this.log.info(`SSH session closed, hadError: ${hadError}`);
        this._connected = false;
        this.conn = null;
        this.stream = null;
        this.emit('disconnect', { error: hadError });
      });

      conn.connect(sshConfig);
    });
  }

  async write(data) {
    if (this.stream) {
      this.stream.write(data);
      return true;
    }
    this.log.info('SSH terminal not connected');
    return false;
  }

  async resize(cols, rows) {
    if (this.stream) {
      this.stream.setWindow(rows, cols, null, null);
    }
  }

  async close() {
    if (this.conn) {
      this.log.info('SSH session closing');
      this.conn.end();
      this.conn = null;
      this.stream = null;
      this._connected = false;
    }
  }

  async exec(command) {
    const config = this._initialConfig;
    if (!config) throw new Error('No SSH config available for exec');

    const merged = { ...config };
    const { proxy, getSecrets, ...sshConfig } = merged;

    return new Promise((resolve, reject) => {
      const conn = new Client();
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          conn.end();
          reject(new Error('SSH command timed out after 30s'));
        }
      }, 30000);

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          conn.end();
        }
      };

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            cleanup();
            reject(err);
            return;
          }
          let stdout = '';
          let stderr = '';
          stream.on('close', (code) => {
            cleanup();
            resolve({ stdout, stderr, exitCode: code });
          });
          stream.on('data', (data) => { stdout += data.toString(); });
          stream.stderr.on('data', (data) => { stderr += data.toString(); });
        });
      });

      conn.on('error', (err) => {
        if (!resolved) {
          cleanup();
          reject(err);
        }
      });

      conn.connect(sshConfig);
    });
  }
}

module.exports = { SshTerminalSession };
