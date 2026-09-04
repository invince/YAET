#!/usr/bin/env node
const { ACPServer } = require('./server');
const { Logger } = require('../common/logger');
const { SshTerminalSession } = require('../../plugins/ssh-terminal/backend/ssh.connector');
const { LocalTerminalSession } = require('../../src-electron/runtime/connectors/terminal/local');
const { resolveConfig } = require('../common/credentialResolver');

const log = new Logger('acp-server');

function main() {
  const server = new ACPServer({
    name: 'YAET ACP Server',
    version: '5.0.0',
  });

  server.registerTool(
    'ssh_execute',
    'Execute a command on a remote server via SSH. Prefer profileName (credentials resolve server-side, never enter the LLM conversation) over manual host/username/password.',
    {
      type: 'object',
      properties: {
        profileName: { type: 'string', description: 'YAET profile name (resolves host/username/password from encrypted store). Prefer this — manual passwords end up in the LLM conversation.' },
        host: { type: 'string', description: 'SSH hostname/IP (ignored if profileName given)' },
        port: { type: 'number', default: 22 },
        username: { type: 'string', description: 'SSH username (ignored if profileName given)' },
        password: { type: 'string', description: 'SSH password (only for manual fallback; prefer profileName)' },
        privateKey: { type: 'string', description: 'SSH private key path or content (manual fallback only)' },
        command: { type: 'string' },
      },
      required: ['command'],
    },
    async (args) => {
      const sshConfig = await resolveConfig(args, getMasterKey);
      const session = new SshTerminalSession(log, sshConfig);
      const result = await session.exec(args.command, args.timeoutSeconds);
      return (result.stdout || '') + (result.stderr || '');
    }
  );

  async function getMasterKey() {
    const key = process.env.YAET_MASTER_KEY;
    if (!key) throw new Error('YAET_MASTER_KEY env var not set');
    return key;
  }

  server.registerTool(
    'ssh_sudo_execute',
    'Execute a sudo command on a remote server via SSH. Uses profile password for sudo.',
    {
      type: 'object',
      properties: {
        profileName: { type: 'string', description: 'YAET profile name (resolves host/username/password)' },
        host: { type: 'string' },
        port: { type: 'number', default: 22 },
        username: { type: 'string' },
        password: { type: 'string', description: 'Password for SSH and sudo' },
        privateKey: { type: 'string' },
        command: { type: 'string' },
      },
      required: ['command'],
    },
    async (args) => {
      const sshConfig = await resolveConfig(args, getMasterKey);
      const sudoPassword = sshConfig.password || null;
      const session = new SshTerminalSession(log, sshConfig);
      const result = await session.execWithSudo(args.command, sudoPassword, args.timeoutSeconds);
      const output = (result.stdout || '') + (result.stderr || '');
      return output || '(no output)';
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
      const session = new LocalTerminalSession(log);
      const result = await session.exec(args.command);
      return (result.stdout || '') + (result.stderr || '');
    }
  );

  log.info('Starting ACP server (stdio)...');
  server.runStdio().catch(err => {
    log.error('ACP server error: ' + err.message);
    process.exit(1);
  });
}

main();
