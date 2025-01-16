const {ipcMain} = require('electron');
const {NodeSSH} = require('node-powershell');

function initWinRmIpcHandler(log, terminalMap) {

  ipcMain.on('session.open.terminal.powershell', (event, data) => {
    const id = data.terminalId;
    const config = data.config;

    // Use WinRM for PowerShell Remoting
    const ps = new NodeSSH({
      executionPolicy: 'Bypass',
      noProfile: true,
    });

    ps.addCommand(data.command || 'Get-Process');
    ps.invoke()
      .then((output) => {
        event.sender.send('terminal.output', {id: id, data: output});
        terminalMap.set(id, {
          type: 'powershell',
          process: ps,
          callback: (cmd) => {
            ps.addCommand(cmd);
            ps.invoke().then((output) => {
              event.sender.send('terminal.output', {id: id, data: output});
            });
          },
        });
      })
      .catch((err) => {
        log.error('PowerShell Remoting (WinRM) error for id:', id, err);
        event.sender.send('error', {
          category: 'powershell',
          id: id,
          error: `PowerShell Remoting (WinRM) error: ${err.message}`,
        });
      });
  });

  ipcMain.on('session.close.terminal.powershell', (event, data) => {
    const id = data.terminalId;
    const terminal = terminalMap.get(id);
    if (terminal?.type === 'powershell') {
      if (terminal.process.end) terminal.process.end();
      if (terminal.process.dispose) terminal.process.dispose();
      terminalMap.delete(id);
      log.info('PowerShell session ' + id + ' closed');
    }
  });


}

module.exports = {initWinRmIpcHandler};
