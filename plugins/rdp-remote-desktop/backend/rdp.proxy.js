'use strict';

const tls = require('tls');
const net = require('net');
const WebSocket = require('ws');
const findFreePorts = require('find-free-ports');

// RDCleanPath version 1 (RDP port + 1).
const VERSION_1 = 3390;

const TAG_SEQUENCE = 0x30;
const TAG_INTEGER = 0x02;
const TAG_OCTET_STRING = 0x04;
const TAG_UTF8STRING = 0x0c;
const TAG_CTX = (n) => 0xa0 + n;

// ── ASN.1 DER helpers ───────────────────────────────────────────────────────

function derEncodeLength(length) {
  if (length < 0x80) {
    return Buffer.from([length]);
  }
  const bytes = [];
  let temp = length;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derWrap(tag, content) {
  return Buffer.concat([Buffer.from([tag]), derEncodeLength(content.length), content]);
}

function derEncodeInteger(value) {
  if (value === 0) {
    return derWrap(TAG_INTEGER, Buffer.from([0]));
  }
  const bytes = [];
  let temp = value;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp >>= 8;
  }
  if (bytes[0] & 0x80) {
    bytes.unshift(0);
  }
  return derWrap(TAG_INTEGER, Buffer.from(bytes));
}

function derEncodeUtf8String(str) {
  return derWrap(TAG_UTF8STRING, Buffer.from(str, 'utf-8'));
}

function derEncodeOctetString(buf) {
  return derWrap(TAG_OCTET_STRING, buf);
}

function derWrapContext(tagNum, content) {
  return derWrap(TAG_CTX(tagNum), content);
}

function derDecodeLength(buf, offset) {
  const first = buf[offset];
  if (first < 0x80) {
    return { length: first, bytesRead: 1 };
  }
  const numBytes = first & 0x7f;
  let length = 0;
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | buf[offset + 1 + i];
  }
  return { length, bytesRead: 1 + numBytes };
}

function derDecodeTLV(buf, offset) {
  const tag = buf[offset];
  const { length, bytesRead } = derDecodeLength(buf, offset + 1);
  const headerLen = 1 + bytesRead;
  const value = buf.slice(offset + headerLen, offset + headerLen + length);
  return { tag, value, totalLength: headerLen + length };
}

function derDecodeInteger(buf) {
  let val = 0;
  for (let i = 0; i < buf.length; i++) {
    val = (val << 8) | buf[i];
  }
  return val;
}

function derDecodeChildren(buf) {
  const children = [];
  let offset = 0;
  while (offset < buf.length) {
    const tlv = derDecodeTLV(buf, offset);
    children.push(tlv);
    offset += tlv.totalLength;
  }
  return children;
}

// ── RDCleanPath PDU ─────────────────────────────────────────────────────────

function parseRDCleanPathRequest(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const outer = derDecodeTLV(buf, 0);
  if (outer.tag !== TAG_SEQUENCE) {
    throw new Error(`Expected SEQUENCE (0x30), got 0x${outer.tag.toString(16)}`);
  }

  let version = null;
  let destination = null;
  let proxyAuth = null;
  let x224ConnectionRequest = null;
  let preconnectionBlob = null;

  for (const child of derDecodeChildren(outer.value)) {
    const ctxTag = child.tag & 0x1f;
    switch (ctxTag) {
      case 0:
        version = derDecodeInteger(derDecodeTLV(child.value, 0).value);
        break;
      case 2:
        destination = derDecodeTLV(child.value, 0).value.toString('utf-8');
        break;
      case 3:
        proxyAuth = derDecodeTLV(child.value, 0).value.toString('utf-8');
        break;
      case 5:
        preconnectionBlob = derDecodeTLV(child.value, 0).value.toString('utf-8');
        break;
      case 6:
        x224ConnectionRequest = derDecodeTLV(child.value, 0).value;
        break;
    }
  }

  if (version !== VERSION_1) {
    throw new Error(`Unsupported RDCleanPath version: ${version} (expected ${VERSION_1})`);
  }
  if (!destination) {
    throw new Error('Missing destination in RDCleanPath request');
  }
  if (!x224ConnectionRequest) {
    throw new Error('Missing x224_connection_pdu in RDCleanPath request');
  }

  return { destination, proxyAuth, x224ConnectionRequest, preconnectionBlob };
}

