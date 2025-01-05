const { ipcMain } = require('electron');
const {load, save, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, CLOUD_JSON, updateManifest }= require("../common");
function initConfigFilesIpcHandler(log, mainWindow) {

  ipcMain.on('settings.reload', (event, obj) => {
    log.info("reload " + SETTINGS_JSON);
    load(log, mainWindow, SETTINGS_JSON, "settings.loaded", false)
      .then(r => log.info(SETTINGS_JSON + " reloaded"))
      .catch(err => log.error(err));
  });

  ipcMain.on('settings.save', (event, obj) => {
    save(log, SETTINGS_JSON, obj.data, false)
      .then(() => {
        log.info('Setting saved successfully!');
        updateManifest('setting.json');
      })
      .catch((error) => log.error('Error saving file:', error));
  });


  ipcMain.on('profiles.reload', (event, obj) => {
    log.info("reload " + PROFILES_JSON);
    load(log, mainWindow, PROFILES_JSON, "profiles.loaded", false)
      .then(r => log.info(PROFILES_JSON + " reloaded"))
      .catch(err => log.error(err));
  });


  ipcMain.on('profiles.save', (event, obj) => {
    save(log, PROFILES_JSON, obj.data, false)
      .then(() => {
        log.info('Profiles saved successfully!');
        updateManifest('profile.json');
      })
      .catch((error) => log.error('Error saving file:', error));
  });

  ipcMain.on('secrets.reload', (event, obj) => {
    log.info("reload " + SECRETS_JSON);
    load( log, mainWindow,  SECRETS_JSON, "secrets.loaded", true)
      .then(r => log.info(SECRETS_JSON + " reloaded"))
      .catch(err => log.error(err));
  });

  ipcMain.on('secrets.save', (event, obj) => {
    save(log, SECRETS_JSON, obj.data, true)
      .then(() => {
        log.info('Secrets saved successfully!');
        updateManifest('secrets.json');
      })
      .catch((error) => log.error('Error saving file:', error));
  });

  ipcMain.on('cloud.reload', (event, obj) => {
    log.info("reload " + CLOUD_JSON);
    load(log, mainWindow, CLOUD_JSON, "cloud.loaded", true)
      .then(r => log.info(CLOUD_JSON + " reloaded"))
      .catch(err => log.error(err));
  });

  ipcMain.on('cloud.save', (event, obj) => {
    save(log, CLOUD_JSON, obj.data, true)
      .then(() => {
        log.info('Cloud saved successfully!');
        updateManifest('cloud.json');
      })
      .catch((error) => log.error('Error saving file:', error));
  });


}

module.exports = { initConfigFilesIpcHandler };
