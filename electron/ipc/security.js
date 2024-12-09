const {ipcMain} = require('electron');
const keytar = require("keytar");

function initSecurityIpcHandler() {

  ipcMain.handle('masterkey.save', async (event, service, account, password) => {
    return keytar.setPassword(service, account, password);
  });

  ipcMain.handle('masterkey.get', async (event, service, account) => {
    return keytar.getPassword(service, account);
  });

  ipcMain.handle('masterkey.delete', async (event, service, account) => {
    console.log("master key deleting...");
    return keytar.deletePassword(service, account);
  });

}

module.exports = {initSecurityIpcHandler};
