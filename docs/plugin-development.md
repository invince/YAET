# YAET Plugin Development Guide

## Overview

YAET uses a plugin system to manage connection types (SSH, Telnet, FTP, etc.). Each plugin provides:
- **Backend**: IPC handler + runtime connector (Node.js, runs in Electron main process)
- **Frontend**: profile form component (Web Component or Angular component)
- **Manifest**: Metadata declaration (IPC channels, profile type, category)

Plugins live in two locations:
- **Bundled**: `plugins/<id>/` at the project root (shipped with the app)
- **External**: `~/.yaet/plugins/<id>/` (user-installed, overrides bundled)

See [`ext-plugins-example/`](../ext-plugins-example/) for a working external SSH plugin example.

## How It Works

### Startup Flow

```
Electron app starts
  │
  ├─ PluginManager.discover()             ← scans plugins/ AND ~/.yaet/plugins/
  │   └─ external plugins override bundled ones with the same id
  ├─ PluginManager.writeMergedManifest()  ← writes .plugin-manifest.json to both locations
  │
  ├─ new BrowserWindow(preload.js)
  │   └─ preload.js reads .plugin-manifest.json (external preferred over bundled)
  │       └─ merges plugin IPC channels into whitelist
  │
  ├─ initHandlerBeforeSettingLoad()       ← core IPC handlers
  └─ PluginManager.loadAll(context)       ← plugin backends register their IPC handlers
      └─ context.projectRequire available for external plugin npm deps
```

### Runtime Flow

```
User creates SSH connection
  → SessionService.create(profile, 'SSH_TERMINAL')
    → registry.getExternalPlugin('SSH_TERMINAL')  ← found? use PluginSession
    → new PluginSession(profile, ..., channels, profileData, secretStorage)
      → PluginSession.open()
        → resolveSecretToConfig()  ← resolve secrets before IPC
        → ipcRenderer.send('session.open.terminal.ssh', data)
          → preload.js checks whitelist (includes plugin channels) ✓
          → plugin backend handler receives event ✓
          → SshTerminalSession connects via ssh2 ✓
          → output streams back via 'terminal.output' ✓
```

### How Backend Code Loads

Backend code runs in Electron's **main process** (Node.js). It is loaded at runtime via `require()`.

```
electronMain.js
  │
  ├─ app.on('ready')
  │   │
  │   ├─ new PluginManager(__dirname, log)
  │   ├─ pluginManager.discover()
  │   │   └─ for each directory in plugins/:
  │   │       ├─ read manifest.json
  │   │       ├─ validate fields (id, category, profileType)
  │   │       └─ store in plugins Map
  │   │
  │   ├─ pluginManager.writeMergedManifest()
  │   │   └─ combine all plugin ipc channels → plugins/.plugin-manifest.json
  │   │      (preload.js reads this file to build the IPC whitelist)
  │   │
  │   ├─ new BrowserWindow({ preload: 'preload.js' })
  │   │
  │   ├─ initHandlerBeforeSettingLoad()   ← core handlers (non-plugin)
  │   │
  │   └─ pluginManager.loadAll(context)
  │       └─ for each enabled plugin:
  │           ├─ require('plugins/<id>/backend/index.js')   ← Node.js dynamic require
  │           ├─ backendModule.register(context)            ← plugin registers its IPC handlers
  │           └─ done
```

**Key points about backend loading:**

- `require()` is a synchronous Node.js call — plugins load one by one, in directory order
- The `context` object provides access to core services (`ipcMain`, `logger`, `sessionRegistry`, etc.)
- Some context values are lazy getters (functions) because they aren't initialized yet at load time
- A plugin's `register()` function typically calls `ipcMain.on(...)` or `ipcMain.handle(...)` to listen for IPC events
- If a plugin's `backend/index.js` has syntax errors or missing dependencies, `require()` throws and that plugin is skipped (other plugins continue loading)
- External plugins can use `context.projectRequire(moduleName)` to resolve npm dependencies from the project's `node_modules`

