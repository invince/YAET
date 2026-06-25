# Extending the File Explorer

This guide explains how to add new remote file system protocol support (e.g., WebDAV, S3) to the YAET File Explorer via the **plugin system**.

## 1. Architecture Overview

YAET uses a plugin architecture for file explorer backends:

```
plugins/<plugin-id>/
├── manifest.json          # Plugin metadata
├── backend/
│   ├── index.js           # Backend entry: register(context) + IPC handlers
│   └── <type>.connector.js  # Connector class (extends EventEmitter)
└── frontend/              # (Optional) Angular components
```

- **Connector**: Handles file operations (list, read, write, delete, rename) and emits events.
- **Backend entry**: Registers IPC handlers plus Express REST endpoints for file upload/download, and registers the connector with `RuntimeAPI` for AI tool integration.
- **Manifest**: Declares plugin metadata, IPC channels, and frontend entry points.

## 2. Creating a New File Explorer Plugin

### Step 1: Create the manifest

```json
{
  "id": "webdav-file-explorer",
  "name": "WebDAV File Explorer",
  "version": "1.0.0",
  "description": "WebDAV remote file system plugin",
  "category": "FILE_EXPLORER",
  "profileType": "WEBDAV_FILE_EXPLORER",
  "defaultPort": 443,
  "icon": "cloud",
  "enabled": true,
  "backend": "./backend/index.js",
  "ipc": {
    "send": ["session.open.fe.webdav", "session.close.fe.webdav"],
    "invoke": ["fe.list.webdav", "fe.read.webdav", "fe.write.webdav", "fe.delete.webdav", "fe.rename.webdav"],
    "on": []
  }
}
```

Key fields:
- `category`: Must be `FILE_EXPLORER` for file explorer plugins.
- `profileType`: Unique identifier (e.g. `SCP_FILE_EXPLORER`, `FTP_FILE_EXPLORER`, `SAMBA_FILE_EXPLORER`).
- `ipc.invoke`: For async handlers that return file listing, content, etc.
- `ipc.send`: For fire-and-forget handlers (like open/close session).

### Step 2: Implement the connector

Create `backend/webdav.connector.js`:

```javascript
const EventEmitter = require('events');

class WebDavFileExplorer extends EventEmitter {
  constructor(log, config) {
    super();
    this.log = log;
    this.config = config;
    this._client = null;
  }

  async connect() {
    const { url, username, password } = this.config;
    this.log.info(`Connecting to WebDAV at ${url}...`);
    // Establish your connection here
    this._client = await createWebDavClient({ url, username, password });
    this.emit('connected');
  }

  async listFiles(path) {
    // Return [{ name, type: 'file'|'dir', size, modifiedAt }, ...]
    return this._client.list(path);
  }

  async readFile(path) {
    return this._client.read(path); // returns Buffer
  }

  async writeFile(path, data) {
    await this._client.write(path, data);
  }

  async deleteFile(path) {
    await this._client.delete(path);
  }

  async renameFile(oldPath, newPath) {
    await this._client.rename(oldPath, newPath);
  }

  async disconnect() {
    if (this._client) {
      this._client.close();
      this._client = null;
    }
  }
}

module.exports = { WebDavFileExplorer };
```

### Step 3: Implement the backend entry

Create `backend/index.js`:

