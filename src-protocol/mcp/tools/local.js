const { exec } = require('child_process');
const { Logger } = require('../../common/logger');

const log = new Logger('mcp-local');

function createLocalTools() {
  return [
    {
      name: 'local_execute',
      description: 'Execute a command on the local machine and return the output',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute' },
        },
        required: ['command'],
      },
      handler: async (args) => {
        const shell = process.platform === 'win32' ? { shell: 'cmd.exe' } : {};
        return new Promise((resolve) => {
          exec(args.command, {
            ...shell,
            timeout: 30000,
            maxBuffer: 10 * 1024 * 1024,
            windowsHide: true,
          }, (error, stdout, stderr) => {
            const output = (stdout || '') + (stderr || '');
            resolve(output || '(no output)');
          });
        });
      },
    },
  ];
}

module.exports = { createLocalTools };
