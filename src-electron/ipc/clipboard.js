
const { ipcMain, webContents } = require('electron');
const { globalShortcut, clipboard } = require('electron');


function initClipboard(log, mainWindow) {

  // 1st we send the clipboard paste text to angular, on angular side it will check if we need special process
  // if it's not used, angular send this text back to electron, we trigger the native clipboard paste

  ipcMain.on('trigger-native-clipboard-paste', async (event, data) => {
    // Trigger the default paste action
    const focusedWebContents = webContents.getFocusedWebContents();
    if (focusedWebContents) {
      log.info(focusedWebContents);
      focusedWebContents.paste(); // Simulate the standard clipboard paste action
    } else {
      log.warn('No focused web contents to paste into');
    }
  });
}


module.exports = { initClipboard };
