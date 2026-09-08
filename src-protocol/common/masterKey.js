/**
 * YAET master key resolution — shared by CLI, MCP/ACP servers and scripts.
 *
 * Resolution order:
 *   1. explicit argument (--master-key / function param)
 *   2. $YAET_MASTER_KEY
 *   3. $YAET_MASTER_KEY_FILE (path to a 0600 file holding the key;
 *      Docker-secrets / systemd LoadCredential friendly)
 *   4. OS keyring via keytar (desktop only; expected to fail headless)
 *
 * Pure JS except the optional keytar require, which is lazy and guarded so
 * headless environments without native modules keep working.
 */
const fs = require('fs');
const { getKeytarIdentity } = require('../../src-electron/services/envConfig');

function readKeyFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  // Strip one trailing newline (echo adds it); preserve everything else.
  return raw.replace(/\r?\n$/, '');
}

async function resolveMasterKeyWithSource(explicit) {
  if (explicit) return { key: explicit, source: 'explicit' };

  if (process.env.YAET_MASTER_KEY) {
    return { key: process.env.YAET_MASTER_KEY, source: 'env:YAET_MASTER_KEY' };
  }

  const keyFile = process.env.YAET_MASTER_KEY_FILE;
  if (keyFile) {
    try {
      return { key: readKeyFile(keyFile), source: `file:${keyFile}` };
    } catch (e) {
      throw new Error(`Cannot read YAET_MASTER_KEY_FILE='${keyFile}': ${e.message}`);
    }
  }

  try {
    const keytar = require('keytar');
    const { service, account } = getKeytarIdentity();
    const key = await keytar.getPassword(service, account);
    if (key) return { key, source: 'keyring' };
  } catch (e) {
    // keytar missing or no Secret Service (headless) — fall through to error.
  }
  throw new Error(
    'No master key found. Pass --master-key <key> or set YAET_MASTER_KEY / YAET_MASTER_KEY_FILE.'
  );
}

async function resolveMasterKey(explicit) {
  const { key } = await resolveMasterKeyWithSource(explicit);
  return key;
}

module.exports = { resolveMasterKey, resolveMasterKeyWithSource, readKeyFile };
