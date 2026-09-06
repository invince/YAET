const { ipcMain } = require('electron');
const CryptoJS = require("crypto-js");
const { ConfigService, PROFILES_JSON, SECRETS_JSON, PROXIES_JSON, CLOUD_JSON } = require("../../services/configService");

const mockStore = new Map();

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Mirror of the real handler: convert Maps to plain objects recursively
// before JSON.stringify (see security.js for rationale).
function serializeForEncrypt(value) {
  if (value instanceof Map) {
    const obj = {};
    for (const [k, v] of value) obj[k] = serializeForEncrypt(v);
    return obj;
  }
  if (Array.isArray(value)) return value.map(serializeForEncrypt);
  if (value && typeof value === 'object') {
    const obj = {};
    for (const [k, v] of Object.entries(value)) obj[k] = serializeForEncrypt(v);
    return obj;
  }
  return value;
}

function initSecurityIpcHandler(log) {
  const configService = new ConfigService(log);

  // ── Key management ──
  ipcMain.handle('masterkey.save', async (_event, password) => {
    log.info("master key saving (mock)...");
    mockStore.set('masterkey', password);
    _event.sender.send('masterkey-changed');
  });

  ipcMain.handle('masterkey.exists', async () => {
    const key = mockStore.get('masterkey');
    return !!(key && key.length > 0);
  });

  ipcMain.handle('masterkey.delete', async (_event) => {
    log.info("master key deleting (mock)...");
    mockStore.delete('masterkey');
    _event.sender.send('masterkey-changed');
  });

  // ── Crypto operations ──
  ipcMain.handle('masterkey.match', async (_event, input) => {
    const stored = mockStore.get('masterkey');
    if (!stored) return false;
    return timingSafeEqual(input, stored);
  });

  // Mirror of real handler: atomic change + full re-encrypt reading from disk.
  ipcMain.handle('masterkey.change', async (_event, { oldPassword, newPassword }) => {
    const oldKey = mockStore.get('masterkey');
    if (!oldKey) return { ok: false, reason: 'no-key' };
    if (typeof oldPassword !== 'string' || !timingSafeEqual(oldPassword, oldKey)) {
      return { ok: false, reason: 'mismatch' };
    }
    if (typeof newPassword !== 'string' || newPassword.length === 0) {
      return { ok: false, reason: 'empty-new' };
    }

    const encryptedFiles = [PROFILES_JSON, SECRETS_JSON, PROXIES_JSON, CLOUD_JSON];
    const plain = {};
    for (const file of encryptedFiles) {
      try {
        const ct = await configService.load(file, true);
        if (ct === undefined) continue;
        const bytes = CryptoJS.AES.decrypt(ct, oldKey);
        const json = bytes.toString(CryptoJS.enc.Utf8);
        if (!json) {
          log.error(`masterkey.change (mock): ${file} failed to decrypt; aborting.`);
          return { ok: false, reason: 'decrypt-failed', file };
        }
        plain[file] = json;
      } catch (err) {
        log.error(`masterkey.change (mock): ${file} failed: ${err.message}`);
        return { ok: false, reason: 'decrypt-failed', file };
      }
    }

    mockStore.set('masterkey', newPassword);
    for (const file of encryptedFiles) {
      const json = plain[file];
      if (json === undefined) continue;
      await configService.save(file, CryptoJS.AES.encrypt(json, newPassword).toString(), true);
    }
    _event.sender.send('masterkey-changed');
    return { ok: true };
  });

  ipcMain.handle('crypto.encrypt', async (_event, plaintext) => {
    const key = mockStore.get('masterkey');
    if (!key) throw new Error('Master key not set');
    const json = typeof plaintext === 'string' ? plaintext : JSON.stringify(serializeForEncrypt(plaintext), null, 2);
    return CryptoJS.AES.encrypt(json, key).toString();
  });

  ipcMain.handle('crypto.decrypt', async (_event, ciphertext) => {
    const key = mockStore.get('masterkey');
    if (!key) throw new Error('Master key not set');
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  });
}

function decrypt(data) {
  const password = mockStore.get('masterkey');
  if (!password) {
    return Promise.reject(new Error('Master key not found'));
  }
  const bytes = CryptoJS.AES.decrypt(data, password);
  return Promise.resolve(bytes.toString(CryptoJS.enc.Utf8));
}

module.exports = { initSecurityIpcHandler, decrypt };
