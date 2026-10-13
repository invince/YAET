/**
 * SSH port forwarding manager (A1).
 *
 * One dedicated ssh2 connection per tunnel rule (same pattern as
 * SshTerminalSession.exec() — tunnels outlive terminal tabs, so they must
 * not piggyback on a tab's session).
 *
 * Only IDs cross the IPC boundary: start(tunnelId) re-reads the tunnel
 * from the encrypted tunnels file via runtime.resolveTunnel() and
 * re-validates it (P0-1 principle — a compromised renderer cannot smuggle
 * rule parameters). Credentials come from runtime._resolveRemoteConfig().
 *
 * No Electron dependencies in this file (only injected `broadcast`) —
 * lifecycle is unit tested with node:test and a fake ssh2 connection
 * (`node --test src-electron/services/tunnelService.spec.js`).
 */
const net = require('net');
const { PUBLIC_BINDS } = require('./tunnelRules');
const { createSocksServer } = require('./socksServer');

const CONNECT_TIMEOUT_MS = 15000;
/** Reconnect backoff between attempts. Overridable for tests. */
const DEFAULT_RECONNECT_DELAYS = [5000, 15000, 30000];
const MAX_RECONNECT_ATTEMPTS = 10;
/** How long "trust this source IP" lasts. Overridable for tests. */
const DEFAULT_TRUST_TTL_MS = 10 * 60 * 1000;

function defaultCreateConnection(sshConfig) {
  // Lazy require so unit tests never touch the native ssh2 stack.
  const { Client } = require('ssh2');
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { conn.end(); } catch (_) { /* already dead */ }
        reject(new Error(`SSH connection timed out after ${CONNECT_TIMEOUT_MS / 1000}s`));
      }
    }, CONNECT_TIMEOUT_MS);
    conn.on('ready', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(conn);
      }
    });
    conn.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
    conn.connect(sshConfig);
  });
}

class TunnelService {
  constructor(log, options = {}) {
    this.log = log || console;
    this.runtime = options.runtime || null;
    this.broadcast = options.broadcast || (() => {});
    this.createConnection = options.createConnection || defaultCreateConnection;
    this.reconnectDelays = options.reconnectDelays || DEFAULT_RECONNECT_DELAYS;
    /**
     * Approval gate for incoming connections on publicly-bound (-R 0.0.0.0)
     * tunnels: `requestApproval(info, { signal }) => Promise<boolean>`.
     * The IPC layer implements it with a user dialog + timeout; tests inject
     * fakes. Defaults to allow (loopback-only tunnels never call it).
     */
    this.requestApproval = options.requestApproval || (async () => true);
    this.trustTtlMs = options.trustTtlMs || DEFAULT_TRUST_TTL_MS;
    /** "tunnelId\0srcIP" -> expiresAt. User-granted, memory only. */
    this.trustedSources = new Map();
    /** tunnelId -> entry */
    this.tunnels = new Map();
  }

  snapshot(entry) {
    return {
      tunnelId: entry.tunnelId,
      profileId: entry.profileId,
      profileName: entry.profileName,
      tunnelName: entry.tunnelName,
      rule: entry.rule,
      status: entry.status,
      error: entry.error,
      bytesUp: entry.bytesUp,
      bytesDown: entry.bytesDown,
      startedAt: entry.startedAt,
      actualLocalPort: entry.actualLocalPort,
      reconnectAttempt: entry.reconnectAttempt,
    };
  }

  list() {
    return Array.from(this.tunnels.values()).map((entry) => this.snapshot(entry));
  }

  _emit() {
    try {
      this.broadcast(this.list());
    } catch (err) {
      this.log.warn(`TunnelService: broadcast failed: ${err.message}`);
    }
  }

  _setStatus(entry, status, error = '') {
    entry.status = status;
    entry.error = error || '';
    this.log.info(`Tunnel '${entry.rule.name}': ${status}${error ? ` — ${error}` : ''}`);
    this._emit();
  }

