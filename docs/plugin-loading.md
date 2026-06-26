# Plugin Loading — Implementation

## Two Loading Paths

YAET has two independent plugin loading mechanisms — one for **bundled** plugins (shipped with the app) and one for **external** plugins (user-installed at `~/.yaet/plugins/`).

### Bundled Plugins (build-time)

Bundled plugins' frontend files are TypeScript (`.plugin.ts`) that import Angular components and services — they must be compiled into the Angular bundle at build time.

#### Frontend loading flow

```
scripts/generate-plugin-barrel.js (build-time)
  │
  ├─ Scan plugins/*/manifest.json
  │   ├─ Extract id, manifest.frontend.plugin/entry → plugin file path
  │   ├─ For each plugin: generate import + registerPluginEntry() call
  │   └─ Output: plugins/generated-plugin-registry.ts
  │
  ├─ Run via: npm run build / npm start / npm test:e2e
  │   (prebuild / preserve hooks in package.json)
  │
  └─ Commit to repo so the file always exists
```

**Generated barrel** (`plugins/generated-plugin-registry.ts`):

```typescript
// Auto-generated. Reads manifest.json from each plugin directory.
import { registerPluginEntry } from '../src/app/plugin/services/plugin-import-registry';
import { register as __ssh_terminalRegister } from './ssh-terminal/frontend/ssh.plugin';
// ... one import per plugin ...

registerPluginEntry('ssh-terminal', __ssh_terminalRegister);
// ... one call per plugin ...
```

**Runtime flow** (Angular startup):

```
app.component.ts → ngOnInit()
  │
  ├─ PluginLoaderService.loadExternalPlugins()
  │   (handles external plugins only, see below)
  │
  └─ sessionService.initSessionFactories()
      │
      ├─ session.service.ts imports '../../../plugins/generated-plugin-registry'
      │   (side-effect import triggers all plugin module evaluation)
      │
      ├─ Each plugin's self-registration:
      │   registerPluginEntry('ssh-terminal', __ssh_terminalRegister)
      │   → stored in PLUGIN_ENTRIES map
      │
      ├─ getRegisteredPluginIds() → ['ssh-terminal', 'telnet-terminal', ...]
      │
      └─ For each pluginId:
          loadBundledPluginModule(id) → { register }
          module.register(registry, injector)
          → PluginRegistryService stores: category type, form metadata, manifest
```

**Key files for bundled loading:**

| File | Role |
|------|------|
| `scripts/generate-plugin-barrel.js` | Build-time script: scans manifest.json, generates barrel |
| `plugins/generated-plugin-registry.ts` | Auto-generated: statically imports all plugin modules, registers entries |
| `src/app/plugin/services/plugin-import-registry.ts` | Runtime registry: stores `register()` functions, provides lookup |
| `src/app/services/session.service.ts` | Init trigger: imports barrel, calls each plugin's `register()` |

**Adding a new bundled plugin:** drop its directory in `plugins/` with a `manifest.json` → the generation script detects it automatically on next build. No manual barrel editing needed.

---

### External Plugins (runtime)

External plugins live at `~/.yaet/plugins/<id>/` and are loaded entirely at runtime — no rebuild required. Their frontend code is pre-compiled JavaScript, not TypeScript.

#### Backend loading flow (Electron main process)

```
electronMain.js → app.on('ready')
  │
  ├─ new PluginManager(__dirname, log)
  ├─ pluginManager.discover()
  │   └─ Scan plugins/ AND ~/.yaet/plugins/ for manifest.json
  │       └─ External plugins that conflict with bundled ids are SKIPPED (security)
  │
  ├─ pluginManager.writeMergedManifest()
  │   └─ combined ipc channels → plugins/generated-plugin-manifest.json
  │       (preload.js reads this to build the IPC whitelist)
  │
  └─ pluginManager.loadAll(context)
      └─ For each enabled plugin:
          require(backend/index.js) → register(context)
          → registers IPC handlers (ipcMain.on/handle)
```

#### Frontend loading flow (Angular renderer)