```
PluginManager.loadAll(context)
  │
  ├─ plugins/ssh-terminal (bundled)
  │   ├─ require('./plugins/ssh-terminal/backend/index.js')
  │   └─ register({ ipcMain, logger, ... })
  │       └─ ipcMain.on('session.open.terminal.ssh', handler)
  │
  ├─ ~/.yaet/plugins/ssh-terminal (external, overrides bundled)
  │   ├─ require('~/.yaet/plugins/ssh-terminal/backend/index.js')
  │   │   └─ const { SshTerminalSession } = require('./ssh.connector')
  │   │       └─ uses context.projectRequire('ssh2') for npm deps
  │   └─ register({ ipcMain, logger, projectRequire, ... })
  │       └─ ipcMain.on('session.open.terminal.ssh', handler)
  │
  ├─ plugins/telnet-terminal (bundled)
  │   ├─ require('./plugins/telnet-terminal/backend/index.js')
  │   │   └─ const { TelnetSession } = require('./telnet.connector')  ← telnet-client loaded here
  │   └─ register({ ipcMain, logger, ... })
  │       └─ ipcMain.on('session.open.terminal.telnet', handler)
  │
  └─ ...
```

### How Frontend Code Loads

**Bundled plugins** have their `.ts` files compiled into the Angular bundle via `tsconfig.app.json`.

**External plugins** ship a pre-built JS file (`frontend/index.js`) that is loaded at runtime:

```
App starts → app.component.ts → ngOnInit()
  │
  ├─ PluginLoaderService.loadExternalPlugins()
  │   ├─ Read ~/.yaet/plugins/.plugin-manifest.json (via IPC)
  │   ├─ For each plugin where source === 'external':
  │   │   ├─ Read frontend code via IPC: plugins.readFrontend(id)
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

**Why the difference?**

| Aspect | Backend | Frontend (Bundled) | Frontend (External) |
|---|---|---|---|
| Runtime | Node.js (main process) | Browser (renderer process) | Browser (renderer process) |
| Loading | `require()` at app startup | Compiled into bundle at build time | Inline `<script>` at runtime |
| Discovery | `PluginManager` scans `plugins/` | `tsconfig.app.json` includes `plugins/**/*.ts` | Reads merged manifest |
| Registration | `ipcMain.on/handle()` in `register()` | `PluginRegistryService.register()` | `window.__<ID>_PLUGIN__` + `registerExternalPlugin()` |
| npm deps | `context.projectRequire()` for external | N/A (bundled) | N/A (backend handles deps) |
| Hot reload | Possible (require cache) | Requires rebuild (`ng just reload page`) | Reload page |

## Directory Structure

### Bundled Plugins (shipped with app)

```
plugins/
└── my-connection-type/
    ├── manifest.json              # Plugin metadata
    ├── backend/
    │   ├── index.js               # register(context) — entry point
    │   └── my.connector.js        # Runtime connector (optional, can be inline)
    └── frontend/
        ├── my-electron.service.ts # Frontend IPC service
        └── my.plugin.ts           # Frontend registration
```

### External Plugins (user-installed at ~/.yaet/plugins/)

```
~/.yaet/plugins/my-connection-type/
├── manifest.json              # Plugin metadata
├── backend/
│   ├── index.js               # register(context) — entry point
│   └── my.connector.js        # Runtime connector (self-contained)
└── frontend/
    └── index.js               # Pre-built JS bundle (Web Component or inline script)
