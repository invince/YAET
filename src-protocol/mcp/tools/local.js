const { LocalTerminalSession } = require('../../../src-electron/runtime/connectors/terminal/local');
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
        const session = new LocalTerminalSession(log);
        const result = await session.exec(args.command);
        const output = (result.stdout || '') + (result.stderr || '');
        return output || '(no output)';
      },
    },
  ];
}

module.exports = { createLocalTools };
