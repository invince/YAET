const path = require('path');
const os = require('os');
const fs = require('fs');
const { SshTerminalSession } = require('../../../plugins/ssh-terminal/backend/ssh.connector');
const { Logger } = require('../../common/logger');
const { ProfileService } = require('../../../src-electron/services/profileService');

const log = new Logger('mcp-ssh');
const profileService = new ProfileService(log);

/** Build ssh config: supports profileName (resolved from YAET credentials) or manual host/username/password */
async function resolveConfig(args) {
  if (args.profileName) {
    const cfg = await profileService.resolveSSHConfig(args.profileName);
    return cfg;
  }
  const { host, port = 22, username, password, privateKey } = args;
  if (!host || !username) throw new Error('Provide either profileName or host+username');
  const config = { host, port, username };
  if (password) config.password = password;
  if (privateKey) {
    if (privateKey.includes('-----BEGIN')) {
      config.privateKey = privateKey;
    } else {
      const keyPath = path.resolve(privateKey.replace(/^~/, os.homedir()));
      config.privateKey = fs.readFileSync(keyPath, 'utf8');
    }
  }
  return config;
}

function createSSHTools() {
  const sessions = new Map();

  return [
    {
      name: 'ssh_execute',
      description: 'Execute a command on a remote server via SSH and return the output. Use profileName to pull credentials from YAET profiles, OR pass host/username/password manually.',
      inputSchema: {
        type: 'object',
        properties: {
          profileName: { type: 'string', description: 'YAET profile name (e.g. "0 PVE Nuc"). Resolves host/username/password from encrypted YAET store. Overrides manual creds.' },
          host: { type: 'string', description: 'SSH server hostname or IP (ignored if profileName given)' },
          port: { type: 'number', description: 'SSH server port (default: 22)', default: 22 },
          username: { type: 'string', description: 'SSH username (ignored if profileName given)' },
          password: { type: 'string', description: 'SSH password (optional if using key)' },
          privateKey: { type: 'string', description: 'SSH private key path or content (optional)' },
          command: { type: 'string', description: 'Command to execute on the remote server' },
        },
        required: ['command'],
      },
      handler: async (args) => {
        const { command } = args;
        if (!command) throw new Error('Missing command');
        const sshConfig = await resolveConfig(args);
        const session = new SshTerminalSession(log, sshConfig);
        const result = await session.exec(command);
        const output = (result.stdout || '') + (result.stderr || '');
        return output || '(no output)';
      },
    },
    {
      name: 'yaet_profiles',
      description: 'List available SSH/SFTP profiles stored in YAET (name, host, port, authType). Use the name with other ssh_/scp_ tools via profileName.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const profiles = await profileService.listSSHProfiles();
        return JSON.stringify(profiles, null, 2);
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
        const session = new SshTerminalSession(log);
        await session.connect({ ...sshConfig, initCmd: initCommand });
        sessions.set(sessionId, session);
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
        const session = sessions.get(args.sessionId);
        if (!session) throw new Error(`Session not found: ${args.sessionId}`);
        await session.write(args.input + '\n');
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
        const session = sessions.get(args.sessionId);
        if (session) {
          await session.close();
          sessions.delete(args.sessionId);
        }
        return 'Disconnected';
      },
    },
  ];
}

module.exports = { createSSHTools };
