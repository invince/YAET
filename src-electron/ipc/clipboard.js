
const { ipcMain, webContents} = require('electron');
const {globalShortcut, clipboard} = require('electron');


function initClipboard( log, mainWindow) {

  // 1st we send the clipboard paste text to angular, on angular side it will check if we need special process
  // if it's not used, angular send this text back to electron, we trigger the native clipboard paste

  mainWindow.on('focus', () => {
    globalShortcut.register('CommandOrControl+V', () => {
      if (mainWindow.isFocused()) {
        const clipboardText = clipboard.readText();
        mainWindow.webContents.send('clipboard-paste', clipboardText);
      }
    });
  });


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



  // Unregister global shortcut when mainWindow loses focus
  mainWindow.on('blur', () => {
    globalShortcut.unregister('CommandOrControl+V');
  });

  mainWindow.on('closed', () => {
    globalShortcut.unregisterAll(); // Clean up when window is closed
  });
}


module.exports = { initClipboard };
