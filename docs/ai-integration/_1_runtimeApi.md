# Phase 1: Runtime API Layer

> Extract business logic from Electron IPC handlers into an Electron-free Runtime layer.
> Last updated: 2026-05-25

---

## Architecture

```
Electron UI / AI Agent / MCP Client / ACP Agent
    |
Adapter Layer (one per protocol)
    |--- adapter/ipc/          - Electron IPC (UI)
    |--- adapter/ai/           - AI Chat (function calling loop, 33 tools)
    |--- src-protocol/mcp/     - MCP Server (stdio/SSE)
    |--- src-protocol/acp/     - ACP Server (stdin/stdout)
    |
Runtime Layer (Electron-free)
    |--- runtimeAPI.js
    |--- connectors/ (8 connectors)
```

### Design Principles

1. **Runtime Layer has zero Electron dependency** -- shared by all Adapters
2. **Adapter is a thin protocol bridge** -- one Adapter per protocol/interface
3. **Adapters are independent** -- adding a new protocol means adding a new Adapter
4. **`runtimeAPI.getConnector(profileId, opts)`** is the unified factory; empty `profileId` returns a `LocalTerminalSession`
5. **Credentials never exposed to AI** -- `listProfiles()` returns only `{id, name, type, host, port}`

---

## Runtime API

`src-electron/runtime/runtimeAPI.js`

```
runtimeAPI
  ├── listProfiles(keyword?)          → {profiles: [{id, name, type, host, port}]}
  ├── getConnector(profileId, opts?)  → connector instance
  │     ├── undefined/null            → LocalTerminalSession
  │     ├── SSH_TERMINAL              → SshTerminalSession
  │     ├── TELNET_TERMINAL           → TelnetSession
  │     ├── WIN_RM_TERMINAL           → WinRMSession
  │     ├── SCP_FILE_EXPLORER         → ScpFileExplorer
  │     ├── FTP_FILE_EXPLORER         → FtpFileExplorer
  │     ├── SAMBA_FILE_EXPLORER       → SambaFileExplorer
  │     └── VNC_REMOTE_DESKTOP        → VncDesktop
  └── _resolveRemoteConfig(profileId, opts) → resolved config
```

### Connectors

Terminal connectors (SSH, Telnet, WinRM) are registered at runtime by plugins via `runtimeAPI.registerConnector()`. File/desktop connectors remain hardcoded:

| Connector | Source | Capabilities |
|---|---|---|
| **SSH** | `plugins/ssh-terminal/` (registered) | `connect`, `exec`, `write`, `resize`, `close` |
| **Telnet** | `plugins/telnet-terminal/` (registered) | `connect`, `exec`, `write`, `close` |
| **WinRM** | `plugins/winrm-terminal/` (registered) | `connect`, `exec`, `write`, `resize`, `close` |
| **Local** | `runtime/connectors/terminal/local.js` | `connect`, `exec`, `write`, `resize`, `close` |
| **SCP** | `runtime/connectors/file/scp.js` | `listFiles`, `readFile`, `writeFile`, `deleteFiles`, `renameFile`, `copyFiles`, `moveFiles`, `createFolder`, `search`, `downloadFile` |
| **FTP** | `runtime/connectors/file/ftp.js` | Same as SCP |
| **Samba** | `runtime/connectors/file/samba.js` | Same as SCP (no proxy/secret support) |
| **VNC** | `runtime/connectors/desktop/vnc.js` | `connect`, `disconnect` |

### Services (Infrastructure, retained)

- `configService.js` -- JSON config read/write, manifest management
- `proxyService.js` -- HTTP CONNECT / SOCKS4/5 proxy tunneling
- `cloudService.js` -- Git cloud sync

---

## AI Adapter

`src-electron/adapter/ai/`

```
aiClient.js              -- OpenAI-compatible HTTP client
toolDefinitions.js       -- 33 tool definitions + executeTool dispatcher
functionLoop.js          -- Recursive function calling loop (max 10 depth)
```

### AI Tools (33)

| Category | Tools |
|---|---|
| **Profile** | `profile_list` |
| **Terminal** | `terminal_execute`, `local_execute` (grouped) |
| **SCP** | `scp_list_files`, `scp_read_file`, `scp_write_file`, `scp_delete_files`, `scp_rename_file`, `scp_copy_files`, `scp_move_files`, `scp_create_folder`, `scp_search_files`, `scp_download_file` |
| **FTP** | `ftp_list_files`, `ftp_read_file`, `ftp_write_file`, `ftp_delete_files`, `ftp_rename_file`, `ftp_copy_files`, `ftp_move_files`, `ftp_create_folder`, `ftp_search_files`, `ftp_download_file` |
| **Samba** | `samba_list_files`, `samba_read_file`, `samba_write_file`, `samba_delete_files`, `samba_rename_file`, `samba_copy_files`, `samba_move_files`, `samba_create_folder`, `samba_search_files`, `samba_download_file` |

Tools for the same operation across protocols (scp/ftp/samba) share a single implementation via switch fall-through.

---

## IPC Adapter

`src-electron/adapter/ipc/` (formerly `ui-ipc/`)

```
adapter/ipc/
├── terminal/
│   ├── sshHandler.js       → uses SshTerminalSession
│   ├── telnetHandler.js    → uses TelnetSession
│   ├── winRMHandler.js     → uses WinRMSession
│   ├── localHandler.js     → uses LocalTerminalSession
│   └── terminalHandler.js
├── file-explorer/
│   ├── scpHandler.js       → uses ScpFileExplorer
│   ├── ftpHandler.js       → uses FtpFileExplorer
│   └── sambaHandler.js     → uses SambaFileExplorer
├── remote-desktop/
│   └── vncHandler.js       → uses VncDesktop
└── ai/
    └── aiChat.js           → bridges AI Chat UI ↔ functionCallLoop
```

---

## Protocol Layer

`src-protocol/`

```
src-protocol/
├── cli.js              -- Unified CLI entry point
├── common/logger.js    -- Standalone logger (no Electron)
├── mcp/server.js       -- MCP Server (JSON-RPC 2.0, stdio)
├── mcp/index.js        -- MCP tool registration
├── mcp/tools/ssh.js    -- SSH Tools
├── mcp/tools/scp.js    -- SCP Tools
├── mcp/tools/local.js  -- Local Tools
├── acp/server.js       -- ACP Server
└── acp/index.js        -- ACP entry
```

---

## Delivery Checklist

- [x] 170 unit tests pass
- [x] MCP Server `tools/list` returns tool schemas
- [x] ACP Server `tools/list` returns tool info
- [x] `npm run mcp` / `npm run acp` scripts work
- [x] 8 old services deleted, migrated to runtime connectors
- [x] All connectors use runtime layer
- [x] AI Chat integrates 33 tools (including `local_execute`)
- [x] `toolDefinitions.js` switch refactored -- protocol fall-through grouping
- [x] `getConnector()` supports empty `profileId` → `LocalTerminalSession`
- [x] `adapter/ui-ipc/` renamed to `adapter/ipc/`
- [x] Unused interface files deleted (`secretRuntimeApi`, `proxyRuntimeApi`, `cloudRuntimeApi`)
