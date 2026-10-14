/**
 * Shared MCP registration (B4) — tools + resources + prompts.
 *
 * Used by both entry points (`src-protocol/mcp/index.js` for `yaet mcp` and
 * the `--mcp` block in `src-electron/electronMain.js`) so they can never
 * drift apart.
 */
const { createSSHTools } = require('./tools/ssh');
const { createSCPTools } = require('./tools/scp');
const { createLocalTools } = require('./tools/local');
const { createResources } = require('./resources');
const { createPrompts } = require('./prompts');

function registerAll(server, getMasterKey, log) {
  const say = (m) => { if (log) log.info(m); };

  for (const tool of [...createSSHTools(), ...createSCPTools(), ...createLocalTools()]) {
    server.registerTool(tool.name, tool.description, tool.inputSchema, tool.handler);
    say(`Registered tool: ${tool.name}`);
  }

  for (const r of createResources(getMasterKey)) {
    server.registerResource(r.uri, r.name, r.description, r.handler);
    say(`Registered resource: ${r.uri}`);
  }

  for (const p of createPrompts()) {
    server.registerPrompt(p.name, p.description, p.arguments, p.handler);
    say(`Registered prompt: ${p.name}`);
  }

  return server;
}

module.exports = { registerAll };
