const { ipcMain } = require('electron');
const { CloudService } = require('../../services/cloudService');

function initCloudIpcHandler(log, proxyRepo, secretRepo) {
  const cloudService = new CloudService(log);

  ipcMain.handle('cloud.upload', async (event, data) => {
    if (!data || !data.data) {
      return { succeed: false, ok: [], ko: ['no cloud setting found'] };
    }
    return cloudService.upload(data.data, proxyRepo, secretRepo);
  });

  ipcMain.handle('cloud.download', async (event, data) => {
    if (!data || !data.data) {
      return { succeed: false, ok: [], ko: ['no cloud setting found'] };
    }
    return cloudService.download(data.data, proxyRepo, secretRepo);
  });
}

module.exports = { initCloudIpcHandler };
