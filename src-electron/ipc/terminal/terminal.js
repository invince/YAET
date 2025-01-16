const {ipcMain} = require('electron');

function initTerminalIpcHandler(log, terminalMap) {

  ipcMain.on('terminal.input', (event, data) => {
    const id = data.terminalId; // cf terminal.component.ts
    const input = data.input;
    const terminalCallback = terminalMap.get(id)?.callback;
    log.info('Terminal id to find ' + id);
    if (terminalCallback) {
      log.info('Terminal found. Sending input.');
      terminalCallback(input); // Send input to the correct terminal
    } else {
      log.info('Terminal not found for id:', id);
    }
  });


}

module.exports = {initTerminalIpcHandler};