function buildRDCleanPathResponse(serverAddr, x224Response, certChain) {
  const parts = [];
  parts.push(derWrapContext(0, derEncodeInteger(VERSION_1)));
  parts.push(derWrapContext(6, derEncodeOctetString(x224Response)));
  const certOctets = certChain.map((cert) => derEncodeOctetString(cert));
  parts.push(derWrapContext(7, derWrap(TAG_SEQUENCE, Buffer.concat(certOctets))));
  parts.push(derWrapContext(9, derEncodeUtf8String(serverAddr)));
  return derWrap(TAG_SEQUENCE, Buffer.concat(parts));
}

function buildRDCleanPathError(errorCode, httpStatusCode) {
  const errParts = [derWrapContext(0, derEncodeInteger(errorCode))];
  if (httpStatusCode != null) {
    errParts.push(derWrapContext(1, derEncodeInteger(httpStatusCode)));
  }
  const parts = [
    derWrapContext(0, derEncodeInteger(VERSION_1)),
    derWrapContext(1, derWrap(TAG_SEQUENCE, Buffer.concat(errParts))),
  ];
  return derWrap(TAG_SEQUENCE, Buffer.concat(parts));
}

// ── Destination / handshake ────────────────────────────────────────────────

function parseDestination(destination) {
  if (destination.startsWith('[')) {
    const bracketEnd = destination.indexOf(']');
    if (bracketEnd === -1) throw new Error(`Invalid IPv6 destination: ${destination}`);
    const host = destination.slice(1, bracketEnd);
    const rest = destination.slice(bracketEnd + 1);
    const port = rest.startsWith(':') ? parseInt(rest.slice(1), 10) : 3389;
    return { host, port };
  }
  const lastColon = destination.lastIndexOf(':');
  if (lastColon === -1) {
    return { host: destination, port: 3389 };
  }
  const host = destination.slice(0, lastColon);
  const port = parseInt(destination.slice(lastColon + 1), 10);
  if (isNaN(port)) {
    return { host: destination, port: 3389 };
  }
  return { host, port };
}

function performRDPHandshake(host, port, x224Request, log) {
  return new Promise((resolve, reject) => {
    const tcpSocket = net.createConnection({ host, port }, () => {
      tcpSocket.write(x224Request);
    });

    tcpSocket.once('error', (err) => {
      reject(new Error(`TCP connection failed: ${err.message}`));
    });

    tcpSocket.once('data', (x224Response) => {
      if (x224Response.length === 0) {
        tcpSocket.destroy();
        reject(new Error('RDP server closed connection without X.224 response'));
        return;
      }

      tcpSocket.removeAllListeners('error');
      tcpSocket.removeAllListeners('data');
      tcpSocket.setTimeout(0);

      const tlsOptions = {
        socket: tcpSocket,
        rejectUnauthorized: false,
        // RDP self-signed certs often lack the digitalSignature key usage
        // required by TLS 1.3; RDP itself only needs TLS 1.2.
        maxVersion: 'TLSv1.2',
      };
      if (net.isIP(host) === 0) {
        tlsOptions.servername = host;
      }
      const tlsSocket = tls.connect(
        tlsOptions,
        () => {
          log?.debug?.(`[rdp] TLS ${tlsSocket.getProtocol()} (${tlsSocket.getCipher()?.name}) established with ${host}:${port}`);
          const peerCert = tlsSocket.getPeerCertificate(true);
          resolve({
            x224Response: Buffer.from(x224Response),
            certChain: extractCertChain(peerCert),
            tlsSocket,
          });
        }
      );

      tlsSocket.once('error', (err) => {
        tlsSocket.destroy();
        reject(new Error(`TLS handshake failed: ${err.message}`));
      });
    });

    tcpSocket.setTimeout(15000, () => {
      tcpSocket.destroy();
      reject(new Error('Connection timed out'));
    });
  });
}

