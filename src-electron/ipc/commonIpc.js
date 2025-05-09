const {ipcMain, shell} = require('electron');

function initCommonIpc(log) {

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

  ipcMain.on('open-url', (event, {url}) => {
    if (isSafeUrl(url)) {
      shell.openExternal(url);
    }
    else {
      log.warn('Unsafe or invalid URL blocked:', url);
    }
  });

  function isSafeUrl(url)  {
    try {
      const parsed = new URL(url);

      // Only allow http or https protocols
      return !(parsed.protocol !== 'http:' && parsed.protocol !== 'https:');


    } catch {
      return false; // Invalid URL
    }
  }

}

module.exports = {initCommonIpc};
