const { ipcMain } = require('electron');
const pty = require("node-pty");
const {Client} = require("ssh2");
const {Telnet} = require("telnet-client");

function initTerminalIpcHandler(log, terminalMap) {

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
      cols: 80,
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
        callback: (data) => ptyProcess.write(data),
      });

  });

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

  ipcMain.on('session.close.terminal.ssh', (event, data) => {
    const id = data.terminalId;
    terminalMap.get(id)?.process.end();
    terminalMap.delete(id);
    log.info('SSH connection ' + id + ' closed');
  });

  ipcMain.on('session.open.terminal.ssh', (event, data) => {
    const conn = new Client();
    const sshConfig = data.config;
    const id = data.terminalId;
    const shellOptions = {
      term: 'xterm-256color'
    };

    sshConfig.debug = (info) => {
      log.info('DEBUG:', info);
    };

    conn.on('ready', () => {
      log.info('SSH connection ready for id:', id);
      conn.shell(shellOptions, (err, stream) => {
        if (err) {
          log.error('Error starting shell:', err);
          return;
        }
        log.info('Shell started for id:', id);

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
      log.error('SSH connection error for id:', id, err);
      event.sender.send('error', {
        category: 'ssh',
        id: id,
        error: `SSH connection error: ${err.message}`
      });
    });

    // Handle end event
    conn.on('end', () => {
      log.info('SSH connection ended for id:', id);

    });

    // Handle close event
    conn.on('close', (hadError) => {
      if (hadError) {
        log.info(`SSH connection closed for id: ${id}, hadError: ${hadError}`);
        event.sender.send('session.disconnect.terminal.ssh', { id: id , error: hadError });
      } else {
        event.sender.send('session.disconnect.terminal.ssh', { id: id });
      }
    });
  });

  ipcMain.on('session.open.terminal.telnet', (event, data) => {
    const telnetClient = new Telnet();
    const config = data.config;
    const id = data.terminalId;

    telnetClient
      .connect(config)
      .then(() => {

        let isLoginPrompt = false;
        let inputBuffer = '';

        event.sender.send('terminal.output',
          {id: id, data: 'Connected to Telnet server.'}
        );
        telnetClient.on('data', (data) => {
          const message = data.toString();
          // Detect login prompt
          if (message.toLowerCase().includes('login:') || message.toLowerCase().includes('username:')) {
            isLoginPrompt = true;
          }

          event.sender.send('terminal.output',
            {id: id, data: message}
          );
        });

        terminalMap.set(id,
          {
            type: 'telnet',
            process: telnetClient,
            callback: (data) => {
              if (data === '\r') {
                if (isLoginPrompt) {
                  isLoginPrompt = false; // Reset the state
                } else {
                  inputBuffer += '\r';
                }

                telnetClient.send(inputBuffer).catch((err) => {
                  log.error(`Error sending data: ${err.message}`);
                });
                event.sender.send('terminal.output',
                  {id: id, data: '\r'}
                );
                inputBuffer = '';
              }
              else if (data === '\x7F' || data === '\b') {
                // Backspace key
                if (inputBuffer.length > 0) {
                  inputBuffer = inputBuffer.slice(0, -1); // Remove last character
                  event.sender.send('terminal.output',
                    {id: id, data: '\b \b'}
                  ); // Erase character on the terminal
                }
              }

              else {
                inputBuffer += data;
                if (!isLoginPrompt ) { // in login and password prompt, you input will appear without send it to terminal
                  event.sender.send('terminal.output',
                    {id: id, data: data.toString()}
                  );
                }

              }

            },
          });
      })
      .catch((err) => {
        log.error(`Error sending data: ${err.message}`);
      });

  });

  ipcMain.on('session.close.terminal.telnet', (event, data) => {
    const id = data.terminalId;
    terminalMap.get(id)?.process.end();
    terminalMap.delete(id);
    log.info('Telnet connection ' + id + ' closed');
  });

}

module.exports = { initTerminalIpcHandler };
