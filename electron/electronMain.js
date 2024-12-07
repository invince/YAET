const {app} = require('electron');

const {createWindow} = require('./ui/windows-manager');
const {createMenu} = require('./ui/menu');
const {initConfigFilesIpcHandler} = require('./ipc/configFiles');
const {initTerminalIpcHandler} = require('./ipc/terminal');
const {initCloudIpcHandler} = require('./ipc/cloud');
const {initSecurityIpcHandler} = require('./ipc/security');


let mainWindow;
app.on('ready', () => {
  mainWindow = createWindow();
  createMenu();
  initConfigFilesIpcHandler(mainWindow);
  initTerminalIpcHandler();
  initCloudIpcHandler();
  initSecurityIpcHandler();
});






