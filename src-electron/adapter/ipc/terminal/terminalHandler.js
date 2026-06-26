const {ipcMain} = require('electron');
const {Terminal: TerminalHandler} = require("@xterm/xterm");

function initTerminalIpcHandler(log, terminalMap) {

  ipcMain.on('terminal.input', (event, data) => {
    const id = data.terminalId; // cf terminal.component.ts
    const input = data.input;
    const terminalCallback = terminalMap.get(id)?.callback;
    log.info('TerminalHandler id to find ' + id);
    if (terminalCallback) {
      log.info('TerminalHandler found. Sending input.');
      terminalCallback(input, id); // Send input to the correct terminal
    } else {
      log.info('TerminalHandler not found for id:', id);
    }
  });

  ipcMain.on('terminal.resize', (event, { id, cols, rows }) => {
    const terminal = terminalMap.get(id);
    if (!terminal) {
      terminalMap.set(id, {cols, rows}); // resize may arrive before we create the terminal
      return;
    }
    if (typeof terminal.resize === 'function') {
      terminal.resize(cols, rows);
    }
  });


}

module.exports = {initTerminalIpcHandler};
