#!/usr/bin/env node
const { MCPServer } = require('./server');
const { createSSHTools } = require('./tools/ssh');
const { createSCPTools } = require('./tools/scp');
const { createLocalTools } = require('./tools/local');
const { Logger } = require('../common/logger');

const log = new Logger('mcp-server');

function main() {
  const args = process.argv.slice(2);
  const transport = args.includes('--transport')
    ? args[args.indexOf('--transport') + 1] || 'stdio'
    : 'stdio';

  const server = new MCPServer({
    name: 'YAET MCP Server',
    version: '5.0.0',
  });

  const sshTools = createSSHTools();
  for (const tool of sshTools) {
    server.registerTool(tool.name, tool.description, tool.inputSchema, tool.handler);
    log.info(`Registered tool: ${tool.name}`);
  }

  const scpTools = createSCPTools();
  for (const tool of scpTools) {
    server.registerTool(tool.name, tool.description, tool.inputSchema, tool.handler);
    log.info(`Registered tool: ${tool.name}`);
  }

  const localTools = createLocalTools();
  for (const tool of localTools) {
    server.registerTool(tool.name, tool.description, tool.inputSchema, tool.handler);
    log.info(`Registered tool: ${tool.name}`);
  }

  if (transport === 'stdio') {
    log.info('Starting MCP server (stdio transport)...');
    server.runStdio().catch((err) => {
      log.error('MCP server error: ' + err.message);
      process.exit(1);
    });
  } else {
    log.error(`Unsupported transport: ${transport}`);
    process.exit(1);
  }
}

main();
