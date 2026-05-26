# Phase 3: Runtime Session State Classification

> Give the AI session-level state awareness so it understands what a terminal is doing beyond raw text output.
> Last updated: 2026-05-25

---

## Problem

Phase 2 introduced session output buffering via `SessionRegistry`. The AI can now read raw terminal output, but it has no structured understanding of what is happening in a session:

```json
// session_read returns opaque text
{
  "output": [
    "Last login: Mon May 25 12:00:00\n",
    "user@server:~$ ",
    "sudo apt update\n",
    "[sudo] password for user: ",
    "Waiting for input...\n"
  ]
}
```

The AI must regex-parse every block of text to guess: is this a prompt? An error? Waiting for password input? This leads to brittle code and incorrect inferences.

**Key insight**: Terminal sessions follow a well-defined lifecycle with discrete states. Classifying state at the session level lets the AI make better decisions.

---

## Solution: SessionStateClassifier

A session-level state machine that classifies terminal output and exposes the current `state` in every `session_list` and `session_read` response.

### State Model

```
{
  sessionId: string,

  state: "IDLE" |
         "RUNNING" |
         "INPUT_REQUIRED" |
         "INTERACTIVE_PROGRAM" |
         "DISCONNECTED" |
         "ERROR",

  subtype?: "PASSWORD" |
            "CONFIRMATION" |
            "GENERIC_INPUT" |
            "VIM" |
            "MYSQL",

  prompt?: string,     // e.g. "Password:", "(y/n):"

  lastOutput: string,  // most recent output chunk

  updatedAt: number    // timestamp
}
```

### State Machine

```
                  command output
             ┌─────────────────────┐
             ↓                     │
  ┌──────┐  output(user write)  ┌─────────┐  prompt detected  ┌──────┐
  │ IDLE │────────────────────→│ RUNNING │──────────────────→│ IDLE │
  └──┬───┘                     └─────────┘                   └──────┘
     │                            │
     │ password/confirm           │ alt-screen (enter)
     │ pattern detected           │
     ↓                            ↓
  ┌────────────────┐        ┌──────────────────────┐
  │ INPUT_REQUIRED │        │ INTERACTIVE_PROGRAM   │
  │ (subtype)      │        │ (vim / less / top)    │
  │ prompt: "..."  │        └──────────────────────┘
  └───────┬────────┘                 │
          │ input submitted          │ alt-screen (exit)
          ↓                          ↓
       ┌──────┐                  ┌──────┐
       │ IDLE │                  │ IDLE │
       └──────┘                  └──────┘

  Any state ──── disconnect event ────→ DISCONNECTED
  Any state ──── error + no prompt ───→ ERROR
```

### State Transition Rules

| From | Trigger | To | Detail |
|---|---|---|---|
| `IDLE` | User/AI writes command | `RUNNING` | Output will follow; wait for next state |
| `RUNNING` | Final output line matches prompt regex | `IDLE` | e.g. `user@host:~$ `, `# ` |
| `RUNNING` | Output contains password/confirm pattern | `INPUT_REQUIRED` | Last few lines determine subtype |
| `RUNNING` | PTY enters alt-screen buffer | `INTERACTIVE_PROGRAM` | vi/less/top full-screen mode |
| `INPUT_REQUIRED` | Input submitted → more output | `RUNNING` | Command executing after input |
| `INPUT_REQUIRED` | Input submitted → prompt back | `IDLE` | Quick password submit returns to idle |
| `INTERACTIVE_PROGRAM` | PTY exits alt-screen buffer | `IDLE` | vi/less/top exited |
| `DISCONNECTED` | (terminal) | `DISCONNECTED` | No transitions out; final |
| `ERROR` | (terminal) | `ERROR` | No transitions out; final |

### Subtype Detection Heuristics

| Pattern (last N lines) | subtype | prompt |
|---|---|---|
| `/password\s*[:：]/i` | `PASSWORD` | `"Password:"` |
| `/confirm|continue\s*[\(\[].*[yY]\/[nN].*[\)\]]|\(y\/n\)|\[y\/n\]/i` | `CONFIRMATION` | `"(y/n):"` |
| `Enter\]|enter to |press any key/i` | `GENERIC_INPUT` | `"Press Enter to continue"` |
| Output contains `mysql>` / `MariaDB [(none)]>` | `MYSQL` | `"mysql>"` |
| PTY alt-screen enter event | `VIM` (or infer from PATH) | — |
| Other non-prompt input wait | `GENERIC_INPUT` | — |

---

## Architecture

### Module: SessionStateClassifier

A lightweight class that can be composed with `SessionRegistry`.

```
SessionRegistry               SessionStateClassifier
  register(id, session)          ─── observes output via session events
  unregister(id)                 ─── owns Map<id, SessionState>
  list()                         ─── get(id) returns state
  read(id)                       ─── read(id) returns state + output
        ↓
  session output event
        ↓
  buffer.append({ts, data})     stateClassifier.update(id, data)
        ↓                               ↓
  { ts, data }                    { state, subtype, prompt, updatedAt }
```

### Integration

```
electronMain.js
  sessionRegistry = new SessionRegistry({ maxBufferLines })
  stateClassifier = new SessionStateClassifier()
  sessionRegistry.setClassifier(stateClassifier)
                                  ─ or ─
  unifiedRegistry = new SessionRegistry({ maxBufferLines, classifier: stateClassifier })
```

### Output Augmentation

`session_read` response gains top-level state fields:

```json
{
  "id": "term_ssh_abc123",
  "type": "ssh",
  "owner": "user",
  "running": true,
  "state": "INPUT_REQUIRED",
  "subtype": "PASSWORD",
  "prompt": "Password:",
  "updatedAt": 1712345678000,
  "output": [
    { "ts": 1712345677000, "data": "sudo apt update\n" },
    { "ts": 1712345678000, "data": "[sudo] password for user: " }
  ]
}
```

`session_list` also returns `state` / `subtype` fields per session.

---

## Configuration

No new settings needed. `contextMaxLines` already controls buffer size. The classifier is always on.

---

## Integration Points

### Classifier Hooks

| Hook | Trigger | Action |
|---|---|---|
| `session.on('output', cb)` | On each output chunk | Feed to classifier |
| `session.on('disconnect', cb)` | Session terminated | Set state → `DISCONNECTED` |
| `session.on('error', cb)` | Session error | Set state → `ERROR` |
| PTY alt-screen (future) | vim/less/top enter/exit | Toggle `INTERACTIVE_PROGRAM` |

### AI Tool Impact

| Tool | Change |
|---|---|
| `session_list` | Response includes `state` + `subtype` |
| `session_read` | Response includes `state` + `subtype` + `prompt` |
| Context injection | Injected context includes `state` + `subtype` |

---

## File Change Summary

| Operation | File |
|---|---|
| **Create** | `src-electron/runtime/sessionStateClassifier.js` |
| **Modify** | `src-electron/runtime/sessionRegistry.js` — integrate classifier |
| **Modify** | `src-electron/adapter/ai/toolDefinitions.js` — return state in list/read |
| **Modify** | `src-electron/adapter/ipc/ai/aiChat.js` — inject state context |
| **Modify** | `docs/ai-integration/_2_aiContextAwareness.md` — update AI tools schema (optional) |

---

## Future Extensions (Not in Scope)

- Multi-line progressive heuristics (top/htop output detection)
- ANSI strip before classification (avoid false positives on escape sequences)
- User confirmation flow: AI asks user before writing to `INPUT_REQUIRED` sessions
- `session_write` tool: allow AI to write to sessions (e.g. submit password/confirmations)
- State history log for auditing
- Custom state rules via regex configuration
