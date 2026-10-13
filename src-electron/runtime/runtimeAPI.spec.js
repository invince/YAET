/**
 * Unit tests for RuntimeAPI.resolveTunnel (A1 rework: first-class tunnels).
 * Stubs services/securityService.decrypt with real AES (test password) and
 * feeds configService from in-memory encrypted fixtures — no fs, no keyring.
 * Run: node --test src-electron/runtime/runtimeAPI.spec.js
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const CryptoJS = require('crypto-js');

const TEST_PASSWORD = 'tunnel-spec-password';

function encrypt(obj) {
  return CryptoJS.AES.encrypt(JSON.stringify(obj), TEST_PASSWORD).toString();
}

// Stub BEFORE requiring runtimeAPI (it destructures decrypt at load time).
const secSvcPath = require.resolve('../services/securityService');
require.cache[secSvcPath] = {
  exports: {
    SecurityService: class {},
    decrypt: async (ciphertext) => {
      const bytes = CryptoJS.AES.decrypt(ciphertext, TEST_PASSWORD);
      const text = bytes.toString(CryptoJS.enc.Utf8);
      if (!text) throw new Error('decrypt failed');
      return text;
    },
  },
  loaded: true,
};

const { RuntimeAPI } = require('./runtimeAPI');

const SECRETS = {
  secrets: [
    { id: 'sec-login', secretType: 'LOGIN_PASSWORD', login: 'dbuser', password: 'dbpass' },
    { id: 'sec-key', secretType: 'SSH_KEY', login: 'git', key: 'KEYDATA', passphrase: 'pp' },
  ],
};

function makeApi({ tunnels, profiles, secrets = SECRETS, proxies = { proxies: [] } } = {}) {
  const api = new RuntimeAPI(console);
  api.configService = {
    getTunnels: async () => (tunnels ? encrypt(tunnels) : null),
    getProfiles: async () => (profiles ? encrypt(profiles) : null),
  };
  api.secretRepo = () => secrets;
  api.proxyRepo = () => proxies;
  return api;
}

function tunnelDoc(tunnel) {
  return { tunnels: [tunnel] };
}

function sshProfileDoc() {
  return {
    profiles: [{
      id: 'p1', name: 'srv', profileType: 'SSH_TERMINAL',
      profileData: {
        SSH_TERMINAL: { host: 'srv.example', port: 2222, authType: 'secret', secretId: 'sec-login' },
      },
    }],
  };
}

describe('RuntimeAPI.resolveTunnel', () => {
  let api;
  beforeEach(() => {
    api = makeApi({ tunnels: tunnelDoc({}), profiles: sshProfileDoc() });
  });

  it('rejects unknown tunnel ids', async () => {
    await assert.rejects(() => api.resolveTunnel('nope'), /Tunnel not found: nope/);
  });

  it('rejects invalid forward params', async () => {
    api = makeApi({
      tunnels: tunnelDoc({ id: 't1', type: 'local', localPort: 1, remoteHost: '', remotePort: 2, connection: { mode: 'adhoc', host: 'h' } }),
      profiles: sshProfileDoc(),
    });
    await assert.rejects(() => api.resolveTunnel('t1'), /remoteHost/);
  });

  it('resolves profile mode via the referenced SSH profile', async () => {
    api = makeApi({
      tunnels: tunnelDoc({
        id: 't1', name: 'db', type: 'local', localPort: 13306, remoteHost: '127.0.0.1', remotePort: 3306,
        connection: { mode: 'profile', profileId: 'p1' },
      }),
      profiles: sshProfileDoc(),
    });
    const resolved = await api.resolveTunnel('t1');
    assert.equal(resolved.tunnelName, 'db');
    assert.equal(resolved.profileId, 'p1');
    assert.equal(resolved.profileName, 'srv');
    assert.equal(resolved.rule.localPort, 13306);
    assert.deepEqual(
      { host: resolved.sshConfig.host, port: resolved.sshConfig.port, username: resolved.sshConfig.username, password: resolved.sshConfig.password },
      { host: 'srv.example', port: 2222, username: 'dbuser', password: 'dbpass' },
    );
  });

  it('rejects non-SSH profiles with a clear error', async () => {
    api = makeApi({
      tunnels: tunnelDoc({
        id: 't1', type: 'local', localPort: 1, remoteHost: 'h', remotePort: 2,
        connection: { mode: 'profile', profileId: 'p9' },
      }),
      profiles: { profiles: [{ id: 'p9', name: 't', profileType: 'TELNET_TERMINAL', profileData: { TELNET_TERMINAL: { host: 'h' } } }] },
    });
    await assert.rejects(() => api.resolveTunnel('t1'), /needs an SSH profile/);
  });

  it('rejects profile mode without a selected profile', async () => {
    api = makeApi({
      tunnels: tunnelDoc({
        id: 't1', type: 'local', localPort: 1, remoteHost: 'h', remotePort: 2,
        connection: { mode: 'profile' },
      }),
      profiles: sshProfileDoc(),
    });
    await assert.rejects(() => api.resolveTunnel('t1'), /has no SSH profile selected/);
  });

  it('resolves adhoc login auth from inline credentials', async () => {
    api = makeApi({
      tunnels: tunnelDoc({
        id: 't1', type: 'dynamic', localPort: 1080,
        connection: { mode: 'adhoc', host: 'jump.example', port: 2222, authType: 'login', login: 'ops', password: 's3cret' },
      }),
      profiles: sshProfileDoc(),
    });
    const resolved = await api.resolveTunnel('t1');
    assert.equal(resolved.profileId, '');
    assert.deepEqual(
      { host: resolved.sshConfig.host, port: resolved.sshConfig.port, username: resolved.sshConfig.username, password: resolved.sshConfig.password },
      { host: 'jump.example', port: 2222, username: 'ops', password: 's3cret' },
    );
  });

  it('resolves adhoc secret auth via SSH_KEY with passphrase', async () => {
    api = makeApi({
      tunnels: tunnelDoc({
        id: 't1', type: 'local', localPort: 1, remoteHost: 'h', remotePort: 2,
        connection: { mode: 'adhoc', host: 'jump.example', authType: 'secret', secretId: 'sec-key' },
      }),
      profiles: sshProfileDoc(),
    });
    const resolved = await api.resolveTunnel('t1');
    assert.equal(resolved.sshConfig.username, 'git');
    assert.equal(resolved.sshConfig.privateKey, 'KEYDATA');
    assert.equal(resolved.sshConfig.passphrase, 'pp');
  });

  it('rejects adhoc secret auth with unknown secret ids', async () => {
    api = makeApi({
      tunnels: tunnelDoc({
        id: 't1', type: 'local', localPort: 1, remoteHost: 'h', remotePort: 2,
        connection: { mode: 'adhoc', host: 'jump.example', authType: 'secret', secretId: 'ghost' },
      }),
      profiles: sshProfileDoc(),
    });
    await assert.rejects(() => api.resolveTunnel('t1'), /Secret not found: ghost/);
  });

  it('rejects adhoc without host', async () => {
    api = makeApi({
      tunnels: tunnelDoc({
        id: 't1', type: 'local', localPort: 1, remoteHost: 'h', remotePort: 2,
        connection: { mode: 'adhoc', authType: 'login', login: 'u' },
      }),
      profiles: sshProfileDoc(),
    });
    await assert.rejects(() => api.resolveTunnel('t1'), /has no host configured/);
  });

  it('resolves adhoc proxyId to a live sock via a fake HTTP proxy', async () => {
    // Minimal HTTP CONNECT proxy on loopback.
    const proxyServer = net.createServer((socket) => {
      socket.once('data', () => socket.write('HTTP/1.1 200 Connection established\r\n\r\n'));
    });
    await new Promise((resolve) => proxyServer.listen(0, '127.0.0.1', resolve));
    const proxyPort = proxyServer.address().port;
    try {
      api = makeApi({
        tunnels: tunnelDoc({
          id: 't1', type: 'local', localPort: 1, remoteHost: 'h', remotePort: 2,
          connection: { mode: 'adhoc', host: 'target.example', authType: 'login', login: 'u', password: 'p', proxyId: 'px1' },
        }),
        profiles: sshProfileDoc(),
        proxies: { proxies: [{ id: 'px1', type: 'HTTP', host: '127.0.0.1', port: proxyPort }] },
      });
      const resolved = await api.resolveTunnel('t1');
      assert.ok(resolved.sshConfig.sock, 'expected a proxy socket');
      resolved.sshConfig.sock.destroy();
    } finally {
      proxyServer.close();
    }
  });
});
