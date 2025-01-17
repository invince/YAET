const { ipcMain } = require('electron');
const {Telnet} = require("telnet-client");

function initTelnetIpcHandler(log, terminalMap) {

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
