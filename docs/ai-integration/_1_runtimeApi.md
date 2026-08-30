# Phase 1: Runtime API Layer

> Extract business logic from Electron IPC handlers into an Electron-free Runtime layer.
> Last updated: 2026-08-30

---

## Architecture

```
Electron UI / AI Agent / MCP Client / ACP Agent
    |
Adapter Layer (one per protocol)
    |--- adapter/ipc/          - Electron IPC (UI)
    |--- adapter/ai/           - AI Chat (function calling loop, 33+ tools)
    |--- src-protocol/mcp/     - MCP Server (stdio)
    |--- src-protocol/acp/     - ACP Server (stdin/stdout)
    |
Runtime Layer (Electron-free)
    |--- runtimeAPI.js         - Facade for all runtime operations
    |--- sessionRegistry.js    - Session tracking + output buffering
    |--- approvalManager.js    - AI command approval
    |--- connectors/terminal/  - Local terminal (only non-plugin connector)
    |--- interfaces/           - Base classes for connectors
    |
Plugin Layer (all connection types)
    |--- plugins/ssh-terminal/
    |--- plugins/telnet-terminal/
    |--- plugins/winrm-terminal/
    |--- plugins/serial-terminal/
    |--- plugins/scp-file-explorer/
    |--- plugins/sftp-file-explorer/
    |--- plugins/ftp-file-explorer/
    |--- plugins/samba-file-explorer/
    |--- plugins/vnc-remote-desktop/
    |--- plugins/rdp-remote-desktop/
```

### Design Principles

1. **Runtime Layer has zero Electron dependency** — shared by all Adapters
2. **Plugin Layer makes all connectors interchangeable** — each connection type is an independent plugin
3. **Adapter is a thin protocol bridge** — one Adapter per protocol/interface
4. **Adapters are independent** — adding a new protocol means adding a new Adapter
5. **`runtimeAPI.getConnector(profileId, opts)`** is the unified factory; empty `profileId` returns a `LocalTerminalSession`
6. **Credentials never exposed to AI** — `listProfiles()` returns only `{id, name, type, host, port}`

---

## Runtime API

`src-electron/runtime/runtimeAPI.js`

```
runtimeAPI
  ├── listProfiles(keyword?)          → {profiles: [{id, name, type, host, port}]}
  ├── getConnector(profileId, opts?)  → connector instance
  │     ├── undefined/null            → LocalTerminalSession
  │     ├── SSH_TERMINAL              → SshTerminalSession (via plugin)
  │     ├── TELNET_TERMINAL           → TelnetSession (via plugin)
  │     ├── WIN_RM_TERMINAL           → WinRMSession (via plugin)
  │     ├── SCP_FILE_EXPLORER         → ScpFileExplorer (via plugin)
  │     ├── FTP_FILE_EXPLORER         → FtpFileExplorer (via plugin)
  │     ├── SAMBA_FILE_EXPLORER       → SambaFileExplorer (via plugin)
  │     ├── VNC_REMOTE_DESKTOP        → VncDesktop (via plugin)
  │     └── ...                       → any registered plugin connector
  ├── registerConnector(type, factory)  ← plugins call this at startup
  ├── registerConfigResolver(type, fn)  ← plugins can customize config resolution
  ├── resolveSSHConfigByName(name)      → SSH config by profile name
  ├── resolveSSHConfigById(id)          → SSH config by profile ID
  ├── listSSHProfiles()                 → list all SSH profiles
  └── _resolveRemoteConfig(profileId, opts) → resolved config (host, port, credentials)
```

### Connectors

All connection types are now plugins. Plugins register their connectors with `RuntimeAPI` at startup:

```javascript
// In plugin backend/index.js
const api = typeof runtimeAPI === 'function' ? runtimeAPI() : runtimeAPI;
if (api) {
  api.registerConnector('SSH_TERMINAL', (log, config) => {
    return new SshTerminalSession(log, config);
  });
}
```

The only non-plugin connector is the Local Terminal (`runtime/connectors/terminal/local.js`).

| Plugin | Category | ProfileType | Capabilities |
|--------|----------|-------------|--------------|
| `ssh-terminal` | TERMINAL | SSH_TERMINAL | `connect`, `exec`, `write`, `resize`, `close` |
| `telnet-terminal` | TERMINAL | TELNET_TERMINAL | `connect`, `exec`, `write`, `close` |
| `winrm-terminal` | TERMINAL | WIN_RM_TERMINAL | `connect`, `exec`, `write`, `resize`, `close` |
| `serial-terminal` | TERMINAL | SERIAL_TERMINAL | `connect`, `write`, `resize`, `close` |
| `scp-file-explorer` | FILE_EXPLORER | SCP_FILE_EXPLORER | `listFiles`, `readFile`, `writeFile`, `deleteFiles`, `renameFile`, `copyFiles`, `moveFiles`, `createFolder`, `search`, `downloadFile` |
| `sftp-file-explorer` | FILE_EXPLORER | SFTP_FILE_EXPLORER | Same as SCP |
| `ftp-file-explorer` | FILE_EXPLORER | FTP_FILE_EXPLORER | Same as SCP |
| `samba-file-explorer` | FILE_EXPLORER | SAMBA_FILE_EXPLORER | Same as SCP (limited proxy/secret support) |
| `vnc-remote-desktop` | REMOTE_DESKTOP | VNC_REMOTE_DESKTOP | `connect`, `disconnect` |
| `rdp-remote-desktop` | REMOTE_DESKTOP | RDP_REMOTE_DESKTOP | External process spawn |

