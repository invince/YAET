/**
 * `yaet doctor` — local self-check for headless machines.
 *
 * Checks (local only, no network):
 *   - config dir exists
 *   - master key resolves (reports source, never prints the key)
 *   - settings.json parses (plain JSON)
 *   - profiles/secrets/cloud/proxies.json each decrypt (missing = warn,
 *     decrypt failure = fail)
 *   - cloud.json holds a URL when present
 *
 * Exit 0 when no FAIL lines, 1 otherwise.
 */
const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');
const { getAppConfigPath } = require('../../src-electron/services/envConfig');
const { resolveMasterKeyWithSource } = require('../common/masterKey');

const ENCRYPTED = ['profiles.json', 'secrets.json', 'cloud.json', 'proxies.json'];

async function runDoctor() {
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

  if (failed) throw new Error('doctor found problems (see FAIL lines).');
  console.log('doctor: all checks passed.');
}

module.exports = { runDoctor };
