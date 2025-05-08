const { ipcMain } = require('electron');
const pty = require("node-pty");

function initWinRmIpcHandler(settings, log, terminalMap) {
  ipcMain.on('session.open.terminal.winrm', (event, data) => {
    if (process.platform === 'win32') {
      openWin32WinRM(event, data);
    } else {
      log.error('WinRM is only supported on Windows platforms.');
      event.sender.send('error', {
        category: 'winrm',
        error: 'WinRM is only supported on Windows platforms.',
      });
    }
  });

  ipcMain.on('session.close.terminal.winrm', (event, data) => {
    const id = data.terminalId;
    const terminal = terminalMap.get(id);
    if (terminal?.type === 'winrm') {
      terminal.process.kill(); // Kill the process
      terminalMap.delete(id);
      log.info(`WinRM Terminal ${id} closed`);
    }
  });

  function openWin32WinRM(event, data) {
    const id = data.terminalId;
    const { host, username, password } = data.config;

    log.info(`WinRM Terminal ${id} initializing`);

    let localTermForWinRM = 'powershell.exe';
    if('powershell 7' === settings?.terminal?.localTerminal?.type){
      localTermForWinRM = 'pwsh.exe';
    }

    // Spawn a PowerShell process
    const ptyProcess = pty.spawn(localTermForWinRM, [], {
      name: 'xterm-color',
      rows: 30,
      cwd: process.env.HOME,
      env: process.env,
      /* ISSUE 108, useConpty false to avoid Error: read EPIPE on close
         ref: https://github.com/microsoft/node-pty/issues/512
              https://github.com/vercel/hyper/issues/6961
      */
      useConpty: false,
    });

    let initialized = false;

    ptyProcess.onData((data) => {
      if (!initialized) {
        // Buffer output until initialization completes
        if (data.includes("Enter-PSSession")) {
          initialized = true;
          log.info(`WinRM Terminal ${id} session established`);
          event.sender.send('terminal.opened', { id });
        }
      } else {
        // Send interactive output to the terminal
        event.sender.send('terminal.output', { id, data: data.toString() });
      }
    });

    ptyProcess.on('error', (data) => {
      log.error(`Error in WinRM Terminal ${id}: ${data.toString()}`);
      event.sender.send('error', {
        category: 'winrm',
        id,
        error: data.toString(),
      });
    });

    ptyProcess.on('close', (code) => {
      log.info(`WinRM Terminal ${id} closed with code ${code}`);
      terminalMap.delete(id);
      event.sender.send('terminal.closed', { id });
    });

    terminalMap.set(id, {
      type: 'winrm',
      process: ptyProcess,
      callback: (data) => {
        ptyProcess.write(data);
      },
    });

    // Initialize the remote connection
    // Prepare the commands
    let connectionCommand = [];
    if (password && username) {
      connectionCommand =  [
        `$secPassword = ConvertTo-SecureString '${password}' -AsPlainText -Force`,
        `$cred = New-Object System.Management.Automation.PSCredential('${username}', $secPassword)`,
        `Enter-PSSession -ComputerName '${host}' -Credential $cred`,
      ];
    } else {
      connectionCommand = [`Enter-PSSession -ComputerName '${host}'`]
    }

    for (const oneCmd of connectionCommand) {
      ptyProcess.write(oneCmd + '\r');
    }

    // Send initial command if provided after initialization
    if (data.initPath) {
      ptyProcess.write(`cd ${data.initPath}\r`);
    }
    if (data.initCmd) {
      ptyProcess.write(`${data.initCmd}\r`);
    }
  }
}

module.exports = { initWinRmIpcHandler };
