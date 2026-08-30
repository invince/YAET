const path = require('path');
const os = require('os');
const fs = require('fs');
const { ScpFileExplorer } = require('../../../plugins/scp-file-explorer/backend/scp');
const { Logger } = require('../../common/logger');
const { ProfileService } = require('../../../src-electron/services/profileService');

const log = new Logger('mcp-scp');
const profileService = new ProfileService(log);

/** Build ssh config: supports profileName (resolved from YAET credentials) or manual host/username/password */
async function resolveConfig(args) {
  if (args.profileName) {
    return profileService.resolveSSHConfigByName(args.profileName);
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

function createSCPTools() {
  return [
    {
      name: 'scp_list_files',
      description: 'List files in a remote directory via SFTP/SCP. Use profileName to pull credentials from YAET profiles, OR pass host/username/password manually.',
      inputSchema: {
        type: 'object',
        properties: {
          profileName: { type: 'string', description: 'YAET profile name (e.g. "0 PVE Nuc"). Resolves host/username/password from encrypted YAET store. Overrides manual creds.' },
          host: { type: 'string', description: 'SSH server hostname or IP (ignored if profileName given)' },
          port: { type: 'number', description: 'SSH port (default: 22)', default: 22 },
          username: { type: 'string', description: 'SSH username (ignored if profileName given)' },
          password: { type: 'string', description: 'SSH password (optional)' },
          privateKey: { type: 'string', description: 'SSH private key path or content (optional)' },
          path: { type: 'string', description: 'Remote directory path', default: '/' },
        },
        required: ['path'],
      },
      handler: async (args) => {
        const config = await resolveConfig(args);
        const explorer = new ScpFileExplorer(log, config);
        return explorer.listFiles(args.path);
      },
    },
    {
      name: 'scp_read_file',
      description: 'Read a remote file content via SFTP/SCP. Use profileName to pull credentials from YAET profiles, OR pass host/username/password manually.',
      inputSchema: {
        type: 'object',
        properties: {
          profileName: { type: 'string', description: 'YAET profile name (e.g. "0 PVE Nuc"). Resolves host/username/password from encrypted YAET store. Overrides manual creds.' },
          host: { type: 'string', description: 'SSH server hostname or IP (ignored if profileName given)' },
          port: { type: 'number', description: 'SSH port (default: 22)', default: 22 },
          username: { type: 'string', description: 'SSH username (ignored if profileName given)' },
          password: { type: 'string', description: 'SSH password (optional)' },
          privateKey: { type: 'string', description: 'SSH private key path or content (optional)' },
          path: { type: 'string', description: 'Remote file path' },
        },
        required: ['path'],
      },
      handler: async (args) => {
        const config = await resolveConfig(args);
        const explorer = new ScpFileExplorer(log, config);
        const buffer = await explorer.readFile(args.path);
        return buffer.toString('utf-8');
      },
    },
    {
      name: 'scp_write_file',
      description: 'Write content to a remote file via SFTP/SCP. Use profileName to pull credentials from YAET profiles, OR pass host/username/password manually.',
      inputSchema: {
        type: 'object',
        properties: {
          profileName: { type: 'string', description: 'YAET profile name (e.g. "0 PVE Nuc"). Resolves host/username/password from encrypted YAET store. Overrides manual creds.' },
          host: { type: 'string', description: 'SSH server hostname or IP (ignored if profileName given)' },
          port: { type: 'number', description: 'SSH port (default: 22)', default: 22 },
          username: { type: 'string', description: 'SSH username (ignored if profileName given)' },
          password: { type: 'string', description: 'SSH password (optional)' },
          privateKey: { type: 'string', description: 'SSH private key path or content (optional)' },
          path: { type: 'string', description: 'Remote file path' },
          content: { type: 'string', description: 'File content to write' },
          overwrite: { type: 'boolean', description: 'Overwrite if exists', default: false },
        },
        required: ['path', 'content'],
      },
      handler: async (args) => {
        const config = await resolveConfig(args);
        const explorer = new ScpFileExplorer(log, config);
        return explorer.writeFile(args.path, Buffer.from(args.content, 'utf-8'), {
          overwrite: args.overwrite,
        });
      },
    },
    {
      name: 'scp_delete_file',
      description: 'Delete a remote file via SFTP/SCP. Use profileName to pull credentials from YAET profiles, OR pass host/username/password manually.',
      inputSchema: {
        type: 'object',
        properties: {
          profileName: { type: 'string', description: 'YAET profile name (e.g. "0 PVE Nuc"). Resolves host/username/password from encrypted YAET store. Overrides manual creds.' },
          host: { type: 'string', description: 'SSH server hostname or IP (ignored if profileName given)' },
          port: { type: 'number', description: 'SSH port (default: 22)', default: 22 },
          username: { type: 'string', description: 'SSH username (ignored if profileName given)' },
          password: { type: 'string', description: 'SSH password (optional)' },
          privateKey: { type: 'string', description: 'SSH private key path or content (optional)' },
          path: { type: 'string', description: 'Remote directory path' },
          name: { type: 'string', description: 'File name to delete' },
        },
        required: ['path', 'name'],
      },
      handler: async (args) => {
        const config = await resolveConfig(args);
        const explorer = new ScpFileExplorer(log, config);
        return explorer.deleteFiles(args.path, [
          { name: args.name, type: 'file' },
        ]);
      },
    },
  ];
}

module.exports = { createSCPTools };