```

**Important**: the directory name MUST match `manifest.json → id`. PluginManager constructs backend path as `path.join(baseDir, id, backend)`.

## Writing a Plugin

### Step 1: Create manifest.json

```json
{
  "id": "my-connection",
  "name": "My Connection",
  "version": "1.0.0",
  "description": "Description of what this plugin does",
  "author": "Your Name",
  "category": "TERMINAL",
  "profileType": "MY_CONNECTION",
  "defaultPort": 22,
  "icon": "terminal",
  "enabled": true,
  "dependencies": [],
  "ipc": {
    "send": ["session.open.my-connection", "session.close.my-connection"],
    "invoke": [],
    "on": ["session.disconnect.my-connection"]
  },
  "backend": "./backend/index.js",
  "frontend": {
    "entry": "./frontend/index.js",
    "profileFormElement": "my-connection-profile-form"
  },
  "secretTypes": ["LOGIN_PASSWORD"],
  "supportedAuthTypes": ["N/A", "login", "secret"]
}
```

**Manifest fields:**

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique identifier (kebab-case) |
| `name` | Yes | Display name |
| `version` | Yes | Semver version |
| `category` | Yes | `TERMINAL`, `FILE_EXPLORER`, `REMOTE_DESKTOP`, or `CUSTOM` |
| `profileType` | Yes | Must match a value in `ProfileType` enum |
| `icon` | Yes | Material icon name |
| `enabled` | Yes | Whether the plugin loads on startup |
| `ipc.send` | No | IPC channels the plugin listens on (renderer → main) |
| `ipc.invoke` | No | IPC channels the plugin handles (renderer → main, request/response) |
| `ipc.on` | No | IPC channels the plugin sends (main → renderer) |
| `secretTypes` | No | Which secret types this plugin supports |
| `supportedAuthTypes` | No | `N/A`, `login`, `secret` |

### Step 2: Write the Backend

Create `backend/index.js`:

```javascript
const { MyConnector } = require('./my.connector');

function register(context) {
  const { ipcMain, logger, sessionRegistry, terminalMap } = context;

  ipcMain.on('session.open.my-connection', async (event, data) => {
    const session = new MyConnector(logger, context.projectRequire);

    // Wire up events
    session.on('output', ({ data: output }) => {
      event.sender.send('terminal.output', { id: data.terminalId, data: output });
    });

    session.on('error', ({ error }) => {
      event.sender.send('error', { category: 'my-connection', id: data.terminalId, error });
    });

    session.on('disconnect', ({ error }) => {
      event.sender.send('session.disconnect.my-connection', { id: data.terminalId, error: !!error });
    });

    try {
      // Resolve proxy if needed
      let proxy = null;
      if (data.proxyId && context.proxyService) {
        const proxies = typeof context.proxyService === 'function'
          ? context.proxyService() : context.proxyService;
        if (proxies?.proxies) {
          proxy = proxies.proxies.find(p => p.id === data.proxyId);
        }
      }

      // Resolve secrets if needed
      const secretRepo = typeof context.secretService === 'function'
        ? context.secretService() : context.secretService;

      await session.connect({
        ...data.config,
        proxy,
        secretRepo,
        id: data.terminalId,
      });

      // Register in session registry (for AI tools)
      const registry = typeof sessionRegistry === 'function'
        ? sessionRegistry() : sessionRegistry;
      if (registry) registry.register(data.terminalId, 'my-connection', 'user', session);

      // Register in terminalMap (for shared terminalHandler.js resize/input)
      if (terminalMap) {
        terminalMap.set(data.terminalId, {
          type: 'my-connection',
          process: session.conn,
          stream: session.stream,
          callback: (input) => session.write(input),
        });
      }
    } catch (error) {
      event.sender.send('error', {
        category: 'my-connection',
        id: data.terminalId,
        error: error.message,
      });
    }
  });

  ipcMain.on('session.close.my-connection', (event, data) => {
    const registry = typeof sessionRegistry === 'function'
      ? sessionRegistry() : sessionRegistry;
    const entry = registry?.get(data.terminalId);
    if (entry?.session) entry.session.close();
    registry?.unregister(data.terminalId);
  });

  logger.info('[my-connection] Plugin registered');
}

module.exports = { register };
```

**Context object available to plugins:**

| Property | Type | Description |
|---|---|---|
| `ipcMain` | Electron `ipcMain` | Register IPC handlers |
| `logger` | `electron-log` | Logging |
| `terminalMap` | `Map` | Shared terminal session map (for resize/input routing) |
| `sessionRegistry` | `SessionRegistry` or `() => SessionRegistry` | Session tracking for AI tools |
| `runtimeAPI` | `RuntimeAPI` or `() => RuntimeAPI` | Runtime API facade |
| `proxyService` | object or `() => object` | Proxy configuration |
| `secretService` | array or `() => array` | Decrypted secrets |
| `expressApp` | Express app or `() => Express` | Backend REST API (for file explorers) |
| `projectRequire` | Function | `createRequire()` from project root — use for npm deps like `require('ssh2')` |
| `appRoot` | string | Absolute path to the project root (for reference) |

### Step 3: Write the Runtime Connector

Create `backend/my.connector.js`:

```javascript
const { EventEmitter } = require('events');