```javascript
const { WebDavFileExplorer } = require('./webdav.connector');

const sessions = new Map();

function register(context) {
  const { ipcMain, logger, sessionRegistry, runtimeAPI, expressApp } = context;

  // Register connector factory for AI tools
  const api = typeof runtimeAPI === 'function' ? runtimeAPI() : runtimeAPI;
  if (api) {
    api.registerConnector('WEBDAV_FILE_EXPLORER', (log, config) => {
      return new WebDavFileExplorer(log, config);
    });
  }

  // --- Express REST endpoints for file upload/download ---

  expressApp.post('/api/v1/webdav/:id', async (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const { path, action, content } = req.body;
    try {
      if (action === 'list') {
        const files = await session.listFiles(path);
        res.json({ files });
      } else if (action === 'read') {
        const data = await session.readFile(path);
        res.json({ content: data.toString('base64') });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- IPC handlers for frontend ---

  ipcMain.handle('fe.list.webdav', async (event, { sessionId, path }) => {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    return session.listFiles(path);
  });

  ipcMain.handle('fe.read.webdav', async (event, { sessionId, path }) => {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    return (await session.readFile(path)).toString('base64');
  });

  ipcMain.on('session.open.fe.webdav', async (event, data) => {
    const explorer = new WebDavFileExplorer(logger, data.config);
    await explorer.connect();

    explorer.on('error', (err) => {
      event.sender.send('error', { category: 'webdav', error: err });
    });

    sessions.set(data.sessionId, explorer);

    const registry = typeof sessionRegistry === 'function'
      ? sessionRegistry() : sessionRegistry;
    if (registry) registry.register(data.sessionId, 'webdav', 'user', explorer);

    event.sender.send('session.connect.fe.webdav', { id: data.sessionId });
  });

  ipcMain.on('session.close.fe.webdav', (event, { sessionId }) => {
    const explorer = sessions.get(sessionId);
    if (explorer) explorer.disconnect();
    sessions.delete(sessionId);

    const registry = typeof sessionRegistry === 'function'
      ? sessionRegistry() : sessionRegistry;
    if (registry) registry.unregister(sessionId);
  });

  logger.info('[webdav-file-explorer] Plugin registered');
}

module.exports = { register };
```

## 3. Express API for File Transfer

File explorer plugins use Express endpoints for streaming file uploads and downloads (via the `expressApp` provided in context). The Express server is shared — all plugins register their routes on the same app:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/<type>/:id` | POST | List, read, write, delete files |
| `/api/v1/<type>/upload/:id` | POST | Upload files with multipart |
| `/api/v1/<type>/download/:id` | POST | Download files with streaming |

See `plugins/scp-file-explorer/` or `plugins/ftp-file-explorer/` for working examples.

## 4. Context API

The `context` object passed to `register()` provides:

| Property | Type | Description |
|---|---|---|
| `ipcMain` | `Electron.IpcMain` | Register IPC handlers |
| `logger` | `Logger` | Electron-log instance |
| `sessionRegistry` | `() => SessionRegistry` | Register/list/unregister sessions |
| `runtimeAPI` | `() => RuntimeAPI` | Register connectors for AI tools |
| `expressApp` | `Express` | Shared Express app for REST endpoints |
| `projectRequire` | `Function` | `require()` rooted at project's `node_modules` |
| `proxyService` | `() => ProxyConfig` | Resolve proxy configurations |
| `secretService` | `() => SecretsConfig` | Resolve secret credentials |

## 5. Frontend Integration

File explorer plugins typically reuse the shared `FileExplorerComponent` for the UI. The frontend reads the plugin manifest and renders the shared file listing component automatically.

For a custom frontend, create an Angular component and register it in the bundled plugin's `frontend/*.plugin.ts`.

## 6. AI Tool Integration

By calling `api.registerConnector('WEBDAV_FILE_EXPLORER', factory)`, your connector becomes available to AI tools:
- `file_read`, `file_write`, `file_delete`, `file_list` — work automatically with any registered file explorer connector

## 7. Plugin Locations

- **Bundled**: `plugins/<id>/` — shipped with the app
- **External**: `~/.yaet/plugins/<id>/` — user-installed, overrides bundled plugins with the same id

## 8. Examples

- `plugins/scp-file-explorer/` — SCP/SFTP with Express upload/download endpoints
- `plugins/ftp-file-explorer/` — FTP protocol with streaming
- `plugins/samba-file-explorer/` — SMB/CIFS Windows file sharing
