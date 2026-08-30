const { ScpFileExplorer } = require('../../../plugins/scp-file-explorer/backend/scp');
const { Logger } = require('../../common/logger');
const { resolveConfig } = require('../../common/credentialResolver');

const log = new Logger('mcp-scp');

async function getMasterKey() {
  const key = process.env.YAET_MASTER_KEY;
  if (!key) throw new Error('YAET_MASTER_KEY env var not set');
  return key;
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
        const config = await resolveConfig(args, getMasterKey);
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
        const config = await resolveConfig(args, getMasterKey);
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
        const config = await resolveConfig(args, getMasterKey);
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
        const config = await resolveConfig(args, getMasterKey);
        const explorer = new ScpFileExplorer(log, config);
        return explorer.deleteFiles(args.path, [
          { name: args.name, type: 'file' },
        ]);
      },
    },
  ];
}

module.exports = { createSCPTools };
