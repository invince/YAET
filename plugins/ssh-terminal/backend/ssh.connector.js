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

// One lightweight, read-only probe per poll. CPU is a cumulative jiffy
// sample diffed between polls; RAM/disk are instantaneous. `df -P` is
// POSIX-stable output and is fed a single path so it can't block on
// unmounted/network filesystems elsewhere.
const METRICS_COMMAND = [
  "awk '/^cpu /{print}' /proc/stat",
  "awk '/^MemTotal:|^MemAvailable:|^MemFree:|^Buffers:|^Cached:/{print}' /proc/meminfo",
  "df -P / 2>/dev/null | tail -n 1",
].join('; ');

function parseKb(line) {
  const m = String(line).match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

/**
 * Parse the combined METRICS_COMMAND stdout. Returns CPU jiffies (for the
 * caller to diff), plus used-% for RAM and root disk. Fields that could not
 * be determined stay null so the UI can hide them individually.
 */
function parseSystemMetrics(stdout) {
  const out = { cpu: null, mem: null, disk: null, cpuRaw: null };
  if (!stdout) return out;
  const lines = String(stdout).split(/\r?\n/);
  let memTotal = 0, memAvail = 0, memFree = 0, memBuffers = 0, memCached = 0;

  for (const line of lines) {
    if (/^cpu\s/.test(line)) {
      const nums = line.trim().split(/\s+/).slice(1).map(Number).filter((n) => !Number.isNaN(n));
      if (nums.length >= 4) {
        const idle = nums[3] + (nums[4] || 0); // idle + iowait
        const total = nums.slice(0, 8).reduce((a, b) => a + b, 0);
        if (total > 0) out.cpuRaw = { idle, total };
      }
    } else if (line.startsWith('MemTotal:')) memTotal = parseKb(line);
    else if (line.startsWith('MemAvailable:')) memAvail = parseKb(line);
    else if (line.startsWith('MemFree:')) memFree = parseKb(line);
    else if (line.startsWith('Buffers:')) memBuffers = parseKb(line);
    else if (line.startsWith('Cached:')) memCached = parseKb(line);
  }

  if (memTotal > 0) {
    // MemAvailable is absent on very old kernels — fall back to the classic
    // free+buffers+cached approximation.
    const avail = memAvail > 0 ? memAvail : (memFree + memBuffers + memCached);
    out.mem = Math.max(0, Math.min(100, ((memTotal - avail) / memTotal) * 100));
  }

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 6 && /^\d+%$/.test(parts[4])) {
      const totalKb = Number(parts[1]);
      const usedKb = Number(parts[2]);
      if (totalKb > 0) {
        out.disk = Math.max(0, Math.min(100, (usedKb / totalKb) * 100));
        break;
      }
    }
  }

  return out;
}

function hostKeyError(status, leg, host, port, keyType, base64, cause) {
  const info = keyInfo(keyType, base64);
  // Headless protocol-server (MCP/ACP) callers only ever see err.message, so
  // carry the fingerprint in it — the key is pinned out of band via
  // `yaet known-hosts pin --fingerprint <this sha256>`.
  const hint = `; keyType=${keyType} sha256=${info.sha256}`
    + ` (approve via GUI modal or 'yaet known-hosts pin --fingerprint <sha256>')`;
  const err = new Error(
    (status === 'CHANGED'
      ? `SSH host key for ${host} has changed — possible man-in-the-middle attack`
      : `Unknown SSH host key for ${host} (not in known_hosts)`) + hint,
  );
  err.code = status === 'CHANGED' ? 'HOST_KEY_CHANGED' : 'HOST_KEY_UNKNOWN';
  err.details = { status, leg, host, port, ...info };
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
    this._metricsCpuPrev = null;
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
        // A handshake that fails (e.g. host key not yet approved) also closes
        // the socket, but the tab is not really a dropped session — emitting
        // 'disconnect' here flips the tab to "disconnected" and it never
        // recovers on the host-key approve/retry path.
        const wasConnected = this._connected;
        this._connected = false;
        this.conn = null;
        this.stream = null;
        if (wasConnected) {
          this.emit('disconnect', { error: hadError });
        }
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

  /**
   * Run a command on the ALREADY-OPEN connection by opening one more SSH
   * channel. Unlike exec(), this never dials/authenticates again — the
   * metrics poll must not pay a full handshake every few seconds.
   */
  async execOnLiveSession(command, timeoutMs = 8000) {
    if (!this.conn || !this._connected) throw new Error('SSH session is not connected');
    const conn = this.conn;

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };
      const timer = setTimeout(
        () => finish(reject, new Error('SSH command timed out')),
        timeoutMs,
      );

      conn.exec(command, (err, stream) => {
        if (err) { finish(reject, err); return; }
        let stdout = '';
        let stderr = '';
        stream.on('data', (data) => { stdout += data.toString(); });
        stream.stderr.on('data', (data) => { stderr += data.toString(); });
        stream.on('close', (code) => finish(resolve, { stdout, stderr, exitCode: code }));
        stream.on('error', (e) => finish(reject, e));
      });
    });
  }

  /**
   * Sample CPU/RAM/root-disk usage over the live connection. CPU is a delta
   * between consecutive polls, so the first call returns cpu=null.
   */
  async getSystemMetrics() {
    const result = await this.execOnLiveSession(METRICS_COMMAND);
    const metrics = parseSystemMetrics(result.stdout);

    if (metrics.cpuRaw) {
      const prev = this._metricsCpuPrev;
      this._metricsCpuPrev = metrics.cpuRaw;
      if (prev) {
        const dTotal = metrics.cpuRaw.total - prev.total;
        const dIdle = metrics.cpuRaw.idle - prev.idle;
        if (dTotal > 0) {
          metrics.cpu = Math.max(0, Math.min(100, (1 - dIdle / dTotal) * 100));
        }
      }
      delete metrics.cpuRaw;
    } else {
      this._metricsCpuPrev = null;
    }

    return metrics;
  }
}

module.exports = { SshTerminalSession };
