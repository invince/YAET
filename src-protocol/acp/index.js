#!/usr/bin/env node
const { ACPServer } = require('./server');
const { Logger } = require('../common/logger');
const { SSHService } = require('../../src-electron/services/sshService');
const { LocalTerminalService } = require('../../src-electron/services/localTerminalService');

const log = new Logger('acp-server');

function main() {
  const server = new ACPServer({
    name: 'YAET ACP Server',
    version: '5.0.0',
  });

  const sshService = new SSHService(log);
  const localService = new LocalTerminalService(log);

  server.registerTool(
    'ssh_execute',
    'Execute a command on a remote server via SSH',
    {
      type: 'object',
      properties: {
        host: { type: 'string' },
        port: { type: 'number', default: 22 },
        username: { type: 'string' },
        password: { type: 'string' },
        command: { type: 'string' },
      },
      required: ['host', 'username', 'command'],
    },
    async (args) => {
      const sessionId = `acp-ssh-${Date.now()}`;
      let output = '';
      return new Promise((resolve, reject) => {
        sshService.on('output', ({ id, data }) => { if (id === sessionId) output += data; });
        sshService.on('error', ({ id, error }) => { if (id === sessionId) reject(new Error(error)); });
        sshService.on('disconnect', ({ id }) => { if (id === sessionId) resolve(output); });

        sshService.connect(
          { host: args.host, port: args.port || 22, username: args.username, password: args.password },
          { id: sessionId }
        ).then(() => {
          sshService.write(sessionId, args.command + '\n');
          setTimeout(() => { sshService.disconnect(sessionId); resolve(output); }, 15000);
        }).catch(reject);
      });
    }
  );

  server.registerTool(
    'local_execute',
    'Execute a command on the local machine',
    {
      type: 'object',
      properties: {
        command: { type: 'string' },
      },
      required: ['command'],
    },
    async (args) => {
      const sessionId = `acp-local-${Date.now()}`;
      let output = '';
      return new Promise((resolve) => {
        localService.on('output', ({ id, data }) => { if (id === sessionId) output += data; });
        const session = localService.connect({ terminalExec: undefined }, { id: sessionId });
        localService.write(sessionId, args.command + '\n');
        localService.write(sessionId, 'exit\n');
        session.process.on('exit', () => resolve(output));
        setTimeout(() => resolve(output), 15000);
      });
    }
  );

  log.info('Starting ACP server (stdio)...');
  server.runStdio().catch(err => {
    log.error('ACP server error: ' + err.message);
    process.exit(1);
  });
}

main();
