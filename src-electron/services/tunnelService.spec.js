/**
 * Unit tests for tunnelService.js lifecycle (fake ssh2 connection, no network
 * beyond loopback sockets).
 * Run: node --test src-electron/services/tunnelService.spec.js
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const { EventEmitter, Duplex } = require('node:stream');
const { TunnelService } = require('./tunnelService');

const RULES = {
  local: {
    id: 't-local', name: '', type: 'local',
    bindHost: '127.0.0.1', localPort: 0, remoteHost: 'db.internal', remotePort: 3306,
    connection: { mode: 'profile', profileId: 'p1' },
  },
  remote: {
    id: 't-remote', name: '', type: 'remote',
    bindHost: '127.0.0.1', localPort: 0, remoteHost: '', remotePort: 0,
    connection: { mode: 'profile', profileId: 'p1' },
  },
  dynamic: {
    id: 't-dynamic', name: '', type: 'dynamic',
    bindHost: '127.0.0.1', localPort: 0, remoteHost: '', remotePort: 0,
    connection: { mode: 'profile', profileId: 'p1' },
  },
};

/**
 * Fake ssh2 channel end. A single PassThrough CANNOT model an ssh channel:
 * _pipe() connects both directions (a.pipe(b) + b.pipe(a)), which is correct
 * for real ssh2 streams (independent read/write sides) but self-loops on a
 * PassThrough (shared buffer). This pair delivers writes to the peer's
 * readable side instead, exactly like a real duplex channel.
 */
class FakeChannel extends Duplex {
  constructor() {
    super();
    this.peer = null;
  }
  _read() {}
  _write(chunk, _enc, cb) {
    if (this.peer) this.peer.push(chunk);
    cb();
  }
  _final(cb) {
    if (this.peer) this.peer.push(null);
    cb();
  }
}

/** Fake ssh2 Client: forwardOut returns the service side of a channel pair. */
class FakeConn extends EventEmitter {
  constructor() {
    super();
    this.ended = false;
    this.forwardInCalls = [];
    this.outStreams = [];
  }
  forwardOut(srcIP, srcPort, dstHost, dstPort, cb) {
    const serviceSide = new FakeChannel();
    const remoteSide = new FakeChannel();
    serviceSide.peer = remoteSide;
    remoteSide.peer = serviceSide;
    this.outStreams.push({ dstHost, dstPort, stream: serviceSide, remote: remoteSide });
    setImmediate(() => cb(null, serviceSide));
    return true;
  }
  forwardIn(addr, port, cb) {
    this.forwardInCalls.push({ addr, port });
    setImmediate(() => cb(null));
  }
  end() {
    this.ended = true;
  }
}

function makeService(overrides = {}) {
  const conns = [];
  const broadcasts = [];
  const runtime = {
    resolveTunnel: async (tunnelId) => {
      const base = Object.values(RULES).find((r) => r.id === tunnelId);
      if (!base) throw new Error(`Tunnel not found: ${tunnelId}`);
      const { connection, ...forward } = base;
      const { normalizeTunnelRule } = require('./tunnelRules');
      const normalized = normalizeTunnelRule(forward);
      if (normalized.error) throw new Error(normalized.error);
      return {
        tunnelName: '', profileId: 'p1', profileName: 'test-profile',
        rule: normalized.rule, sshConfig: { host: 'example.com', port: 22, username: 'u' },
      };
    },
    ...overrides.runtime,
  };
  const service = new TunnelService(console, {
    runtime,
    broadcast: (list) => broadcasts.push(list),
    createConnection: async () => {
      const conn = new FakeConn();
      conns.push(conn);
      return conn;
    },
    reconnectDelays: [10, 10, 10],
    ...overrides.service,
  });
  return { service, conns, broadcasts };
}

