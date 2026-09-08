/**
 * `yaet cloud status|download` — headless cloud sync, reusing CloudService.
 *
 *   cloud status [--master-key <key>]
 *   cloud download [--master-key <key>]
 *
 * Master key resolution: --master-key, $YAET_MASTER_KEY,
 * $YAET_MASTER_KEY_FILE, then OS keyring (see ../common/masterKey.js).
 * cloud.json itself is encrypted — a working master key is required first
 * (see `yaet masterkey set`). download backs up local JSONs to backup/
 * before overwriting (handled inside CloudService).
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
    if (e.code === 'ENOENT') throw new Error('No cloud.json found — configure cloud sync in the GUI first.');
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
    if (e.code === 'ENOENT') throw new Error('No cloud.json found — configure cloud sync in the GUI first.');
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

function printHelp() {
  console.log(`
yaet cloud — headless cloud sync

Usage:
  yaet cloud status [--master-key <key>]
  yaet cloud download [--master-key <key>]
`);
}

async function runCloud(argv) {
  const [sub, ...rest] = argv;
  if (sub === 'status') return cmdStatus(rest);
  if (sub === 'download') return cmdDownload(rest);
  printHelp();
  if (sub && sub !== '--help' && sub !== '-h') throw new Error(`Unknown subcommand: ${sub}`);
}

module.exports = { runCloud };
