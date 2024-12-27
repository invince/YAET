const path = require("path");
const fs = require("fs");

const {app, globalShortcut, BrowserWindow} = require('electron');
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


const expressApp = express(); // we define the express backend here, because maybe multiple module needs create custom backend
expressApp.use(bodyParser.urlencoded({ extended: true })); // to accept application/x-www-form-urlencoded
expressApp.use(express.json());
expressApp.use(  cors({
  origin: 'http://localhost:4200', // Allow Angular dev server
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
  credentials: true, // If you need to send cookies or authentication
}));

let mainWindow;
let terminalMap = new Map();
let vncMap = new Map();
let scpMap = new Map();
app.on('ready', () => {

  const isDev = process.env.NODE_ENV === 'development';

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

  if (isDev) {
    mainWindow.loadURL(`http://localhost:4200`);
  } else {
    mainWindow.setMenu(null); // Disable the menu bar in production
    mainWindow.loadFile(path.join(__dirname, '../dist/yet-another-electron-term/browser/index.html'));
  }

  if (!fs.existsSync(APP_CONFIG_PATH)) {
    fs.mkdirSync(APP_CONFIG_PATH);
  }

  mainWindow.webContents.once('dom-ready', () => {
    load( SETTINGS_JSON, "settings.loaded", false, mainWindow);
    load( PROFILES_JSON, "profiles.loaded", false, mainWindow);
    load( SECRETS_JSON, "secrets.loaded", true, mainWindow);
    load( CLOUD_JSON, "cloud.loaded", true, mainWindow);
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


