const path = require('path');
const EventEmitter = require('events');

// ── Mock 1: adapter/ipc/security.js ──
const mock = require('./adapter/ipc/security.mock');
const cachePath = path.join(__dirname, 'adapter', 'ipc', 'security.js');
require.cache[cachePath] = { exports: mock, loaded: true };

// ── Mock 2: services/securityService.js — avoid keytar (native module) ──
const secSvcPath = path.join(__dirname, 'services', 'securityService.js');
require.cache[secSvcPath] = {
  exports: {
    SecurityService: class {
      constructor() { this._store = new Map(); }
      async save(pw) { this._store.set('key', pw); }
      async get() { return this._store.get('key') || null; }
      async delete() { this._store.delete('key'); }
    },
    decrypt: () => Promise.resolve('{}'),
  },
  loaded: true,
};

// ── Mock 3: runtime/connectors/terminal/local.js — avoid node-pty (native module) ──
class MockTerminalSession extends (require('./runtime/interfaces/terminalRuntimeApi').TerminalRuntimeApi) {
  constructor() { super(); this._connected = false; this.process = null; }
  async connect() { this._connected = true; this.emit('output', { data: '' }); }
  async write() {}
  async resize() {}
  async close() { this._connected = false; this.emit('disconnect'); }
  async exec() { return ''; }
}
const localPath = path.join(__dirname, 'runtime', 'connectors', 'terminal', 'local.js');
require.cache[localPath] = {
  exports: { LocalTerminalSession: MockTerminalSession },
  loaded: true,
};

// ── Mock 4: runtime/connectors/terminal/winRM.js — avoid node-pty (native module) ──
const winRmPath = path.join(__dirname, 'runtime', 'connectors', 'terminal', 'winRM.js');
require.cache[winRmPath] = {
  exports: { WinRMSession: MockTerminalSession },
  loaded: true,
};

require('./electronMain');
