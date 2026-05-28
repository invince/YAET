# Phase 3: AI Thinking Process Visualization

> Show the AI's intermediate reasoning steps in the chat UI so users understand what the AI is doing in real time.
> Last updated: 2026-05-27

---

## Problem

Today the AI chat UI shows the final response only. When the AI calls multiple tools (`session_list` → `session_read` → `terminal_execute`), the user sees nothing until all tools complete, then a wall of text appears.

This creates a poor UX:
- Users don't know if the AI is "thinking" or stuck
- Long tool chains appear unresponsive
- No way to observe or debug the AI's decision process

---

## Solution: Progressive Tool Call Rendering

`functionCallLoop` pushes each tool call result to the UI as it completes, via an IPC event separate from the final response handler. The renderer collects these events and displays them incrementally.

### Architecture

```
AI Chat UI                  Main Process                        AI API
   │                           │                                 │
   ├─ send-with-tools ────────→│                                 │
   │                           ├── functionCallLoop ────────────→│
   │                           │     │                           │
   │  ← ai.tool-progress ──────┤     │ (per tool call)           │
   │  ← ai.tool-progress ──────┤     │                           │
   │  ← ai.tool-progress ──────┤     │                           │
   │                           │     │                           │
   │  ← response (final) ──────┤  ←──────────────────────────────│
```

### IPC Addition

| Channel | Direction | Payload |
|---|---|---|
| `ai.tool-progress` | main → renderer | `{ toolName, args, result, error?, ts }` |

No changes to the existing `ai.send-with-tools` handler (which returns the final response). Progress events are fire-and-forget notifications.

---

## UI Component: ToolCallStep

A new component rendered between the user message and the AI's final response.

### Layout

```
User: "what's running on my server?"

  🔍 session_list
    → Found 2 active sessions

  📖 session_read (session_abc)
    → output: "load average: 0.45, 0.30, 0.25"

  ⚡ terminal_execute (profile: web-server)
    → "top -bn1" completed

AI: The server is running normally...
```

### States

| State | Visual | Description |
|---|---|---|
| `pending` | 🔍 session_list ... | Tool dispatched, waiting for result |
| `success` | ✅ session_list → 2 sessions | Tool returned successfully |
| `error` | ❌ terminal_execute → "command not found" | Tool threw exception |

### Interaction

- **Collapsed by default**: shows tool name + truncated args
- **Click to expand**: shows full args + full result (JSON formatted)
- **Error auto-expand**: errors are shown expanded

---

## Implementation Notes

### Main Process (`functionLoop.js`)

`functionCallLoop` now accepts a `sendEvent` callback. After each `executeTool()` call:

```js
if (sendEvent) {
  sendEvent({ toolName, args, result, error: null, ts: Date.now() });
}
```

`aiChat.js` provides `event.sender.send('ai.tool-progress', data)` as `sendEvent`.

### Renderer

- `ElectronService` listens for `ai.tool-progress`
- `AiChatComponent.onToolProgress()` pushes entries to `toolProgress[]`
- Tool progress rendered **inline** in `ai-chat.component.html` (no separate component)
- Renders between user message and approval banner / loading indicator

### Redact Pipe

Added `RedactPipe` (`src/app/pipes/redact.pipe.ts`) to hide sensitive fields in tool args/results:

```ts
const SENSITIVE_KEYS = new Set([
  'id', 'profileId', 'profile_id',
  'secretId', 'secret_id',
  'sessionId', 'session_id'
]);
```

Applied as `{{ entry.args | redact | json }}` and `{{ entry.result | redact | json }}` in the template. Recursively walks nested objects.

### Ordering

```
User message
  └─ Tool progress entries (collapsible, expand on click)
    └─ Approval banner (if pending command)
      └─ Loading indicator / AI response
```

---

## Progress

| Feature | Status |
|---|---|
| `ai.tool-progress` IPC channel | ✅ Implemented |
| `sendEvent` callback in `functionCallLoop` | ✅ Implemented |
| Tool progress inline rendering | ✅ Implemented |
| Status icons (hourglass / check / error) | ✅ Implemented |
| Collapse/expand per entry | ✅ Implemented |
| Error auto-expand | ✅ Implemented |
| Redact pipe for sensitive fields | ✅ Implemented |
| Progress cards above approval banner | ✅ Implemented |
| Scrolling follows new progress entries | ✅ Implemented |

### Future

- Stream tool results character-by-character (vs. batch per loop iteration)
- Collapse/expand all toggle
- Animated transitions between steps
