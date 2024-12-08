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

  ipcMain.on('create-local-terminal', (event, data) => {

    const id = data.terminalId; // cf ElectronService
    let shell = validate(data.terminalExec);
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env,
    });
    ptyProcess.on('data', (data) => {
      event.sender.send('terminal-output',
        {id: id, data: data.toString()}
      );
    });

    terminalMap.set(id, (data) => ptyProcess.write(data));

  });

  ipcMain.on('terminal-input', (event, data) => {
    const id = data.terminalId; // cf terminal.component.ts
    const input = data.input;
    const terminalCallback = terminalMap.get(id);
    console.log('Terminal id to find ' + id);
    if (terminalCallback) {
      console.log('Terminal found. Sending input.');
      terminalCallback(input); // Send input to the correct terminal
    } else {
      console.log('Terminal not found for id:', id);
    }
  });

  ipcMain.on('create-ssh-terminal', (event, data) => {
    const conn = new Client();
    const sshConfig = data.config;
    const id = data.terminalId;

    sshConfig.debug = (info) => {
      console.log('DEBUG:', info);
    };

    console.log(sshConfig);
    conn.on('ready', () => {
      console.log('SSH connection ready for id:', id);
      conn.shell((err, stream) => {
        if (err) {
          console.error('Error starting shell:', err);
          return;
        }
        console.log('Shell started for id:', id);

        stream.on('data', (data) => {
          event.sender.send('terminal-output',
            {id: id, data: data.toString()}
          );
        });

        terminalMap.set(id, (data) => stream.write(data));
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
      event.sender.send('ssh-disconnect', { id });
    });

    // Handle close event
    conn.on('close', (hadError) => {
      console.log(`SSH connection closed for id: ${id}, hadError: ${hadError}`);
      event.sender.send('ssh-disconnect', { id });
    });
  });



}

module.exports = { initTerminalIpcHandler };
