/**
 * SSH Terminal Connector - Plugin version
 *
 * Migrated from src-electron/runtime/connectors/terminal/ssh.js
 * References core services via relative paths from plugins/ directory.
 */
const { Client } = require('ssh2');
const { ProxyService } = require('../../../src-electron/services/proxyService');
const { TerminalRuntimeApi } = require('../../../src-electron/runtime/interfaces/terminalRuntimeApi');

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
    const { proxy, secretRepo, initPath, initCmd, rows, cols, id, jumper, ...sshConfig } = merged;

    // P2: SSH wire-protocol debug is chatty — only attach it when explicitly
    // enabled via SSH_DEBUG=1, and log at debug level (off by default).
    if (process.env.SSH_DEBUG === '1' || process.env.SSH_DEBUG === 'true') {
      sshConfig.debug = (info) => {
        this.log.debug('SSH DEBUG:', info);
      };
    }

    if (proxy && proxy.id) {
      try {
        this.log.info(`SSH session: Using proxy ${proxy.name || proxy.id}`);
        const proxyService = new ProxyService(this.log);
        const sock = await proxyService.createProxyConnection(
          proxy,
          sshConfig.host,
          sshConfig.port || 22,
          secretRepo
        );
        sshConfig.sock = sock;
        this.log.info('SSH session: Proxy tunnel established');
      } catch (error) {
        this.log.error('SSH session: Proxy connection failed:', error);
        this.emit('error', { error: `Proxy connection failed: ${error.message}` });
        throw error;
      }
    }

    // Bastion/jumper host: connect to the jump host first, then open a
    // direct-tcpip channel (forwardOut) to the final target and dial through it.
    if (jumper && jumper.host && !sshConfig.sock) {
      try {
        this.log.info(`SSH session: Using jumper ${jumper.host}:${jumper.port || 22}`);
        const sock = await this._openJumperChannel(jumper, sshConfig.host, sshConfig.port || 22);
        sshConfig.sock = sock;
        this.log.info('SSH session: Jumper channel established');
      } catch (error) {
        this.log.error('SSH session: Jumper connection failed:', error);
        this.emit('error', { error: `Jumper connection failed: ${error.message}` });
        throw error;
      }
    }

    return new Promise((resolve, reject) => {
      const conn = new Client();

      conn.on('ready', () => {
        this.log.info('SSH session ready');
        const ptyCols = Number(cols) > 0 ? Number(cols) : 80;
        const ptyRows = Number(rows) > 0 ? Number(rows) : 24;
        this.log.info(`SSH pty open requested: cols=${ptyCols} rows=${ptyRows} (raw cols=${cols} rows=${rows})`);
        conn.shell({ term: 'xterm-256color', cols: ptyCols, rows: ptyRows }, (err, stream) => {
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
    this.log.info(`SSH pty resize: cols=${cols} rows=${rows} (streamReady=${!!this.stream})`);
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
    if (this._jumperConn) {
      try { this._jumperConn.end(); } catch { /* ignore */ }
      this._jumperConn = null;
    }
  }

  _connectRaw(config) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => resolve(conn));
      conn.on('error', (err) => reject(err));
      conn.connect(config);
    });
  }

  async _openJumperChannel(jumperConfig, targetHost, targetPort) {
    const { proxy, secretRepo, initPath, initCmd, rows, cols, id, jumper, ...clean } = jumperConfig;
    const jumperConn = await this._connectRaw(clean);
    this._jumperConn = jumperConn;
    return new Promise((resolve, reject) => {
      jumperConn.forwardOut('127.0.0.1', 0, targetHost, targetPort, (err, stream) => {
        if (err) {
          try { jumperConn.end(); } catch { /* ignore */ }
          this._jumperConn = null;
          reject(err);
          return;
        }
        resolve(stream);
      });
    });
  }

  async exec(command, timeoutSeconds = 30) {
    const config = this._initialConfig;
    if (!config) throw new Error('No SSH config available for exec');

    const merged = { ...config };
    const { proxy, secretRepo, jumper, ...sshConfig } = merged;
    if (jumper && jumper.host && !sshConfig.sock) {
      const { proxy: _p, secretRepo: _s, initPath: _a, initCmd: _b, rows: _c, cols: _d, id: _e, jumper: _f, ...clean } = jumper;
      const jumperConn = await this._connectRaw(clean);
      try {
        sshConfig.sock = await new Promise((resolve, reject) => {
          jumperConn.forwardOut('127.0.0.1', 0, sshConfig.host, sshConfig.port || 22, (err, stream) => {
            if (err) reject(err);
            else resolve(stream);
          });
        });
      } catch (err) {
        try { jumperConn.end(); } catch { /* ignore */ }
        throw err;
      }
      // keep jumperConn alive until command finishes; closed in cleanup below
      sshConfig._jumperConn = jumperConn;
    }
    const ms = Math.max(1, Number(timeoutSeconds) || 30) * 1000;

    return new Promise((resolve, reject) => {
      const conn = new Client();
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          conn.end();
          reject(new Error(`SSH command timed out after ${Math.floor(ms / 1000)}s`));
        }
      }, ms);

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          conn.end();
          if (sshConfig._jumperConn) { try { sshConfig._jumperConn.end(); } catch { /* ignore */ } }
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

      const { _jumperConn, ...connectConfig } = sshConfig;
      conn.connect(connectConfig);
    });
  }

  async execWithSudo(command, sudoPassword, timeoutSeconds = 30) {
    const config = this._initialConfig;
    if (!config) throw new Error('No SSH config available for execWithSudo');

    const merged = { ...config };
    const { proxy, secretRepo, jumper, ...sshConfig } = merged;
    if (jumper && jumper.host && !sshConfig.sock) {
      const { proxy: _p2, secretRepo: _s2, initPath: _a2, initCmd: _b2, rows: _c2, cols: _d2, id: _e2, jumper: _f2, ...clean2 } = jumper;
      const jumperConn = await this._connectRaw(clean2);
      try {
        sshConfig.sock = await new Promise((resolve, reject) => {
          jumperConn.forwardOut('127.0.0.1', 0, sshConfig.host, sshConfig.port || 22, (err, stream) => {
            if (err) reject(err);
            else resolve(stream);
          });
        });
      } catch (err) {
        try { jumperConn.end(); } catch { /* ignore */ }
        throw err;
      }
      sshConfig._jumperConn = jumperConn;
    }
    const sq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
    const inner = `sh -c ${sq(command)}`;
    const sudoCmd = sudoPassword ? `printf '%s\\n' ${sq(sudoPassword)} | sudo -S -p '' ${inner}` : `sudo ${inner}`;
    const ms = Math.max(1, Number(timeoutSeconds) || 30) * 1000;

    return new Promise((resolve, reject) => {
      const conn = new Client();
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          conn.end();
          reject(new Error(`SSH sudo command timed out after ${Math.floor(ms / 1000)}s`));
        }
      }, ms);

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          conn.end();
          if (sshConfig._jumperConn) { try { sshConfig._jumperConn.end(); } catch { /* ignore */ } }
        }
      };

      conn.on('ready', () => {
        conn.exec(sudoCmd, (err, stream) => {
          if (err) { cleanup(); reject(err); return; }
          let stdout = '';
          let stderr = '';
          stream.on('close', (code) => {
            cleanup();
            resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
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

      const { _jumperConn: _jc2, ...connectConfig2 } = sshConfig;
      conn.connect(connectConfig2);
    });
  }
}

module.exports = { SshTerminalSession };
