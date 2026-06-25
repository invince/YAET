# Extending the Terminal

This guide explains how to add new terminal connection types to YAET via the **plugin system**.

## 1. Architecture Overview

YAET uses a plugin architecture for terminal backends:

```
plugins/<plugin-id>/
├── manifest.json          # Plugin metadata
├── backend/
│   ├── index.js           # Backend entry: register(context) + IPC handlers
│   └── <type>.connector.js  # Connector class (extends EventEmitter)
└── frontend/              # (Optional) Angular components
```

- **Connector**: Handles the actual connection (SSH, Telnet, WinRM, etc.) and exposes `connect`, `write`, `resize`, `close`, `exec`.
- **Backend entry**: Registers IPC handlers for session lifecycle (`open`, `close`, `disconnect`) and registers the connector with `RuntimeAPI` for AI tool integration.
- **Manifest**: Declares plugin metadata, IPC channels, supported auth types, and frontend entry points.

## 2. Creating a New Terminal Plugin

### Step 1: Create the manifest

```json
{
  "id": "my-terminal",
  "name": "My Terminal",
  "version": "1.0.0",
  "description": "Custom terminal connection plugin",
  "category": "TERMINAL",
  "profileType": "MY_TERMINAL",
  "defaultPort": 22,
  "icon": "terminal",
  "enabled": true,
  "secretTypes": ["LOGIN_PASSWORD"],
  "supportedAuthTypes": ["N/A", "login", "secret"],
  "backend": "./backend/index.js",
  "ipc": {
    "send": ["session.open.terminal.my-terminal", "session.close.terminal.my-terminal"],
    "invoke": [],
    "on": ["session.disconnect.terminal.my-terminal"]
  }
}
```

Key fields:
- `profileType`: Unique identifier used by the frontend and AI tools (e.g. `SSH_TERMINAL`, `TELNET_TERMINAL`, `WIN_RM_TERMINAL`).
- `ipc.send` / `ipc.on`: IPC channels the plugin uses. Channels follow the pattern `session.<action>.terminal.<plugin-id>`.
- `category`: Must be `TERMINAL` for terminal plugins.

### Step 2: Implement the connector

Create `backend/my-terminal.connector.js`:

```javascript
const { EventEmitter } = require('events');

class MyTerminalSession extends EventEmitter {
  constructor(log, config) {
    super();
    this.log = log;
    this._config = config;
    this._connected = false;
    this._stream = null; // your connection handle
  }

  async connect(options) {
    const { host, port, username, password } = options;
    this.log.info(`Connecting to ${host}:${port}...`);

    // Establish your connection here
    this._stream = await createMyConnection({ host, port, username, password });
    this._connected = true;

    // Pipe data from connection to xterm
    this._stream.on('data', (data) => {
      this.emit('output', { data });
    });

    this._stream.on('error', (err) => {
      this.emit('error', { error: err.message });
    });

    this._stream.on('close', () => {
      this._connected = false;
      this.emit('disconnect', { error: null });
    });
  }

  write(data) {
    if (this._stream) this._stream.write(data);
  }

  async resize(rows, cols) {
    // Resize if supported by the connection type
  }

  async close() {
    if (this._stream) this._stream.end();
    this._connected = false;
  }

  async exec(command) {
    this.write(command + '\n');
    // Return stdout/stderr as needed
    return { stdout: '', stderr: '' };
  }
}

module.exports = { MyTerminalSession };
```

### Step 3: Implement the backend entry

Create `backend/index.js`:

