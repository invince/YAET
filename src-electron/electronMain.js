const path = require("path");

const {app, globalShortcut, clipboard, BrowserWindow} = require('electron');
const {createMenu} = require('./ui/menu');
const {initConfigFilesIpcHandler} = require('./ipc/configFiles');
const {initTerminalIpcHandler} = require('./ipc/terminal');
const {initCloudIpcHandler} = require('./ipc/cloud');
const {initSecurityIpcHandler} = require('./ipc/security');
const {initRdpHandler} = require('./ipc/rdp');
const {initClipboard} = require('./ipc/clipboard');

const {CONFIG_FOLDER, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, load, CLOUD_JSON} = require("./common");
const {initVncHandler} = require("./ipc/vnc");

let mainWindow;
let terminalMap = new Map();
let vncMap = new Map();
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
  initRdpHandler();
  initVncHandler(vncMap, mainWindow);
  initClipboard(mainWindow);

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {

    terminalMap.forEach((value) => {
      value?.process?.kill();
    });

    vncMap.forEach((value) => {
      // value?.end();
    });

    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll(); // Clean up on app exit
});


