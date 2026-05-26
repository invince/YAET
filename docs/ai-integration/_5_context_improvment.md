# Phase 5: Context Transmission Optimization

> Reduce token usage and latency by sending only relevant session output to the AI, rather than the full buffer every time.
> Last updated: 2026-05-26

---

## Problem

Currently `injectSessionContext()` sends the complete output of every active session with every user message. This wastes tokens and increases latency:

| Issue | Impact |
|---|---|
| Old output re-sent every turn | Redundant tokens |
| IDLE sessions (just a prompt) send full buffer | Unnecessary detail |
| Long-running sessions accumulate large buffers | Token limit pressure |
| AI has already seen the same output | No new information |

---

## Solution: Three-Level Optimization

### Level 1: State-Aware Truncation (Quick Win)

Send different content depending on session state:

| Session State | Injection Content |
|---|---|
| `IDLE` | `"[local] session_abc — state: IDLE, ready for input"` |
| `INPUT_REQUIRED` | `"[ssh] session_def — state: INPUT_REQUIRED, prompt: 'Password:'"` |
| `RUNNING` | Full buffered output (new output since last check) |
| `DISCONNECTED` | `"[ssh] session_ghi — disconnected"` |
| `ERROR` | `"[telnet] session_jkl — error: command not found"` |

IDLE sessions are collapsed to a one-liner — the AI doesn't need to see 50 lines of old output just to confirm the session is waiting at a prompt.

### Level 2: Incremental Delivery

Track which sessions were already sent in previous turns using a `lastSentAt` timestamp per session.

```
Turn 1:
  injectSessionContext():
    session_abc: lastSentAt = null → send full buffer (10 lines)
                               ↓ set lastSentAt = now
    session_def: lastSentAt = null → send full buffer (3 lines)
                               ↓ set lastSentAt = now

Turn 2:
  injectSessionContext():
    session_abc: lastSentAt = T1 → send only output after T1 (2 new lines)
                               ↓ update lastSentAt = now
    session_def: lastSentAt = T1 → no new output → skip entirely
```

### Level 3: AI-Driven Relevance (Future)

The AI can explicitly tag sessions as "no longer needed" via a tool:

```
session_ignore(id) — mark session as not relevant, skip in future context
session_focus(id)  — boost this session, always include its output
```

Or the system can infer relevance heuristically:
- If AI has read session A in the last 2 turns → keep including
- If AI has ignored session A for 5+ turns → drop from context
- If AI just used `terminal_execute` on profile P → boost P's session priority

---

## Configuration

```json
{
  "ai": {
    "contextOptimization": {
      "enabled": true,
      "level": 2,
      "idleSummary": true,
      "maxContextTokens": 4000
    }
  }
}
```

| Setting | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Master switch |
| `level` | number | `2` | Optimization level (1, 2, or 3) |
| `idleSummary` | boolean | `true` | Collapse IDLE sessions to one line |
| `maxContextTokens` | number | `4000` | Hard cap on context injection size |

---

## Implementation Plan

### Step 1: Settings

- Add `contextOptimization` fields to `AiSettings` domain model
- Add UI controls in settings page (checkboxes for levels, number input for max tokens)

### Step 2: Level 1 — State-Aware Truncation

- Modify `injectSessionContext()` to check `session_registry.read().state`
- If state is `IDLE` and `idleSummary` is enabled → emit one-liner
- Add `lastOutput` to the state classifier's state object (if available)

### Step 3: Level 2 — Incremental Delivery

- Add a `Map<sessionId, timestamp>` to track last-sent time
- Store it per-conversation (tied to the messages array or a separate context object)
- `injectSessionContext` filters buffer entries to `{ts > lastSentAt}`
- If filtered list is empty → skip the session entirely

### Step 4: Level 3 — Relevance (Future)

- Add `session_ignore` / `session_focus` tool definitions
- `executeTool` calls `runtime.sessionRegistry.setRelevance(id, score)`
- `injectSessionContext` filters by relevance score
- Implement heuristic decay (relevance decreases over unused turns)

---

## Token Savings Estimate

| Level | Scenario | Before | After | Savings |
|---|---|---|---|---|
| 1 | 2 IDLE sessions, 1 RUNNING | ~600 tokens | ~200 tokens | ~66% |
| 2 | Same sessions, 3rd turn | ~600 tokens | ~50 tokens | ~92% |
| 3 | 5 sessions, 2 relevant | ~1500 tokens | ~600 tokens | ~60% |

---

## Future

- **Adaptive maxTokens**: automatically adjust `maxContextTokens` based on model's context window
- **Smart ordering**: put RUNNING/INPUT_REQUIRED sessions first, IDLE last
- **Per-model tuning**: different truncation strategies for different models
- **User feedback loop**: if AI asks "what did the previous command output?" → we didn't send enough context → boost buffer lines
