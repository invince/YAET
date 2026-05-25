# Phase 2: AI Context Awareness via Session Registry

> Give the AI visibility into running sessions so it can understand context beyond one-shot function calls.
> Last updated: 2026-05-25

---

## Problem

Phase 1 gave the AI 33 function-calling tools, but the AI operates in a stateless bubble:

- `terminal_execute` runs a command via `connector.exec()` and returns `{stdout, stderr, exitCode}` as the tool response -- the AI sees the result.
- However, terminals opened through the **UI** (via IPC handlers) stream output through `event.sender.send()` to the Angular frontend. The AI has no visibility into these sessions or their output.
- The AI cannot list what sessions are running, read their accumulated output, or interact with them after creation.
- There is no shared session registry -- each IPC handler keeps its own local `sessions = new Map()`.

### Current State

```
UI opens SSH terminal
  → sshHandler creates SshTerminalSession
  → output → ipcMain → Angular UI
  → AI cannot see this session at all

AI calls terminal_execute
  → runtimeAPI.getConnector() creates NEW SshTerminalSession
  → exec(command) → returns {stdout, stderr, exitCode}
  → session is discarded after the call
  → AI cannot re-connect or read ongoing output
```

---

## Solution: SessionRegistry

A unified registry that tracks all sessions regardless of their origin (UI or AI), buffers their output, and exposes the data to AI tools.

### Architecture Change

```
Before:                          After:

sshHandler                        sshHandler
  sessions Map ────┐               sessions Map ────┐
                   │                                 │
localHandler        │              localHandler        │
  sessions Map ────┤               sessions Map ────┤
                   ├────►         SessionRegistry ←─┤ ← shared registry
telnetHandler      │              telnetHandler      │
  sessions Map ────┤               sessions Map ────┤
                   │                                 │
AI executeTool     │              AI executeTool ────┘
  always creates   │                session_list/read → query registry
  new connector    │
                   │
winRMHandler       │              winRMHandler
  sessions Map ────┘               sessions Map ────┘
```

---

## Configuration: Context Buffer Size

A new setting `contextMaxLines` controls how many lines of session output are retained in memory and returned by `session_read`.

### Default

```ts
// src/app/domain/setting/AiSettings.ts
class AiSettings {
  contextMaxLines: number = 50;  // default
}
```

### Wiring

```
AiSettings.contextMaxLines (UI)
  → saved to settings.json via ConfigService
    → electronMain.js reads settings?.ai?.contextMaxLines
      → sessionRegistry.maxBufferLines = value
        → SessionRegistry trims buffer to maxBufferLines on overflow
          → session_read(lastN) defaults to maxBufferLines
```

### Validation (in SettingService)

```ts
if (!ai.contextMaxLines || ai.contextMaxLines < 10) ai.contextMaxLines = 50;
```

A minimum of 10 lines prevents accidentally setting it too low. No upper bound -- future AI models with larger context windows can set it higher.

---

### Session Registry Module

File: `src-electron/runtime/sessionRegistry.js`

```js
class SessionRegistry {
  constructor(options = {}) {
    this._maxBufferLines = options.maxBufferLines || 50;
    // ...
  }

  register(id, type, owner, session)
    // Hook session.on('output') to buffer data
    // Trims buffer to maxBufferLines on overflow
    // owner: 'user' | 'ai'
    // entry: { id, type, owner, session, buffer: [{ts, data}], createdAt }

  unregister(id)
    // Remove session entry

  get(id)
    // Get single entry

  list(owner?)
    // List all entries, optionally filtered by owner

  read(id, lastN?)
    // Read buffered output, defaults to maxBufferLines lines
}
```

### Entry Structure

```js
{
  id: 'term_ssh_abc123',
  type: 'ssh',              // ssh | local | telnet | winrm | vnc
  owner: 'user',            // user | ai
  session: SshTerminalSession,
  buffer: [
    { ts: 1712345678000, data: "Welcome to Ubuntu 22.04...\n" },
    { ts: 1712345679000, data: "user@server:~$ " },
  ],
  createdAt: 1712345670000
}
```

### Owner-Based Access Control

| Tool | Read Scope | Write Scope |
|---|---|---|
| `session_list` | All (user + ai) | - |
| `session_read` | All (user + ai) | - |
| `session_write` (future) | - | AI-owned only |

