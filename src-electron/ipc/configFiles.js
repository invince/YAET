const { ipcMain } = require('electron');
const path = require("path");
const {load, save, APP_CONFIG_PATH, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, CLOUD_JSON, updateManifest }= require("../common");
function initConfigFilesIpcHandler(mainWindow) {

  ipcMain.on('settings.reload', (event, obj) => {
    console.log("reloading...");
    load(SETTINGS_JSON, "settings.loaded", false, mainWindow);
  });

  ipcMain.on('settings.save', (event, obj) => {
    save(SETTINGS_JSON, obj.data, false)
      .then(() => {
        console.log('Setting saved successfully!');
        updateManifest('setting.json');
      })
      .catch((error) => console.error('Error saving file:', error));
  });


  ipcMain.on('profiles.reload', (event, obj) => {
    console.log("reloading...");
    load(PROFILES_JSON, "profiles.loaded", false, mainWindow);
  });


  ipcMain.on('profiles.save', (event, obj) => {
    save(PROFILES_JSON, obj.data, false)
      .then(() => {
        console.log('Profiles saved successfully!');
        updateManifest('profile.json');
      })
      .catch((error) => console.error('Error saving file:', error));
  });

  ipcMain.on('secrets.reload', (event, obj) => {
    console.log("reloading...");
    load( SECRETS_JSON, "secrets.loaded", true, mainWindow);
  });

  ipcMain.on('secrets.save', (event, obj) => {
    save(SECRETS_JSON, obj.data, true)
      .then(() => {
        console.log('Secrets saved successfully!');
        updateManifest('secrets.json');
      })
      .catch((error) => console.error('Error saving file:', error));
  });

  ipcMain.on('cloud.reload', (event, obj) => {
    console.log("reloading...")
    load(CLOUD_JSON, "cloud.loaded", true, mainWindow);
  });

  ipcMain.on('cloud.save', (event, obj) => {
    save(CLOUD_JSON, obj.data, true)
      .then(() => {
        console.log('Cloud saved successfully!');
        updateManifest('cloud.json');
      })
      .catch((error) => console.error('Error saving file:', error));
  });


}

module.exports = { initConfigFilesIpcHandler };
