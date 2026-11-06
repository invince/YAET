/**
 * `yaet known-hosts probe|pin|import|list` — headless host-key management.
 *
 * The GUI approves unknown/changed SSH host keys via the renderer modal
 * (A3). Protocol-server (MCP/ACP) hosts have no renderer, so the connector
 * fails closed and there was no way to pin a key at all. This command is
 * the CLI counterpart of that modal:
 *
 *   probe           connect once, print the key the server presented
 *                   (fingerprints, no randomart, nothing is stored)
 *   pin --fingerprint ...   connect, compare the presented key with the
 *                   user-confirmed fingerprint, store only on exact match
 *   import [file]   import an OpenSSH known_hosts file (default
 *                   ~/.ssh/known_hosts, hashed lines skipped with a count)
 *   list            show pinned host keys (sha256 per entry)
 *
 * Exit codes: 0 ok, 1 error, 2 unknown key (probe), 3 changed key (probe).
 */
const os = require('os');
const path = require('path');
const { Logger } = require('../common/logger');
const { resolveMasterKey } = require('../common/masterKey');
const { resolveConfig } = require('../common/credentialResolver');
const { KnownHostsService } = require('../../src-electron/services/knownHostsService');
const {
  SshTerminalSession,
} = require('../../plugins/ssh-terminal/backend/ssh.connector');

const log = new Logger('hostkey-cli');

function printHelp() {
  console.log(`
yaet known-hosts — headless SSH host-key management (A3, CLI side)

Usage:
  yaet known-hosts probe <profileName>            Show the key the server presents
  yaet known-hosts probe --host H --username U [--port N] [--password P | --privateKey <path>]
  yaet known-hosts pin   <profileName> --fingerprint SHA256:xxxx [--comment C]
  yaet known-hosts pin   --host H ... --fingerprint SHA256:xxxx
  yaet known-hosts import [<known_hosts file>]    Default: ~/.ssh/known_hosts
  yaet known-hosts list

Pin stores the key ONLY if the fingerprint given on the command line matches
the key the server presented (user confirmed it out of band).
Exit codes: 0 ok, 1 error, 2 unknown key, 3 changed key.
`);
}

