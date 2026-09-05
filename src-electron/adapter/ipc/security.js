const { ipcMain } = require('electron');
const { SecurityService, decrypt } = require('../../services/securityService');
const CryptoJS = require('crypto-js');

function initSecurityIpcHandler(log) {
  const securityService = new SecurityService(log);

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

  // ── Crypto operations (key never leaves main process) ────────────────────

  ipcMain.handle('masterkey.match', async (_event, input) => {
    const stored = await securityService.get();
    if (!stored) return false;
    // Constant-time comparison to prevent timing attacks
    if (input.length !== stored.length) return false;
    let result = 0;
    for (let i = 0; i < input.length; i++) {
      result |= input.charCodeAt(i) ^ stored.charCodeAt(i);
    }
    return result === 0;
  });

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
