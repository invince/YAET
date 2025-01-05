const {ipcMain} = require('electron');
const keytar = require("keytar");

function initSecurityIpcHandler(log) {

  ipcMain.handle('masterkey.save', async (event, service, account, password) => {
    log.info("master key saving...");
    return keytar.setPassword(service, account, password);
  });

  ipcMain.handle('masterkey.get', async (event, service, account) => {
    return keytar.getPassword(service, account);
  });

  ipcMain.handle('masterkey.delete', async (event, service, account) => {
    log.info("master key deleting...");
    return keytar.deletePassword(service, account);
  });

}

module.exports = {initSecurityIpcHandler};
