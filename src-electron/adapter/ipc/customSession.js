const { ipcMain } = require('electron');
const { spawn } = require('child_process');

function parseCommand(cmd) {
  const parts = cmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  if (parts.length === 0) return null;
  const program = parts[0];
  const args = parts.slice(1).map(arg => {
    if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
      return arg.slice(1, -1);
    }
    return arg;
  });
  return { program, args };
}

function initCustomSessionHandler(log) {

  ipcMain.on('session.open.custom', (event, { command }) => {
    log.info('Launching custom command');
    const parsed = parseCommand(command);
    if (!parsed) {
      log.error('Empty command received');
      return;
    }
    const child = spawn(parsed.program, parsed.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    child.stdout.on('data', (data) => {
      log.log(`custom profile Output: ${data.toString()}`);
    });
    child.stderr.on('data', (data) => {
      log.error(`custom profile Error: ${data.toString()}`);
    });
    child.on('error', (error) => {
      log.error(`Error launching custom profile: ${error.message}`);
    });
  });


}

module.exports = {initCustomSessionHandler};
