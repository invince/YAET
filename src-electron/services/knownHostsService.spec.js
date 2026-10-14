/**
 * Unit tests for knownHostsService.js (A3 host-key verification).
 * Run: node --test src-electron/services/knownHostsService.spec.js
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  KnownHostsService,
  hostToken,
  parseHostToken,
  parseLine,
  fingerprintSHA256,
  fingerprintMD5,
  randomart,
} = require('./knownHostsService');

// Well-known test vector: valid base64, stable fingerprints.
const KEY_A = Buffer.from('test-key-material-a').toString('base64');
const KEY_B = Buffer.from('test-key-material-b').toString('base64');

describe('knownHostsService helpers', () => {
  it('hostToken uses [host]:port only for non-22 ports', () => {
    assert.equal(hostToken('example.com', 22), 'example.com');
    assert.equal(hostToken('example.com', undefined), 'example.com');
    assert.equal(hostToken('example.com', 2222), '[example.com]:2222');
  });

  it('parseHostToken round-trips bracketed and bare tokens', () => {
    assert.deepEqual(parseHostToken('[example.com]:2222'), { host: 'example.com', port: 2222 });
    assert.deepEqual(parseHostToken('example.com'), { host: 'example.com', port: 22 });
  });

  it('parseLine preserves comments, hashed and malformed lines', () => {
    assert.equal(parseLine('# comment').preserved, true);
    assert.equal(parseLine('|1|salt|hash ssh-ed25519 AAAA').preserved, true);
    assert.equal(parseLine('only-two fields').preserved, true);
    const good = parseLine(`example.com ssh-ed25519 ${KEY_A} comment`);
    assert.equal(good.preserved, undefined);
    assert.deepEqual(good.hosts, ['example.com']);
    assert.equal(good.comment, 'comment');
  });

  it('fingerprints are stable and OpenSSH-styled', () => {
    assert.match(fingerprintSHA256(KEY_A), /^SHA256:[A-Za-z0-9+/]+$/);
    assert.match(fingerprintMD5(KEY_A), /^([0-9a-f]{2}:){15}[0-9a-f]{2}$/);
    assert.notEqual(fingerprintSHA256(KEY_A), fingerprintSHA256(KEY_B));
  });

  it('randomart renders a 17-wide drunken-bishop box', () => {
    const art = randomart(KEY_A, 'ssh-ed25519').split('\n');
    assert.equal(art.length, 11);
    assert.match(art[0], /^\+-+(\[SSH-ED25519\])-+\+$/);
    assert.equal(randomart(KEY_A), randomart(KEY_A));
    assert.notEqual(randomart(KEY_A), randomart(KEY_B));
  });
});

describe('KnownHostsService', () => {
  let dir;
  let svc;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaet-known-hosts-'));
    svc = new KnownHostsService(null, dir);
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('verify returns UNKNOWN on an empty store', () => {
    assert.equal(svc.verify('example.com', 22, 'ssh-ed25519', KEY_A), 'UNKNOWN');
  });

  it('add then verify MATCH; different key gives CHANGED', () => {
    svc.add({ host: 'example.com', port: 22, keyType: 'ssh-ed25519', base64: KEY_A });
    assert.equal(svc.verify('example.com', 22, 'ssh-ed25519', KEY_A), 'MATCH');
    assert.equal(svc.verify('example.com', 22, 'ssh-ed25519', KEY_B), 'CHANGED');
  });

  it('new key type for a known host is UNKNOWN (not CHANGED)', () => {
    svc.add({ host: 'example.com', port: 22, keyType: 'ssh-ed25519', base64: KEY_A });
    assert.equal(svc.verify('example.com', 22, 'ssh-rsa', KEY_B), 'UNKNOWN');
  });

  it('non-standard ports are keyed separately via [host]:port', () => {
    svc.add({ host: 'example.com', port: 2222, keyType: 'ssh-ed25519', base64: KEY_A });
    assert.equal(svc.verify('example.com', 2222, 'ssh-ed25519', KEY_A), 'MATCH');
    assert.equal(svc.verify('example.com', 22, 'ssh-ed25519', KEY_A), 'UNKNOWN');
  });

  it('add replaces same host+keyType (rotation never leaves stale keys)', () => {
    svc.add({ host: 'example.com', port: 22, keyType: 'ssh-ed25519', base64: KEY_A });
    svc.add({ host: 'example.com', port: 22, keyType: 'ssh-ed25519', base64: KEY_B });
    assert.equal(svc.verify('example.com', 22, 'ssh-ed25519', KEY_B), 'MATCH');
    assert.equal(svc.entries().length, 1);
  });

  it('remove deletes matching entries and reports counts', () => {
    svc.add({ host: 'a.com', port: 22, keyType: 'ssh-ed25519', base64: KEY_A });
    svc.add({ host: 'b.com', port: 22, keyType: 'ssh-ed25519', base64: KEY_A });
    assert.deepEqual(svc.remove({ host: 'a.com', port: 22 }), { removed: 1 });
    assert.equal(svc.verify('a.com', 22, 'ssh-ed25519', KEY_A), 'UNKNOWN');
    assert.equal(svc.verify('b.com', 22, 'ssh-ed25519', KEY_A), 'MATCH');
  });

  it('list enriches entries with host/port/fingerprints', () => {
    svc.add({ host: 'example.com', port: 2222, keyType: 'ssh-ed25519', base64: KEY_A });
    const list = svc.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].host, 'example.com');
    assert.equal(list[0].port, 2222);
    assert.match(list[0].sha256, /^SHA256:/);
    assert.ok(list[0].randomart.includes('+'));
  });

  it('importOpenSSH imports plain entries, skips hashed/duplicates', () => {
    const src = path.join(dir, 'ssh-known_hosts');
    fs.writeFileSync(
      src,
      [`a.com ssh-ed25519 ${KEY_A}`, '|1|salt|hash ssh-ed25519 AAAA', `a.com ssh-ed25519 ${KEY_A}`, ''].join('\n'),
    );
    const res = svc.importOpenSSH(src);
    assert.deepEqual(res, { added: 1, skipped: 2 });
    assert.equal(svc.verify('a.com', 22, 'ssh-ed25519', KEY_A), 'MATCH');
  });

  it('file round-trips OpenSSH line format', () => {
    svc.add({ host: 'example.com', port: 22, keyType: 'ssh-ed25519', base64: KEY_A });
    const raw = fs.readFileSync(path.join(dir, 'known_hosts'), 'utf-8').trim();
    assert.equal(raw, `example.com ssh-ed25519 ${KEY_A}`);
  });
});
