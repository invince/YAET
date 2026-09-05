const path = require('path');

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

// ── Mock 3: services/profileService.js — avoid keytar (native module) ──
const profileSvcPath = path.join(__dirname, 'services', 'profileService.js');
require.cache[profileSvcPath] = {
  exports: {
    ProfileService: class {
      constructor() {}
      async findProfileByName(name) { throw new Error(`Profile not found: '${name}'`); }
      async findProfileById(id) { throw new Error(`Profile not found: '${id}'`); }
      async listSSHProfiles() { return []; }
      async resolveSSHConfigByName(name) { throw new Error(`Profile not found: '${name}'`); }
      async resolveSSHConfigById(id) { throw new Error(`Profile not found: '${id}'`); }
      async resolveSCPConfig(name) { throw new Error(`Profile not found: '${name}'`); }
    },
  },
  loaded: true,
};

// NOTE: node-pty and local.js / winRM.js are NOT mocked here.
// This entry point is for e2e tests that need real PTY behavior.

require('./electronMain');
