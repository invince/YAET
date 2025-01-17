const { ipcMain } = require('electron');
const { spawn } = require('child_process');

function runPowerShellCommand(command, callback) {
  const psProcess = spawn('powershell.exe', ['-Command', command], {
    env: process.env,
    stdio: 'pipe',
  });

  psProcess.stdout.setEncoding('utf8');
  psProcess.stderr.setEncoding('utf8');

  let output = '';
  psProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  psProcess.stderr.on('data', (data) => {
    console.error(`Error: ${data.toString()}`);
  });

  psProcess.on('close', (code) => {
    callback(output, code);
  });
}

function initWinRmIpcHandler(log, terminalMap) {
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
      terminal.process.stdin.end(); // Close stdin
      terminal.process.kill(); // Kill the process

      // Check the initial state of WinRM and act accordingly
      if (!terminal.isWinRMActiveBeforeOpen) {
        const disableWinRmCommand = `Disable-PSRemoting -Force`;
        runPowerShellCommand(disableWinRmCommand, (output, code) => {
          if (code !== 0) {
            log.error('Failed to disable WinRM:', output);
          } else {
            log.info('WinRM disabled successfully.');
          }
        });
      } else {
        log.info('WinRM state unchanged, as it was active before opening.');
      }

      terminalMap.delete(id);
      log.info(`WinRM Terminal ${id} closed`);
    }
  });

  function openWin32WinRM(event, data) {
    const id = data.terminalId;
    const { host, username, password } = data;

    log.info(`WinRM Terminal ${id} initializing`);

    // Check if WinRM is enabled
    const checkWinRmCommand = `winrm quickconfig`;
    runPowerShellCommand(checkWinRmCommand, (output, code) => {
      const checkWinRmCommand = `Test-WSMan -ComputerName localhost`;
      runPowerShellCommand(checkWinRmCommand, (output, code) => {
        const isWinRMActiveBeforeOpen = code === 0; // If WinRM is enabled, code will be 0
        if (!isWinRMActiveBeforeOpen) {
          log.info('WinRM not enabled. Enabling now...');
          const enableWinRmCommand = `Enable-PSRemoting -Force`;
          runPowerShellCommand(enableWinRmCommand, (enableOutput, enableCode) => {
            if (enableCode !== 0) {
              log.error('Failed to enable WinRM:', enableOutput);
              event.sender.send('error', {
                category: 'winrm',
                id: id,
                error: 'Failed to enable WinRM',
              });
              return;
            }
            log.info('WinRM enabled successfully.');
            openWinRmSession(isWinRMActiveBeforeOpen);
          });
        } else {
          log.info('WinRM already enabled.');
          openWinRmSession(isWinRMActiveBeforeOpen);
        }
      });
    });


    function openWinRmSession(isWinRMActiveBeforeOpen) {
      // PowerShell command for remote connection
      const winRmCommand = `
        $secPassword = ConvertTo-SecureString '${password}' -AsPlainText -Force;
        $cred = New-Object System.Management.Automation.PSCredential('${username}', $secPassword);
        Enter-PSSession -ComputerName '${host}' -Credential $cred
      `;

      // Spawn a PowerShell process
      const psProcess = spawn('powershell.exe', ['-NoExit', '-Command', winRmCommand], {
        env: process.env,
        stdio: 'pipe',
      });

      psProcess.stdout.setEncoding('utf8');
      psProcess.stderr.setEncoding('utf8');

      psProcess.stdout.on('data', (data) => {
        event.sender.send('terminal.output', { id: id, data: data.toString() });
      });

      psProcess.stderr.on('data', (data) => {
        log.error(`Error in WinRM Terminal ${id}: ${data.toString()}`);
        event.sender.send('error', {
          category: 'winrm',
          id: id,
          error: data.toString(),
        });
      });

      psProcess.on('close', (code) => {
        log.info(`WinRM Terminal ${id} closed with code ${code}`);
        terminalMap.delete(id);
        event.sender.send('terminal.closed', { id: id });
      });

      terminalMap.set(id, {
        type: 'winrm',
        process: psProcess,
        isWinRMActiveBeforeOpen, // Save the initial WinRM state
        callback: (cmd) => {
          psProcess.stdin.write(cmd + '\n');
        },
      });

      // Send initial command if provided
      if (data.initPath) {
        psProcess.stdin.write('cd ' + data.initPath + '\n');
      }
      if (data.initCmd) {
        psProcess.stdin.write(data.initCmd + '\n');
      }
    }
  }
}

module.exports = { initWinRmIpcHandler };
