# External Plugin Loading — Implementation

## Overview

External plugins live at `~/.yaet/plugins/<id>/` and are loaded at runtime — no rebuild required.

See [`ext-plugins-example/`](../ext-plugins-example/) for a complete working example (SSH plugin).

## Plugin Structure

```
~/.yaet/plugins/ssh-terminal/
├── manifest.json              # Metadata (id, category, profileType, ipc channels)
├── backend/
│   ├── index.js               # register(context) — IPC handlers
│   └── ssh.connector.js       # Runtime connector (self-contained)
└── frontend/
    └── index.js               # Pre-built JS bundle (Web Component or metadata only)
```

**Important**: The directory name MUST match `manifest.json → id`. PluginManager constructs backend path as `path.join(baseDir, id, backend)`.

## manifest.json

```json
{
  "id": "ssh-terminal",
  "name": "SSH Terminal (External)",
  "version": "1.0.0",
  "description": "External SSH terminal plugin",
  "category": "TERMINAL",
  "profileType": "SSH_TERMINAL",
  "defaultPort": 22,
  "icon": "terminal",
  "enabled": true,
  "secretTypes": ["LOGIN_PASSWORD", "SSH_KEY"],
  "supportedAuthTypes": ["N/A", "login", "secret"],
  "backend": "./backend/index.js",
  "frontend": {
    "entry": "./frontend/index.js",
    "profileFormElement": "ssh-terminal-profile-form"
  },
  "ipc": {
    "send": ["session.open.terminal.ssh", "session.close.terminal.ssh"],
    "invoke": [],
    "on": ["session.disconnect.terminal.ssh"]
  }
}
```

## Backend: Resolving npm Dependencies

External plugins live in `~/.yaet/plugins/` where there is no `node_modules`. To use npm packages like `ssh2`, use `context.projectRequire()`:

```javascript
// backend/index.js
const { SshTerminalSession } = require('./ssh.connector');

function register(context) {
  const { ipcMain, logger, terminalMap, sessionRegistry, proxyService, secretService } = context;

  ipcMain.on('session.open.terminal.ssh', async (event, data) => {
    // Pass projectRequire to connector so it can resolve ssh2
    const session = new SshTerminalSession(logger, context.projectRequire);

    session.on('output', ({ data: output }) => {
      event.sender.send('terminal.output', { id: data.terminalId, data: output });
    });

    session.on('error', ({ error }) => {
      event.sender.send('error', { category: 'ssh', id: data.terminalId, error });
    });

    session.on('disconnect', ({ error }) => {
      event.sender.send('session.disconnect.terminal.ssh', { id: data.terminalId, error: !!error });
    });

    try {
      let proxy = null;
      if (data.proxyId && context.proxyService) {
        const proxies = typeof context.proxyService === 'function' ? context.proxyService() : context.proxyService;
        if (proxies?.proxies) proxy = proxies.proxies.find(p => p.id === data.proxyId);
      }

      const secretRepo = typeof context.secretService === 'function' ? context.secretService() : context.secretService;

      await session.connect({
        ...data.config, proxy, proxyService, secretRepo, id: data.terminalId,
        initPath: data.initPath, initCmd: data.initCmd,
        rows: data.rows, cols: data.cols,
      });

      const registry = typeof sessionRegistry === 'function' ? sessionRegistry() : sessionRegistry;
      if (registry) registry.register(data.terminalId, 'ssh', 'user', session);

      if (terminalMap) {
        terminalMap.set(data.terminalId, {
          type: 'ssh', process: session.conn, stream: session.stream,
          callback: (input) => session.write(input),
        });
      }
    } catch (error) {
      event.sender.send('error', { category: 'ssh', id: data.terminalId, error: error.message });
    }
  });

  ipcMain.on('session.close.terminal.ssh', (event, data) => {
    const registry = typeof sessionRegistry === 'function' ? sessionRegistry() : sessionRegistry;
    const entry = registry ? registry.get(data.terminalId) : null;
    if (entry?.session) entry.session.close();
    if (registry) registry.unregister(data.terminalId);
  });

  logger.info('[ssh-terminal] Plugin registered');
}

module.exports = { register };
```

## Backend: Self-Contained Connector

The connector must be self-contained — it cannot `require()` from `src-electron/` via relative paths. Use `context.projectRequire()` for npm deps:

