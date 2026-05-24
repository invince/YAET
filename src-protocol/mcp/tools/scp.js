const path = require('path');
const os = require('os');
const fs = require('fs');
const { ScpFileExplorer } = require('../../../src-electron/runtime/connectors/file/scp');
const { Logger } = require('../../common/logger');

const log = new Logger('mcp-scp');

function buildSshConfig(args) {
  const { host, port = 22, username, password, privateKey } = args;
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
      description: 'List files in a remote directory via SFTP/SCP',
      inputSchema: {
        type: 'object',
        properties: {
          host: { type: 'string', description: 'SSH server hostname or IP' },
          port: { type: 'number', description: 'SSH port (default: 22)', default: 22 },
          username: { type: 'string', description: 'SSH username' },
          password: { type: 'string', description: 'SSH password (optional)' },
          privateKey: { type: 'string', description: 'SSH private key path or content (optional)' },
          path: { type: 'string', description: 'Remote directory path', default: '/' },
        },
        required: ['host', 'username', 'path'],
      },
      handler: async (args) => {
        const config = buildSshConfig(args);
        const explorer = new ScpFileExplorer(log, config);
        return explorer.listFiles(args.path);
      },
    },
    {
      name: 'scp_read_file',
      description: 'Read a remote file content via SFTP/SCP',
      inputSchema: {
        type: 'object',
        properties: {
          host: { type: 'string', description: 'SSH server hostname or IP' },
          port: { type: 'number', description: 'SSH port (default: 22)', default: 22 },
          username: { type: 'string', description: 'SSH username' },
          password: { type: 'string', description: 'SSH password (optional)' },
          privateKey: { type: 'string', description: 'SSH private key path or content (optional)' },
          path: { type: 'string', description: 'Remote file path' },
        },
        required: ['host', 'username', 'path'],
      },
      handler: async (args) => {
        const config = buildSshConfig(args);
        const explorer = new ScpFileExplorer(log, config);
        const buffer = await explorer.readFile(args.path);
        return buffer.toString('utf-8');
      },
    },
    {
      name: 'scp_write_file',
      description: 'Write content to a remote file via SFTP/SCP',
      inputSchema: {
        type: 'object',
        properties: {
          host: { type: 'string', description: 'SSH server hostname or IP' },
          port: { type: 'number', description: 'SSH port (default: 22)', default: 22 },
          username: { type: 'string', description: 'SSH username' },
          password: { type: 'string', description: 'SSH password (optional)' },
          privateKey: { type: 'string', description: 'SSH private key path or content (optional)' },
          path: { type: 'string', description: 'Remote file path' },
          content: { type: 'string', description: 'File content to write' },
          overwrite: { type: 'boolean', description: 'Overwrite if exists', default: false },
        },
        required: ['host', 'username', 'path', 'content'],
      },
      handler: async (args) => {
        const config = buildSshConfig(args);
        const explorer = new ScpFileExplorer(log, config);
        return explorer.writeFile(args.path, Buffer.from(args.content, 'utf-8'), {
          overwrite: args.overwrite,
        });
      },
    },
    {
      name: 'scp_delete_file',
      description: 'Delete a remote file via SFTP/SCP',
      inputSchema: {
        type: 'object',
        properties: {
          host: { type: 'string', description: 'SSH server hostname or IP' },
          port: { type: 'number', description: 'SSH port (default: 22)', default: 22 },
          username: { type: 'string', description: 'SSH username' },
          password: { type: 'string', description: 'SSH password (optional)' },
          privateKey: { type: 'string', description: 'SSH private key path or content (optional)' },
          path: { type: 'string', description: 'Remote directory path' },
          name: { type: 'string', description: 'File name to delete' },
        },
        required: ['host', 'username', 'path', 'name'],
      },
      handler: async (args) => {
        const config = buildSshConfig(args);
        const explorer = new ScpFileExplorer(log, config);
        return explorer.deleteFiles(args.path, [
          { name: args.name, type: 'file' },
        ]);
      },
    },
  ];
}

module.exports = { createSCPTools };
