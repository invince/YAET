/**
 * known_hosts management (A3 — SSH host-key verification).
 *
 * Stores trusted server host keys in OpenSSH known_hosts line format
 * (`<hosts> <keytype> <base64> [comment]`) at `<configDir>/known_hosts`
 * (~/.yaet in production, isolated per envConfig in dev/e2e).
 *
 * Non-standard ports use the OpenSSH `[host]:port` token. Hashed
 * (`|1|...`) and malformed lines are preserved verbatim on write but never
 * match (same conservative stance as strict OpenSSH consumers).
 *
 * Pure-logic helpers (fingerprints, randomart, line parse/format) are
 * exported for unit tests.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getAppConfigPath } = require('./envConfig');

const KNOWN_HOSTS_FILE = 'known_hosts';

function hostToken(host, port) {
  const p = Number(port) || 22;
  return p === 22 ? String(host) : `[${host}]:${p}`;
}

function parseHostToken(token) {
  const m = /^\[(.+)\]:(\d+)$/.exec(String(token || ''));
  if (m) return { host: m[1], port: Number(m[2]) };
  return { host: String(token || ''), port: 22 };
}

/**
 * Parse one known_hosts line.
 * Returns { hosts[], keyType, base64, comment } | { raw, preserved:true }.
 */
function parseLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return { raw: line, preserved: true };
  const parts = trimmed.split(/\s+/);
  if (parts.length < 3) return { raw: line, preserved: true };
  const [hostsField, keyType, base64, ...rest] = parts;
  if (hostsField.startsWith('|') || hostsField.startsWith('@')) {
    // Hashed host or @cert-authority/@revoked marker — preserve, never match.
    return { raw: line, preserved: true };
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) return { raw: line, preserved: true };
  return { hosts: hostsField.split(','), keyType, base64, comment: rest.join(' ') };
}

function formatLine({ hosts, keyType, base64, comment }) {
  return [hosts.join(','), keyType, base64, comment].filter(Boolean).join(' ');
}

function fingerprintSHA256(base64Key) {
  const digest = crypto.createHash('sha256').update(Buffer.from(base64Key, 'base64')).digest('base64');
  return `SHA256:${digest.replace(/=+$/, '')}`;
}

function fingerprintMD5(base64Key) {
  const hex = crypto.createHash('md5').update(Buffer.from(base64Key, 'base64')).digest('hex');
  return hex.match(/../g).join(':');
}

/**
 * OpenBSD "drunken bishop" randomart (same algorithm as ssh-keygen -v).
 * Drawn over the SHA256 digest so it is stable for a given key.
 */
function randomart(base64Key, keyType = 'SSH') {
  const WIDTH = 17;
  const HEIGHT = 9;
  const CHARS = ' .o+=*BOX@%&#/^SE';
  const field = Array.from({ length: HEIGHT }, () => new Array(WIDTH).fill(0));
  const digest = crypto.createHash('sha256').update(Buffer.from(base64Key, 'base64')).digest();
  let x = Math.floor(WIDTH / 2);
  let y = Math.floor(HEIGHT / 2);
  for (const byte of digest) {
    let b = byte;
    for (let i = 0; i < 4; i += 1) {
      x += (b & 0x1) ? 1 : -1;
      y += (b & 0x2) ? 1 : -1;
      x = Math.max(0, Math.min(WIDTH - 1, x));
      y = Math.max(0, Math.min(HEIGHT - 1, y));
      field[y][x] = Math.min(field[y][x] + 1, CHARS.length - 3);
      b >>= 2;
    }
  }
  const sx = Math.floor(WIDTH / 2);
  const sy = Math.floor(HEIGHT / 2);
  field[sy][sx] = CHARS.length - 2; // start
  field[y][x] = CHARS.length - 1; // end
  const title = `[${String(keyType).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) || 'SSH'}]`;
  const dashes = WIDTH - title.length;
  const left = Math.floor(dashes / 2);
  const lines = [`+${'-'.repeat(left)}${title}${'-'.repeat(dashes - left)}+`];
  for (const row of field) lines.push(`|${row.map((v) => CHARS[v]).join('')}|`);
  lines.push(`+${'-'.repeat(WIDTH)}+`);
  return lines.join('\n');
}

function keyInfo(keyType, base64) {
  return {
    keyType,
    base64,
    sha256: fingerprintSHA256(base64),
    md5: fingerprintMD5(base64),
    randomart: randomart(base64, keyType),
  };
}

class KnownHostsService {
  constructor(log, configDir) {
    this.log = log;
    this.configDir = configDir || getAppConfigPath();
  }

  filePath() {
    return path.join(this.configDir, KNOWN_HOSTS_FILE);
  }

