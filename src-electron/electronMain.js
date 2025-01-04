const path = require("path");
const fs = require("fs");
const {IPty} = require("node-pty");
const {app, globalShortcut, BrowserWindow, Tray} = require('electron');

const {createMenu} = require('./ui/menu');
const {SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, load, CLOUD_JSON, APP_CONFIG_PATH} = require("./common");
const {initConfigFilesIpcHandler} = require('./ipc/configFiles');
const {initTerminalIpcHandler} = require('./ipc/terminal');
const {initCloudIpcHandler} = require('./ipc/cloud');
const {initSecurityIpcHandler} = require('./ipc/security');
const {initRdpHandler} = require('./ipc/rdp');
const {initClipboard} = require('./ipc/clipboard');
const {initVncHandler} = require("./ipc/vnc");
const {initCustomHandler} = require("./ipc/custom");
const {initScpSftpHandler} = require("./ipc/scp");
const {initAutoUpdater} = require("./ipc/autoUpdater");
const {initBackend} = require("./ipc/backend");

let tray;
let expressApp;
let mainWindow;
let terminalMap = new Map();
let vncMap = new Map();
let scpMap = new Map();

const log = require("electron-log")

log.transports.file.level = "debug"

app.on('ready', () => {

  const isDev = process.env.NODE_ENV === 'development';

  tray = new Tray( __dirname + '/assets/icons/app-icon.png',);
  tray.setToolTip('Yet Another Electron Terminal');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: __dirname + '/assets/icons/app-icon.png', // Path to your icon
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      // preload: path.join(__dirname, 'preload.js'), // FIXME: preload need contextIsolation, but xterm.js won't work with that
    },
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:4200`);
  } else {
    mainWindow.setMenu(null); // Disable the menu bar in production
    mainWindow.loadFile(path.join(__dirname, '../dist/yet-another-electron-term/browser/index.html'));
  }

  if (!fs.existsSync(APP_CONFIG_PATH)) {
    fs.mkdirSync(APP_CONFIG_PATH);
  }

  // Ensure `load` runs on every page reload
  mainWindow.webContents.on('did-finish-load', () => {
    load(SETTINGS_JSON, "settings.loaded", false, mainWindow)
      .then(settings => {
        const autoUpdate = settings.general?.autoUpdate;
        if (autoUpdate) {
          initAutoUpdater(log);
        }
      })
      .catch(console.error);
    load(PROFILES_JSON, "profiles.loaded", false, mainWindow)
      .then(r =>  console.debug(PROFILES_JSON + " loaded, event sent"))
      .catch(console.error);
    load(SECRETS_JSON, "secrets.loaded", true, mainWindow)
      .then(r =>  console.debug(SECRETS_JSON + " loaded, event sent"))
      .catch(console.error);
    load(CLOUD_JSON, "cloud.loaded", true, mainWindow)
      .then(r =>  console.debug(CLOUD_JSON + " loaded, event sent"))
      .catch(console.error);
  });

  // createMenu();

  expressApp = initBackend();

  initConfigFilesIpcHandler(mainWindow);
  initTerminalIpcHandler(terminalMap);
  initCloudIpcHandler();
  initSecurityIpcHandler();
  initRdpHandler();
  initVncHandler(vncMap);
  initScpSftpHandler(scpMap, expressApp);
  initClipboard(mainWindow);
  initCustomHandler();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {

    terminalMap.forEach((term) => {
      switch (term.type) {
        case 'local':
          term.process?.removeAllListeners();
          term.process?.kill() ;
          break;
        case 'ssh':
          term.process?.end() ;
          break;

      }
    });

    vncMap.forEach((vncClient) => {
      // value?.end();
      if (vncClient) {
        vncClient.close(); // WebSocket server for this vnc client closed
      }
    });

    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll(); // Clean up on app exit
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);

  mainWindow.webContents.send('error', {
    category: 'exception',
    error: `Uncaught Exception: ${error.message}`
  });
});


