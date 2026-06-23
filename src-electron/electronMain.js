const path = require("path");
const fs = require("fs");
const { app, globalShortcut, BrowserWindow, Tray, ipcMain } = require('electron');

const { createMenu } = require('./ui/menu');
const { ConfigService, APP_CONFIG_PATH, SETTINGS_JSON, PROFILES_JSON, SECRETS_JSON, CLOUD_JSON, PROXIES_JSON } = require("./services/configService");
const { initConfigFilesIpcHandler } = require('./adapter/ipc/configFiles');
const { initTerminalIpcHandler } = require('./adapter/ipc/terminal/terminalHandler');
const { initCloudIpcHandler } = require('./adapter/ipc/cloud');
const { initSecurityIpcHandler, decrypt } = require('./adapter/ipc/security');
const { initClipboard } = require('./adapter/ipc/clipboard');
const { initCustomSessionHandler } = require("./adapter/ipc/customSession");
const { initScpSftpHandler } = require("./adapter/ipc/file-explorer/scpHandler");
const { initAutoUpdater } = require("./adapter/ipc/autoUpdater");
const { initBackend } = require("./adapter/ipc/backend");
const { initFtpHandler } = require("./adapter/ipc/file-explorer/ftpHandler");
const { initLocalFileHandler } = require("./adapter/ipc/localFile");
const { initPluginHandler } = require("./adapter/ipc/pluginHandler");


let tray;
let expressApp;
let mainWindow;
let terminalMap = new Map();
let scpMap = new Map();
let ftpMap = new Map();
let sambaMap = new Map();
let initialized = false;
let lastSettings = null;
let allProxies = null;
let allSecrets = null;
let runtime = null;
let sessionRegistry = null;
let pluginManager = null;

const log = require("electron-log")
const configService = new ConfigService(log);
const { initCommonIpc } = require("./adapter/ipc/commonIpc");
const { initAcpClientIpcHandler } = require("./adapter/ipc/ai/acpClient");
const { initAiIpcHandler, initAiChatIpcHandler, initAiToolsIpcHandler } = require("./adapter/ipc/ai/aiChat");
const { initLocalTerminalIpcHandler } = require("./adapter/ipc/terminal/localHandler");
const { initSambaHandler } = require("./adapter/ipc/file-explorer/sambaHandler");
const { RuntimeAPI } = require("./runtime/runtimeAPI");
const { SessionRegistry } = require("./runtime/sessionRegistry");
const { ApprovalManager } = require("./runtime/approvalManager");

const logPath = path.join(app.getPath('userData'), 'logs/main.log');
console.log(logPath);
log.transports.file.resolvePathFn = () => logPath;
log.transports.file.level = "debug"



app.on('ready', () => {

  log.info("Starting yaet app");

  const isDev = process.env.NODE_ENV === 'development';

  // ── Phase 1: Discover plugins and write merged manifest for preload.js ──
  pluginManager = initPluginHandler(log);

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
      sandbox: false, // for plugin, we need load add require other path
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

  // ── Phase 1: Discover plugins and write merged manifest for preload.js ──
  pluginManager = initPluginHandler(log);

  runtime = new RuntimeAPI(log);
  runtime.setSecretRepo(() => allSecrets);
  runtime.setProxyRepo(() => allProxies);

  initHandlerBeforeSettingLoad();

  // ── Phase 2: Load plugin backends (after sessionRegistry is created) ────
  pluginManager.loadAll({
    ipcMain,
    logger: log,
    terminalMap,
    sessionRegistry: () => sessionRegistry,
    runtimeAPI: () => runtime,
    proxyService: () => allProxies,
    secretService: () => allSecrets,
    expressApp: () => expressApp,
    settings: () => lastSettings,
  });

  // Ensure `load` runs on every page reload
  mainWindow.webContents.on('did-finish-load', () => {
    configService.load(PROFILES_JSON, true)
      .then(r => { mainWindow.webContents.send("profiles.loaded", r); log.info(PROFILES_JSON + " loaded, event sent"); })
      .catch(log.error);

    reloadSecrets();

    configService.load(CLOUD_JSON, true)
      .then(r => { mainWindow.webContents.send("cloud.loaded", r); log.info(CLOUD_JSON + " loaded, event sent"); })
      .catch(log.error);

    reloadProxies();

    configService.load(SETTINGS_JSON, false)
      .then(settings => {
        mainWindow.webContents.send("settings.loaded", settings);
        lastSettings = settings;
        initHandlerAfterSettingLoad(settings);
      })
      .catch(log.error);

  });
});

