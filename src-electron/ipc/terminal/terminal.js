const {ipcMain} = require('electron');
const {Terminal} = require("@xterm/xterm");

function initTerminalIpcHandler(log, terminalMap) {

  ipcMain.on('terminal.input', (event, data) => {
    const id = data.terminalId; // cf terminal.component.ts
    const input = data.input;
    const terminalCallback = terminalMap.get(id)?.callback;
    log.info('Terminal id to find ' + id);
    if (terminalCallback) {
      log.info('Terminal found. Sending input.');
      terminalCallback(input, id); // Send input to the correct terminal
    } else {
      log.info('Terminal not found for id:', id);
    }
  });

  ipcMain.on('terminal.resize', (event, { id, cols, rows }) => {
    const terminal = terminalMap.get(id);
    if (!terminal) {
      terminalMap.set(id, {cols: cols, rows: rows}); // resize may arrive before we create the terminal
    }
    if (terminal?.type === 'ssh') {
      terminal.stream?.setWindow(rows, cols, null, null);
    }
  });


}

module.exports = {initTerminalIpcHandler};
