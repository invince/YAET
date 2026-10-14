/**
 * SSH Terminal Connector - Plugin version
 *
 * Migrated from src-electron/runtime/connectors/terminal/ssh.js
 * References core services via relative paths from plugins/ directory.
 */
const { Client } = require('ssh2');
const { ProxyService } = require('../../../src-electron/services/proxyService');
const { TerminalRuntimeApi } = require('../../../src-electron/runtime/interfaces/terminalRuntimeApi');
const { KnownHostsService, keyInfo } = require('../../../src-electron/services/knownHostsService');

/**
 * Parse the key-type string from a raw SSH public-key blob (wire format:
 * string key-type, ...). ssh2's hostVerifier only hands us the buffer.
 */
function sshKeyType(raw) {
  try {
    if (!Buffer.isBuffer(raw) || raw.length < 4) return 'unknown';
    const len = raw.readUInt32BE(0);
    if (len <= 0 || len > 64 || raw.length < 4 + len) return 'unknown';
    return raw.slice(4, 4 + len).toString('utf8');
  } catch {
    return 'unknown';
  }
}

function hostKeyError(status, leg, host, port, keyType, base64, cause) {
  const err = new Error(
    status === 'CHANGED'
      ? `SSH host key for ${host} has changed — possible man-in-the-middle attack`
      : `Unknown SSH host key for ${host} (not in known_hosts)`,
  );
  err.code = status === 'CHANGED' ? 'HOST_KEY_CHANGED' : 'HOST_KEY_UNKNOWN';
  err.details = { status, leg, host, port, ...keyInfo(keyType, base64) };
  if (cause) err.cause = cause;
  return err;
}

class SshTerminalSession extends TerminalRuntimeApi {
  constructor(log, sshConfig) {
    super();
    this.log = log;
    this._initialConfig = sshConfig || null;
    this.conn = null;
    this.stream = null;
    this._connected = false;
    this._knownHosts = null;
  }

  _knownHostsSvc() {
    if (!this._knownHosts) this._knownHosts = new KnownHostsService(this.log);
    return this._knownHosts;
  }

  /**
   * Build an ssh2 hostVerifier for one leg (target or jumper). Fail-closed:
   * any key that is not pinned in known_hosts (and not the one-shot
   * modal-approved key) records a classified failure and rejects the
   * handshake. The caller turns `collector.failure` into a coded error.
   */
  _buildVerifier(host, port, leg, collector, trustOnce) {
    const svc = this._knownHostsSvc();
    return (key) => {
      const keyType = sshKeyType(key);
      const base64 = Buffer.from(key).toString('base64');
      if (trustOnce && trustOnce.keyType === keyType && trustOnce.base64 === base64) return true;
      let status = 'UNKNOWN';
      try {
        status = svc.verify(host, port, keyType, base64);
      } catch (err) {
        this.log.error(`SSH host-key lookup failed for ${host}, failing closed:`, err);
      }
      if (status === 'MATCH') return true;
      collector.failure = { status, leg, host, port: Number(port) || 22, keyType, base64 };
      return false;
    };
  }

