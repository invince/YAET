const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { app, globalShortcut, BrowserWindow, Tray, ipcMain } = require('electron');
const findFreePorts = require('find-free-ports');

const { createMenu } = require('./ui/menu');
const { SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, load, CLOUD_JSON, APP_CONFIG_PATH, PROXIES_JSON } = require("./common");
const { initConfigFilesIpcHandler } = require('./ipc/configFiles');
const { initTerminalIpcHandler } = require('./ipc/terminal/terminal');
const { initCloudIpcHandler } = require('./ipc/cloud');
const { initSecurityIpcHandler, decrypt } = require('./ipc/security');
const { initRdpHandler } = require('./ipc/remote-desktop/rdp');
const { initClipboard } = require('./ipc/clipboard');
const { initVncHandler } = require("./ipc/remote-desktop/vnc");
const { initCustomSessionHandler } = require("./ipc/customSession");
const { initScpSftpHandler } = require("./ipc/file-explorer/scp");
const { initAutoUpdater } = require("./ipc/autoUpdater");
const { initBackend } = require("./ipc/backend");
const { initFtpHandler } = require("./ipc/file-explorer/ftp");
const { initLocalFileHandler } = require("./ipc/localFile");

let tray;
let expressApp;
let mainWindow;
let terminalMap = new Map();
let vncMap = new Map();
let scpMap = new Map();
let ftpMap = new Map();
let sambaMap = new Map();
let initialized = false;
let allProxies = null;
let allSecrets = null;
let backendPort = 13012; // default fallback
let bearerToken = crypto.randomBytes(32).toString('hex'); // generated once at startup

const log = require("electron-log")
const { initCommonIpc } = require("./ipc/commonIpc");
const { initSSHTerminalIpcHandler } = require("./ipc/terminal/ssh");
const { initTelnetIpcHandler } = require("./ipc/terminal/telnet");
const { initLocalTerminalIpcHandler } = require("./ipc/terminal/localTerminal");
const { initWinRmIpcHandler } = require("./ipc/terminal/winRM");
const { initSambaHandler } = require("./ipc/file-explorer/samba");

const logPath = path.join(app.getPath('userData'), 'logs/main.log');
console.log(logPath);
log.transports.file.resolvePathFn = () => logPath;
log.transports.file.level = "debug"



app.on('ready', () => {

  log.info("Starting yaet app");

  const isDev = process.env.NODE_ENV === 'development';

  tray = new Tray(__dirname + '/assets/icons/app-icon.png',);
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

  initHandlerBeforeSettingLoad();


  // Ensure `load` runs on every page reload
  mainWindow.webContents.on('did-finish-load', () => {
    load(log, mainWindow, PROFILES_JSON, "profiles.loaded", true)
      .then(r => log.info(PROFILES_JSON + " loaded, event sent"))
      .catch(log.error);
    
    reloadSecrets();
    
    load(log, mainWindow, CLOUD_JSON, "cloud.loaded", true)
      .then(r => log.info(CLOUD_JSON + " loaded, event sent"))
      .catch(log.error);
      
    reloadProxies();

    load(log, mainWindow, SETTINGS_JSON, "settings.loaded", false)
      .then(settings => {
        initHandlerAfterSettingLoad(settings);
      })
      .catch(log.error);

  });
});

function initHandlerBeforeSettingLoad() {

  initCommonIpc(log);

  expressApp = initBackend(log, bearerToken);

  initConfigFilesIpcHandler(log, mainWindow, reloadProxies, reloadSecrets);
  initCloudIpcHandler(log, () => allProxies, () => allSecrets);
  initSecurityIpcHandler(log);
  initTerminalIpcHandler(log, terminalMap);
  initSSHTerminalIpcHandler(log, terminalMap, () => allProxies, () => allSecrets);
  initTelnetIpcHandler(log, terminalMap, () => allProxies, () => allSecrets);

  initScpSftpHandler(log, scpMap, expressApp, () => allProxies, () => allSecrets);
  initFtpHandler(log, ftpMap, expressApp, () => allProxies, () => allSecrets);
  initSambaHandler(log, sambaMap, expressApp, () => allProxies, () => allSecrets);

  initRdpHandler(log);
  initVncHandler(log, vncMap, () => allProxies, () => allSecrets);

  initClipboard(log, mainWindow);
  initCustomSessionHandler(log);
  initLocalFileHandler(log, mainWindow);

  // IPC: allow renderer to request the backend config (port + token)
  ipcMain.handle('backend.get-config', () => ({
    port: backendPort,
    token: bearerToken
  }));

  // Find a free port and start the API
  findFreePorts(1, { startPort: 13012 }).then(([port]) => {
    backendPort = port;
    expressApp.listen(backendPort, () => {
      log.info(`API listening on port ${backendPort}`);
      // Notify the renderer once the backend is ready
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend.ready', { port: backendPort, token: bearerToken });
      }
    });
  }).catch(err => {
    log.error('Failed to find a free port, falling back to 13012', err);
    expressApp.listen(13012, () => log.info('API listening on fallback port 13012'));
  });
}


function initHandlerAfterSettingLoad(settings) {
  // createMenu(log);
  if (!initialized) {
    const autoUpdate = settings?.general?.autoUpdate;
    if (autoUpdate) {
      initAutoUpdater(log, settings, () => allProxies, () => allSecrets);
    }
    initLocalTerminalIpcHandler(settings, log, terminalMap);
    initWinRmIpcHandler(settings, log, terminalMap);
    initialized = true;
  }

}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {

    terminalMap.forEach((term) => {
      switch (term.type) {
        case 'local':
        case 'winrm':
          term.process?.removeAllListeners();
          term.process?.kill();
          break;
        case 'ssh':
        case 'telnet':
          term.process?.end();
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





function reloadSecrets() {
  return load(log, mainWindow, SECRETS_JSON, "secrets.loaded", true)
    .then(r => {
      log.info(SECRETS_JSON + " loaded, event sent");
      return decrypt(r);
    })
    .then(decrypted => {
      allSecrets = JSON.parse(decrypted);
      log.info("Secrets updated in backend memory");
    })
    .catch(log.error);
}

function reloadProxies() {
  return load(log, mainWindow, PROXIES_JSON, "proxies.loaded", true)
    .then(r => {
      log.info(PROXIES_JSON + " loaded, event sent");
      return decrypt(r);
    })
    .then(decrypted => {
      allProxies = JSON.parse(decrypted);
      log.info("Proxies updated in backend memory");
    })
    .catch(log.error);
}
