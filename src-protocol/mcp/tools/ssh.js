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
      description: 'List available SSH/SFTP profiles stored in YAET (id and name only). Use the name with other ssh_/scp_ tools via profileName.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const profiles = await listSSHProfiles(getMasterKey);
        return JSON.stringify(profiles, null, 2);
      },
    },
  ];
}

module.exports = { createSSHTools };
