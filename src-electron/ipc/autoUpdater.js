const { autoUpdater } = require('electron-updater');
const {dialog} = require("electron");

function initAutoUpdater(log) {

  log.info("AutoUpdate is active");

  autoUpdater.logger = log;

  const isDev = process.env.NODE_ENV === 'development';

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