function initHandlerBeforeSettingLoad() {

  initCommonIpc(log);

  expressApp = initBackend(log);

  initConfigFilesIpcHandler(log, mainWindow, reloadProxies, reloadSecrets,
    (settings) => { lastSettings = settings; });
  initCloudIpcHandler(log, () => allProxies, () => allSecrets);
  initSecurityIpcHandler(log);
  initTerminalIpcHandler(log, terminalMap);

  initScpSftpHandler(log, scpMap, expressApp, () => allProxies, () => allSecrets);
  initFtpHandler(log, ftpMap, expressApp, () => allProxies, () => allSecrets);
  initSambaHandler(log, sambaMap, expressApp, () => allProxies, () => allSecrets);

  initClipboard(log, mainWindow);
  initCustomSessionHandler(log);
  initAcpClientIpcHandler(log);
  initAiIpcHandler(log);
  initAiChatIpcHandler(log);

  sessionRegistry = new SessionRegistry({ maxBufferLines: 50 });
  runtime.sessionRegistry = sessionRegistry;

  runtime.approvalManager = new ApprovalManager(log, () => lastSettings);
  runtime.approvalManager.setBroadcast((requestId, toolName, args) => {
    const preview = _getApprovalPreview(toolName, args);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ai.command-pending', { requestId, toolName, args, preview });
    }
  });

  ipcMain.on('ai.command-approved', (_event, { requestId }) => {
    runtime.approvalManager?.resolve(requestId, true);
  });

  ipcMain.on('ai.command-rejected', (_event, { requestId }) => {
    runtime.approvalManager?.resolve(requestId, false);
  });

  initAiToolsIpcHandler(log, runtime, () => lastSettings);

  initLocalFileHandler(log, mainWindow);

  // Allow renderer to check if settings were already loaded before its listener registered
  ipcMain.handle('settings.get', () => lastSettings);

  // Start API
  const apiServer = expressApp.listen(13012, () => log.info('API listening on port 13012'));
  apiServer.on('error', (err) => {
    log.error('Failed to start API server:', err.message);
  });
}


function initHandlerAfterSettingLoad(settings) {
  if (!initialized) {
    const autoUpdate = settings?.general?.autoUpdate;
    if (autoUpdate) {
      initAutoUpdater(log, settings, () => allProxies, () => allSecrets);
    }
    initLocalTerminalIpcHandler(settings, log, terminalMap, sessionRegistry);
    initialized = true;
  }

  const maxLines = settings?.ai?.contextMaxLines;
  if (maxLines && sessionRegistry) {
    sessionRegistry.maxBufferLines = maxLines;
    log.info(`SessionRegistry maxBufferLines set to ${maxLines}`);
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
  return configService.load(SECRETS_JSON, true)
    .then(r => {
      mainWindow.webContents.send("secrets.loaded", r);
      log.info(SECRETS_JSON + " loaded, event sent");
      return decrypt(r);
    })
    .then(decrypted => {
      allSecrets = JSON.parse(decrypted);
      log.info("Secrets updated in backend memory");
    })
    .catch(log.error);
}

function _getApprovalPreview(toolName, args) {
  if (toolName === 'local_execute') return args.command;
  if (toolName === 'session_write') return args.input;
  return '';
}

function reloadProxies() {
  return configService.load(PROXIES_JSON, true)
    .then(r => {
      mainWindow.webContents.send("proxies.loaded", r);
      log.info(PROXIES_JSON + " loaded, event sent");
      return decrypt(r);
    })
    .then(decrypted => {
      allProxies = JSON.parse(decrypted);
      log.info("Proxies updated in backend memory");
    })
    .catch(log.error);
}