```javascript
// backend/ssh.connector.js
const EventEmitter = require('events');

class SshTerminalSession extends EventEmitter {
  constructor(log, projectRequire) {
    super();
    this.log = log;
    this._projectRequire = projectRequire;
    this.conn = null;
    this.stream = null;
    this._connected = false;
  }

  async connect(options = {}) {
    // Resolve ssh2 from the project's node_modules
    const { Client } = this._projectRequire('ssh2');
    const { proxy, proxyService, secretRepo, initPath, initCmd, rows, cols, id, ...sshConfig } = options;

    // ... connection logic ...
  }

  async write(data) {
    if (this.stream) { this.stream.write(data); return true; }
    return false;
  }

  async resize(cols, rows) {
    if (this.stream) this.stream.setWindow(rows, cols, null, null);
  }

  async close() {
    if (this.conn) { this.conn.end(); this.conn = null; this.stream = null; this._connected = false; }
  }
}

module.exports = { SshTerminalSession };
```

## Frontend Loading Flow

```
App starts → app.component.ts → ngOnInit()
  │
  ├─ PluginLoaderService.loadExternalPlugins()
  │   ├─ Read ~/.yaet/plugins/.plugin-manifest.json (via IPC)
  │   ├─ For each plugin where source === 'external':
  │   │   ├─ Read frontend code via IPC: plugins.readFrontend(id)
  │   │   │   (main process reads file content, returns as string)
  │   │   ├─ Inject as inline <script> (avoids CSP file:// restriction)
  │   │   ├─ Plugin registers: window.__<ID>_PLUGIN__ = { manifest, profileFormElement }
  │   │   └─ Register with PluginRegistryService.registerExternalPlugin()
  │   │
  │   └─ External plugins reuse RemoteTerminalProfileFormComponent for profile forms
  │
  ├─ pluginRegistry.getExternalPlugin('SSH_TERMINAL')
  │   └─ returns { id, name, category, profileType, profileFormElement, ipcChannels }
  │
  └─ Profile form: @default case in profile-form.component.html
      └─ <app-remote-terminal-profile-form> (shared component for all terminal types)
```

### Frontend: window.__<ID>_PLUGIN__

The frontend bundle must expose a global variable for the host app to read metadata:

```javascript
// Key MUST be __<ID>_PLUGIN__ where ID = manifest.id with hyphens → underscores, uppercased
// For manifest id "ssh-terminal": key = __SSH_TERMINAL_PLUGIN__
window.__SSH_TERMINAL_PLUGIN__ = {
  manifest: {
    id: 'ssh-terminal',
    name: 'SSH Terminal (External)',
    category: 'TERMINAL',
    profileType: 'SSH_TERMINAL',
  },
  profileFormElement: 'ssh-terminal-profile-form',
};
```

## Merged Manifest

PluginManager writes a merged manifest to both locations:
- `plugins/.plugin-manifest.json` (for dev mode)
- `~/.yaet/plugins/.plugin-manifest.json` (for production)

The merged manifest includes per-plugin `ipcChannels`:

```json
{
  "version": 1,
  "plugins": {
    "ssh-terminal": {
      "name": "SSH Terminal (External)",
      "version": "1.0.0",
      "category": "TERMINAL",
      "profileType": "SSH_TERMINAL",
      "source": "external",
      "ipcChannels": {
        "send": ["session.open.terminal.ssh", "session.close.terminal.ssh"],
        "invoke": [],
        "on": ["session.disconnect.terminal.ssh"]
      }
    }
  },
  "ipc": {
    "send": ["session.open.terminal.ssh", "session.close.terminal.ssh"],
    "invoke": [],
    "on": ["session.disconnect.terminal.ssh"]
  }
}
```

## Key Files

| File | Role |
|------|------|
| `src-electron/plugin/pluginManager.js` | Discovers plugins, writes merged manifest, loads backends |
| `src-electron/preload.js` | IPC whitelist (reads merged manifest, external preferred) |
| `src-electron/electronMain.js` | Plugin lifecycle, IPC handlers for manifest/frontend reading |
| `src/app/services/plugin/plugin-loader.service.ts` | Loads external plugin frontend bundles via IPC |
| `src/app/services/plugin/plugin-registry.service.ts` | Stores plugin metadata + ipcChannels |
| `src/app/services/session.service.ts` | Creates `PluginSession` for external plugin types |
| `src/app/domain/session/PluginSession.ts` | Generic session using manifest IPC channels |

## Context Object

The `context` passed to `register()` includes:

| Property | Type | Description |
|---|---|---|
| `ipcMain` | Electron `ipcMain` | Register IPC handlers |
| `logger` | `electron-log` | Logging |
| `terminalMap` | `Map` | Shared terminal session map |
| `sessionRegistry` | `SessionRegistry` or `() => SessionRegistry` | Session tracking |
| `proxyService` | object or `() => object` | Proxy configuration |
| `secretService` | array or `() => array` | Decrypted secrets |
| `projectRequire` | Function | `createRequire()` from project root — use for npm deps |
| `appRoot` | string | Absolute path to the project root |
