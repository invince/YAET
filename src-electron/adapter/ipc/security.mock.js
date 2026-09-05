const { ipcMain } = require('electron');
const CryptoJS = require("crypto-js");

const mockStore = new Map();

function initSecurityIpcHandler(log) {
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
    if (input.length !== stored.length) return false;
    let result = 0;
    for (let i = 0; i < input.length; i++) {
      result |= input.charCodeAt(i) ^ stored.charCodeAt(i);
    }
    return result === 0;
  });

  ipcMain.handle('crypto.encrypt', async (_event, plaintext) => {
    const key = mockStore.get('masterkey');
    if (!key) throw new Error('Master key not set');
    const json = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext, null, 2);
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
