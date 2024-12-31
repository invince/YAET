const { ipcMain } = require('electron');
const pty = require("node-pty");
const {Client} = require("ssh2");
const fs = require("fs");
function initTerminalIpcHandler(terminalMap) {

  function validate(terminalExec) {
    if (!terminalExec) {
      return process.platform === 'win32' ? 'cmd.exe' : 'bash';
    }
    return terminalExec;
  }

  ipcMain.on('session.close.terminal.local', (event, data) => {
    const id = data.terminalId;
    terminalMap.get(id)?.process.removeAllListeners();
    terminalMap.get(id)?.process.kill();
    terminalMap.delete(id);
    console.log('Local Terminal ' + id + ' closed');
  });

  ipcMain.on('session.open.terminal.local', (event, data) => {

    const id = data.terminalId; // cf ElectronService
    console.log('Local Terminal ' + id + ' ready');
    let shell = validate(data.terminalExec);
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env,
    });

    ptyProcess.onData((data) => {
      event.sender.send('terminal.output',
        {id: id, data: data.toString()}
      );
    });

    ptyProcess.on('error', (err) => {
      // there is a strange error when we do kill, ptyProcess continue receiving an \n, add onError can prevent error popup
      console.error(`Error in terminal ${id}:`, err);
    });

    terminalMap.set(id,
      {
        type: 'local',
        process: ptyProcess,
        callback: (data) => ptyProcess.write(data),
      });

  });

  ipcMain.on('terminal.input', (event, data) => {
    const id = data.terminalId; // cf terminal.component.ts
    const input = data.input;
    const terminalCallback = terminalMap.get(id)?.callback;
    console.log('Terminal id to find ' + id);
    if (terminalCallback) {
      console.log('Terminal found. Sending input.');
      terminalCallback(input); // Send input to the correct terminal
    } else {
      console.log('Terminal not found for id:', id);
    }
  });

  ipcMain.on('session.close.terminal.ssh', (event, data) => {
    const id = data.terminalId;
    terminalMap.get(id)?.process.end();
    terminalMap.delete(id);
    console.log('SSH connection ' + id + ' closed');
  });

  ipcMain.on('session.open.terminal.ssh', (event, data) => {
    const conn = new Client();
    const sshConfig = data.config;
    const id = data.terminalId;

    sshConfig.debug = (info) => {
      console.log('DEBUG:', info);
    };

    conn.on('ready', () => {
      console.log('SSH connection ready for id:', id);
      conn.shell((err, stream) => {
        if (err) {
          console.error('Error starting shell:', err);
          return;
        }
        console.log('Shell started for id:', id);

        if (data.initPath) {
          const initPath = data.initPath;
          stream.write(`cd ${initPath}\n`);
        }

        if (data.initCmd) {
          const initCmd = data.initCmd;
          stream.write(`${initCmd}\n`);
        }

        stream.on('data', (data) => {
          event.sender.send('terminal.output',
            {id: id, data: data.toString()}
          );
        });

        terminalMap.set(id,
          {
            type: 'ssh',
            process: conn,
            callback: (data) => stream.write(data),
          });
      });
    }).connect(sshConfig);

    // Handle connection errors
    conn.on('error', (err) => {
      console.error('SSH connection error for id:', id, err);
      event.sender.send('error', {
        category: 'ssh',
        id: id,
        error: `SSH connection error: ${err.message}`
      });
    });

    // Handle end event
    conn.on('end', () => {
      console.log('SSH connection ended for id:', id);
    });

    // Handle close event
    conn.on('close', (hadError) => {
      if (hadError) {
        console.log(`SSH connection closed for id: ${id}, hadError: ${hadError}`);
        event.sender.send('session.disconnect.terminal.ssh', { id: id });
      }
    });
  });



}

module.exports = { initTerminalIpcHandler };
