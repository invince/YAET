const {app, ipcMain, BrowserWindow} = require('electron');

const {createMenu} = require('./ui/menu');
const {initConfigFilesIpcHandler} = require('./ipc/configFiles');
const {initTerminalIpcHandler} = require('./ipc/terminal');
const {initCloudIpcHandler} = require('./ipc/cloud');
const {initSecurityIpcHandler} = require('./ipc/security');
const path = require("path");
const {CONFIG_FOLDER, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, load, CLOUD_JSON} = require("./common");

let mainWindow;
let terminalMap = new Map();
app.on('ready', () => {
  mainWindow = new BrowserWindow({
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
    load(path.join(CONFIG_FOLDER, SETTINGS_JSON), "settings.loaded", false, mainWindow);
    load(path.join(CONFIG_FOLDER, PROFILES_JSON), "profiles.loaded", false, mainWindow);
    load(path.join(CONFIG_FOLDER, SECRETS_JSON), "secrets.loaded", true, mainWindow);
    load(path.join(CONFIG_FOLDER, CLOUD_JSON), "cloud.loaded", true, mainWindow);
  });
  // createMenu();
  initConfigFilesIpcHandler(mainWindow);
  initTerminalIpcHandler(terminalMap);
  initCloudIpcHandler();
  initSecurityIpcHandler();
});




