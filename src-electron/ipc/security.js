const { ipcMain } = require('electron');
const keytar = require("keytar");
const CryptoJS = require("crypto-js");

const service = 'io.github.invince.YAET';
const account = 'ac13ba1ac2f841d19a9f73bd8c335086';

function initSecurityIpcHandler(log) {

  ipcMain.handle('masterkey.save', async (event, password) => {
    log.info("master key saving...");
    return keytar.setPassword(service, account, password);
  });

  ipcMain.handle('masterkey.get', async (event,) => {
    return keytar.getPassword(service, account);
  });

  ipcMain.handle('masterkey.delete', async (event) => {
    log.info("master key deleting...");
    return keytar.deletePassword(service, account);
  });

}


function decrypt(data) {
  return keytar.getPassword(service, account).then(password => {
    if (!password) {
      throw new Error('Master key not found');
    }
    const bytes = CryptoJS.AES.decrypt(data, password);
    return bytes.toString(CryptoJS.enc.Utf8);
  });
}

module.exports = { initSecurityIpcHandler, decrypt };
