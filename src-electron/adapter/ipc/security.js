const { ipcMain } = require('electron');
const { SecurityService, decrypt } = require('../../services/securityService');

function initSecurityIpcHandler(log) {
  const securityService = new SecurityService(log);

  ipcMain.handle('masterkey.save', async (event, password) => {
    log.info("master key saving...");
    await securityService.save(password);
    event.sender.send('masterkey-changed');
  });

  ipcMain.handle('masterkey.get', async () => {
    return securityService.get();
  });

  ipcMain.handle('masterkey.delete', async (event) => {
    log.info("master key deleting...");
    await securityService.delete();
    event.sender.send('masterkey-changed');
  });
}

module.exports = { initSecurityIpcHandler, decrypt };
