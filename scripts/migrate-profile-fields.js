#!/usr/bin/env node
/**
 * One-off migration (P2 / OLD_FIELD_MAP):
 * Convert old-format profiles (flat connection fields like `sshProfile`)
 * into the current `profileData[profileType]` format, then re-encrypt and save.
 *
 * Usage:
 *   node scripts/migrate-profile-fields.js [--master-key <key>] [--dry-run]
 * Master key resolution order: --master-key, $YAET_MASTER_KEY, then keytar
 * (env-aware identity from src-electron/services/envConfig.js: production
 * keyring, or the isolated debug keyring under NODE_ENV=development).
 * Target directory likewise follows envConfig (~/.yaet vs ~/.yaet-debug,
 * $YAET_HOME base override respected).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const CryptoJS = require('crypto-js');
const { getAppConfigPath, getKeytarIdentity } = require('../src-electron/services/envConfig');

// Must stay in sync with RuntimeAPI.OLD_FIELD_MAP
const OLD_FIELD_MAP = {
  sshProfile: 'SSH_TERMINAL',
  telnetProfile: 'TELNET_TERMINAL',
  winRmProfile: 'WIN_RM_TERMINAL',
  rdpProfile: 'RDP_REMOTE_DESKTOP',
  vncProfile: 'VNC_REMOTE_DESKTOP',
  ftpProfile: 'FTP_FILE_EXPLORER',
  sambaProfile: 'SAMBA_FILE_EXPLORER',
};

function getArgs() {
  const args = process.argv.slice(2);
  const opts = { masterKey: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--master-key') opts.masterKey = args[++i];
    else if (args[i] === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

async function resolveMasterKey(explicit) {
  if (explicit) return explicit;
  if (process.env.YAET_MASTER_KEY) return process.env.YAET_MASTER_KEY;
  try {
    const keytar = require('keytar');
    const { service, account } = getKeytarIdentity();
    const key = await keytar.get(service, account);
    if (key) return key;
  } catch (e) {
    // keytar not installed or no entry — fall through to error
  }
  throw new Error('No master key found. Pass --master-key <key> or set YAET_MASTER_KEY.');
}

// Returns true if the profile was migrated.
function migrateProfile(profile) {
  let changed = false;
  for (const [oldField, profileType] of Object.entries(OLD_FIELD_MAP)) {
    const oldData = profile[oldField];
    if (!oldData) continue;
    if (!profile.profileData) profile.profileData = {};
    const existing = profile.profileData[profileType];
    const existingEmpty = !existing || (!existing.host && !existing.share);
    if (existingEmpty) {
      profile.profileData[profileType] = oldData;
      delete profile[oldField];
      changed = true;
    }
  }
  return changed;
}

async function main() {
  const opts = getArgs();
  const masterKey = await resolveMasterKey(opts.masterKey);

  const yaetDir = getAppConfigPath();
  const profilesPath = path.join(yaetDir, 'profiles.json');

  if (!fs.existsSync(profilesPath)) {
    console.log(`No ${profilesPath} found — nothing to migrate.`);
    return;
  }

  const ciphertext = fs.readFileSync(profilesPath, 'utf-8');
  const plain = CryptoJS.AES.decrypt(ciphertext, masterKey).toString(CryptoJS.enc.Utf8);
  if (!plain) {
    throw new Error('Failed to decrypt profiles.json — wrong master key?');
  }
  const data = JSON.parse(plain);
  const profiles = data.profiles || [];

  let migrated = 0;
  const migratedNames = [];
  for (const p of profiles) {
    if (migrateProfile(p)) {
      migrated++;
      migratedNames.push(p.name || p.id || '?');
    }
  }

  if (migrated === 0) {
    console.log('All profiles already in profileData format. No changes needed.');
    return;
  }

  if (opts.dryRun) {
    console.log(`[dry-run] Would migrate ${migrated} profile(s): ${migratedNames.join(', ')}`);
    return;
  }

  const newCiphertext = CryptoJS.AES.encrypt(JSON.stringify(data), masterKey).toString();
  fs.writeFileSync(profilesPath, newCiphertext, 'utf-8');
  console.log(`Migrated ${migrated} profile(s) from old flat-field format to profileData: ${migratedNames.join(', ')}.`);
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