function extractCertChain(peerCert) {
  const certs = [];
  if (!peerCert || !peerCert.raw) return certs;

  const seen = new Set();
  let current = peerCert;
  while (current && current.raw) {
    const fingerprint = current.fingerprint256 || current.raw.toString('hex');
    if (seen.has(fingerprint)) break;
    seen.add(fingerprint);
    certs.push(Buffer.from(current.raw));

    if (current.issuerCertificate && current.issuerCertificate !== current) {
      current = current.issuerCertificate;
    } else {
      break;
    }
  }
  return certs;
}

function setupRelay(ws, tlsSocket, log, id) {
  tlsSocket.on('data', (data) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    } catch (err) {
      log.debug(`[rdp ${id}] TLS→WS write error: ${err.message}`);
    }
  });

  ws.on('message', (data) => {
    try {
      if (!tlsSocket.destroyed) {
        tlsSocket.write(data);
      }
    } catch (err) {
      log.debug(`[rdp ${id}] WS→TLS write error: ${err.message}`);
    }
  });

  const cleanup = (source) => {
    log.debug(`[rdp ${id}] relay closed (${source})`);
    if (!tlsSocket.destroyed) tlsSocket.destroy();
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.close(); } catch (_) { /* ignore */ }
    }
  };

  tlsSocket.on('end', () => cleanup('TLS'));
  tlsSocket.on('error', (err) => {
    log.debug(`[rdp ${id}] TLS error: ${err.message}`);
    cleanup('TLS error');
  });
  ws.on('close', () => cleanup('WebSocket'));
  ws.on('error', (err) => {
    log.debug(`[rdp ${id}] WebSocket error: ${err.message}`);
    cleanup('WebSocket error');
  });
}

function handleConnection(ws, log, allowed, id) {
  ws.once('message', async (data) => {
    try {
      const request = parseRDCleanPathRequest(data);
      const dest = parseDestination(request.destination);

      // The renderer must not be able to use this proxy as a generic pivot.
      if (allowed && (dest.port !== allowed.port || dest.host.toLowerCase() !== allowed.host.toLowerCase())) {
        throw new Error(`Destination ${dest.host}:${dest.port} does not match profile`);
      }

      const { x224Response, certChain, tlsSocket } = await performRDPHandshake(
        allowed.host,
        allowed.port,
        request.x224ConnectionRequest
      );

      ws.send(buildRDCleanPathResponse(`${allowed.host}:${allowed.port}`, x224Response, certChain));
      setupRelay(ws, tlsSocket, log, id);
    } catch (err) {
      log.warn(`[rdp ${id}] RDCleanPath handshake failed: ${err.message}`);
      try {
        ws.send(buildRDCleanPathError(1, 502));
      } catch (_) { /* ignore */ }
      try { ws.close(); } catch (_) { /* ignore */ }
    }
  });

  ws.on('error', (err) => {
    log.debug(`[rdp ${id}] WebSocket error: ${err.message}`);
  });
}

/**
 * Start a per-session RDCleanPath WebSocket proxy.
 * @param {{info: Function, debug: Function, warn: Function, error: Function}} log
 * @param {{host: string, port: number}} allowed destination this proxy may reach
 * @param {string} id session id (for logs)
 */
async function startProxy(log, allowed, id) {
  const ports = await findFreePorts(1, { startPort: 7000 });
  const port = ports[0];
  const wss = new WebSocket.Server({ port, host: '127.0.0.1' });
  const sockets = new Set();

  wss.on('connection', (ws) => {
    sockets.add(ws);
    ws.on('close', () => sockets.delete(ws));
    handleConnection(ws, log, allowed, id);
  });

  wss.on('error', (err) => {
    log.error(`[rdp ${id}] proxy error: ${err.message}`);
  });

  log.info(`[rdp ${id}] RDCleanPath proxy on ws://127.0.0.1:${port} -> ${allowed.host}:${allowed.port}`);

  return {
    port,
    async close() {
      for (const ws of sockets) {
        try { ws.terminate(); } catch (_) { /* ignore */ }
      }
      await new Promise((resolve) => wss.close(() => resolve()));
    },
  };
}

module.exports = { startProxy };
