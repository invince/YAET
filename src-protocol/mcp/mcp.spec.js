/**
 * Unit tests for the MCP B4 completion (resources + prompts).
 * Run: node --test src-protocol/mcp/mcp.spec.js
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const CryptoJS = require('crypto-js');
const { MCPServer } = require('./server');
const { createResources } = require('./resources');
const { createPrompts } = require('./prompts');
const { registerAll } = require('./setup');

const MASTER_KEY = 'test-master-key';

function makeServer() {
  const server = new MCPServer({ name: 'test', version: '0.0.1' });
  registerAll(server, async () => MASTER_KEY, null);
  return server;
}

describe('MCP resources', () => {
  let home;
  let prevHome;
  beforeEach(() => {
    prevHome = process.env.YAET_HOME;
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'yaet-mcp-'));
    process.env.YAET_HOME = home;
    const dir = path.join(home, '.yaet');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'settings.json'),
      JSON.stringify({ ai: { mode: 'web', model: 'gpt-x', token: 'SECRET-TOKEN' } }),
    );
    const profiles = {
      profiles: [
        {
          id: 'p1', name: 'web-01', profileType: 'SSH_TERMINAL', category: 'TERMINAL',
          profileData: { SSH_TERMINAL: { host: '10.0.0.1', login: 'root', password: 'pw' } },
        },
      ],
    };
    fs.writeFileSync(path.join(dir, 'profiles.json'), CryptoJS.AES.encrypt(JSON.stringify(profiles), MASTER_KEY).toString());
  });
  afterEach(() => {
    if (prevHome === undefined) delete process.env.YAET_HOME;
    else process.env.YAET_HOME = prevHome;
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('resources/list exposes yaet://profiles and yaet://settings/ai', async () => {
    const res = await makeServer().handleRequest({ id: 1, method: 'resources/list' });
    const uris = res.result.resources.map((r) => r.uri).sort();
    assert.deepEqual(uris, ['yaet://profiles', 'yaet://settings/ai']);
  });

  it('yaet://profiles exposes identity only (no hosts/credentials)', async () => {
    const res = await makeServer().handleRequest({ id: 1, method: 'resources/read', params: { uri: 'yaet://profiles' } });
    const list = JSON.parse(res.result.contents[0].text);
    assert.equal(list.length, 1);
    assert.deepEqual(Object.keys(list[0]).sort(), ['category', 'group', 'id', 'name', 'profileType']);
  });

  it('yaet://settings/ai redacts the token', async () => {
    const res = await makeServer().handleRequest({ id: 1, method: 'resources/read', params: { uri: 'yaet://settings/ai' } });
    const ai = JSON.parse(res.result.contents[0].text);
    assert.equal(ai.model, 'gpt-x');
    assert.notEqual(ai.token, 'SECRET-TOKEN');
  });

  it('unknown resource URIs are rejected', async () => {
    const res = await makeServer().handleRequest({ id: 1, method: 'resources/read', params: { uri: 'yaet://nope' } });
    assert.equal(res.error.code, -32602);
  });
});

describe('MCP prompts', () => {
  it('prompts/list exposes backup-audit and batch-upgrade', async () => {
    const res = await makeServer().handleRequest({ id: 1, method: 'prompts/list' });
    const names = res.result.prompts.map((p) => p.name).sort();
    assert.deepEqual(names, ['backup-audit', 'batch-upgrade']);
  });

  it('prompts/get backup-audit returns a safety-scoped workflow', async () => {
    const res = await makeServer().handleRequest({ id: 1, method: 'prompts/get', params: { name: 'backup-audit' } });
    assert.equal(res.result.messages.length, 1);
    assert.match(res.result.messages[0].content.text, /备份巡检/);
    assert.match(res.result.messages[0].content.text, /never print/i);
  });

  it('prompts/get batch-upgrade interpolates command and target', async () => {
    const res = await makeServer().handleRequest({
      id: 1, method: 'prompts/get',
      params: { name: 'batch-upgrade', arguments: { command: 'apt upgrade -y', target: 'prod' } },
    });
    assert.match(res.result.messages[0].content.text, /apt upgrade -y/);
    assert.match(res.result.messages[0].content.text, /prod/);
    assert.match(res.result.messages[0].content.text, /SEQUENTIALLY/);
  });

  it('unknown prompts are rejected', async () => {
    const res = await makeServer().handleRequest({ id: 1, method: 'prompts/get', params: { name: 'nope' } });
    assert.equal(res.error.code, -32602);
  });
});

describe('MCP capabilities', () => {
  it('initialize advertises resources+prompts only when registered', async () => {
    const full = await makeServer().handleRequest({ id: 1, method: 'initialize', params: {} });
    assert.ok(full.result.capabilities.tools);
    assert.ok(full.result.capabilities.resources);
    assert.ok(full.result.capabilities.prompts);

    const bare = new MCPServer();
    const res = await bare.handleRequest({ id: 1, method: 'initialize', params: {} });
    assert.equal(res.result.capabilities.resources, undefined);
    assert.equal(res.result.capabilities.prompts, undefined);
  });

  it('registerAll wires tools, resources and prompts together', () => {
    const server = new MCPServer();
    registerAll(server, async () => MASTER_KEY, null);
    assert.ok(server.tools.size > 0);
    assert.equal(server.resources.size, 2);
    assert.equal(server.prompts.size, 2);
    assert.ok(server.tools.has('ssh_execute'));
    assert.ok(server.tools.has('yaet_profiles'));
  });
});

describe('MCP prompt registry validation', () => {
  it('missing required prompt arguments are rejected', async () => {
    const server = new MCPServer();
    for (const p of createPrompts()) server.registerPrompt(p.name, p.description, p.arguments, p.handler);
    server.registerPrompt('needs-arg', 'd', [{ name: 'x', description: 'd', required: true }], async () => ({ messages: [] }));
    const res = await server.handleRequest({ id: 1, method: 'prompts/get', params: { name: 'needs-arg', arguments: {} } });
    assert.equal(res.error.code, -32602);
    assert.match(res.error.message, /x/);
  });

  it('resource read failures surface as error contents, not throws', async () => {
    const server = new MCPServer();
    for (const r of createResources(async () => { throw new Error('no key'); })) {
      server.registerResource(r.uri, r.name, r.description, r.handler);
    }
    const res = await server.handleRequest({ id: 1, method: 'resources/read', params: { uri: 'yaet://profiles' } });
    assert.equal(res.result.isError, true);
  });
});
