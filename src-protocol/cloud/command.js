/**
 * `yaet cloud status|download|setup` — headless cloud sync, reusing CloudService.
 *
 *   cloud status [--master-key <key>]
 *   cloud download [--master-key <key>]
 *   cloud setup --url <git-url> --login <user>
 *     [--password <pw> | --password-stdin]
 *     [--items Setting,Profile] [--master-key <key>] [--force] [--download]
 *
 * Master key resolution: --master-key, $YAET_MASTER_KEY,
 * $YAET_MASTER_KEY_FILE, then OS keyring (see ../common/masterKey.js).
 * cloud.json itself is encrypted — a working master key is required first
 * (see `yaet masterkey set`). download backs up local JSONs to backup/
 * before overwriting (handled inside CloudService).
 *
 * setup only writes the local sync config (cloud.json, encrypted). There is
 * still no `cloud upload` on purpose — push from the GUI, re-download here.
 */
const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');
const { getAppConfigPath } = require('../../src-electron/services/envConfig');
const { CloudService } = require('../../src-electron/services/cloudService');
const { Logger } = require('../common/logger');
const { resolveMasterKeyWithSource } = require('../common/masterKey');

const log = new Logger('yaet-cloud');

function decryptJson(filename, key) {
  const raw = fs.readFileSync(path.join(getAppConfigPath(), filename), 'utf8');
  const dec = CryptoJS.AES.decrypt(raw, key).toString(CryptoJS.enc.Utf8);
  if (!dec) throw new Error(`${filename}: decrypt failed (wrong master key?)`);
  return JSON.parse(dec);
}

function tryDecryptJson(filename, key) {
  try {
    return decryptJson(filename, key);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

function maskUrl(url) {
  return String(url || '').replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
}

function encryptJson(obj, key) {
  return CryptoJS.AES.encrypt(JSON.stringify(obj), key).toString();
}

/** All syncable items — setup always syncs everything, no --items flag. */
const ALL_ITEMS = ['Setting', 'Profile', 'Secret', 'Proxy'];

function readPasswordStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(new Error('--password-stdin given but stdin is a TTY (nothing piped).'));
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

function promptHidden(query) {
  return new Promise((resolve, reject) => {
    let ttyFd = null;
    try {
      ttyFd = fs.openSync('/dev/tty', 'r');
    } catch {
      reject(new Error('No TTY available — pass --password <pw> or --password-stdin instead.'));
      return;
    }
    const input = fs.createReadStream(null, { fd: ttyFd });
    const readline = require('readline');
    const rl = readline.createInterface({ input, output: process.stderr, terminal: true });
    const { spawnSync } = require('child_process');
    spawnSync('stty', ['-echo'], { stdio: [ttyFd, 'ignore', 'ignore'] });
    rl.question(query, (value) => {
      spawnSync('stty', ['echo'], { stdio: [ttyFd, 'ignore', 'ignore'] });
      try { fs.writeSync(ttyFd, '\n'); } catch {}
      rl.close();
      try { fs.closeSync(ttyFd); } catch {}
      resolve(value);
    });
  });
}

function promptLine(query) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('No TTY available — re-run with --force to overwrite.'));
      return;
    }
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(query, (value) => {
      rl.close();
      resolve(value);
    });
  });
}

