const { ipcMain } = require('electron');
const { exec } = require('child_process');
function initCustomHandler() {

  ipcMain.on('session.open.custom', (event, { command }) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error launching custom profile: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`custom profile Error: ${stderr}`);
      }
      console.log(`custom profile Output: ${stdout}`);
    });
  });


}

module.exports = {initCustomHandler};
