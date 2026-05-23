const { LocalTerminalService } = require('../../../src-electron/services/localTerminalService');
const { Logger } = require('../../common/logger');

const log = new Logger('mcp-local');

function createLocalTools() {
  const localService = new LocalTerminalService(log);

  return [
    {
      name: 'local_execute',
      description: 'Execute a command on the local machine and return the output',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute' },
          shell: { type: 'string', description: 'Shell to use (e.g., bash, cmd.exe, powershell.exe)', optional: true },
        },
        required: ['command'],
      },
      handler: async (args) => {
        const { command, shell } = args;
        const sessionId = `mcp-local-${Date.now()}`;
        let output = '';

        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            localService.disconnect(sessionId);
            resolve(output || '(no output within timeout)');
          }, 30000);

          localService.on('output', ({ id, data }) => {
            if (id === sessionId) output += data;
          });

          const session = localService.connect(
            { terminalExec: shell },
            { id: sessionId }
          );

          localService.write(sessionId, command + '\n');
          localService.write(sessionId, 'exit\n');

          session.process.on('exit', () => {
            clearTimeout(timeout);
            resolve(output || '(no output)');
          });
        });
      },
    },
  ];
}

module.exports = { createLocalTools };
