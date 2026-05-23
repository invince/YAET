const path = require('path');
const os = require('os');
const fs = require('fs');
const { SSHService } = require('../../../src-electron/services/sshService');
const { Logger } = require('../../common/logger');

const log = new Logger('mcp-ssh');

function createSSHTools() {
  const sshService = new SSHService(log);

  return [
    {
      name: 'ssh_execute',
      description: 'Execute a command on a remote server via SSH and return the output',
      inputSchema: {
        type: 'object',
        properties: {
          host: { type: 'string', description: 'SSH server hostname or IP' },
          port: { type: 'number', description: 'SSH server port (default: 22)', default: 22 },
          username: { type: 'string', description: 'SSH username' },
          password: { type: 'string', description: 'SSH password (optional if using key)' },
          privateKey: { type: 'string', description: 'SSH private key path or content (optional)' },
          command: { type: 'string', description: 'Command to execute on the remote server' },
        },
        required: ['host', 'username', 'command'],
      },
      handler: async (args) => {
        const { host, port = 22, username, password, privateKey, command } = args;

        const sshConfig = { host, port, username };
        if (password) sshConfig.password = password;
        if (privateKey) {
          if (privateKey.includes('-----BEGIN')) {
            sshConfig.privateKey = privateKey;
          } else {
            const keyPath = path.resolve(privateKey.replace(/^~/, os.homedir()));
            sshConfig.privateKey = fs.readFileSync(keyPath, 'utf8');
          }
        }

        const sessionId = `mcp-ssh-${Date.now()}`;
        let output = '';

        return new Promise((resolve, reject) => {
          sshService.on('output', ({ id, data }) => {
            if (id === sessionId) output += data;
          });

          sshService.on('error', ({ id, error }) => {
            if (id === sessionId) reject(new Error(error));
          });

          sshService.on('disconnect', ({ id }) => {
            if (id === sessionId) resolve(output || '(no output)');
          });

          sshService.connect(sshConfig, { id: sessionId })
            .then(() => {
              sshService.write(sessionId, command + '\n');
              setTimeout(() => {
                sshService.disconnect(sessionId);
                resolve(output || '(no output)');
              }, 10000);
            })
            .catch(reject);
        });
      },
    },
    {
      name: 'ssh_connect_interactive',
      description: 'Open an interactive SSH shell session (returns session ID for subsequent input)',
      inputSchema: {
        type: 'object',
        properties: {
          host: { type: 'string', description: 'SSH server hostname or IP' },
          port: { type: 'number', description: 'SSH server port (default: 22)', default: 22 },
          username: { type: 'string', description: 'SSH username' },
          password: { type: 'string', description: 'SSH password (optional if using key)' },
          privateKey: { type: 'string', description: 'SSH private key path or content (optional)' },
          initCommand: { type: 'string', description: 'Initial command to run after connection' },
        },
        required: ['host', 'username'],
      },
      handler: async (args) => {
        const { host, port = 22, username, password, privateKey, initCommand } = args;

        const sshConfig = { host, port, username };
        if (password) sshConfig.password = password;
        if (privateKey) {
          if (privateKey.includes('-----BEGIN')) {
            sshConfig.privateKey = privateKey;
          } else {
            const keyPath = path.resolve(privateKey.replace(/^~/, os.homedir()));
            sshConfig.privateKey = fs.readFileSync(keyPath, 'utf8');
          }
        }

        const sessionId = `mcp-ssh-${Date.now()}`;

        await sshService.connect(sshConfig, {
          id: sessionId,
          initCmd: initCommand,
        });

        return JSON.stringify({ sessionId, status: 'connected' });
      },
    },
    {
      name: 'ssh_send_input',
      description: 'Send input to an existing interactive SSH session',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Session ID from ssh_connect_interactive' },
          input: { type: 'string', description: 'Input text to send' },
        },
        required: ['sessionId', 'input'],
      },
      handler: async (args) => {
        const { sessionId, input } = args;
        sshService.write(sessionId, input + '\n');
        return JSON.stringify({ sent: true });
      },
    },
    {
      name: 'ssh_disconnect',
      description: 'Disconnect an active SSH session',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Session ID to disconnect' },
        },
        required: ['sessionId'],
      },
      handler: async (args) => {
        sshService.disconnect(args.sessionId);
        return 'Disconnected';
      },
    },
  ];
}

module.exports = { createSSHTools };
