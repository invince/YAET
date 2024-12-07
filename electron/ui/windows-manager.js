const { BrowserWindow } = require('electron');
const path = require("path");
const {load, CONFIG_FOLDER, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, CLOUD_JSON }= require("../common");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      // preload: path.join(__dirname, 'preload.js'), // FIXME: preload need contextIsolation, but xterm.js won't work with that
    },
  });

  mainWindow.loadURL(`http://localhost:4200`);

  mainWindow.webContents.once('dom-ready', () => {
    load(path.join(CONFIG_FOLDER, SETTINGS_JSON), "settings-loaded", false, mainWindow);
    load(path.join(CONFIG_FOLDER, PROFILES_JSON), "profiles-loaded", false, mainWindow);
    load(path.join(CONFIG_FOLDER, SECRETS_JSON), "secrets-loaded", true, mainWindow);
    load(path.join(CONFIG_FOLDER, CLOUD_JSON), "cloud-loaded", true, mainWindow);
  })
  return mainWindow;
}

module.exports = { createWindow };
