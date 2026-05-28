const { ipcMain } = require('electron');
const CryptoJS = require("crypto-js");

const mockStore = new Map();

function initSecurityIpcHandler(log) {
  ipcMain.handle('masterkey.save', async (_event, password) => {
    log.info("master key saving (mock)...");
    mockStore.set('masterkey', password);
    _event.sender.send('masterkey-changed');
  });

  ipcMain.handle('masterkey.get', async () => {
    return mockStore.get('masterkey') || null;
  });

  ipcMain.handle('masterkey.delete', async (_event) => {
    log.info("master key deleting (mock)...");
    mockStore.delete('masterkey');
    _event.sender.send('masterkey-changed');
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
