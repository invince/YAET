/**
 * Minimal SOCKS5 server (RFC 1928, CONNECT only, no authentication) used for
 * dynamic (-D) SSH tunnels: local apps point at it, each request is forwarded
 * through the SSH connection via conn.forwardOut().
 *
 * No Electron dependencies — unit tested with node:test on real loopback
 * sockets (`node --test src-electron/services/socksServer.spec.js`).
 */
const net = require('net');

const SOCKS_VERSION = 0x05;
const CMD_CONNECT = 0x01;
const ATYP_IPV4 = 0x01;
const ATYP_DOMAIN = 0x03;
const ATYP_IPV6 = 0x04;

const REP_SUCCEEDED = 0x00;
const REP_GENERAL_FAILURE = 0x01;
const REP_COMMAND_NOT_SUPPORTED = 0x07;
const REP_ADDR_TYPE_NOT_SUPPORTED = 0x08;

/**
 * Parse a SOCKS5 greeting. Returns null when the buffer is incomplete.
 * @returns {{consumed: number}|{error: string}|null}
 */
function parseGreeting(buf) {
  if (buf.length < 2) return null;
  if (buf[0] !== SOCKS_VERSION) return { error: `unsupported SOCKS version ${buf[0]}` };
  const nmethods = buf[1];
  if (buf.length < 2 + nmethods) return null;
  return { consumed: 2 + nmethods };
}

/**
 * Parse a SOCKS5 request. Returns null when the buffer is incomplete.
 * @returns {{host: string, port: number, consumed: number}|{error: string, reply: number}|null}
 */
function parseRequest(buf) {
  if (buf.length < 4) return null;
  if (buf[0] !== SOCKS_VERSION) return { error: `unsupported SOCKS version ${buf[0]}`, reply: REP_GENERAL_FAILURE };
  if (buf[1] !== CMD_CONNECT) return { error: `unsupported SOCKS command ${buf[1]} (only CONNECT is supported)`, reply: REP_COMMAND_NOT_SUPPORTED };

  const atyp = buf[3];
  let host;
  let offset;
  if (atyp === ATYP_IPV4) {
    if (buf.length < 10) return null;
    host = `${buf[4]}.${buf[5]}.${buf[6]}.${buf[7]}`;
    offset = 8;
  } else if (atyp === ATYP_DOMAIN) {
    if (buf.length < 5) return null;
    const len = buf[4];
    if (buf.length < 5 + len + 2) return null;
    host = buf.subarray(5, 5 + len).toString('utf8');
    if (!host) return { error: 'empty domain name', reply: REP_GENERAL_FAILURE };
    offset = 5 + len;
  } else if (atyp === ATYP_IPV6) {
    if (buf.length < 22) return null;
    const parts = [];
    for (let i = 0; i < 8; i++) parts.push(buf.readUInt16BE(4 + i * 2).toString(16));
    host = parts.join(':');
    offset = 20;
  } else {
    return { error: `unsupported address type ${atyp}`, reply: REP_ADDR_TYPE_NOT_SUPPORTED };
  }

  const port = buf.readUInt16BE(offset);
  return { host, port, consumed: offset + 2 };
}

function sendGreetingReply(socket) {
  socket.write(Buffer.from([SOCKS_VERSION, 0x00])); // NO AUTHENTICATION REQUIRED
}

function sendRequestReply(socket, rep) {
  // VER REP RSV ATYP(IPv4) ADDR PORT — BND.ADDR/PORT are zeroed, unused.
  socket.write(Buffer.from([SOCKS_VERSION, rep, 0x00, ATYP_IPV4, 0, 0, 0, 0, 0, 0]));
}

/**
 * Create a SOCKS5 server. For every CONNECT request, `onTcpConnect` is called
 * with (host, port, clientSocket) and must either pipe the socket through the
 * SSH connection or destroy it.
 */
function createSocksServer(log, onTcpConnect) {
  const server = net.createServer((socket) => {
    let stage = 'greeting';
    let pending = Buffer.alloc(0);

    const fail = (message, reply) => {
      if (log) log.warn(`SOCKS5: ${message}`);
      try {
        if (stage === 'request' || reply !== undefined) sendRequestReply(socket, reply ?? REP_GENERAL_FAILURE);
      } catch (_) { /* socket already gone */ }
      socket.destroy();
    };

    socket.on('data', (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      try {
        if (stage === 'greeting') {
          const parsed = parseGreeting(pending);
          if (!parsed) return; // wait for more bytes
          if (parsed.error) return fail(parsed.error);
          pending = pending.subarray(parsed.consumed);
          sendGreetingReply(socket);
          stage = 'request';
          if (pending.length === 0) return;
        }
        if (stage === 'request') {
          const parsed = parseRequest(pending);
          if (!parsed) return; // wait for more bytes
          if (parsed.error) return fail(parsed.error, parsed.reply);
          // Hand the socket over — no more listeners from this server.
          socket.removeAllListeners('data');
          sendRequestReply(socket, REP_SUCCEEDED);
          onTcpConnect(parsed.host, parsed.port, socket);
        }
      } catch (err) {
        fail(`internal error: ${err.message}`);
      }
    });

    socket.on('error', () => { /* downstream handles errors; just avoid crashes */ });
  });

  return server;
}

module.exports = {
  parseGreeting,
  parseRequest,
  sendGreetingReply,
  sendRequestReply,
  createSocksServer,
  SOCKS_VERSION,
};
