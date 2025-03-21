const { ipcMain } = require('electron');
const pty = require("node-pty");

function initLocalTerminalIpcHandler(settings, log, terminalMap) {

  function validate(terminalExec) {
    if (!terminalExec) {
      return process.platform === 'win32' ? 'cmd.exe' : 'bash';
    }
    return terminalExec;
  }

  ipcMain.on('session.close.terminal.local', (event, data) => {
    const id = data.terminalId;
    let terminal = terminalMap.get(id)?.process;
    terminal.kill();
    terminalMap.delete(id);
    log.info('Local Terminal ' + id + ' closed');
  });

  ipcMain.on('session.open.terminal.local', (event, data) => {

    const id = data.terminalId; // cf ElectronService
    log.info('Local Terminal ' + id + ' ready');
    let shell = validate(data.terminalExec);
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 150,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env,
      /* ISSUE 108, useConpty false to avoid Error: read EPIPE on close
         ref: https://github.com/microsoft/node-pty/issues/512
              https://github.com/vercel/hyper/issues/6961
      */
      useConpty: false
    });

    ptyProcess.onData((data) => {
      event.sender.send('terminal.output',
        {id: id, data: data.toString()}
      );
    });

    ptyProcess.on('error', (err) => {
      // there is a strange error when we do kill, ptyProcess continue receiving an \n, add onError can prevent error popup
      log.error(`Error in terminal ${id}:`, err);
    });

    terminalMap.set(id,
      {
        type: 'local',
        process: ptyProcess,
        callback: (data, id) => ptyProcess.write(data), // cf terminal.js
      });

  });

}

module.exports = { initLocalTerminalIpcHandler };
