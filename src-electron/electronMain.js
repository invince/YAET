const path = require("path");
const fs = require("fs");
const {app, globalShortcut, BrowserWindow, Tray, ipcMain} = require('electron');

const {createMenu} = require('./ui/menu');
const {SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, load, CLOUD_JSON, APP_CONFIG_PATH} = require("./common");
const {initConfigFilesIpcHandler} = require('./ipc/configFiles');
const {initTerminalIpcHandler} = require('./ipc/terminal/terminal');
const {initCloudIpcHandler} = require('./ipc/cloud');
const {initSecurityIpcHandler} = require('./ipc/security');
const {initRdpHandler} = require('./ipc/remote-desktop/rdp');
const {initClipboard} = require('./ipc/clipboard');
const {initVncHandler} = require("./ipc/remote-desktop/vnc");
const {initCustomSessionHandler} = require("./ipc/customSession");
const {initScpSftpHandler} = require("./ipc/file-explorer/scp");
const {initAutoUpdater} = require("./ipc/autoUpdater");
const {initBackend} = require("./ipc/backend");
const {initFtpHandler} = require("./ipc/file-explorer/ftp");

let tray;
let expressApp;
let mainWindow;
let terminalMap = new Map();
let vncMap = new Map();
let scpMap = new Map();
let ftpMap = new Map();

const log = require("electron-log")
const {initSSHTerminalIpcHandler} = require("./ipc/terminal/ssh");
const {initTelnetIpcHandler} = require("./ipc/terminal/telnet");
const {initLocalTerminalIpcHandler} = require("./ipc/terminal/localTerminal");

const logPath = `${__dirname}/logs/main.log`;
console.log(logPath);
log.transports.file.resolvePathFn = () => logPath;
log.transports.file.level = "debug"

ipcMain.on('log', (event, {level, message}) => {
  message = '[Frontend] ' + message;
  switch (level) {
    case 'info': log.info(message); break;
    case 'debug': log.debug(message); break;
    case 'trace': log.debug(message); break;
    case 'warn': log.warn(message); break;
    case 'error': log.error(message); break;
    default: log.info(message); break;
  }
});

app.on('ready', () => {

  log.info("Starting yaet app");

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
      enableBlinkFeatures: 'Accelerated2dCanvas',
      // preload: path.join(__dirname, 'preload.js'), // FIXME: preload need contextIsolation, but xterm.js won't work with that
    },
  });


  if (isDev) {
    log.info("We use Dev Mode");
    mainWindow.loadURL(`http://localhost:4200`)
      .then(r => log.log("Frontend loaded"));
  } else {
    mainWindow.setMenu(null); // Disable the menu bar in production
    mainWindow.loadFile(path.join(__dirname, '../dist/yet-another-electron-term/browser/index.html'))
      .then(r => log.log("Frontend loaded"));
  }

  if (!fs.existsSync(APP_CONFIG_PATH)) {
    fs.mkdirSync(APP_CONFIG_PATH);
  }

  // Ensure `load` runs on every page reload
  mainWindow.webContents.on('did-finish-load', () => {
    load(log, mainWindow, SETTINGS_JSON, "settings.loaded", false)
      .then(settings => {
        const autoUpdate = settings?.general?.autoUpdate;
        if (autoUpdate) {
          initAutoUpdater(log);
        }
      })
      .catch(log.error);
    load(log, mainWindow,  PROFILES_JSON, "profiles.loaded", false)
      .then(r =>  log.info(PROFILES_JSON + " loaded, event sent"))
      .catch(log.error);
    load(log, mainWindow, SECRETS_JSON, "secrets.loaded", true)
      .then(r =>  log.info(SECRETS_JSON + " loaded, event sent"))
      .catch(log.error);
    load(log, mainWindow, CLOUD_JSON, "cloud.loaded", true)
      .then(r =>  log.info(CLOUD_JSON + " loaded, event sent"))
      .catch(log.error);
  });

  // createMenu(log);

  expressApp = initBackend(log);

  initConfigFilesIpcHandler(log, mainWindow);
  initCloudIpcHandler(log);
  initSecurityIpcHandler(log);
  initTerminalIpcHandler(log, terminalMap);
  initSSHTerminalIpcHandler(log, terminalMap);
  initTelnetIpcHandler(log, terminalMap);
  initLocalTerminalIpcHandler(log, terminalMap);
  initRdpHandler(log);
  initVncHandler(log, vncMap);
  initScpSftpHandler(log, scpMap, expressApp);
  initFtpHandler(log, ftpMap, expressApp);
  initClipboard(log, mainWindow);
  initCustomSessionHandler(log);

  // Start API
  expressApp.listen(13012, () => log.info('API listening on port 13012'));


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


    ftpMap.forEach((ftpClient) => {
      // value?.end();
      if (ftpClient) {
        ftpClient.close(); // WebSocket server for this vnc client closed
      }
    });

    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll(); // Clean up on app exit
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);

  mainWindow.webContents.send('error', {
    category: 'exception',
    error: `Uncaught Exception: ${error.message}`
  });
});




