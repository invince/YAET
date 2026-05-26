# Phase 3: AI Thinking Process Visualization

> Show the AI's intermediate reasoning steps in the chat UI so users understand what the AI is doing in real time.
> Last updated: 2026-05-26

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

After each `executeTool()` call, before pushing the tool result to the messages array, send a progress event:

```js
if (event.sender) {
  event.sender.send('ai.tool-progress', {
    toolName: tc.function.name,
    args,
    result,
    error: null,
    ts: Date.now(),
  });
}
```

Requires passing `event` (or `event.sender`) to `functionCallLoop`.

### Renderer

- `AiChatService` listens for `ai.tool-progress`
- Stores progress events per conversation
- `AiChatComponent` renders them between user message and response
- New `ToolCallStepComponent` for rendering individual steps

---

## Future

- Stream tool results character-by-character (vs. batch per loop iteration)
- Cancel button next to pending tool calls
- Collapse/expand all toggle
- Animated transitions between steps