class MyConnector extends EventEmitter {
  constructor(log, projectRequire) {
    super();
    this.log = log;
    this._projectRequire = projectRequire;
    this.conn = null;
    this.stream = null;
  }

  async connect(options) {
    // Use projectRequire to resolve npm deps (works for both bundled and external plugins)
    const { SomeClient } = this._projectRequire('some-npm-package');
    const { host, port, /* ... */ } = options;

    // Establish connection using your protocol library
    this.conn = await createConnection({ host, port });
    this.stream = this.conn;

    // Forward output events
    this.conn.on('data', (data) => {
      this.emit('output', { data: data.toString() });
    });

    this.conn.on('close', () => {
      this.emit('disconnect', { error: false });
    });
  }

  async write(data) {
    if (this.stream) {
      this.stream.write(data);
      return true;
    }
    return false;
  }

  async resize(cols, rows) {
    // Protocol-specific resize
  }

  async close() {
    if (this.conn) {
      this.conn.end();
      this.conn = null;
      this.stream = null;
    }
  }
}

module.exports = { MyConnector };
```

**Important**: Pass `projectRequire` to the connector constructor so it can resolve npm deps. This is required for external plugins — without it, `require('some-npm-package')` will fail because the plugin lives in `~/.yaet/plugins/` where `node_modules` doesn't exist.

### Step 4: Write the Frontend

For **external plugins**, create `frontend/index.js` — a pre-built JS bundle that registers a Web Component:

```javascript
class MyConnectionProfileForm extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({mode: 'open'});
  }

  connectedCallback() {
    this._shadow.innerHTML = `
      <style>
        :host { display: block; padding: 16px; }
        .form-field { margin-bottom: 12px; }
        label { display: block; font-size: 12px; color: #999; margin-bottom: 4px; }
        input { width: 100%; padding: 8px; border: 1px solid #444; border-radius: 4px;
                background: #1e1e1e; color: #fff; box-sizing: border-box; }
      </style>
      <div class="form-field">
        <label>Host</label>
        <input type="text" id="host" placeholder="hostname or IP" />
      </div>
      <div class="form-field">
        <label>Port</label>
        <input type="number" id="port" value="22" />
      </div>
    `;
  }

  setForm(form) { /* pass form data to the element */ }
  setProfile(profile) { /* pass profile data to the element */ }
}

// Register the custom element
customElements.define('my-connection-profile-form', MyConnectionProfileForm);

// Expose metadata for the host app
// Key MUST be __<ID>_PLUGIN__ where ID = manifest.id with hyphens → underscores, uppercased
window.__MY_CONNECTION_PLUGIN__ = {
  manifest: { id: 'my-connection', category: 'TERMINAL', profileType: 'MY_CONNECTION' },
  profileFormElement: 'my-connection-profile-form',
};
```

**Alternatively**, for terminal-type plugins, you can skip the custom element and reuse the shared `RemoteTerminalProfileFormComponent` — no frontend code needed at all. The `@default` case in `profile-form.component.html` handles this automatically for external terminal plugins.

### Step 5: Register the Plugin

For **external plugins**, registration happens automatically:
1. `PluginManager` discovers the plugin in `~/.yaet/plugins/<id>/`
2. `PluginLoaderService` loads `frontend/index.js` via IPC
3. The plugin's `window.__<ID>_PLUGIN__` metadata is read
4. `PluginRegistryService.registerExternalPlugin()` stores the plugin info

For **bundled plugins**, create `frontend/my.plugin.ts`:

```typescript
import { inject } from '@angular/core';
import { PluginRegistryService } from '../../../src/app/services/plugin/plugin-registry.service';
import { ProfileCategory, ProfileType } from '../../../src/app/domain/profile/Profile';

