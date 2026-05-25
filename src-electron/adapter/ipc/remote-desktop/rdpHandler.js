const { ipcMain } = require('electron');
const { spawn } = require('child_process');

function isValidHostname(hostname) {
  return typeof hostname === 'string' &&
    hostname.length > 0 &&
    hostname.length <= 253 &&
    /^[a-zA-Z0-9.\-_:]+$/.test(hostname);
}

function initRdpHandler(log) {

  ipcMain.on('session.open.rd.rdp', (event, { hostname, options }) => {
    launchMSTSC(hostname, options);
  });

  function launchMSTSC(hostname, options = {}) {
    if (!isValidHostname(hostname)) {
      log.error(`Invalid hostname rejected: ${hostname}`);
      return;
    }
    log.info('Starting mstsc...');
    const args = [`/v:${hostname}`];
    if (options.fullscreen) args.push('/f');
    if (options.admin) args.push('/admin');

    const child = spawn('mstsc', args, {
      stdio: 'ignore',
      shell: false,
    });
    child.on('error', (error) => {
      log.error(`Error launching MSTSC: ${error.message}`);
    });
  }

}

module.exports = {initRdpHandler};
