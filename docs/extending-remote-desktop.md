# Extending Remote Desktop

This guide explains how to add new remote desktop connection types to YAET via the **plugin system**.

## 1. Architecture Overview

YAET uses a plugin architecture for remote desktop backends:

```
plugins/<plugin-id>/
├── manifest.json          # Plugin metadata
├── backend/
│   ├── index.js           # Backend entry: register(context) + IPC handlers
│   └── <type>.connector.js  # Connector class (extends EventEmitter)
└── frontend/              # (Optional) Angular components
```

- **Connector**: Handles the actual connection (VNC WebSocket proxy, RDP spawn, etc.) and emits `connected`, `disconnected`, `error` events.
- **Backend entry**: Registers IPC handlers for session lifecycle (`open`, `disconnect`) and registers the connector with `RuntimeAPI` for AI tool integration.
- **Manifest**: Declares plugin metadata, IPC channels, and frontend entry points.

## 2. Creating a New Remote Desktop Plugin

### Step 1: Create the manifest

```json
{
  "id": "spice-remote-desktop",
  "name": "SPICE Remote Desktop",
  "version": "1.0.0",
  "description": "SPICE remote desktop connection plugin",
  "category": "REMOTE_DESKTOP",
  "profileType": "SPICE_REMOTE_DESKTOP",
  "icon": "desktop_windows",
  "enabled": true,
  "backend": "./backend/index.js",
  "ipc": {
    "send": [],
    "invoke": ["session.open.rd.spice"],
    "on": ["session.connect.rd.spice", "session.disconnect.rd.spice"]
  }
}
```

Key fields:
- `category`: Must be `REMOTE_DESKTOP` for remote desktop plugins.
- `profileType`: Unique identifier (e.g. `VNC_REMOTE_DESKTOP`, `RDP_REMOTE_DESKTOP`).
- `ipc.invoke`: For async handlers that return a value (like VNC returning `proxyPort`).
- `ipc.send`: For fire-and-forget handlers (like RDP spawning `mstsc`).
- `ipc.on`: For events sent back to the renderer.

### Step 2: Implement the connector

Create `backend/spice.connector.js`:

```javascript
const EventEmitter = require('events');

class SpiceDesktop extends EventEmitter {
  constructor(log, config) {
    super();
    this.log = log;
    this.config = config; // { host, port, ... }
    this._connection = null;
  }

  async connect() {
    const { host, port } = this.config;
    this.log.info(`Connecting to SPICE server at ${host}:${port}...`);

    // Establish your connection here
    this._connection = await createSpiceConnection({ host, port });

    this._connection.on('ready', () => {
      this.emit('connected');
    });

    this._connection.on('close', () => {
      this.emit('disconnected');
    });

    this._connection.on('error', (err) => {
      this.emit('error', err.message);
    });

    // Return any data the frontend needs (e.g. proxy port for WebSocket)
    return { proxyPort: 5901 };
  }

  async disconnect() {
    if (this._connection) {
      this._connection.close();
      this._connection = null;
    }
  }
}

module.exports = { SpiceDesktop };
```

### Step 3: Implement the backend entry

Create `backend/index.js`:

```javascript
const { SpiceDesktop } = require('./spice.connector');

const sessionSenders = new Map();

function register(context) {
  const { ipcMain, logger, sessionRegistry, runtimeAPI } = context;

  // Register connector factory for AI tools
  const api = typeof runtimeAPI === 'function' ? runtimeAPI() : runtimeAPI;
  if (api) {
    api.registerConnector('SPICE_REMOTE_DESKTOP', (log, config) => {
      return new SpiceDesktop(log, config);
    });
  }

  // Handle session open (invoke — returns proxyPort to frontend)
  ipcMain.handle('session.open.rd.spice', async (event, { id, host, port }) => {
    sessionSenders.set(id, event.sender);
    const desktop = new SpiceDesktop(logger, { host, port });

    desktop.on('connected', () => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('session.connect.rd.spice', { id });
    });

    desktop.on('disconnected', () => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('session.disconnect.rd.spice', { id });
    });

    desktop.on('error', (error) => {
      const sender = sessionSenders.get(id);
      if (sender) sender.send('error', { category: 'spice', id, error });
    });

    const result = await desktop.connect();
    const registry = typeof sessionRegistry === 'function'
      ? sessionRegistry() : sessionRegistry;
    if (registry) registry.register(id, 'spice', 'user', desktop);
    return result.proxyPort;
  });

  // Handle session disconnect (fire-and-forget)
  ipcMain.on('session.disconnect.rd.spice', (event, { id }) => {
    const registry = typeof sessionRegistry === 'function'
      ? sessionRegistry() : sessionRegistry;
    const entry = registry ? registry.get(id) : null;
    const desktop = entry ? entry.session : null;
    if (desktop) desktop.disconnect();
    if (registry) registry.unregister(id);
    sessionSenders.delete(id);
  });

  logger.info('[spice-remote-desktop] Plugin registered');
}

module.exports = { register };
```

## 3. IPC Patterns

Remote desktop plugins use two IPC patterns:

### Invoke (async, returns value)
Used when the frontend needs a return value (e.g. VNC proxy port):
```javascript
ipcMain.handle('session.open.rd.vnc', async (event, data) => {
  const proxyPort = await desktop.connect();
  return proxyPort; // returned to frontend via ipc.invoke()
});
```

### Send (fire-and-forget)
Used when no return value is needed (e.g. RDP spawning mstsc):
```javascript
ipcMain.on('session.open.rd.rdp', (event, { hostname, options }) => {
  spawn('mstsc', [`/v:${hostname}`]);
});
```

## 4. Context API

The `context` object passed to `register()` provides:

| Property | Type | Description |
|---|---|---|
| `ipcMain` | `Electron.IpcMain` | Register IPC handlers |
| `logger` | `Logger` | Electron-log instance |
| `sessionRegistry` | `() => SessionRegistry` | Register/list/unregister sessions |
| `runtimeAPI` | `() => RuntimeAPI` | Register connectors for AI tools |
| `projectRequire` | `Function` | `require()` rooted at project's `node_modules` |

## 5. Frontend Integration

### VNC pattern (WebSocket proxy)
The VNC plugin returns a `proxyPort` from `connect()`. The frontend creates a noVNC `RFB` instance connected to `ws://localhost:${proxyPort}`:

```typescript
// In your Angular service
const proxyPort = await window.electronAPI.invoke('session.open.rd.vnc', { id, host, port });
const rfb = new RFB(vncCanvas, `ws://localhost:${proxyPort}`);
```

### RDP pattern (external process)
The RDP plugin spawns `mstsc` directly. No frontend session needed:

```typescript
// In your Angular service
window.electronAPI.send('session.open.rd.rdp', { hostname, options: { fullscreen: true } });
```

### Custom pattern
For protocols that need a custom frontend (like SPICE), create an Angular component that:
1. Sends IPC to open the session
2. Renders the remote desktop stream in a canvas
3. Handles keyboard/mouse input

## 6. Preload Whitelist

Add your IPC channels to `src-electron/preload.js`:

```javascript
const allowedSendChannels = [
  'session.open.rd.spice',
  // ...
];

const allowedInvokeChannels = [
  'session.open.rd.spice',  // if using ipc.handle
  // ...
];

const allowedOnChannels = [
  'session.connect.rd.spice',
  'session.disconnect.rd.spice',
  // ...
];
```

## 7. Plugin Locations

- **Bundled**: `plugins/<id>/` — shipped with the app
- **External**: `~/.yaet/plugins/<id>/` — user-installed, overrides bundled plugins

## 8. Examples

- `plugins/vnc-remote-desktop/` — WebSocket-to-TCP proxy pattern (invoke + return proxyPort)
- `plugins/rdp-remote-desktop/` — External process spawn pattern (fire-and-forget)