The AI can **see** all sessions for context, but can only **write** to sessions it created.

---

## New AI Tools

### `session_list`

Lists all active sessions or filters by owner.

```js
{
  name: 'session_list',
  description: 'List active terminal/file explorer sessions',
  parameters: {
    type: 'object',
    properties: {
      owner: { type: 'string', enum: ['user', 'ai'], description: 'Optional filter by session owner' }
    }
  }
}
```

Returns: `[{ id, type, owner, runningSince }]`

### `session_read`

Reads buffered output from a specific session.

```js
{
  name: 'session_read',
  description: 'Read recent output from a running session',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Session ID from session_list' },
      lastN: { type: 'number', description: 'Number of recent lines to return (default: contextMaxLines setting, min 10)' }
    },
    required: ['id']
  }
}
```

Returns: `{ id, type, owner, running: bool, output: [{ts, data}] }`

---

## IPC Handler Changes

Each handler that currently manages its own `sessions = new Map()` will receive the shared `SessionRegistry` as a parameter and register/unregister sessions with it.

| File | Current | After |
|---|---|---|
| `sshHandler.js` | `const sessions = new Map()` | Parameter: `registry` |
| `localHandler.js` | `const sessions = new Map()` | Parameter: `registry` |
| `telnetHandler.js` | `const sessions = new Map()` | Parameter: `registry` |
| `winRMHandler.js` | `const sessions = new Map()` | Parameter: `registry` |
| `vncHandler.js` | `const sessions = new Map()` | Parameter: `registry` |

Pattern change:

```js
// Before
sessions.set(data.terminalId, session);
// ...
sessions.delete(data.terminalId);

// After
registry.register(data.terminalId, 'ssh', 'user', session);
// ...
registry.unregister(data.terminalId);
```

Output buffering is handled automatically by the registry (it hooks the session's `output` event), so existing `session.on('output', ...)` handlers for IPC push remain unchanged.

---

## Integration Points

### electronMain.js

```js
const { SessionRegistry } = require('./runtime/sessionRegistry');

const registry = new SessionRegistry();

// Pass to IPC handlers
initSSHTerminalIpcHandler(log, terminalMap, () => allProxies, () => allSecrets, registry);
initLocalTerminalIpcHandler(settings, log, terminalMap, registry);
initTelnetIpcHandler(log, terminalMap, () => allProxies, () => allSecrets, registry);
initWinRmIpcHandler(settings, log, terminalMap, registry);
initVncHandler(log, vncMap, () => allProxies, () => allSecrets, registry);

// Expose on runtime for AI tools
runtime.setSessionRegistry(registry);
// or: runtime.sessionRegistry = registry;
```

### functionCallLoop

No changes needed. `executeTool(runtime, toolName, args)` already receives `runtime`, and `runtime.sessionRegistry` exposes the registry.

---

## File Change Summary

| Operation | File |
|---|---|
| **Create** | `src-electron/runtime/sessionRegistry.js` |
| **Modify** | `src-electron/electronMain.js` |
| **Modify** | `src-electron/adapter/ai/toolDefinitions.js` |
| **Modify** | `src-electron/adapter/ipc/terminal/sshHandler.js` |
| **Modify** | `src-electron/adapter/ipc/terminal/localHandler.js` |
| **Modify** | `src-electron/adapter/ipc/terminal/telnetHandler.js` |
| **Modify** | `src-electron/adapter/ipc/terminal/winRMHandler.js` |
| **Modify** | `src-electron/adapter/ipc/remote-desktop/vncHandler.js` |
| **Modify** (optional) | `src-electron/runtime/runtimeAPI.js` (facade methods) |
| **Modify** | `src/app/domain/setting/AiSettings.ts` (add `contextMaxLines`) |
| **Modify** | `src/app/services/setting.service.ts` (validate `contextMaxLines`)

---

## Future Extensions (Not in Scope)

- `session_write` tool -- send input to a running AI-owned session
- `session_close` tool -- terminate a session from AI
- `terminal_execute` auto-registration -- one-shot exec commands also register their session
- UI session indicator -- show which sessions are AI-accessible
- Session output streaming to AI -- real-time output push (vs. poll-based `session_read`)
- User-configurable `contextMaxLines` in Settings UI (currently `AiSettings.contextMaxLines: number = 50`)