```
App starts → app.component.ts → ngOnInit()
  │
  ├─ PluginLoaderService.loadExternalPlugins()
  │   ├─ IPC invoke: plugins.getMergedManifest
  │   │   → pluginHandler reads generated-plugin-manifest.json
  │   │   → returns merged plugin metadata
  │   │
  │   ├─ For each plugin where source === 'external':
  │   │   ├─ IPC invoke: plugins.readFrontend(id)
  │   │   │   (main process reads frontend/index.js, returns as string)
  │   │   ├─ Inject as inline <script> (avoids CSP file:// restriction)
  │   │   ├─ Plugin registers: window.__<ID>_PLUGIN__ = { manifest, profileFormElement }
  │   │   └─ PluginLoaderService calls registry.registerExternalPlugin()
  │   │
  │   └─ External plugins reuse RemoteTerminalProfileFormComponent for profile forms
  │
  ├─ sessionService.initSessionFactories()
  │   └─ (handles bundled plugins only, see above)
  │
  └─ When user opens a connection:
      create(profile, profileType)
        ├─ registry.getBundledPlugin(profileType) ? → BundledPlugin
        ├─ registry.getExternalPlugin(profileType) ? → PluginSession (IPC-based)
        └─ fallback → generic Session
```

#### External plugin frontend: window.__<ID>_PLUGIN__

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

---

See [`ext-plugins-example/webdav-file-explorer/`](../ext-plugins-example/webdav-file-explorer/) for a working external WebDAV FILE_EXPLORER plugin — a complete example with backend REST API, Web Component profile form, and core auth integration.

## Plugin Structure

### Bundled (shipped with app)

```
plugins/
└── my-connection-type/
    ├── manifest.json              # Metadata (id, category, profileType, ipc channels)
    ├── backend/
    │   ├── index.js               # register(context) — IPC handlers
    │   └── my.connector.js        # Runtime connector
    └── frontend/
        ├── my.plugin.ts           # Angular plugin registration (compiled into bundle)
        └── ...                    # Angular components, services (compiled into bundle)
```

### External (user-installed at ~/.yaet/plugins/)

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

---

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

Manifest fields shared by both loading paths:

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique identifier (kebab-case), must match directory name |
| `category` | Yes | `TERMINAL`, `FILE_EXPLORER`, `REMOTE_DESKTOP`, or `CUSTOM` |
| `profileType` | Yes | Unique type string (e.g. `SSH_TERMINAL`, `VNC_REMOTE_DESKTOP`) |
| `backend` | Yes | Path to backend entry (relative to plugin dir) |
| `ipc.send` | No | IPC channels the plugin listens on (renderer → main, fire-and-forget) |
| `ipc.invoke` | No | IPC channels the plugin handles (renderer → main, request/response) |
| `ipc.on` | No | IPC channels the plugin sends (main → renderer) |

For bundled plugins:
- `frontend.plugin` — path to the `.plugin.ts` file (e.g. `./frontend/ssh.plugin`)
- `frontend.entry` — alternative path used by some plugins

For external plugins:
- `frontend.entry` — path to pre-built JS bundle (e.g. `./frontend/index.js`)
- `frontend.profileFormElement` — Web Component tag name for the profile form
- `supportedAuthTypes` — optional; `["N/A", "login", "secret"]` — declares which auth modes the plugin supports. When set, the core renders `<app-auth-form>` for auth type selection
- `secretTypes` — optional; `["LOGIN_PASSWORD", "PASSWORD_ONLY"]` — filters the secret dropdown in the auth form

---

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

## Merged Manifest

PluginManager writes a merged manifest (`generated-plugin-manifest.json`) to both locations:
- `plugins/generated-plugin-manifest.json` (for dev mode)
- `~/.yaet/plugins/generated-plugin-manifest.json` (for production)

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
| `scripts/generate-plugin-barrel.js` | Build-time: scans `manifest.json`, generates bundled plugin barrel |
| `plugins/generated-plugin-registry.ts` | Auto-generated: statically imports all bundled plugin modules |
| `plugins/generated-plugin-manifest.json` | Auto-generated: merged IPC channels for preload whitelist |
| `src-electron/services/pluginManager.js` | Main process: discovers plugins, writes merged manifest, loads backends |
| `src-electron/preload.js` | IPC whitelist (reads merged manifest, external preferred) |
| `src-electron/adapter/ipc/pluginHandler.js` | IPC handlers: frontend reading, manifest serving |
| `src/app/plugin/services/plugin-import-registry.ts` | Renderer: registry for bundled plugin `register()` functions |
| `src/app/plugin/services/plugin-loader.service.ts` | Renderer: loads external plugin frontend bundles via IPC |
| `src/app/plugin/services/plugin-registry.service.ts` | Renderer: stores plugin metadata + ipcChannels |
| `src/app/services/session.service.ts` | Creates sessions for both bundled and external plugins |
| `src/app/domain/session/PluginSession.ts` | Generic session using manifest IPC channels |

## Context Object

The `context` passed to `register()` in backend code includes:

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