```javascript
const { MyTerminalSession } = require('./my-terminal.connector');

function register(context) {
  const { ipcMain, logger, sessionRegistry, terminalMap, runtimeAPI } = context;

  // Register connector factory for AI tools (terminal_open, local_execute, etc.)
  const api = typeof runtimeAPI === 'function' ? runtimeAPI() : runtimeAPI;
  if (api) {
    api.registerConnector('MY_TERMINAL', (log, config) => {
      return new MyTerminalSession(log, config);
    });
  }

  // Handle session open
  ipcMain.on('session.open.terminal.my-terminal', async (event, data) => {
    const session = new MyTerminalSession(logger);

    session.on('output', ({ data: output }) => {
      event.sender.send('terminal.output', { id: data.terminalId, data: output });
    });

    session.on('error', ({ error }) => {
      event.sender.send('error', { category: 'my-terminal', id: data.terminalId, error });
    });

    session.on('disconnect', ({ error }) => {
      event.sender.send('session.disconnect.terminal.my-terminal', {
        id: data.terminalId,
        error: !!error,
      });
    });

    try {
      // Resolve secrets
      const secretRepo = typeof context.secretService === 'function'
        ? context.secretService() : context.secretService;

      // Resolve proxy
      let proxy = null;
      if (data.proxyId && context.proxyService) {
        const proxies = typeof context.proxyService === 'function'
          ? context.proxyService() : context.proxyService;
        if (proxies?.proxies) proxy = proxies.proxies.find(p => p.id === data.proxyId);
      }

      await session.connect({
        ...data.config,
        proxy,
        secretRepo,
        id: data.terminalId,
        rows: data.rows,
        cols: data.cols,
      });

      // Register in session registry
      const registry = typeof sessionRegistry === 'function'
        ? sessionRegistry() : sessionRegistry;
      if (registry) registry.register(data.terminalId, 'my-terminal', 'user', session);

      // Register in terminalMap for shared resize/input routing
      if (terminalMap) {
        terminalMap.set(data.terminalId, {
          type: 'my-terminal',
          process: session._stream,
          callback: (input) => session.write(input),
        });
      }
    } catch (error) {
      event.sender.send('error', {
        category: 'my-terminal',
        id: data.terminalId,
        error: error.message,
      });
    }
  });

  // Handle session close
  ipcMain.on('session.close.terminal.my-terminal', (event, data) => {
    const registry = typeof sessionRegistry === 'function'
      ? sessionRegistry() : sessionRegistry;
    const entry = registry?.get(data.terminalId);
    if (entry?.session) entry.session.close();
    registry?.unregister(data.terminalId);
  });

  logger.info('[my-terminal] Plugin registered');
}

module.exports = { register };
```

### Step 4: npm dependencies

If your connector needs npm packages (e.g. `ssh2`, `node-pty`), use `context.projectRequire` from the backend entry:

```javascript
// projectRequire is a require() function rooted at the project's node_modules
const projectRequire = context.projectRequire;
const ssh2 = projectRequire('ssh2');
```

Do **not** use relative `require()` paths to `src-electron/` — external plugins must be self-contained.

## 3. Context API

The `context` object passed to `register()` provides:

| Property | Type | Description |
|---|---|---|
| `ipcMain` | `Electron.IpcMain` | Register IPC handlers |
| `logger` | `Logger` | Electron-log instance |
| `terminalMap` | `Map` | Shared map for terminal resize/input routing |
| `sessionRegistry` | `() => SessionRegistry` | Register/list/unregister sessions |
| `runtimeAPI` | `() => RuntimeAPI` | Register connectors for AI tools |
| `proxyService` | `() => ProxyConfig` | Resolve proxy configurations |
| `secretService` | `() => SecretsConfig` | Resolve secret credentials |
| `projectRequire` | `Function` | `require()` rooted at project's `node_modules` |
| `settings` | `() => Settings` | App settings (lazy-loaded) |

**Important**: `sessionRegistry`, `runtimeAPI`, `proxyService`, `secretService`, and `settings` are **getter functions** — call them to get the actual value (e.g. `runtimeAPI()` returns the `RuntimeAPI` instance). `projectRequire` is the require function itself — use it directly.

## 4. AI Tool Integration

By calling `api.registerConnector('MY_TERMINAL', factory)`, your connector becomes available to AI tools:

- `terminal_open` with `profileType: "MY_TERMINAL"` — creates a session via your connector
- `session_write`, `session_read`, `session_list` — work automatically with any registered connector

The factory function signature is `(logger, config) => ConnectorInstance` where `config` is the resolved profile configuration (host, port, credentials already resolved from secrets).

## 5. Plugin Locations

- **Bundled**: `plugins/<id>/` — shipped with the app
- **External**: `~/.yaet/plugins/<id>/` — user-installed, overrides bundled plugins with the same id

External plugins must be self-contained. They cannot `require()` from `src-electron/` via relative paths. Use `context.projectRequire()` for npm dependencies.

## 6. Example

See `plugins/ssh-terminal/` for a complete bundled example, or `~/.yaet/plugins/ssh-terminal/` for an external example.
