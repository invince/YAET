#!/usr/bin/env node
const { MCPServer } = require('./server');
const { registerAll } = require('./setup');
const { resolveMasterKey } = require('../common/masterKey');
const { Logger } = require('../common/logger');

const log = new Logger('mcp-server');

function getMasterKey() {
  return resolveMasterKey();
}

function main() {
  const args = process.argv.slice(2);
  const transport = args.includes('--transport')
    ? args[args.indexOf('--transport') + 1] || 'stdio'
    : 'stdio';

  const server = new MCPServer({
    name: 'YAET MCP Server',
    version: '5.0.0',
  });

  registerAll(server, getMasterKey, log);

  if (transport === 'stdio') {
    log.info('Starting MCP server (stdio transport)...');
    server.runStdio().then(() => process.exit(0)).catch((err) => {
      log.error('MCP server error: ' + err.message);
      process.exit(1);
    });
  } else {
    log.error(`Unsupported transport: ${transport}`);
    process.exit(1);
  }
}

main();
