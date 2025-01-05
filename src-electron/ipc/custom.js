const { ipcMain } = require('electron');
const { exec } = require('child_process');

function initCustomHandler(log) {

  ipcMain.on('session.open.custom', (event, { command }) => {
    log.info('Launching custom command');
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log.error(`Error launching custom profile: ${error.message}`);
        return;
      }
      if (stderr) {
        log.error(`custom profile Error: ${stderr}`);
      }
      log.log(`custom profile Output: ${stdout}`);
    });
  });


}

module.exports = {initCustomHandler};
