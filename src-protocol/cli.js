#!/usr/bin/env node
const path = require('path');

function printHelp() {
  console.log(`
YAET Protocol Server - MCP/ACP Server CLI
===========================================

Usage:
  node src-protocol/cli.js <command> [options]

Commands:
  mcp           Start MCP server (Model Context Protocol)
  acp           Start ACP server (Agent Communication Protocol)

Options:
  --transport <type>   Transport type: stdio (default)
  --port <number>      Port for SSE transport (future use)
  --help              Show this help

Examples:
  node src-protocol/cli.js mcp
  node src-protocol/cli.js acp
  node src-protocol/cli.js mcp --transport stdio

Claude Desktop Config (claude_desktop_config.json):
  {
    "mcpServers": {
      "yaet": {
        "command": "node",
        "args": ["path/to/yaet/src-protocol/cli.js", "mcp"]
      }
    }
  }
`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case 'mcp':
      require('./mcp/index');
      break;
    case 'acp':
      require('./acp/index');
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main();
