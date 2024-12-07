const {ipcMain} = require('electron');
const keytar = require("keytar");

function initSecurityIpcHandler() {

  ipcMain.handle('keytar-save-password', async (event, service, account, password) => {
    return keytar.setPassword(service, account, password);
  });

  ipcMain.handle('keytar-get-password', async (event, service, account) => {
    return keytar.getPassword(service, account);
  });

  ipcMain.handle('keytar-delete-password', async (event, service, account) => {
    console.log("master key deleting...");
    return keytar.deletePassword(service, account);
  });

}

module.exports = {initSecurityIpcHandler};
