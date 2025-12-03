const { ipcMain } = require('electron');
const {Telnet} = require("telnet-client");
const { createProxyConnection } = require('../../utils/proxyUtils');

function initTelnetIpcHandler(log, terminalMap, getProxies, getSecrets) {

  ipcMain.on('session.open.terminal.telnet', async (event, data) => {
    const telnetClient = new Telnet();
    const config = data.config;
    const id = data.terminalId;
    const proxyId = data.proxyId;

    // Handle proxy if configured
    if (proxyId) {
      try {
        log.info(`Telnet connection ${id}: Using proxy ${proxyId}`);
        const proxies = getProxies();
        if (proxies && proxies.proxies) {
          const proxy = proxies.proxies.find(p => p.id === proxyId);
          if (proxy) {
            log.info(`Telnet connection ${id}: Found proxy ${proxy.name} (type: ${proxy.type})`);
            // Create proxy connection to Telnet server
            const sock = await createProxyConnection(
              proxy,
              config.host,
              config.port || 23,
              getSecrets,
              log
            );
            config.sock = sock;
            log.info(`Telnet connection ${id}: Proxy tunnel established`);
          } else {
            log.warn(`Telnet connection ${id}: Proxy ${proxyId} not found`);
          }
        }
      } catch (error) {
        log.error(`Telnet connection ${id}: Failed to establish proxy connection:`, error);
        event.sender.send('error', {
          category: 'telnet',
          id,
          error: `Proxy connection failed: ${error.message}`,
        });
        return;
      }
    }

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
            callback: (data, id) => { // cf terminal.js
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

module.exports = { initTelnetIpcHandler };
