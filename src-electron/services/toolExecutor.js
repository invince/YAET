const { Client } = require('ssh2');
const { SCPService } = require('./scpService');
const { decrypt } = require('../ipc/security');

class ToolExecutor {
  constructor(log, configService) {
    this.log = log;
    this.configService = configService;
    this.scpService = new SCPService(log);
    this.getSecrets = null;
  }

  setSecretsGetter(getter) {
    this.getSecrets = getter;
  }

  getToolDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'profile_list',
          description: 'Search available connection profiles. Returns id, name, type, host for matching profiles.',
          parameters: {
            type: 'object',
            properties: {
              keyword: { type: 'string', description: 'Optional keyword to filter by name or host' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'ssh_execute',
          description: 'Execute a command on a remote server via SSH using a saved profile',
          parameters: {
            type: 'object',
            properties: {
              profileId: { type: 'string', description: 'ID of the profile to use' },
              command: { type: 'string', description: 'Command to execute on the remote server' },
            },
            required: ['profileId', 'command'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'scp_list_files',
          description: 'List files in a remote directory via SFTP using a saved profile',
          parameters: {
            type: 'object',
            properties: {
              profileId: { type: 'string', description: 'ID of the profile to use' },
              path: { type: 'string', description: 'Remote directory path' },
            },
            required: ['profileId', 'path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'scp_read_file',
          description: 'Read a remote file content via SFTP using a saved profile',
          parameters: {
            type: 'object',
            properties: {
              profileId: { type: 'string', description: 'ID of the profile to use' },
              path: { type: 'string', description: 'Remote file path' },
            },
            required: ['profileId', 'path'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'scp_write_file',
          description: 'Write content to a remote file via SFTP using a saved profile',
          parameters: {
            type: 'object',
            properties: {
              profileId: { type: 'string', description: 'ID of the profile to use' },
              path: { type: 'string', description: 'Remote file path' },
              content: { type: 'string', description: 'File content to write' },
            },
            required: ['profileId', 'path', 'content'],
          },
        },
      },
    ];
  }

  async execute(toolName, args) {
    switch (toolName) {
      case 'profile_list':
        return this._profileList(args);
      case 'ssh_execute':
        return this._sshExecute(args);
      case 'scp_list_files':
        return this._scpListFiles(args);
      case 'scp_read_file':
        return this._scpReadFile(args);
      case 'scp_write_file':
        return this._scpWriteFile(args);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async _profileList(args) {
    const encrypted = await this.configService.getProfiles();
    if (!encrypted) return { profiles: [] };

    const decrypted = await decrypt(encrypted);
    const data = JSON.parse(decrypted);
    const profiles = data.profiles || [];

    const keyword = args.keyword ? args.keyword.toLowerCase() : '';

    const safe = profiles
      .filter(p => {
        if (!keyword) return true;
        const name = (p.name || '').toLowerCase();
        const host = p.sshProfile?.host || p.telnetProfile?.host || p.winRmProfile?.host || '';
        return name.includes(keyword) || host.includes(keyword);
      })
      .map(p => {
        const host = p.sshProfile?.host || p.telnetProfile?.host || p.winRmProfile?.host || '';
        const port = p.sshProfile?.port || p.telnetProfile?.port || p.winRmProfile?.port || null;
        return {
          id: p.id,
          name: p.name || '',
          type: p.profileType || '',
          host,
          port,
        };
      });

    return { profiles: safe };
  }

  async _sshExecute(args) {
    const { profileId, command } = args;
    const sshConfig = await this._resolveSshConfig(profileId);
    const result = await this._execCommand(sshConfig, command);
    return result;
  }

  async _scpListFiles(args) {
    const { profileId, path: remotePath } = args;
    const sshConfig = await this._resolveSshConfig(profileId);
    const result = await this.scpService.listFiles(sshConfig, remotePath || '/');
    return result;
  }

  async _scpReadFile(args) {
    const { profileId, path: remotePath } = args;
    const sshConfig = await this._resolveSshConfig(profileId);
    const buffer = await this.scpService.readFile(sshConfig, remotePath);
    return { content: buffer.toString('utf-8') };
  }

  async _scpWriteFile(args) {
    const { profileId, path: remotePath, content } = args;
    const sshConfig = await this._resolveSshConfig(profileId);
    const result = await this.scpService.writeFile(sshConfig, remotePath, Buffer.from(content, 'utf-8'), { overwrite: true });
    return result;
  }

  async _resolveSshConfig(profileId) {
    const encrypted = await this.configService.getProfiles();
    if (!encrypted) throw new Error('No profiles found');

    const decrypted = await decrypt(encrypted);
    const data = JSON.parse(decrypted);
    const profiles = data.profiles || [];
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) throw new Error(`Profile not found: ${profileId}`);

    const connProfile = profile.sshProfile || profile.telnetProfile || profile.winRmProfile;
    if (!connProfile) throw new Error(`Profile ${profileId} has no remote connection configuration`);
    if (!connProfile.host) throw new Error(`Profile ${profileId} has no host configured`);

    const config = {
      host: connProfile.host,
      port: connProfile.port || 22,
    };

    if (connProfile.authType === 'login' || connProfile.authType === 'LOGIN') {
      config.username = connProfile.login;
      config.password = connProfile.password;
    } else if (connProfile.authType === 'secret' || connProfile.authType === 'SECRET') {
      const secrets = this.getSecrets ? this.getSecrets() : null;
      if (!secrets || !secrets.secrets) throw new Error('No secrets loaded');

      const secretId = connProfile.secretId;
      if (!secretId) throw new Error(`Profile ${profileId} has authType=secret but no secretId`);

      const secret = secrets.secrets.find(s => s.id === secretId);
      if (!secret) throw new Error(`Secret not found: ${secretId}`);

      const secretType = secret.secretType || '';
      if (secretType === 'LOGIN_PASSWORD' || secretType === 'login_password') {
        config.username = secret.login;
        config.password = secret.password;
      } else if (secretType === 'SSH_KEY' || secretType === 'ssh_key') {
        config.username = secret.login;
        config.privateKey = (secret.key || '').replace(/\\n/g, '\n');
        if (secret.passphrase) {
          config.passphrase = secret.passphrase;
        }
      }
    } else {
      if (connProfile.login) {
        config.username = connProfile.login;
      }
    }

    return config;
  }

  _execCommand(sshConfig, command) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('SSH command timed out after 30s'));
      }, 30000);

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            conn.end();
            reject(err);
            return;
          }
          let stdout = '';
          let stderr = '';
          stream.on('close', (code) => {
            clearTimeout(timeout);
            conn.end();
            resolve({ stdout, stderr, exitCode: code });
          });
          stream.on('data', (data) => { stdout += data.toString(); });
          stream.stderr.on('data', (data) => { stderr += data.toString(); });
        });
      });
      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      conn.connect(sshConfig);
    });
  }
}

module.exports = { ToolExecutor };
