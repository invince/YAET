const path = require("path");
const fs = require("fs");

const {app, globalShortcut, BrowserWindow, Tray, dialog} = require('electron');
const {createMenu} = require('./ui/menu');
const {initConfigFilesIpcHandler} = require('./ipc/configFiles');
const {initTerminalIpcHandler} = require('./ipc/terminal');
const {initCloudIpcHandler} = require('./ipc/cloud');
const {initSecurityIpcHandler} = require('./ipc/security');
const {initRdpHandler} = require('./ipc/rdp');
const {initClipboard} = require('./ipc/clipboard');
const {SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, load, CLOUD_JSON, APP_CONFIG_PATH} = require("./common");
const {initVncHandler} = require("./ipc/vnc");
const {initCustomHandler} = require("./ipc/custom");
const {initScpSftpHandler} = require("./ipc/scp");
const express = require('express');
const cors = require('cors');
const bodyParser = require("express");
const {IPty} = require("node-pty");
const { autoUpdater } = require('electron-updater');

const expressApp = express(); // we define the express backend here, because maybe multiple module needs create custom backend
expressApp.use(bodyParser.urlencoded({ extended: true })); // to accept application/x-www-form-urlencoded
expressApp.use(express.json());
expressApp.use(  cors({
  origin: 'http://localhost:4200', // Allow Angular dev server
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
  credentials: true, // If you need to send cookies or authentication
}));

let tray;
let mainWindow;
let terminalMap = new Map();
let vncMap = new Map();
let scpMap = new Map();
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
    // mainWindow.setMenu(null); // Disable the menu bar in production
    mainWindow.loadFile(path.join(__dirname, '../dist/yet-another-electron-term/browser/index.html'));
    autoUpdater.checkForUpdatesAndNotify();
  }

  if (!fs.existsSync(APP_CONFIG_PATH)) {
    fs.mkdirSync(APP_CONFIG_PATH);
  }

  // Ensure `load` runs on every page reload
  mainWindow.webContents.on('did-finish-load', () => {
    load(SETTINGS_JSON, "settings.loaded", false, mainWindow);
    load(PROFILES_JSON, "profiles.loaded", false, mainWindow);
    load(SECRETS_JSON, "secrets.loaded", true, mainWindow);
    load(CLOUD_JSON, "cloud.loaded", true, mainWindow);
  });

  // createMenu();
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
        console.log('User declined the update.');
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
  console.error('Error during update:', error);
});
