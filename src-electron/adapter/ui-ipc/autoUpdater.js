const { autoUpdater } = require('electron-updater');
const { dialog, ipcMain } = require("electron");
const { getProxyUrl } = require("../../utils/proxyUtils");

function initAutoUpdater(log, settings, getProxies, getSecrets) {

  log.info("AutoUpdate is active");

  autoUpdater.logger = log;

  const isDev = process.env.NODE_ENV === 'development';

  const savedEnv = {
    HTTP_PROXY: process.env.HTTP_PROXY,
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    NO_PROXY: process.env.NO_PROXY,
  };

  let proxyUrl = null;
  let savedProxyUrl = null;
  if (settings?.general?.proxyId && getProxies()?.proxies) {
    const proxy = getProxies()?.proxies.find(p => p.id === settings.general.proxyId);
    if (proxy) {
      proxyUrl = getProxyUrl(proxy, getSecrets, log);
      savedProxyUrl = proxyUrl;
    }
  }

  function applyProxyEnv() {
    if (savedProxyUrl) {
      process.env.HTTP_PROXY = savedProxyUrl;
      process.env.HTTPS_PROXY = savedProxyUrl;
      process.env.NO_PROXY = '127.0.0.1,localhost';
    }
  }

  function restoreProxyEnv() {
    ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY'].forEach(key => {
      if (savedEnv[key]) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    });
  }

  applyProxyEnv();

  // Auto check only in production when autoUpdate is enabled
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  let envRestored = false;
  function restoreOnce() {
    if (envRestored) return;
    envRestored = true;
    restoreProxyEnv();
  }

  // IPC handler for manual "Check for Updates" button in settings
  ipcMain.on('check-for-updates', () => {
    log.info('Manual update check triggered');
    envRestored = false;
    applyProxyEnv();
    autoUpdater.checkForUpdatesAndNotify();
  });

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available. Do you want to download it now?`,
        buttons: ['Yes', 'No'],
      })
      .then((response) => {
        if (response.response === 0) {
          autoUpdater.downloadUpdate();
        } else {
          restoreOnce();
          log.info('User declined the update.');
        }
      });
  });

  autoUpdater.on('update-downloaded', () => {
    restoreOnce();
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
    restoreOnce();
    log.error('Error during update:', error);
  });
}


module.exports = { initAutoUpdater };
