const { SshTerminalSession } = require('../../../plugins/ssh-terminal/backend/ssh.connector');
const { Logger } = require('../../common/logger');
const { resolveConfig, listSSHProfiles } = require('../../common/credentialResolver');

const log = new Logger('mcp-ssh');

async function getMasterKey() {
  const key = process.env.YAET_MASTER_KEY;
  if (!key) throw new Error('YAET_MASTER_KEY env var not set');
  return key;
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
          timeoutSeconds: { type: 'number', description: 'Seconds to wait before timing out (default: 30). Raise for long-running commands.', default: 30 },
        },
        required: ['command'],
      },
      handler: async (args) => {
        const { command, timeoutSeconds } = args;
        if (!command) throw new Error('Missing command');
        const sshConfig = await resolveConfig(args, getMasterKey);
        const session = new SshTerminalSession(log, sshConfig);
        const result = await session.exec(command, timeoutSeconds);
        const output = (result.stdout || '') + (result.stderr || '');
        return output || '(no output)';
      },
    },
    {
      name: 'ssh_sudo_execute',
      description: 'Execute a sudo command on a remote server via SSH. Uses the profile\'s stored password for sudo. Falls back to manual password if no profile. Returns output or error if password is wrong (manual intervention needed).',
      inputSchema: {
        type: 'object',
        properties: {
          profileName: { type: 'string', description: 'YAET profile name. Resolves host/username/password from encrypted store. The profile password is reused for sudo.' },
          host: { type: 'string', description: 'SSH server hostname or IP (ignored if profileName given)' },
          port: { type: 'number', description: 'SSH server port (default: 22)', default: 22 },
          username: { type: 'string', description: 'SSH username (ignored if profileName given)' },
          password: { type: 'string', description: 'Password for SSH login AND sudo (ignored if profileName given)' },
          privateKey: { type: 'string', description: 'SSH private key path or content (optional)' },
          command: { type: 'string', description: 'Sudo command to execute (e.g. "apt update", "systemctl restart nginx")' },
          timeoutSeconds: { type: 'number', description: 'Seconds to wait before timing out (default: 30). Raise for long-running commands.', default: 30 },
        },
        required: ['command'],
      },
      handler: async (args) => {
        const { command, timeoutSeconds } = args;
        if (!command) throw new Error('Missing command');
        const sshConfig = await resolveConfig(args, getMasterKey);
        const sudoPassword = sshConfig.password || null;
        const session = new SshTerminalSession(log, sshConfig);
        const result = await session.execWithSudo(command, sudoPassword, timeoutSeconds);
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
        const profiles = await listSSHProfiles(getMasterKey);
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
        const sshConfig = await resolveConfig({ host, port, username, password, privateKey }, getMasterKey);
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