  async connect(options = {}) {
    const merged = { ...(this._initialConfig || {}), ...options };
    const { proxy, secretRepo, initPath, initCmd, rows, cols, id, jumper, trustOnce, knownHostsSvc, ...sshConfig } = merged;
    if (knownHostsSvc) this._knownHosts = knownHostsSvc;
    const hostKey = {}; // collector for hostVerifier failures (fail-closed)

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
    // The jumper leg is host-key verified against known_hosts like any other.
    if (jumper && jumper.host && !sshConfig.sock) {
      try {
        this.log.info(`SSH session: Using jumper ${jumper.host}:${jumper.port || 22}`);
        const sock = await this._openJumperChannel(jumper, sshConfig.host, sshConfig.port || 22, hostKey);
        sshConfig.sock = sock;
        this.log.info('SSH session: Jumper channel established');
      } catch (error) {
        if (error && (error.code === 'HOST_KEY_UNKNOWN' || error.code === 'HOST_KEY_CHANGED')) throw error;
        this.log.error('SSH session: Jumper connection failed:', error);
        this.emit('error', { error: `Jumper connection failed: ${error.message}` });
        throw error;
      }
    }

    if (!sshConfig.hostVerifier) {
      sshConfig.hostVerifier = this._buildVerifier(sshConfig.host, sshConfig.port || 22, 'target', hostKey, trustOnce);
    }

    const failHostKey = (err) => {
      if (hostKey.failure) {
        const f = hostKey.failure;
        return hostKeyError(f.status, f.leg, f.host, f.port, f.keyType, f.base64, err);
      }
      return err;
    };

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
        const coded = failHostKey(err);
        this.emit('error', { error: `SSH connection error: ${coded.message}`, code: coded.code });
        if (!this._connected) reject(coded);
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

  _connectRaw(config, verifier) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let settled = false;
      conn.on('ready', () => { settled = true; resolve(conn); });
      conn.on('error', (err) => { if (!settled) { settled = true; reject(err); } });
      conn.connect(verifier && !config.hostVerifier ? { ...config, hostVerifier: verifier } : config);
    });
  }

  async _openJumperChannel(jumperConfig, targetHost, targetPort, collector = {}) {
    const { proxy, secretRepo, initPath, initCmd, rows, cols, id, jumper, trustOnce, knownHostsSvc, ...clean } = jumperConfig;
    const verifier = this._buildVerifier(clean.host, clean.port || 22, 'jumper', collector, null);
    let jumperConn;
    try {
      jumperConn = await this._connectRaw(clean, verifier);
    } catch (err) {
      if (collector.failure) {
        const f = collector.failure;
        throw hostKeyError(f.status, f.leg, f.host, f.port, f.keyType, f.base64, err);
      }
      throw err;
    }
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
    const { proxy, secretRepo, jumper, trustOnce, knownHostsSvc, ...sshConfig } = merged;
    if (knownHostsSvc) this._knownHosts = knownHostsSvc;
    // Non-interactive: no approval modal is possible here, so unknown/changed
    // keys fail closed — the user approves them once via a terminal session.
    const hostKey = {};
    if (jumper && jumper.host && !sshConfig.sock) {
      const { proxy: _p, secretRepo: _s, initPath: _a, initCmd: _b, rows: _c, cols: _d, id: _e, jumper: _f, trustOnce: _t, knownHostsSvc: _k, ...clean } = jumper;
      let jumperConn;
      try {
        jumperConn = await this._connectRaw(clean, this._buildVerifier(clean.host, clean.port || 22, 'jumper', hostKey, null));
      } catch (err) {
        if (hostKey.failure) {
          const f = hostKey.failure;
          throw hostKeyError(f.status, f.leg, f.host, f.port, f.keyType, f.base64, err);
        }
        throw err;
      }
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
    if (!sshConfig.hostVerifier) {
      sshConfig.hostVerifier = this._buildVerifier(sshConfig.host, sshConfig.port || 22, 'target', hostKey, trustOnce);
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
          if (hostKey.failure) {
            const f = hostKey.failure;
            cleanup();
            reject(hostKeyError(f.status, f.leg, f.host, f.port, f.keyType, f.base64, err));
            return;
          }
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
    const { proxy, secretRepo, jumper, trustOnce, knownHostsSvc, ...sshConfig } = merged;
    if (knownHostsSvc) this._knownHosts = knownHostsSvc;
    const hostKey = {};
    if (jumper && jumper.host && !sshConfig.sock) {
      const { proxy: _p2, secretRepo: _s2, initPath: _a2, initCmd: _b2, rows: _c2, cols: _d2, id: _e2, jumper: _f2, trustOnce: _t2, knownHostsSvc: _k2, ...clean2 } = jumper;
      let jumperConn2;
      try {
        jumperConn2 = await this._connectRaw(clean2, this._buildVerifier(clean2.host, clean2.port || 22, 'jumper', hostKey, null));
      } catch (err) {
        if (hostKey.failure) {
          const f = hostKey.failure;
          throw hostKeyError(f.status, f.leg, f.host, f.port, f.keyType, f.base64, err);
        }
        throw err;
      }
      try {
        sshConfig.sock = await new Promise((resolve, reject) => {
          jumperConn2.forwardOut('127.0.0.1', 0, sshConfig.host, sshConfig.port || 22, (err, stream) => {
            if (err) reject(err);
            else resolve(stream);
          });
        });
      } catch (err) {
        try { jumperConn2.end(); } catch { /* ignore */ }
        throw err;
      }
      sshConfig._jumperConn = jumperConn2;
    }
    if (!sshConfig.hostVerifier) {
      sshConfig.hostVerifier = this._buildVerifier(sshConfig.host, sshConfig.port || 22, 'target', hostKey, trustOnce);
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
          if (hostKey.failure) {
            const f = hostKey.failure;
            cleanup();
            reject(hostKeyError(f.status, f.leg, f.host, f.port, f.keyType, f.base64, err));
            return;
          }
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