  /**
   * Start (or restart) a tunnel. Idempotent while active/starting.
   * @returns {Promise<object>} status snapshot.
   */
  async start(tunnelId) {
    const existing = this.tunnels.get(tunnelId);
    if (existing && (existing.status === 'active' || existing.status === 'starting' || existing.status === 'reconnecting')) {
      return this.snapshot(existing);
    }
    if (!this.runtime) throw new Error('TunnelService has no runtime — cannot resolve tunnels');

    // Re-read the tunnel server-side (never trust renderer-supplied parameters).
    const resolved = await this.runtime.resolveTunnel(tunnelId);
    const rule = resolved.rule;
    const sshConfig = resolved.sshConfig;

    if (existing) {
      // A pending reconnect timer of a previous generation must not resurrect
      // an orphaned connection next to the new one.
      if (existing.reconnectTimer) {
        clearTimeout(existing.reconnectTimer);
        existing.reconnectTimer = null;
      }
      this._teardown(existing, false);
    }
    const entry = {
      tunnelId,
      profileId: resolved.profileId || '',
      profileName: resolved.profileName || '',
      tunnelName: resolved.tunnelName || '',
      rule,
      status: 'starting',
      error: '',
      conn: null,
      servers: [],
      bytesUp: existing ? existing.bytesUp : 0,
      bytesDown: existing ? existing.bytesDown : 0,
      startedAt: Date.now(),
      actualLocalPort: 0,
      reconnectAttempt: 0,
      stoppedByUser: false,
      reconnectTimer: null,
      pendingApprovals: new Set(),
    };
    this.tunnels.set(tunnelId, entry);
    this._setStatus(entry, 'starting');

    try {
      const conn = await this.createConnection(sshConfig);
      if (entry.stoppedByUser) {
        // Stopped while connecting — drop the connection immediately.
        try { conn.end(); } catch (_) { /* ignore */ }
        return this.snapshot(entry);
      }
      entry.conn = conn;
      conn.on('error', (err) => this._onConnError(entry, err));
      conn.on('close', () => this._onConnClose(entry));
      await this._setupForwarding(entry, conn);
      if (entry.stoppedByUser || entry.status === 'error') {
        // Lost the race with stop()/failure while setting up — drop it.
        this._teardown(entry, false);
        return this.snapshot(entry);
      }
      this._setStatus(entry, 'active');
    } catch (err) {
      this._fail(entry, err.message || String(err));
      throw err;
    }
    return this.snapshot(entry);
  }