function parseArgs(argv) {
  const opts = {
    positional: [],
    host: null,
    port: null,
    username: null,
    password: null,
    privateKey: null,
    fingerprint: null,
    comment: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--host') opts.host = argv[++i];
    else if (a === '--port') opts.port = Number(argv[++i]);
    else if (a === '--username') opts.username = argv[++i];
    else if (a === '--password') opts.password = argv[++i];
    else if (a === '--privateKey') opts.privateKey = argv[++i];
    else if (a === '--fingerprint') opts.fingerprint = argv[++i];
    else if (a === '--comment') opts.comment = argv[++i];
    else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}`);
    else opts.positional.push(a);
  }
  return opts;
}

function normalizeFingerprint(value) {
  if (!value) return null;
  const bare = String(value).replace(/^sha256:/i, '').replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]{40,50}$/.test(bare)) {
    throw new Error(`Fingerprint must be in SHA256:<base64> form — got '${value}'`);
  }
  return bare.toUpperCase();
}

function credArgs(opts, target) {
  const args = {};
  if (target) args.profileName = target;
  if (opts.host) args.host = opts.host;
  if (opts.port) args.port = opts.port;
  if (opts.username) args.username = opts.username;
  if (opts.password) args.password = opts.password;
  if (opts.privateKey) args.privateKey = opts.privateKey;
  return args;
}

/**
 * Connect with the barest command possible and let the connector classify
 * the host key. On success the key was already pinned; on HOST_KEY_* errors
 * err.details carries what the server presented. Never runs the actual
 * user command (the handshake rejects before the exec channel exists).
 */
async function handshake(config) {
  const svc = new KnownHostsService(log);
  const session = new SshTerminalSession(log, config);
  try {
    await session.exec('true', 15);
    const entries = svc.list().filter(
      (e) => e.host === config.host && e.port === (config.port || 22),
    );
    return { status: 'MATCH', entries };
  } catch (err) {
    if (err.code === 'HOST_KEY_UNKNOWN' || err.code === 'HOST_KEY_CHANGED') {
      return { status: err.code, details: err.details || {} };
    }
    throw err;
  }
}

function presentKey(info) {
  console.log(`  keyType:   ${info.keyType}`);
  console.log(`  sha256:    ${info.sha256}`);
  console.log(`  md5:       ${info.md5}`);
  console.log(`  pin with:  yaet known-hosts pin <target> --fingerprint ${info.sha256}`);
}

async function cmdProbe(opts) {
  const target = opts.positional[0] || null;
  if (!target && !opts.host) throw new Error('Provide a profileName or --host ...');
  const config = await resolveConfig(credArgs(opts, target), resolveMasterKey);
  console.log(`Probing ${config.host}:${config.port || 22} ...`);
  const result = await handshake(config);
  if (result.status === 'MATCH') {
    console.log(`Host key is already pinned and matches (${result.entries.length} key(s) on record).`);
    return 0;
  }
  const changed = result.status === 'HOST_KEY_CHANGED';
  const d = result.details;
  console.log(changed
    ? `Host key for ${config.host} HAS CHANGED — possible MITM; update only if you trust the new key.`
    : `Host key for ${config.host} (not in known_hosts)`);
  console.log('Presented key:');
  presentKey(d);
  return changed ? 3 : 2;
}

async function cmdPin(opts) {
  const target = opts.positional[0] || null;
  if (!target && !opts.host) throw new Error('Provide a profileName or --host ...');
  const wanted = normalizeFingerprint(opts.fingerprint);
  if (!wanted) throw new Error('pin requires --fingerprint SHA256:<base64> (the key you trust)');
  const config = await resolveConfig(credArgs(opts, target), resolveMasterKey);
  console.log(`Connecting to ${config.host}:${config.port || 22} to verify the fingerprint ...`);
  const result = await handshake(config);
  if (result.status === 'MATCH') {
    console.log('Host key already pinned and matches — nothing to do.');
    return 0;
  }
  const presented = normalizeFingerprint(result.details.sha256);
  if (presented !== wanted) {
    // Display uses the server's raw casing so it matches the probe output
    // visually; comparison above is normalized.
    throw new Error(
      `Fingerprint mismatch: server presented ${result.details.sha256}, you asked to pin ${opts.fingerprint}. NOT stored.`,
    );
  }
  const svc = new KnownHostsService(log);
  const stored = svc.add({
    host: result.details.host,
    port: result.details.port,
    keyType: result.details.keyType,
    base64: result.details.base64,
    comment: opts.comment || 'pinned via yaet CLI',
  });
  console.log(`Pinned ${stored.host}:${stored.port} keyType=${stored.keyType} (${result.details.sha256}).`);
  return 0;
}

async function cmdImport(opts) {
  const file = opts.positional[0]
    || path.join(os.homedir(), '.ssh', 'known_hosts');
  const svc = new KnownHostsService(log);
  const { added, skipped } = svc.importOpenSSH(file);
  console.log(`Imported ${added} key line(s) from ${file} (${skipped} skipped: hashed/dupes/comments).`);
  if (skipped > 0) {
    console.log('Note: hashed hosts (|1|...) are skipped — OpenSSH hashing is a privacy feature.');
  }
  return 0;
}

async function cmdList() {
  const svc = new KnownHostsService(log);
  const entries = svc.list().sort((a, b) => a.host.localeCompare(b.host) || a.port - b.port);
  if (entries.length === 0) {
    console.log('No pinned host keys yet.');
    console.log('See: yaet known-hosts import ~/.ssh/known_hosts  |  probe + pin');
    return 0;
  }
  for (const e of entries) {
    console.log(`${e.host}:${e.port}  ${e.keyType}  ${e.sha256}`);
  }
  return 0;
}

async function runHostkey(argv) {
  const [sub, ...rest] = argv;
  if (sub === 'probe') return cmdProbe(parseArgs(rest));
  if (sub === 'pin') return cmdPin(parseArgs(rest));
  if (sub === 'import') return cmdImport(parseArgs(rest));
  if (sub === 'list') return cmdList();
  printHelp();
  if (sub && sub !== '--help' && sub !== '-h') throw new Error(`Unknown subcommand: ${sub}`);
  return 0;
}

module.exports = { runHostkey };
