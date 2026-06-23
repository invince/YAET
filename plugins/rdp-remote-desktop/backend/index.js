const { spawn } = require('child_process');

function isValidHostname(hostname) {
  return typeof hostname === 'string' &&
    hostname.length > 0 &&
    hostname.length <= 253 &&
    /^[a-zA-Z0-9.\-_:]+$/.test(hostname);
}

function register(context) {
  const { ipcMain, logger } = context;

  ipcMain.on('session.open.rd.rdp', (event, { hostname, options }) => {
    launchMSTSC(hostname, options);
  });

  function launchMSTSC(hostname, options = {}) {
    if (!isValidHostname(hostname)) {
      logger.error(`Invalid hostname rejected: ${hostname}`);
      return;
    }
    logger.info('Starting mstsc...');
    const args = [`/v:${hostname}`];
    if (options.fullscreen) args.push('/f');
    if (options.admin) args.push('/admin');

    const child = spawn('mstsc', args, {
      stdio: 'ignore',
      shell: false,
    });
    child.on('error', (error) => {
      logger.error(`Error launching MSTSC: ${error.message}`);
    });
  }

  logger.info('[rdp-remote-desktop] Plugin registered');
}

module.exports = { register };