  async _setupForwarding(entry, conn) {
    const { rule } = entry;
    if (rule.type === 'local') {
      const server = net.createServer((clientSock) => {
        conn.forwardOut(
          clientSock.remoteAddress || '127.0.0.1',
          clientSock.remotePort || 0,
          rule.remoteHost,
          rule.remotePort,
          (err, stream) => {
            if (err || !stream) {
              this.log.warn(`Tunnel '${rule.name}': forwardOut failed: ${err ? err.message : 'no stream'}`);
              clientSock.destroy();
              return;
            }
            this._pipe(entry, clientSock, stream);
          }
        );
      });
      await this._listen(entry, server, rule.bindHost, rule.localPort);
      entry.servers.push(server);
    } else if (rule.type === 'remote') {
      entry.remoteHandler = (info, accept, reject) => {
        void this._handleInbound(entry, conn, info, accept, reject);
      };
      conn.on('tcp connection', entry.remoteHandler);
      await new Promise((resolve, reject) => {
        conn.forwardIn(rule.remoteBind || '127.0.0.1', rule.remotePort, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else if (rule.type === 'dynamic') {
      const server = createSocksServer(this.log, (host, port, clientSock) => {
        conn.forwardOut(
          clientSock.remoteAddress || '127.0.0.1',
          clientSock.remotePort || 0,
          host,
          port,
          (err, stream) => {
            if (err || !stream) {
              this.log.warn(`Tunnel '${rule.name}': SOCKS target ${host}:${port} unreachable: ${err ? err.message : 'no stream'}`);
              clientSock.destroy();
              return;
            }
            this._pipe(entry, clientSock, stream);
          }
        );
      });
      await this._listen(entry, server, rule.bindHost, rule.localPort);
      entry.servers.push(server);
    }
  }

  /**
   * One inbound connection on a -R forward. Publicly-bound tunnels
   * (remoteBind 0.0.0.0) hold the channel and ask the user first —
   * fail-closed on deny, timeout, stop, or teardown. A user-granted
   * "trust this IP" skips the dialog for 10 minutes (per tunnel + source).
   */
  async _handleInbound(entry, conn, info, accept, reject) {
    const { rule } = entry;
    if (PUBLIC_BINDS.has(rule.remoteBind)) {
      const srcIP = (info && info.srcIP) || '';
      if (srcIP && this._isTrusted(entry.tunnelId, srcIP)) {
        this.log.info(`Tunnel '${rule.name}': auto-approved trusted source ${srcIP}`);
      } else {
        const controller = new AbortController();
        entry.pendingApprovals.add(controller);
        let result = false;
        try {
          result = await this.requestApproval({
            tunnelId: entry.tunnelId,
            tunnelName: entry.tunnelName || rule.name,
            srcIP,
            srcPort: (info && info.srcPort) || 0,
            dstPort: rule.remotePort,
          }, { signal: controller.signal });
        } catch (_) {
          result = false;
        } finally {
          entry.pendingApprovals.delete(controller);
        }
        const { approved, trustSource } = TunnelService._approvalResult(result);
        // Grant trust only while the tunnel is still ours: stop() clears
        // trust, and a grant landing after that must not resurrect it.
        // (Single-threaded: check + write below run atomically.)
        if (approved && trustSource && srcIP && !entry.stoppedByUser) {
          this._trustSource(entry.tunnelId, srcIP);
        }
        if (!approved || entry.stoppedByUser || !entry.conn) {
          try { reject(); } catch (_) { /* already settled */ }
          return;
        }
      }
    }
    let stream;
    try {
      stream = accept();
    } catch (_) {
      return;
    }
    const local = net.connect(rule.localPort, rule.bindHost, () => {
      this._pipe(entry, stream, local);
    });
    local.on('error', () => {
      try { stream.close ? stream.close() : stream.destroy(); } catch (_) { /* ignore */ }
    });
  }

  /**
   * Normalize approval outcomes. The IPC layer resolves
   * { approved, trustSource }; bare booleans (default impl, test fakes)
   * mean approve/deny without trust.
   */
  static _approvalResult(result) {
    if (result && typeof result === 'object') {
      return { approved: !!result.approved, trustSource: !!result.trustSource };
    }
    return { approved: !!result, trustSource: false };
  }

  _trustKey(tunnelId, srcIP) {
    return `${tunnelId} ${srcIP}`;
  }

  _trustSource(tunnelId, srcIP) {
    this.trustedSources.set(this._trustKey(tunnelId, srcIP), Date.now() + this.trustTtlMs);
    this.log.info(`Tunnel '${tunnelId}': trusted source ${srcIP} for ${Math.round(this.trustTtlMs / 60000)} min`);
  }

  _isTrusted(tunnelId, srcIP) {
    if (!srcIP) return false;
    const expiresAt = this.trustedSources.get(this._trustKey(tunnelId, srcIP));
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      this.trustedSources.delete(this._trustKey(tunnelId, srcIP));
      return false;
    }
    return true;
  }

  /** Explicit user stop ends trust — a restart asks again from scratch. */
  _clearTrust(tunnelId) {
    const prefix = `${tunnelId} `;
    for (const key of Array.from(this.trustedSources.keys())) {
      if (key.startsWith(prefix)) this.trustedSources.delete(key);
    }
  }

  _listen(entry, server, host, port) {
    return new Promise((resolve, reject) => {
      const onError = (err) => {
        if (err && err.code === 'EADDRINUSE') {
          reject(new Error(`local port ${port} is already in use — pick another port for tunnel '${entry.rule.name}'`));
        } else {
          reject(err);
        }
      };
      server.once('error', onError);
      server.listen(port, host, () => {
        server.removeListener('error', onError);
        server.on('error', (err) => this.log.warn(`Tunnel '${entry.rule.name}' listener error: ${err.message}`));
        const address = server.address();
        entry.actualLocalPort = (address && typeof address === 'object' ? address.port : 0) || port;
        resolve();
      });
    });
  }

  /**
   * Pipe two sockets, counting bytes in both directions.
   * Extra 'data' listeners are safe alongside pipe() (both consume flowing mode).
   */
  _pipe(entry, a, b) {
    a.on('data', (chunk) => { entry.bytesUp += chunk.length; });
    b.on('data', (chunk) => { entry.bytesDown += chunk.length; });
    const cleanup = () => {
      try { a.destroy(); } catch (_) { /* ignore */ }
      try { b.destroy(); } catch (_) { /* ignore */ }
      this._emit();
    };
    a.on('error', cleanup);
    b.on('error', cleanup);
    a.on('close', cleanup);
    b.on('close', cleanup);
    a.pipe(b);
    b.pipe(a);
    this._emit();
  }

  _fail(entry, message) {
    this._teardown(entry, false);
    this._setStatus(entry, 'error', message);
  }

  _onConnError(entry, err) {
    if (entry.status === 'starting') {
      // The start() promise path already handles this via createConnection
      // rejection — this only fires for post-ready errors.
      this._fail(entry, err.message || String(err));
    }
    // Active-connection errors are followed by 'close'; reconnect there.
  }

  _onConnClose(entry) {
    if (entry.stoppedByUser || entry.status === 'stopped' || entry.status === 'error') return;
    this._teardown(entry, true);
    if (entry.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this._setStatus(entry, 'error', `connection lost — gave up after ${MAX_RECONNECT_ATTEMPTS} reconnect attempts`);
      return;
    }
    const delay = this.reconnectDelays[Math.min(entry.reconnectAttempt, this.reconnectDelays.length - 1)];
    entry.reconnectAttempt += 1;
    this._setStatus(entry, 'reconnecting', `connection lost — retry ${entry.reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s`);
    entry.reconnectTimer = setTimeout(() => {
      entry.reconnectTimer = null;
      if (entry.stoppedByUser) return;
      this.log.info(`Tunnel '${entry.rule.name}': reconnecting (attempt ${entry.reconnectAttempt})`);
      this._restart(entry).catch(() => { /* _restart reports status itself */ });
    }, delay);
    if (entry.reconnectTimer.unref) entry.reconnectTimer.unref();
  }

  async _restart(entry) {
    entry.stoppedByUser = false;
    entry.status = 'starting';
    entry.error = '';
    this._emit();
    try {
      const resolved = await this.runtime.resolveTunnel(entry.tunnelId);
      entry.rule = resolved.rule;
      const conn = await this.createConnection(resolved.sshConfig);
      if (entry.stoppedByUser) {
        try { conn.end(); } catch (_) { /* ignore */ }
        return;
      }
      entry.conn = conn;
      conn.on('error', (err) => this._onConnError(entry, err));
      conn.on('close', () => this._onConnClose(entry));
      await this._setupForwarding(entry, conn);
      entry.reconnectAttempt = 0;
      this._setStatus(entry, 'active');
    } catch (err) {
      // A failed restart goes back through the close path for another retry.
      this._teardown(entry, true);
      this._onConnClose(entry);
    }
  }

  async stop(tunnelId) {
    const entry = this.tunnels.get(tunnelId);
    if (!entry) return false;
    entry.stoppedByUser = true;
    if (entry.reconnectTimer) {
      clearTimeout(entry.reconnectTimer);
      entry.reconnectTimer = null;
    }
    this._clearTrust(tunnelId);
    this._teardown(entry, false);
    this._setStatus(entry, 'stopped');
    return true;
  }

  async stopAll() {
    for (const tunnelId of Array.from(this.tunnels.keys())) {
      await this.stop(tunnelId);
    }
  }

  /** Release sockets/listeners but keep the entry (stats + restart source). */
  _teardown(entry, keepConnHandlers) {
    // Waiting approvals die with the tunnel — fail closed, never leave a
    // channel hanging because the user stopped while a dialog was open.
    if (entry.pendingApprovals) {
      for (const controller of entry.pendingApprovals) {
        try { controller.abort(); } catch (_) { /* ignore */ }
      }
      entry.pendingApprovals.clear();
    }
    for (const server of entry.servers) {
      try { server.close(); } catch (_) { /* ignore */ }
    }
    entry.servers = [];
    if (entry.conn) {
      try {
        if (entry.remoteHandler) entry.conn.removeListener('tcp connection', entry.remoteHandler);
        if (!keepConnHandlers) {
          entry.conn.removeAllListeners('error');
          entry.conn.removeAllListeners('close');
        }
        entry.conn.end();
      } catch (_) { /* already dead */ }
      entry.conn = null;
    }
    entry.remoteHandler = null;
  }
}

module.exports = { TunnelService, CONNECT_TIMEOUT_MS, MAX_RECONNECT_ATTEMPTS, DEFAULT_TRUST_TTL_MS };