  /** Raw parsed lines: usable entries + preserved (hashed/comments/malformed). */
  loadLines() {
    const fp = this.filePath();
    if (!fs.existsSync(fp)) return [];
    const content = fs.readFileSync(fp, 'utf-8');
    return content.split('\n').filter((l) => l.length > 0).map(parseLine);
  }

  entries() {
    return this.loadLines().filter((l) => !l.preserved);
  }

  /** Enriched entries for UI: host/port per token + fingerprints. */
  list() {
    const out = [];
    for (const e of this.entries()) {
      for (const token of e.hosts) {
        const { host, port } = parseHostToken(token);
        out.push({ host, port, keyType: e.keyType, ...keyInfo(e.keyType, e.base64) });
      }
    }
    return out;
  }

  /**
   * Verify a presented key: 'MATCH' | 'CHANGED' (same host+keyType, new key —
   * possible MITM) | 'UNKNOWN' (no entry for host, or new key type).
   */
  verify(host, port, keyType, base64) {
    const token = hostToken(host, port);
    const bare = String(host);
    const candidates = this.entries().filter(
      (e) => e.hosts.includes(token) || (Number(port) === 22 && e.hosts.includes(bare)),
    );
    if (candidates.length === 0) return 'UNKNOWN';
    const sameType = candidates.filter((e) => e.keyType === keyType);
    if (sameType.length === 0) return 'UNKNOWN';
    return sameType.some((e) => e.base64 === base64) ? 'MATCH' : 'CHANGED';
  }

  /**
   * Add (or replace) a key. Replaces any same-host(+port)+keyType entry so a
   * user-approved rotation never leaves a stale key that would re-trigger
   * CHANGED. Returns the stored line.
   */
  add({ host, port, keyType, base64, comment }) {
    if (!host || !keyType || !base64) throw new Error('host, keyType and base64 are required');
    const token = hostToken(host, port);
    const bare = String(host);
    const lines = this.loadLines().filter((l) => {
      if (l.preserved) return true;
      if (l.keyType !== keyType) return true;
      const hit = l.hosts.includes(token) || (Number(port) === 22 && l.hosts.includes(bare));
      return !hit;
    });
    lines.push({ hosts: [token], keyType, base64, comment: comment || '' });
    this.writeLines(lines);
    return { host, port: Number(port) || 22, keyType };
  }

  remove({ host, port, keyType }) {
    const token = host ? hostToken(host, port) : null;
    const bare = host ? String(host) : null;
    const before = this.loadLines();
    const after = before.filter((l) => {
      if (l.preserved) return true;
      if (token) {
        const hit = l.hosts.includes(token) || (Number(port) === 22 && bare && l.hosts.includes(bare));
        if (!hit) return true;
        if (keyType && l.keyType !== keyType) return true;
        return false;
      }
      if (keyType && l.keyType !== keyType) return true;
      return false;
    });
    const removed = before.length - after.length;
    if (removed > 0) this.writeLines(after);
    return { removed };
  }

  /**
   * Import entries from an OpenSSH known_hosts file. Hashed/malformed lines
   * are skipped (reported). Exact duplicates are skipped. Returns counts.
   */
  importOpenSSH(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const existing = new Set(this.entries().map((e) => `${e.hosts.join(',')}|${e.keyType}|${e.base64}`));
    let added = 0;
    let skipped = 0;
    const lines = this.loadLines();
    for (const raw of content.split('\n')) {
      if (!raw.trim()) continue;
      const parsed = parseLine(raw);
      if (parsed.preserved) {
        skipped += 1;
        continue;
      }
      const key = `${parsed.hosts.join(',')}|${parsed.keyType}|${parsed.base64}`;
      if (existing.has(key)) {
        skipped += 1;
        continue;
      }
      existing.add(key);
      lines.push({ hosts: parsed.hosts, keyType: parsed.keyType, base64: parsed.base64, comment: parsed.comment || '' });
      added += 1;
    }
    if (added > 0) this.writeLines(lines);
    return { added, skipped };
  }

  writeLines(lines) {
    if (!fs.existsSync(this.configDir)) fs.mkdirSync(this.configDir, { recursive: true });
    const body = lines.map((l) => (l.preserved ? l.raw : formatLine(l))).join('\n');
    fs.writeFileSync(this.filePath(), body.length > 0 ? `${body}\n` : '', 'utf-8');
    if (this.log) this.log.info(`known_hosts written (${lines.length} lines)`);
  }
}

module.exports = {
  KnownHostsService,
  KNOWN_HOSTS_FILE,
  hostToken,
  parseHostToken,
  parseLine,
  formatLine,
  fingerprintSHA256,
  fingerprintMD5,
  randomart,
  keyInfo,
};
