const { ipcMain } = require('electron');
const path = require("path");
const {load, save, CONFIG_FOLDER, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, CLOUD_JSON }= require("../common");
function initConfigFilesIpcHandler(mainWindow) {

  ipcMain.on('settings.reload', (event, obj) => {
    console.log("reloading...");
    load(path.join(CONFIG_FOLDER, SETTINGS_JSON), "settings.loaded", false, mainWindow);
  });

  ipcMain.on('settings.save', (event, obj) => {
    save(path.join(CONFIG_FOLDER, SETTINGS_JSON), obj.data, false)
      .then(() => console.log('Setting saved successfully!'))
      .catch((error) => console.error('Error saving file:', error));
  });


  ipcMain.on('profiles.reload', (event, obj) => {
    console.log("reloading...");
    load(path.join(CONFIG_FOLDER, PROFILES_JSON), "profiles.loaded", true, mainWindow);
  });


  ipcMain.on('profiles.save', (event, obj) => {
    save(path.join(CONFIG_FOLDER, PROFILES_JSON), obj.data, false)
      .then(() => console.log('Profiles saved successfully!'))
      .catch((error) => console.error('Error saving file:', error));
  });

  ipcMain.on('secrets.reload', (event, obj) => {
    console.log("reloading...");
    load(path.join(CONFIG_FOLDER, SECRETS_JSON), "secrets.loaded", true, mainWindow);
  });

  ipcMain.on('secrets.save', (event, obj) => {
    save(path.join(CONFIG_FOLDER, SECRETS_JSON), obj.data, true)
      .then(() => console.log('Secrets saved successfully!'))
      .catch((error) => console.error('Error saving file:', error));
  });

  ipcMain.on('cloud.reload', (event, obj) => {
    console.log("reloading...")
    load(path.join(CONFIG_FOLDER, CLOUD_JSON), "cloud.loaded", true, mainWindow);
  });

  ipcMain.on('cloud.save', (event, obj) => {
    save(path.join(CONFIG_FOLDER, CLOUD_JSON), obj.data, true)
      .then(() => console.log('Secrets saved successfully!'))
      .catch((error) => console.error('Error saving file:', error));
  });
}

module.exports = { initConfigFilesIpcHandler };
