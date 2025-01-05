const { ipcMain } = require('electron');
const { exec } = require('child_process');

function initRdpHandler(log) {

  ipcMain.on('session.open.rd.rdp', (event, { hostname, options }) => {
    launchMSTSC(hostname, options);
  });

  function launchMSTSC(hostname, options = {}) {
    log.info('Starting mstsc...');
    // Construct the mstsc command
    let command = `mstsc /v:${hostname}`;

    // Optional parameters
    if (options.fullscreen) command += ' /f';
    if (options.admin) command += ' /admin';

    // Execute MSTSC
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log.error(`Error launching MSTSC: ${error.message}`);
        return;
      }
      if (stderr) {
        log.error(`MSTSC Error: ${stderr}`);
      }
      log.info(`MSTSC Output: ${stdout}`);
    });
  }

}

module.exports = {initRdpHandler};
