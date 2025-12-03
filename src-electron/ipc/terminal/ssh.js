const { ipcMain } = require('electron');
const { Client } = require("ssh2");
const { createProxyConnection } = require("../../utils/proxyUtils");

function initSSHTerminalIpcHandler(log, terminalMap, getProxies, getSecrets) {

  ipcMain.on('session.close.terminal.ssh', (event, data) => {
    const id = data.terminalId;
    const terminal = terminalMap.get(id);
    if (terminal && terminal.process) {
      terminal.process.end();
    }
    terminalMap.delete(id);
    log.info('SSH connection ' + id + ' closed');
  });

  ipcMain.on('session.open.terminal.ssh', async (event, data) => {
    const conn = new Client();
    const sshConfig = data.config;
    const id = data.terminalId;
    const shellOptions = {
      term: 'xterm-256color',
    };

    sshConfig.debug = (info) => {
      log.info('DEBUG:', info);
    };

    // Handle proxy if configured
    if (data.proxyId) {
      try {
        log.info(`SSH connection ${id}: Using proxy ${data.proxyId}`);
        const proxies = getProxies();
        if (proxies && proxies.proxies) {
          const proxy = proxies.proxies.find(p => p.id === data.proxyId);
          if (proxy) {
            log.info(`SSH connection ${id}: Found proxy ${proxy.name} (type: ${proxy.type})`);
            // Create proxy connection (HTTP or SOCKS) to SSH server
            const sock = await createProxyConnection(
              proxy,
              sshConfig.host,
              sshConfig.port || 22,
              getSecrets,
              log
            );
            sshConfig.sock = sock;
            log.info(`SSH connection ${id}: Proxy tunnel established`);
          } else {
            log.warn(`SSH connection ${id}: Proxy ${data.proxyId} not found`);
          }
        }
      } catch (error) {
        log.error(`SSH connection ${id}: Failed to establish proxy connection:`, error);
        event.sender.send('error', {
          category: 'ssh',
          id: id,
          error: `Proxy connection failed: ${error.message}`
        });
        return;
      }
    }

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
          stream.write(`cd ${initPath}\\n`);
        }

        if (data.initCmd) {
          const initCmd = data.initCmd;
          stream.write(`${initCmd}\\n`);
        }

        stream.on('data', (data) => {
          event.sender.send('terminal.output',
            { id: id, data: data.toString() }
          );
        });

        const terminal = terminalMap.get(id);
        if (terminal) {
          stream.setWindow(terminal.rows, terminal.cols, null, null); // means xtermjs resize arrive before we create ssh2 connection
        }

        terminalMap.set(id,
          {
            type: 'ssh',
            process: conn,
            stream: stream,
            callback: (data, id) => stream.write(data), // cf terminal.js

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
        event.sender.send('session.disconnect.terminal.ssh', { id: id, error: hadError });
      } else {
        event.sender.send('session.disconnect.terminal.ssh', { id: id });
      }
    });
  });


}

module.exports = { initSSHTerminalIpcHandler };
