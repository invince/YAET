const { ipcMain } = require('electron');
const { exec } = require('child_process');
function initRdpHandler() {

  ipcMain.on('session.open.rd.rdp', (event, { hostname, options }) => {
    launchMSTSC(hostname, options);
  });

  function launchMSTSC(hostname, options = {}) {
    // Construct the mstsc command
    let command = `mstsc /v:${hostname}`;

    // Optional parameters
    if (options.fullscreen) command += ' /f';
    if (options.admin) command += ' /admin';

    // Execute MSTSC
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error launching MSTSC: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`MSTSC Error: ${stderr}`);
      }
      console.log(`MSTSC Output: ${stdout}`);
    });
  }

}

module.exports = {initRdpHandler};