function appVersion() {
  try {
    return require('../../package.json').version || '';
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const opts = { masterKey: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--master-key') opts.masterKey = argv[++i];
    else throw new Error(`Unknown option: ${argv[i]}`);
  }
  return opts;
}

async function cmdStatus(argv) {
  const opts = parseArgs(argv);
  const { key, source } = await resolveMasterKeyWithSource(opts.masterKey);
  console.log(`Master key: from ${source}`);
  console.log(`Config dir: ${getAppConfigPath()}`);

  let cloud;
  try {
    cloud = decryptJson('cloud.json', key);
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error('No cloud.json found — run `yaet cloud setup` or configure cloud sync in the GUI first.');
    throw e;
  }
  console.log(`URL: ${maskUrl(cloud.url)}`);
  console.log(`Login: ${cloud.login || '(none)'}`);
  console.log(`Items: ${(cloud.items || []).join(', ') || '(none)'}`);

  const svc = new CloudService(log);
  const files = svc.getJsonFilesForCloud(cloud.items);
  for (const f of files) {
    console.log(`  ${fs.existsSync(f) ? '[local] ' : '[missing]'} ${path.basename(f)}`);
  }

  if (cloud.proxyId) {
    const proxies = tryDecryptJson('proxies.json', key);
    const found = proxies && proxies.proxies && proxies.proxies.some((p) => p.id === cloud.proxyId);
    console.log(`Proxy: ${cloud.proxyId} ${found ? '(found)' : '(NOT FOUND in proxies.json)'}`);
  }
}

async function cmdDownload(argv) {
  const opts = parseArgs(argv);
  const { key, source } = await resolveMasterKeyWithSource(opts.masterKey);
  console.log(`Master key: from ${source}`);

  let cloud;
  try {
    cloud = decryptJson('cloud.json', key);
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error('No cloud.json found — run `yaet cloud setup` or configure cloud sync in the GUI first.');
    throw e;
  }

  const proxies = tryDecryptJson('proxies.json', key);
  const secrets = tryDecryptJson('secrets.json', key);
  const svc = new CloudService(log);
  const res = await svc.download(cloud, () => proxies, () => secrets);
  for (const line of res.ok) console.log(`  ok: ${line}`);
  for (const line of res.ko) console.error(`  ko: ${line}`);
  if (!res.succeed) throw new Error('Cloud download failed.');
  console.log('Cloud download succeeded.');
}

function parseSetupArgs(argv) {
  const opts = {
    masterKey: null, url: null, login: null, password: null,
    passwordStdin: false, force: false, download: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--master-key') opts.masterKey = argv[++i];
    else if (a === '--url') opts.url = argv[++i];
    else if (a === '--login') opts.login = argv[++i];
    else if (a === '--password') opts.password = argv[++i];
    else if (a === '--password-stdin') opts.passwordStdin = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--download') opts.download = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  return opts;
}

async function cmdSetup(argv) {
  const opts = parseSetupArgs(argv);
  if (!opts.url) throw new Error('Missing --url <git-url>.');
  if (!opts.login) throw new Error('Missing --login <user>.');

  const { key, source } = await resolveMasterKeyWithSource(opts.masterKey);
  console.log(`Master key: from ${source}`);

  const cloudPath = path.join(getAppConfigPath(), 'cloud.json');
  if (fs.existsSync(cloudPath) && !opts.force) {
    if (!process.stderr.isTTY) {
      throw new Error(`cloud.json exists (${cloudPath}) — re-run with --force to overwrite.`);
    }
    const answer = await promptLine(`cloud.json exists. Overwrite? [y/N] `);
    if (!/^y(es)?$/i.test(answer.trim())) throw new Error('Aborted.');
  }

  const items = [...ALL_ITEMS];

  let password = opts.password;
  if (opts.passwordStdin) {
    password = await readPasswordStdin();
  }
  if (password == null) {
    password = await promptHidden('Git password (hidden): ');
  }
  if (!password) throw new Error('Empty password, aborted.');

  const cloud = {
    url: opts.url,
    items,
    authType: 'login',
    login: opts.login,
    password,
    version: appVersion(),
    compatibleVersion: '1.0.0',
  };

  fs.mkdirSync(getAppConfigPath(), { recursive: true });
  fs.writeFileSync(cloudPath, encryptJson(cloud, key), 'utf8');
  console.log(`Wrote ${cloudPath} (url=${maskUrl(cloud.url)} items=${items.join(',')}).`);

  if (opts.download) {
    const proxies = tryDecryptJson('proxies.json', key);
    const secrets = tryDecryptJson('secrets.json', key);
    const svc = new CloudService(log);
    const res = await svc.download(cloud, () => proxies, () => secrets);
    for (const line of res.ok) console.log(`  ok: ${line}`);
    for (const line of res.ko) console.error(`  ko: ${line}`);
    if (!res.succeed) throw new Error('Cloud download failed.');
    console.log('Cloud download succeeded.');
  } else {
    console.log('Run `yaet cloud download` to pull, then `yaet doctor` to verify.');
  }
}

function printHelp() {
  console.log(`
yaet cloud — headless cloud sync

Usage:
  yaet cloud status [--master-key <key>]
  yaet cloud download [--master-key <key>]
  yaet cloud setup --url <git-url> --login <user>
    [--password <pw> | --password-stdin]
    [--master-key <key>] [--force] [--download]

setup writes the local sync config (cloud.json, encrypted), always
covering all four items: ${ALL_ITEMS.join(', ')}.
--password-stdin (printf '%s' "$PW" | ...) is preferred over --password,
which leaks into shell history and ps output.
`);
}

async function runCloud(argv) {
  const [sub, ...rest] = argv;
  if (sub === 'status') return cmdStatus(rest);
  if (sub === 'download') return cmdDownload(rest);
  if (sub === 'setup') return cmdSetup(rest);
  printHelp();
  if (sub && sub !== '--help' && sub !== '-h') throw new Error(`Unknown subcommand: ${sub}`);
}

module.exports = { runCloud };
