const {ipcMain} = require('electron');
const {Terminal: TerminalHandler} = require("@xterm/xterm");

function initTerminalIpcHandler(log, terminalMap) {

  ipcMain.on('terminal.input', (event, data) => {
    const id = data.id; // cf terminal.component.ts
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
      log.info(`TerminalHandler resize queued for ${id}: cols=${cols} rows=${rows} (terminal not created yet)`);
      return;
    }
    log.info(`TerminalHandler resize for ${id}: cols=${cols} rows=${rows} (hasResizeFn=${typeof terminal.resize === 'function'})`);
    if (typeof terminal.resize === 'function') {
      terminal.resize(cols, rows);
    }
  });


}

module.exports = {initTerminalIpcHandler};
