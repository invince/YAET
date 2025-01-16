const { ipcMain } = require('electron');
const {Client} = require("ssh2");

function initSSHTerminalIpcHandler(log, terminalMap) {

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
            callback: (data) => stream.write(data), // cf terminal.js
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


}

module.exports = { initSSHTerminalIpcHandler };
