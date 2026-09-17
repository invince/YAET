/**
 * `yaet doctor [--fix-shim]` — local self-check for headless machines.
 *
 * Checks (local only, no network):
 *   - config dir exists
 *   - master key resolves (reports source, never prints the key)
 *   - settings.json parses (plain JSON)
 *   - profiles/secrets/cloud/proxies.json each decrypt (missing = warn,
 *     decrypt failure = fail)
 *   - cloud.json holds a URL when present
 *   - `yaet` shim on PATH (missing = warn; --fix-shim installs it)
 *
 * Exit 0 when no FAIL lines, 1 otherwise.
 *
 * --fix-shim reads the shim template from inside the package
 * (scripts/yaet — read from the asar, never unpacked) and installs it:
 * /usr/local/bin/yaet as root, otherwise ~/.local/bin/yaet.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const CryptoJS = require('crypto-js');
const { getAppConfigPath } = require('../../src-electron/services/envConfig');
const { resolveMasterKeyWithSource } = require('../common/masterKey');

const ENCRYPTED = ['profiles.json', 'secrets.json', 'cloud.json', 'proxies.json'];

// Same relative layout in source and inside the asar:
//   <root>/src-protocol/doctor/command.js  ->  <root>/scripts/yaet
function loadShimTemplate() {
  const p = path.join(__dirname, '..', '..', 'scripts', 'yaet');
  if (!fs.existsSync(p)) {
    throw new Error(`shim template missing from package: ${p}`);
  }
  return fs.readFileSync(p, 'utf8');
}

function findOnPath(name) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) {
    try {
      const p = path.join(d, name);
      fs.accessSync(p, fs.constants.X_OK);
      return p;
    } catch { /* not here */ }
  }
  return null;
}

function installShim(ok, warn, fail) {
  const isRoot = typeof process.geteuid === 'function' && process.geteuid() === 0;
  const target = isRoot
    ? '/usr/local/bin/yaet'
    : path.join(os.homedir(), '.local', 'bin', 'yaet');
  let template;
  try {
    template = loadShimTemplate();
  } catch (e) {
    fail(e.message);
    return;
  }
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, template, { mode: 0o755 });
    fs.chmodSync(target, 0o755);
    ok(`installed yaet shim at ${target}`);
    if (!isRoot && !(process.env.PATH || '').split(path.delimiter).includes(path.dirname(target))) {
      warn(`${path.dirname(target)} is not on PATH — add it to your shell profile`);
    }
  } catch (e) {
    fail(`could not install shim at ${target}: ${e.message}`);
  }
}

async function runDoctor(argv) {
  const args = argv || [];
  for (const a of args) {
    if (a !== '--fix-shim') throw new Error(`Unknown option: ${a}`);
  }
  const fixShim = args.includes('--fix-shim');
  const dir = getAppConfigPath();
  let failed = false;
  const ok = (m) => console.log(`[OK]   ${m}`);
  const warn = (m) => console.log(`[WARN] ${m}`);
  const fail = (m) => { console.error(`[FAIL] ${m}`); failed = true; };

  if (fs.existsSync(dir)) ok(`config dir ${dir}`);
  else { fail(`config dir missing: ${dir}`); process.exit(1); }

  let key = null;
  try {
    const r = await resolveMasterKeyWithSource(null);
    key = r.key;
    ok(`master key resolves from ${r.source} (length ${r.key.length})`);
  } catch (e) {
    fail(`master key: ${e.message}`);
    process.exit(1);
  }

  const settingsPath = path.join(dir, 'settings.json');
  if (!fs.existsSync(settingsPath)) warn('settings.json missing (app defaults will apply)');
  else {
    try {
      JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      ok('settings.json parses');
    } catch { fail('settings.json is not valid JSON'); }
  }

  for (const f of ENCRYPTED) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) { warn(`${f} missing`); continue; }
    try {
      const raw = fs.readFileSync(p, 'utf8');
      const dec = CryptoJS.AES.decrypt(raw, key).toString(CryptoJS.enc.Utf8);
      if (!dec) throw new Error('decrypt failed (wrong master key?)');
      JSON.parse(dec);
      ok(`${f} decrypts`);
    } catch (e) {
      fail(`${f}: ${e.message}`);
    }
  }

  const cloudPath = path.join(dir, 'cloud.json');
  if (fs.existsSync(cloudPath)) {
    try {
      const raw = fs.readFileSync(cloudPath, 'utf8');
      const dec = CryptoJS.AES.decrypt(raw, key).toString(CryptoJS.enc.Utf8);
      const cloud = JSON.parse(dec);
      if (cloud && cloud.url) ok('cloud.json holds a sync URL');
      else fail('cloud.json has no url — configure cloud sync in the GUI');
    } catch { /* decrypt failure already reported above */ }
  }

  const shimPath = findOnPath('yaet');
  if (shimPath) {
    ok(`yaet shim on PATH: ${shimPath}`);
  } else if (fixShim) {
    installShim(ok, warn, fail);
  } else {
    warn(`no 'yaet' shim on PATH — re-run with --fix-shim to install it`);
  }

  if (failed) throw new Error('doctor found problems (see FAIL lines).');
  console.log('doctor: all checks passed.');
}

module.exports = { runDoctor };
