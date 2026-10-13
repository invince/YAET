/**
 * Unit tests for socksServer.js.
 * Run: node --test src-electron/services/socksServer.spec.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const { parseGreeting, parseRequest, createSocksServer } = require('./socksServer');

describe('socksServer parsers', () => {
  it('parseGreeting returns null on incomplete buffer', () => {
    assert.equal(parseGreeting(Buffer.from([0x05])), null);
    assert.equal(parseGreeting(Buffer.from([0x05, 0x02, 0x00])), null);
  });

  it('parseGreeting consumes the full greeting', () => {
    assert.deepEqual(parseGreeting(Buffer.from([0x05, 0x02, 0x00, 0x02])), { consumed: 4 });
  });

  it('parseGreeting rejects non-SOCKS5', () => {
    assert.match(parseGreeting(Buffer.from([0x04, 0x01, 0x00])).error, /version/);
  });

  it('parseRequest parses IPv4 CONNECT', () => {
    const buf = Buffer.from([0x05, 0x01, 0x00, 0x01, 10, 0, 0, 5, 0x1f, 0x90]);
    assert.deepEqual(parseRequest(buf), { host: '10.0.0.5', port: 8080, consumed: 10 });
  });

  it('parseRequest parses domain CONNECT', () => {
    const domain = Buffer.from('db.internal', 'utf8');
    const buf = Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, domain.length]), domain, Buffer.from([0x0c, 0xe4])]);
    assert.deepEqual(parseRequest(buf), { host: 'db.internal', port: 3300, consumed: 5 + domain.length + 2 });
  });

  it('parseRequest parses IPv6 CONNECT', () => {
    const buf = Buffer.alloc(22);
    buf[0] = 0x05; buf[1] = 0x01; buf[3] = 0x04;
    buf.writeUInt16BE(0x1f90, 20);
    const parsed = parseRequest(buf);
    assert.equal(parsed.port, 8080);
    assert.match(parsed.host, /:/);
  });

  it('parseRequest returns null on incomplete buffer', () => {
    assert.equal(parseRequest(Buffer.from([0x05, 0x01])), null);
    assert.equal(parseRequest(Buffer.from([0x05, 0x01, 0x00, 0x01, 10])), null);
  });

  it('parseRequest rejects non-CONNECT commands', () => {
    const parsed = parseRequest(Buffer.from([0x05, 0x02, 0x00, 0x01, 1, 2, 3, 4, 0, 80]));
    assert.match(parsed.error, /CONNECT/);
  });

  it('parseRequest rejects unknown address types', () => {
    const parsed = parseRequest(Buffer.from([0x05, 0x01, 0x00, 0x09]));
    assert.match(parsed.error, /address type/);
  });
});

describe('socksServer live handshake', () => {
  async function withServer(fn) {
    const calls = [];
    const server = createSocksServer(null, (host, port, socket) => {
      calls.push({ host, port, socket });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      await fn(server.address().port, calls);
    } finally {
      for (const c of calls) c.socket.destroy();
      server.close();
    }
  }

  function socksClient(port, host, targetPort) {
    return new Promise((resolve, reject) => {
      const socket = net.connect(port, '127.0.0.1', () => {
        socket.write(Buffer.from([0x05, 0x01, 0x00]));
      });
      let received = Buffer.alloc(0);
      let connectSent = false;
      socket.on('data', (chunk) => {
        received = Buffer.concat([received, chunk]);
        if (!connectSent && received.length >= 2) {
          connectSent = true;
          // greeting reply received — send CONNECT
          const domain = Buffer.from(host, 'utf8');
          socket.write(Buffer.concat([
            Buffer.from([0x05, 0x01, 0x00, 0x03, domain.length]),
            domain,
            Buffer.from([(targetPort >> 8) & 0xff, targetPort & 0xff]),
          ]));
        } else if (connectSent && received.length >= 12) {
          resolve({ socket, reply: received.subarray(2) });
        }
      });
      socket.on('error', reject);
      setTimeout(() => reject(new Error('handshake timed out')), 3000);
    });
  }

  it('completes a CONNECT handshake and hands over the socket', async () => {
    await withServer(async (port, calls) => {
      const { reply } = await socksClient(port, 'example.com', 443);
      assert.equal(reply[1], 0x00); // REP succeeded
      assert.equal(calls.length, 1);
      assert.equal(calls[0].host, 'example.com');
      assert.equal(calls[0].port, 443);
    });
  });

  it('rejects BIND with a failure reply and closes', async () => {
    await withServer(async (port, calls) => {
      const socket = await new Promise((resolve, reject) => {
        const s = net.connect(port, '127.0.0.1', () => s.write(Buffer.from([0x05, 0x01, 0x00])));
        s.once('data', () => {
          s.write(Buffer.from([0x05, 0x02, 0x00, 0x01, 1, 2, 3, 4, 0, 80]));
          resolve(s);
        });
        s.on('error', reject);
      });
      const closed = await new Promise((resolve) => {
        let done = false;
        socket.on('close', () => { done = true; resolve(true); });
        setTimeout(() => resolve(done), 1000);
      });
      assert.equal(closed, true);
      assert.equal(calls.length, 0);
      socket.destroy();
    });
  });
});
