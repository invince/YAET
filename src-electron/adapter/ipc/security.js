const { ipcMain } = require('electron');
const { SecurityService, decrypt } = require('../../services/securityService');
const { ConfigService, PROFILES_JSON, SECRETS_JSON, PROXIES_JSON, CLOUD_JSON } = require('../../services/configService');
const CryptoJS = require('crypto-js');

// Constant-time string comparison.
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function initSecurityIpcHandler(log) {
  const securityService = new SecurityService(log);
  const configService = new ConfigService(log);

  // ── Key management (plaintext needed to store in OS keyring) ────────────

  ipcMain.handle('masterkey.save', async (event, password) => {
    log.info("master key saving...");
    await securityService.save(password);
    event.sender.send('masterkey-changed');
  });

  ipcMain.handle('masterkey.exists', async () => {
    const key = await securityService.get();
    return !!(key && key.length > 0);
  });

  ipcMain.handle('masterkey.delete', async (event) => {
    log.info("master key deleting...");
    await securityService.delete();
    event.sender.send('masterkey-changed');
  });

  ipcMain.handle('masterkey.match', async (_event, input) => {
    const stored = await securityService.get();
    if (!stored) return false;
    return timingSafeEqual(input, stored);
  });

  // ── Atomic master-key change with full re-encrypt (main-process only) ───
  // Rationale: never let the keyring switch to the new key while disk files are
  // still encrypted with the OLD key. If we did, the old ciphertext would be
  // unrecoverable AND (previously) the renderer re-encrypted from its in-memory
  // copies, which could be stale/empty after a reload -> profiles/secrets wiped.
  // This handler does it all in one place, reading from disk:
  //   validate old key -> decrypt every encrypted json with OLD key ->
  //   switch keyring to NEW key -> re-encrypt every file with NEW key -> write.
  // If ANY step fails, nothing is changed (no partial re-encrypt).
  ipcMain.handle('masterkey.change', async (event, { oldPassword, newPassword }) => {
    const oldKey = await securityService.get();
    if (!oldKey) {
      return { ok: false, reason: 'no-key' };
    }
    if (typeof oldPassword !== 'string' || !timingSafeEqual(oldPassword, oldKey)) {
      return { ok: false, reason: 'mismatch' };
    }
    if (typeof newPassword !== 'string' || newPassword.length === 0) {
      return { ok: false, reason: 'empty-new' };
    }

    const encryptedFiles = [PROFILES_JSON, SECRETS_JSON, PROXIES_JSON, CLOUD_JSON];
    const plain = {}; // filename -> decrypted json string

    // Phase 1: read + decrypt every file with the OLD key (no writes yet).
    for (const file of encryptedFiles) {
      try {
        const ct = await configService.load(file, true);
        if (ct === undefined) continue; // file not present yet -> leave untouched
        const bytes = CryptoJS.AES.decrypt(ct, oldKey);
        const json = bytes.toString(CryptoJS.enc.Utf8);
        // Wrong key (or corrupt) -> CryptoJS throws "Malformed UTF-8" or yields empty.
        if (!json) {
          log.error(`masterkey.change: ${file} failed to decrypt with old key; aborting.`);
          return { ok: false, reason: 'decrypt-failed', file };
        }
        plain[file] = json;
      } catch (err) {
        log.error(`masterkey.change: reading/decrypting ${file} failed: ${err.message}`);
        return { ok: false, reason: 'decrypt-failed', file };
      }
    }

    // Phase 2: switch keyring, then re-encrypt + write every decrypted file.
    await securityService.save(newPassword);
    for (const file of encryptedFiles) {
      const json = plain[file];
      if (json === undefined) continue; // was absent -> skip
      const reEncrypted = CryptoJS.AES.encrypt(json, newPassword).toString();
      await configService.save(file, reEncrypted, true);
    }

    log.info('master key changed + all encrypted settings re-encrypted in main process');
    event.sender.send('masterkey-changed');
    return { ok: true };
  });

  // ── Crypto operations (key never leaves main process) ────────────────────

  ipcMain.handle('crypto.encrypt', async (_event, plaintext) => {
    const key = await securityService.get();
    if (!key) throw new Error('Master key not set');
    const json = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext, null, 2);
    return CryptoJS.AES.encrypt(json, key).toString();
  });

  ipcMain.handle('crypto.decrypt', async (_event, ciphertext) => {
    const key = await securityService.get();
    if (!key) throw new Error('Master key not set');
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  });

  // ── Legacy decrypt helper (backend-only, used by runtimeAPI) ─────────────
  // Kept for backward compatibility — key stays in main process.
}

module.exports = { initSecurityIpcHandler, decrypt };