const MY_MANIFEST = {
  id: 'my-connection',
  name: 'My Connection',
  version: '1.0.0',
  category: ProfileCategory.TERMINAL,
  profileType: ProfileType.MY_CONNECTION,
  defaultPort: 22,
  icon: 'terminal',
  enabled: true,
  secretTypes: ['LOGIN_PASSWORD'],
  supportedAuthTypes: ['N/A', 'login', 'secret'],
};

export function registerMyPlugin() {
  const registry = inject(PluginRegistryService);

  import('./my-electron.service').then(({ MyElectronService }) => {
    import('../../../src/app/components/terminal/terminal.component').then(({ TerminalComponent }) => {
      registry.register({
        manifest: MY_MANIFEST,
        profileFormComponent: TerminalComponent, // or a custom form
        sessionComponent: TerminalComponent,      // shared terminal view
      });
    });
  });
}
```

### Step 6: Wire into Core

For **external plugins**, no core changes are needed — the plugin is discovered automatically.

For **bundled plugins**, you may need:

**6a. Add ProfileType** (if new type):

In `src/app/domain/profile/Profile.ts`:
```typescript
export enum ProfileType {
  // ... existing types
  MY_CONNECTION = 'MY_CONNECTION',
}
```

**6b. Add Session class** (if needed):

In `src/app/domain/session/MySession.ts`:
```typescript
import { Profile, ProfileType } from '../profile/Profile';
import { TabService } from '../../services/tab.service';
import { Session } from './Session';

export class MySession extends Session {
  private myService: any;

  constructor(profile: Profile, profileType: ProfileType,
              tabService: TabService, myService: any) {
    super(profile, profileType, tabService);
    this.myService = myService;
  }

  override open(): void {
    this.myService.openSession(this);
    super.open();
  }

  override close(): void {
    this.myService.closeSession(this);
    super.close();
  }
}
```

**6c. Update SessionService**:

In `src/app/services/session.service.ts`:
```typescript
import { MyElectronService } from '../../../plugins/my-connection/frontend/my-electron.service';
import { MySession } from '../domain/session/MySession';

// In constructor:
private myService: MyElectronService,

// In create() switch:
case ProfileType.MY_CONNECTION:
  return new MySession(profile, profileType, this.tabService, this.myService);
```

## Checklist for New Plugins

### External Plugins (recommended)
- [ ] `manifest.json` with correct `id`, `category`, `profileType`
- [ ] Directory name matches `manifest.id`
- [ ] `backend/index.js` with `register(context)` function
- [ ] Backend connector uses `context.projectRequire()` for npm deps
- [ ] Frontend `index.js` exposes `window.__<ID>_PLUGIN__` metadata
- [ ] IPC channels added to manifest `ipc` section
- [ ] Plugin works without any core code changes

### Bundled Plugins
- [ ] All of the above, plus:
- [ ] `ProfileType` enum entry
- [ ] Session class (thin wrapper delegating to plugin service)
- [ ] `SessionService` updated to create the session
- [ ] Build passes (`npx ng build`)

## Notes

- **External plugin npm deps**: Use `context.projectRequire(moduleName)` in your connector to resolve npm packages from the project's `node_modules`. Direct `require()` will fail for external plugins since they live in `~/.yaet/plugins/`.
- **Session view sharing**: Terminal plugins (SSH, Telnet, Local, WinRM) all share `TerminalComponent` for the UI. External plugins reuse it automatically via `PluginSession`.
- **Profile form sharing**: `RemoteTerminalProfileFormComponent` is shared between SSH, Telnet, WinRM. External terminal plugins use it automatically via the `@default` case in `profile-form.component.html`.
- **Preload whitelist**: IPC channels are automatically added to the preload whitelist from the plugin manifest. No manual whitelist editing needed.
- **terminalMap**: If your plugin uses terminal output, register with `terminalMap` so the shared `terminalHandler.js` can route input/resize.
- **sessionRegistry**: Register sessions here for AI tool integration (`session_write`, `session_read`).
- **Plugin id = directory name**: PluginManager constructs backend path as `path.join(baseDir, id, backend)`. The directory MUST match `manifest.id`.
