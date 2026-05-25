const path = require("path");
const fs = require("fs");
const { app, globalShortcut, BrowserWindow, Tray, ipcMain } = require('electron');

const { createMenu } = require('./ui/menu');
const { SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, load, CLOUD_JSON, APP_CONFIG_PATH, PROXIES_JSON } = require("./services/common");
const { initConfigFilesIpcHandler } = require('./adapter/ipc/configFiles');
const { initTerminalIpcHandler } = require('./adapter/ipc/terminal/terminalHandler');
const { initCloudIpcHandler } = require('./adapter/ipc/cloud');
const { initSecurityIpcHandler, decrypt } = require('./adapter/ipc/security');
const { initRdpHandler } = require('./adapter/ipc/remote-desktop/rdpHandler');
const { initClipboard } = require('./adapter/ipc/clipboard');
const { initVncHandler } = require("./adapter/ipc/remote-desktop/vncHandler");
const { initCustomSessionHandler } = require("./adapter/ipc/customSession");
const { initScpSftpHandler } = require("./adapter/ipc/file-explorer/scpHandler");
const { initAutoUpdater } = require("./adapter/ipc/autoUpdater");
const { initBackend } = require("./adapter/ipc/backend");
const { initFtpHandler } = require("./adapter/ipc/file-explorer/ftpHandler");
const { initLocalFileHandler } = require("./adapter/ipc/localFile");


let tray;
let expressApp;
let mainWindow;
let terminalMap = new Map();
let vncMap = new Map();
let scpMap = new Map();
let ftpMap = new Map();
let sambaMap = new Map();
let initialized = false;
let lastSettings = null;
let allProxies = null;
let allSecrets = null;

const log = require("electron-log")
const { initCommonIpc } = require("./adapter/ipc/commonIpc");
const { initAcpClientIpcHandler } = require("./adapter/ipc/ai/acpClient");
const { initAiIpcHandler, initAiChatIpcHandler, initAiToolsIpcHandler } = require("./adapter/ipc/ai/aiChat");
const { initSSHTerminalIpcHandler } = require("./adapter/ipc/terminal/sshHandler");
const { initTelnetIpcHandler } = require("./adapter/ipc/terminal/telnetHandler");
const { initLocalTerminalIpcHandler } = require("./adapter/ipc/terminal/localHandler");
const { initWinRmIpcHandler } = require("./adapter/ipc/terminal/winRMHandler");
const { initSambaHandler } = require("./adapter/ipc/file-explorer/sambaHandler");
const { RuntimeAPI } = require("./runtime/runtimeAPI");

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
    backgroundColor: '#1e1e1e',
    icon: __dirname + '/assets/icons/app-icon.png',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      enableBlinkFeatures: 'Accelerated2dCanvas',
      preload: path.join(__dirname, 'preload.js'),
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
        lastSettings = settings;
        initHandlerAfterSettingLoad(settings);
      })
      .catch(log.error);

  });
});

function initHandlerBeforeSettingLoad() {

  initCommonIpc(log);

  expressApp = initBackend(log);

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
  initAcpClientIpcHandler(log);
  initAiIpcHandler(log);
  initAiChatIpcHandler(log);

  const runtime = new RuntimeAPI(log);
  runtime.setSecretRepo(() => allSecrets);
  runtime.setProxyRepo(() => allProxies);
  initAiToolsIpcHandler(log, runtime);

  initLocalFileHandler(log, mainWindow);

  // Allow renderer to check if settings were already loaded before its listener registered
  ipcMain.handle('settings.get', () => lastSettings);

  // Start API
  expressApp.listen(13012, () => log.info('API listening on port 13012'));
}


function initHandlerAfterSettingLoad(settings) {
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