function waitFor(fn, timeoutMs = 2000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        if (fn()) return resolve();
      } catch (err) {
        return reject(err);
      }
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe('TunnelService', () => {
  let ctx;
  beforeEach(() => {
    ctx = makeService();
  });

  it('starts a local tunnel and reports it active', async () => {
    const snap = await ctx.service.start('t-local');
    assert.equal(snap.status, 'active');
    assert.ok(snap.actualLocalPort > 0);
    assert.equal(ctx.conns.length, 1);

    const [entry] = ctx.service.list();
    assert.equal(entry.profileName, 'test-profile');
    assert.equal(entry.rule.type, 'local');
    await ctx.service.stopAll();
  });

  it('pipes data through a local forward and counts bytes', async () => {
    const snap = await ctx.service.start('t-local');
    const conn = ctx.conns[0];

    const client = net.connect(snap.actualLocalPort, '127.0.0.1');
    await new Promise((resolve) => client.on('connect', resolve));
    await waitFor(() => conn.outStreams.length === 1);

    // upload direction: client -> forwardOut stream -> fake remote
    client.write('hello');
    await waitFor(() => ctx.service.tunnels.get('t-local').bytesUp === 5);

    // download direction: fake remote writes back, client receives
    const received = [];
    client.on('data', (c) => received.push(c));
    conn.outStreams[0].remote.write('world');
    await waitFor(() => Buffer.concat(received).toString() === 'world');
    await waitFor(() => ctx.service.tunnels.get('t-local').bytesDown === 5);

    client.destroy();
    await ctx.service.stopAll();
  });

  it('is idempotent while active', async () => {
    await ctx.service.start('t-local');
    await ctx.service.start('t-local');
    assert.equal(ctx.conns.length, 1);
    await ctx.service.stopAll();
  });

  it('throws for unknown rules', async () => {
    await assert.rejects(() => ctx.service.start('nope'), /Tunnel not found/);
  });

  it('rejects rules that fail validation', async () => {
    const bad = makeService({
      runtime: {
        resolveTunnel: async () => { throw new Error("Invalid tunnel 'bad': bindHost '0.0.0.0' is not allowed"); },
      },
    });
    await assert.rejects(() => bad.service.start('bad'), /not allowed/);
  });

  it('propagates connection failures as error status', async () => {
    const failing = makeService({
      service: { createConnection: async () => { throw new Error('auth failed'); } },
    });
    await assert.rejects(() => failing.service.start('t-local'), /auth failed/);
    const [entry] = failing.service.list();
    assert.equal(entry.status, 'error');
    assert.match(entry.error, /auth failed/);
  });

  it('reports EADDRINUSE with a clear message', async () => {
    const blocker = net.createServer();
    await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const takenPort = blocker.address().port;

    const occupied = makeService({
      runtime: {
        resolveTunnel: async () => ({
          tunnelName: '', profileId: 'p1', profileName: 'p',
          rule: { id: 'r', name: 'r', type: 'local', bindHost: '127.0.0.1', localPort: takenPort, remoteHost: 'h', remotePort: 80, enabled: true },
          sshConfig: { host: 'example.com' },
        }),
      },
    });
    await assert.rejects(() => occupied.service.start('r'), /already in use/);
    blocker.close();
    await occupied.service.stopAll();
  });

  it('reconnects after the connection drops', async () => {
    await ctx.service.start('t-local');
    const first = ctx.conns[0];
    first.emit('close');

    await waitFor(() => ctx.service.tunnels.get('t-local').status === 'reconnecting');
    await waitFor(() => ctx.service.tunnels.get('t-local').status === 'active', 3000);
    assert.equal(ctx.conns.length, 2);
    assert.equal(ctx.service.tunnels.get('t-local').reconnectAttempt, 0);
    await ctx.service.stopAll();
  });

  it('gives up after too many failed reconnects', async () => {
    const flaky = makeService({
      service: {
        reconnectDelays: [5],
        createConnection: (() => {
          let calls = 0;
          return async () => {
            calls += 1;
            if (calls === 1) return new FakeConn();
            throw new Error('still down');
          };
        })(),
      },
    });
    // Speed up: fail fast by shrinking the attempt budget is internal;
    // instead drop the first connection repeatedly via close storms.
    await flaky.service.start('t-local');
    for (let i = 0; i < 12; i++) {
      const entry = flaky.service.tunnels.get('t-local');
      if (entry.status === 'error') break;
      const conn = entry.conn;
      if (conn && !conn.ended) conn.emit('close');
      await new Promise((r) => setTimeout(r, 20));
    }
    await waitFor(() => flaky.service.tunnels.get('t-local').status === 'error', 3000);
    assert.match(flaky.service.tunnels.get('t-local').error, /gave up/);
    await flaky.service.stopAll();
  });

  it('stop cancels pending reconnects', async () => {
    await ctx.service.start('t-local');
    ctx.conns[0].emit('close');
    await waitFor(() => ctx.service.tunnels.get('t-local').status === 'reconnecting');
    await ctx.service.stop('t-local');
    assert.equal(ctx.service.tunnels.get('t-local').status, 'stopped');
    const connsBefore = ctx.conns.length;
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(ctx.conns.length, connsBefore);
  });

  it('starts a remote forward via forwardIn', async () => {
    const withPort = makeService({
      runtime: {
        resolveTunnel: async () => ({
          tunnelName: '', profileId: 'p1', profileName: 'p',
          rule: { id: 't-remote', name: 't-remote', type: 'remote', bindHost: '127.0.0.1', localPort: 18080, remoteHost: '', remotePort: 8080, enabled: true },
          sshConfig: { host: 'example.com' },
        }),
      },
    });
    const snap = await withPort.service.start('t-remote');
    assert.equal(snap.status, 'active');
    const conn = withPort.conns[0];
    assert.equal(conn.forwardInCalls.length, 1);
    assert.equal(conn.forwardInCalls[0].port, 8080);
    await withPort.service.stopAll();
  });

  describe('public (-R 0.0.0.0) approval gate', () => {
    function publicService(approve) {
      const approvals = [];
      return {
        approvals,
        svc: makeService({
          runtime: {
            resolveTunnel: async () => ({
              tunnelName: 'pub', profileId: 'p1', profileName: 'p',
              rule: {
                id: 't-pub', name: 'pub', type: 'remote', bindHost: '127.0.0.1',
                localPort: 0, remoteHost: '', remotePort: 18080, remoteBind: '0.0.0.0', enabled: true,
              },
              sshConfig: { host: 'example.com' },
            }),
          },
          service: {
            requestApproval: async (info, { signal } = {}) => {
              approvals.push({ info, signal });
              return approve(info, { signal });
            },
          },
        }),
      };
    }

    async function startEchoTarget() {
      const server = net.createServer((socket) => socket.pipe(socket));
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      return server;
    }

    /** Simulate one inbound ssh channel: returns { channel, rejected }. */
    function inbound(conn) {
      const serviceSide = new FakeChannel();
      const remoteSide = new FakeChannel();
      serviceSide.peer = remoteSide;
      remoteSide.peer = serviceSide;
      let accepted = null;
      let rejected = false;
      conn.emit('tcp connection',
        { srcIP: '192.168.1.50', srcPort: 51234, dstIP: '0.0.0.0', dstPort: 18080 },
        () => { accepted = serviceSide; return serviceSide; },
        () => { rejected = true; });
      return {
        remote: remoteSide,
        get accepted() { return accepted; },
        get rejected() { return rejected; },
      };
    }

    it('binds the server-side listener on 0.0.0.0', async () => {
      const { svc } = publicService(async () => true);
      await svc.service.start('t-pub');
      assert.equal(svc.conns[0].forwardInCalls[0].addr, '0.0.0.0');
      await svc.service.stopAll();
    });

    it('approved connections are piped to the local target', async () => {
      const target = await startEchoTarget();
      const targetPort = target.address().port;
      const { svc, approvals } = publicService(async () => true);
      // point the (already normalized-shaped) rule at the echo target
      const origResolve = svc.service.runtime.resolveTunnel;
      svc.service.runtime.resolveTunnel = async (id) => {
        const resolved = await origResolve(id);
        resolved.rule = { ...resolved.rule, localPort: targetPort };
        return resolved;
      };
      await svc.service.start('t-pub');
      const call = inbound(svc.conns[0]);
      await waitFor(() => approvals.length === 1);
      assert.equal(approvals[0].info.srcIP, '192.168.1.50');
      assert.equal(approvals[0].info.dstPort, 18080);
      await waitFor(() => call.accepted !== null);
      // echo round-trip: remote writes, echo target returns it, remote reads
      const received = [];
      call.remote.on('data', (c) => received.push(c));
      call.remote.write('ping');
      await waitFor(() => Buffer.concat(received).toString() === 'ping');
      call.remote.destroy();
      if (call.accepted) call.accepted.destroy();
      target.close();
      await svc.service.stopAll();
    });

    it('denied connections are rejected without accept', async () => {
      const { svc, approvals } = publicService(async () => false);
      await svc.service.start('t-pub');
      const call = inbound(svc.conns[0]);
      await waitFor(() => approvals.length === 1);
      await waitFor(() => call.rejected === true);
      assert.equal(call.accepted, null);
      await svc.service.stopAll();
    });

    it('loopback tunnels never ask for approval', async () => {
      let asked = 0;
      const quiet = makeService({
        runtime: {
          resolveTunnel: async () => ({
            tunnelName: '', profileId: 'p1', profileName: 'p',
            rule: { id: 't-lo', name: 't-lo', type: 'remote', bindHost: '127.0.0.1', localPort: 18081, remoteHost: '', remotePort: 18081, enabled: true },
            sshConfig: { host: 'example.com' },
          }),
        },
        service: {
          requestApproval: async () => { asked += 1; return true; },
        },
      });
      await quiet.service.start('t-lo');
      // remoteHandler is registered; fire an inbound directly
      const conn = quiet.conns[0];
      let rejected = false;
      conn.emit('tcp connection', { srcIP: '1.2.3.4', srcPort: 1 },
        () => new (require('node:stream').PassThrough)(), () => { rejected = true; });
      await new Promise((r) => setTimeout(r, 100));
      assert.equal(asked, 0);
      assert.equal(rejected, false);
      await quiet.service.stopAll();
    });

    it('stopping aborts a pending approval (fail closed)', async () => {
      let abortSeen = false;
      const { svc, approvals } = publicService((info, { signal } = {}) => new Promise((resolve) => {
        if (signal) {
          signal.addEventListener('abort', () => { abortSeen = true; resolve(false); }, { once: true });
        }
      }));
      await svc.service.start('t-pub');
      const call = inbound(svc.conns[0]);
      await waitFor(() => approvals.length === 1);
      await svc.service.stop('t-pub');
      assert.equal(abortSeen, true);
      await waitFor(() => call.rejected === true);
    });

    it('trusted sources skip the dialog for 10 minutes', async () => {
      const { svc, approvals } = publicService(async () => ({ approved: true, trustSource: true }));
      svc.service.trustTtlMs = 60 * 1000;
      await svc.service.start('t-pub');

      // first connection asks and grants trust
      const first = inbound(svc.conns[0]);
      await waitFor(() => approvals.length === 1);
      await waitFor(() => first.accepted !== null);

      // second connection from the same IP is auto-approved
      const second = inbound(svc.conns[0]);
      await waitFor(() => second.accepted !== null);
      assert.equal(approvals.length, 1);
      assert.equal(second.rejected, false);

      // ...but a different IP still asks
      svc.conns[0].emit('tcp connection', { srcIP: '10.9.9.9', srcPort: 1111 },
        () => new FakeChannel(), () => {});
      await waitFor(() => approvals.length === 2);
      assert.equal(approvals[1].info.srcIP, '10.9.9.9');
      await svc.service.stopAll();
    });

    it('trust expires and stop clears it', async () => {
      const { svc, approvals } = publicService(async () => ({ approved: true, trustSource: true }));
      svc.service.trustTtlMs = 30;
      await svc.service.start('t-pub');

      inbound(svc.conns[0]);
      await waitFor(() => approvals.length === 1);
      await new Promise((r) => setTimeout(r, 60));
      // expired → asks again
      inbound(svc.conns[0]);
      await waitFor(() => approvals.length === 2);
      // let the second grant land before stopping (grant runs a microtask
      // after the approval resolves; stop() must clear a settled map)
      await waitFor(() => svc.service.trustedSources.size === 1);

      // stop clears trust: next start asks even within TTL
      svc.service.trustTtlMs = 60 * 1000;
      await svc.service.stop('t-pub');
      await svc.service.start('t-pub');
      const fresh = svc.conns[svc.conns.length - 1];
      let freshRejected = false;
      fresh.emit('tcp connection', { srcIP: '192.168.1.50', srcPort: 1 },
        () => new FakeChannel(), () => { freshRejected = true; });
      await waitFor(() => approvals.length === 3);
      assert.equal(freshRejected, false);
      await svc.service.stopAll();
    });

    it('empty source IPs are never trusted', async () => {
      const { svc, approvals } = publicService(async () => ({ approved: true, trustSource: true }));
      await svc.service.start('t-pub');
      const conn = svc.conns[0];
      let rejected = false;
      conn.emit('tcp connection', { srcIP: '', srcPort: 0 },
        () => new FakeChannel(), () => { rejected = true; });
      await waitFor(() => approvals.length === 1);
      // second anonymous connection asks again (no trust key possible)
      conn.emit('tcp connection', { srcIP: '', srcPort: 0 },
        () => new FakeChannel(), () => {});
      await waitFor(() => approvals.length === 2);
      assert.equal(rejected, false);
      await svc.service.stopAll();
    });
  });

  it('broadcasts status changes', async () => {
    await ctx.service.start('t-local');
    await ctx.service.stop('t-local');
    const last = ctx.broadcasts[ctx.broadcasts.length - 1];
    assert.equal(last[0].status, 'stopped');
  });
});