### Services (Infrastructure, retained)

- `configService.js` — JSON config read/write, manifest management
- `securityService.js` — AES encryption/decryption via master key + keytar
- `pluginManager.js` — Plugin discovery, loading, manifest generation
- `profileService.js` — SSH config resolution by profile name/ID
- `proxyService.js` — HTTP CONNECT / SOCKS4/5 proxy tunneling
- `cloudService.js` — Git cloud sync

---

## AI Adapter

`src-electron/adapter/ai/`

```
aiClient.js              -- OpenAI-compatible HTTP client
toolDefinitions.js       -- 33+ tool definitions + executeTool dispatcher
functionLoop.js          -- Recursive function calling loop (max 10 depth)
```

### AI Tools (33+)

| Category | Tools |
|----------|-------|
| **Profile** | `profile_list` |
| **Terminal** | `terminal_execute`, `local_execute` |
| **SCP** | `scp_list_files`, `scp_read_file`, `scp_write_file`, `scp_delete_files`, `scp_rename_file`, `scp_copy_files`, `scp_move_files`, `scp_create_folder`, `scp_search_files`, `scp_download_file` |
| **FTP** | `ftp_list_files`, `ftp_read_file`, `ftp_write_file`, `ftp_delete_files`, `ftp_rename_file`, `ftp_copy_files`, `ftp_move_files`, `ftp_create_folder`, `ftp_search_files`, `ftp_download_file` |
| **Samba** | `samba_list_files`, `samba_read_file`, `samba_write_file`, `samba_delete_files`, `samba_rename_file`, `samba_copy_files`, `samba_move_files`, `samba_create_folder`, `samba_search_files`, `samba_download_file` |
| **Session** | `session_list`, `session_read`, `session_write` |

Tools for the same operation across protocols (scp/ftp/samba) share a single implementation via switch fall-through.

---

## IPC Adapter

`src-electron/adapter/ipc/`

```
adapter/ipc/
├── backend.js                 ← Express API server (port 13012)
├── configFiles.js             ← IPC: settings/profiles/secrets save/reload
├── security.js                ← IPC: master key, encryption/decryption
├── cloud.js                   ← IPC: cloud upload/download
├── clipboard.js               ← IPC: clipboard operations
├── customSession.js           ← IPC: custom command sessions
├── localFile.js               ← IPC: local file operations
├── pluginHandler.js           ← IPC: plugin list, manifest, frontend reading
├── commonIpc.js               ← IPC: common utilities
├── autoUpdater.js             ← IPC: auto-update
├── rateLimiter.js             ← API rate limiting
├── terminal/
│   ├── terminalHandler.js     ← IPC: terminal input/resize routing
│   └── localHandler.js        ← IPC: local terminal open/close
└── ai/
    ├── aiChat.js              ← IPC: AI chat, tool execution
    └── acpClient.js           ← IPC: ACP client
```

Note: SSH, Telnet, WinRM, SCP, FTP, Samba, and VNC handlers have been moved to their respective plugins under `plugins/`. Only Local Terminal and shared terminal routing remain in the IPC adapter.

---

## Protocol Layer

`src-protocol/`

```
src-protocol/
├── cli.js                     -- Unified CLI entry point
├── common/
│   ├── credentialResolver.js  -- Decrypt YAET profiles/secrets from ~/.yaet/
│   └── logger.js              -- Standalone logger (no Electron)
├── mcp/
│   ├── server.js              -- MCP Server (JSON-RPC 2.0, stdio)
│   ├── index.js               -- MCP bootstrap
│   └── tools/
│       ├── ssh.js             -- SSH tools (execute, connect, send, disconnect)
│       ├── scp.js             -- SCP tools (list, read, write, delete)
│       └── local.js           -- Local tool (execute)
└── acp/
    ├── server.js              -- ACP Server
    └── index.js               -- ACP entry
```

---

## Delivery Checklist

- [x] 170+ unit tests pass
- [x] MCP Server `tools/list` returns tool schemas
- [x] ACP Server `tools/list` returns tool info
- [x] `npm run mcp` / `npm run acp` scripts work
- [x] All connection types migrated to plugins (10 bundled + 4 external examples)
- [x] Runtime layer has zero Electron dependency
- [x] AI Chat integrates 33+ tools (including `local_execute`, `session_*`)
- [x] `toolDefinitions.js` switch refactored — protocol fall-through grouping
- [x] `getConnector()` supports empty `profileId` → `LocalTerminalSession`
- [x] `adapter/ui-ipc/` renamed to `adapter/ipc/`
- [x] Old service files (sshService.js, scpService.js, etc.) deleted — replaced by plugins
- [x] Plugin architecture: bundled + external with dynamic frontend loading
