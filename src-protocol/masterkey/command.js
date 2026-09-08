/**
 * `yaet masterkey set|check` — headless master key management.
 *
 *   masterkey set [--file <path>] [--key <key>] [--force]
 *   masterkey check [--master-key <key>]
 *
 * Default key file: $YAET_MASTER_KEY_FILE if set, else <configDir>/.masterkey
 * (0600). After `set`, export YAET_MASTER_KEY_FILE=<path> on the headless
 * machine (shell profile, systemd EnvironmentFile=, ...).
 */
const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');
const { getAppConfigPath } = require('../../src-electron/services/envConfig');
const { resolveMasterKeyWithSource } = require('../common/masterKey');

function defaultKeyFile() {
  if (process.env.YAET_MASTER_KEY_FILE) return process.env.YAET_MASTER_KEY_FILE;
  return path.join(getAppConfigPath(), '.masterkey');
}

function parseArgs(argv) {
  const opts = { file: null, key: null, force: false, stdin: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') opts.file = argv[++i];
    else if (argv[i] === '--key') opts.key = argv[++i];
    else if (argv[i] === '--force') opts.force = true;
    else if (argv[i] === '--stdin') opts.stdin = true;
    else throw new Error(`Unknown option: ${argv[i]}`);
  }
  return opts;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error('--stdin given but stdin is a TTY (nothing piped).'));
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data.replace(/\r?\n$/, '')));
    process.stdin.on('error', reject);
    process.stdin.resume();
  });
}

function promptLine(query, hidden) {
  return new Promise((resolve, reject) => {
    let ttyFd = null;
    try {
      ttyFd = fs.openSync('/dev/tty', 'r');
    } catch {
      reject(new Error('No TTY available — pass --key <key> instead.'));
      return;
    }
    const input = fs.createReadStream(null, { fd: ttyFd });
    const readline = require('readline');
    const rl = readline.createInterface({ input, output: process.stderr, terminal: true });
    const { spawnSync } = require('child_process');
    if (hidden) spawnSync('stty', ['-echo'], { stdio: [ttyFd, 'ignore', 'ignore'] });
    const done = (value) => {
      if (hidden) spawnSync('stty', ['echo'], { stdio: [ttyFd, 'ignore', 'ignore'] });
      try { fs.writeSync(ttyFd, '\n'); } catch {}
      rl.close();
      try { fs.closeSync(ttyFd); } catch {}
      resolve(value);
    };
    rl.question(query, done);
  });
}

/** Decrypt probe: returns parsed JSON or throws. */
function tryDecryptFile(jsonPath, key) {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const dec = CryptoJS.AES.decrypt(raw, key).toString(CryptoJS.enc.Utf8);
  if (!dec) throw new Error(`decrypt failed (wrong key?)`);
  return JSON.parse(dec);
}

async function cmdSet(argv) {
  const opts = parseArgs(argv);
  const file = opts.file || defaultKeyFile();

  let key = opts.key || null;
  if (!key && opts.stdin) {
    // Piped input: no TTY games, no echo issues, nothing in argv/ps.
    // Caller confirms out-of-band; single entry is enough.
    key = await readStdin();
    if (!key) throw new Error('Empty master key on stdin, aborted.');
  }
  if (!key) {
    const first = await promptLine('[1/2] Master key (hidden): ', true);
    if (!first) throw new Error('Empty master key, aborted.');
    const second = await promptLine('[2/2] Repeat master key: ', true);
    if (first !== second) throw new Error('Keys do not match, aborted.');
    key = first;
  }

  if (fs.existsSync(file) && !opts.force) {
    if (!process.stderr.isTTY) {
      throw new Error(`Key file exists: ${file} (use --force to overwrite).`);
    }
    const answer = await promptLine(`Key file exists: ${file}. Overwrite? [y/N] `, false);
    if (!/^y(es)?$/i.test(answer.trim())) throw new Error('Aborted.');
  }

  // Verify against existing ciphertext before committing, unless forced.
  const profilesPath = path.join(getAppConfigPath(), 'profiles.json');
  if (fs.existsSync(profilesPath) && !opts.force) {
    tryDecryptFile(profilesPath, key);
    console.log('Verified against profiles.json.');
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, key + '\n', { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  console.log(`Master key written to ${file} (0600).`);
  if (!process.env.YAET_MASTER_KEY_FILE || process.env.YAET_MASTER_KEY_FILE !== file) {
    console.log(`Add to the headless environment: export YAET_MASTER_KEY_FILE=${file}`);
  }
}

async function cmdCheck(argv) {
  let explicit = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--master-key') explicit = argv[++i];
    else throw new Error(`Unknown option: ${argv[i]}`);
  }
  const { key, source } = await resolveMasterKeyWithSource(explicit);
  const profilesPath = path.join(getAppConfigPath(), 'profiles.json');
  if (!fs.existsSync(profilesPath)) {
    console.log(`Key resolved from ${source} (length ${key.length}). No profiles.json yet — nothing to verify against.`);
    return;
  }
  tryDecryptFile(profilesPath, key);
  console.log(`OK: key from ${source} decrypts profiles.json.`);
}

function printHelp() {
  console.log(`
yaet masterkey — headless master key management

Usage:
  yaet masterkey set [--file <path>] [--key <key> | --stdin] [--force]
  yaet masterkey check [--master-key <key>]

Default key file: $YAET_MASTER_KEY_FILE or <configDir>/.masterkey (mode 0600).
`);
}

async function runMasterkey(argv) {
  const [sub, ...rest] = argv;
  if (sub === 'set') return cmdSet(rest);
  if (sub === 'check') return cmdCheck(rest);
  printHelp();
  if (sub && sub !== '--help' && sub !== '-h') throw new Error(`Unknown subcommand: ${sub}`);
}

module.exports = { runMasterkey };
