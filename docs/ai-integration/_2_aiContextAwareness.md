# Phase 2: AI Context Awareness via Session Registry

> Give the AI visibility into running sessions so it can understand context beyond one-shot function calls.
> Last updated: 2026-05-27

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

The AI can only **write** to sessions it created (`owner === 'ai'`). **Reading** is governed by two flags:

| Flag | `session_list` | `session_read` |
|---|---|---|
| `useContext === true` + `crossSessionAccess === true` | All AI-owned sessions | Any AI-owned session |
| `useContext === true` + `crossSessionAccess === false` | Current chat's AI-owned only (`chatSessionId`) | Current chat's AI-owned only |
| `useContext === false` | Empty `[]` | Only AI-owned (by any chat) |

### chatSessionId

Each AI-owned session is tagged with the `chatSessionId` (the AI chat history UUID) that created it. When `crossSessionAccess === false`, `session_list` and `session_read` filter by this ID, preventing chat1 from seeing sessions created by chat2.

Passed through the IPC chain: `component → ai.service → electron.service → aiChat.js → sessionContext → executeTool`.

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
| **Modify** | `src/app/domain/setting/AiSettings.ts` (add `contextMaxLines`, `crossSessionAccess`) |
| **Modify** | `src/app/services/setting.service.ts` (validate `contextMaxLines`, `crossSessionAccess`) |
| **Modify** | `src/app/services/electron/electron.service.ts` (pass `crossSessionAccess`, `useContext`, `chatSessionId` via IPC) |
| **Modify** | `src/app/services/ai.service.ts` (forward params) |
| **Modify** | `src/app/components/ai-chat/ai-chat.component.ts` (terminal content injection, pass flags) |
| **Modify** | `src-electron/adapter/ai/functionLoop.js` (pass `sessionContext`) |
| **Modify** | `src-electron/adapter/ipc/ai/aiChat.js` (`injectSessionContext`, `sessionContext` builder) |

---

## Phase 5: Context Optimization

Implemented in `injectSessionContext()` (`src-electron/adapter/ipc/ai/aiChat.js`):

- **Level 1**: IDLE/disconnected/INPUT_REQUIRED sessions are summarized as one-liners instead of full buffer dump
- **Level 2**: Incremental delivery — only new output (since last sent timestamp) is appended per session
- **`maxContextTokens`** hard cap (default 4000): drops oldest session entries when exceeded
- **`idleSummary`** flag: compresses IDLE and INPUT_REQUIRED states into short status strings
- **`contextOptimization`** settings: `{ enabled, level, idleSummary, maxContextTokens }`

Configured in `AiSettings.contextOptimization`.

### Context Injection (Dual Path)

| Path | Location | Role | Content |
|---|---|---|---|
| Renderer → User message | `ai-chat.component.ts:430-438` | Full xterm content | `getTerminalContent(activeTab.id)` |
| Backend → System message | `aiChat.js:injectSessionContext()` | Buffer summary + status | Session output, state summary |

Both paths gated by `useContext`. First path always injected for the current active terminal. Second path filtered by `crossSessionAccess` + `chatSessionId`.

---

## Progress

| Component | Status |
|---|---|
| `SessionRegistry` class | ✅ Implemented |
| Registry wired into all 5 terminal IPC handlers | ✅ Implemented |
| `session_list` tool | ✅ Implemented |
| `session_read` tool | ✅ Implemented |
| `session_write` tool | ✅ Implemented (AI-owned only) |
| `terminal_execute` removed | ✅ Removed |
| `contextMaxLines` setting | ✅ Implemented |
| Owner-based access control | ✅ Implemented |
| `chatSessionId` isolation | ✅ Implemented |
| `crossSessionAccess` / `useContext` flags | ✅ Implemented |
| `injectSessionContext()` (Phase 5) | ✅ Implemented |
| Context optimization (Level 1 + 2) | ✅ Implemented |
| `maxContextTokens` cap | ✅ Implemented |
| Dual-path context injection (renderer + backend) | ✅ Documented |
| `terminal_open` + `session_write` streaming | ✅ Implemented |
| Redact pipe (hide IDs) | ✅ Implemented |

### Future (Not Started)

- `session_close` tool — terminate a session from AI
- UI session indicator — show which sessions are AI-accessible
- Session output streaming to AI — real-time output push (vs. poll-based `session_read`)
