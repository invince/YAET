const { autoUpdater } = require('electron-updater');
const { dialog } = require("electron");
const { getProxyUrl } = require("../utils/proxyUtils");

function initAutoUpdater(log, settings, getProxies, getSecrets) {

  log.info("AutoUpdate is active");

  autoUpdater.logger = log;

  const isDev = process.env.NODE_ENV === 'development';

  if (settings?.general?.proxyId && getProxies()?.proxies) {
    const proxy = getProxies()?.proxies.find(p => p.id === settings.general.proxyId);
    if (proxy) {
      const proxyUrl = getProxyUrl(proxy, getSecrets, log);
      // Set environment variables for electron-updater
      process.env.HTTP_PROXY = proxyUrl;
      process.env.HTTPS_PROXY = proxyUrl;
      process.env.NO_PROXY = '127.0.0.1,localhost';
    }
  }

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available. Do you want to download it now?`,
        buttons: ['Yes', 'No'],
      })
      .then((response) => {
        if (response.response === 0) { // 'Yes' button clicked
          autoUpdater.downloadUpdate();
        } else {
          log.info('User declined the update.');
        }
      });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. Restart to install?',
      buttons: ['Restart', 'Later'],
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (error) => {
    log.error('Error during update:', error);
  });
}


module.exports = { initAutoUpdater };
