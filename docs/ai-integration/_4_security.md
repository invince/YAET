# Phase 4: Command Approval Gate

> Require user consent before the AI executes sensitive commands, preventing accidental or malicious destructive operations.
> Last updated: 2026-05-26

---

## Problem

The AI has access to tools that can:
- **Modify/delete files**: `rm`, `dd`, `format`, `mkfs`
- **Install/remove software**: `apt`, `pip`, `npm`, `pacman`
- **Modify system state**: `shutdown`, `reboot`, `systemctl`
- **Escalate privileges**: `sudo`, `su`, `chmod 777`
- **Access network**: `curl`, `wget`, `ssh`

A single mistaken or hallucinated command could cause data loss or system damage. Currently every `terminal_execute`, `local_execute`, and `session_write` call executes immediately without user oversight.

---

## Solution: Approval Queue

When the AI calls a command tool, the system intercepts it if it matches sensitivity rules, queues it for approval, and waits for the user to approve or reject before executing.

### Flow

```
AI calls terminal_execute
  │
  ├── (mode: "off") → execute immediately (current behavior)
  │
  ├── (mode: "all") → enqueue for approval
  │     │
  │     └── IPC: 'ai.command-pending' → UI shows approval banner
  │           │
  │           ├── [Approve] → IPC back → executeTool runs
  │           ├── [Reject]  → IPC back → error returned to AI
  │           └── [Timeout] → auto-reject after 60s
  │
  └── (mode: "auto") → check against dangerous lists
        │
        ├── matches? → enqueue for approval (same as "all")
        └── no match → execute immediately
```

### IPC Channels

| Channel | Direction | Payload |
|---|---|---|
| `ai.command-pending` | main → renderer | `{ requestId, toolName, args, preview }` |
| `ai.command-approved` | renderer → main | `{ requestId }` |
| `ai.command-rejected` | renderer → main | `{ requestId }` |

### Main Process Changes

- New `ApprovalManager` class managing the pending queue
- `executeTool()` checks with `ApprovalManager` before executing
- Async wait mechanism: `executeTool` awaits on a Promise that resolves when user approves/rejects
- Timeout: auto-reject after 60 seconds, resolves with error

---

## Sensitivity Rules

Configurable in `settings.json`:

```json
{
  "ai": {
    "safetyRules": {
      "mode": "auto",
      "dangerousCommands": [
        "rm", "dd", "shutdown", "reboot", "mkfs",
        "fdisk", "format", "sudo", "su", "passwd",
        "kill", "pkill", "systemctl"
      ],
      "dangerousPatterns": [
        "rm\\s+-rf\\s+/",
        ">\\s*/dev/sd",
        "dd\\s+if=",
        "chmod\\s+777",
        "chown\\s+[^:]+:",
        "wget\\s+http.*\\|\\s*bash",
        "curl\\s+http.*\\|\\s*bash"
      ]
    }
  }
}
```

### Modes

| Mode | Behavior | Use Case |
|---|---|---|
| `auto` | Intercept only commands matching dangerous lists | Production |
| `all` | Intercept every `terminal_execute` and `session_write` | Maximum security |
| `off` | Never intercept (current behavior) | Development / trusted AI |

---

## UI Component: ApprovalBanner

A non-modal banner that slides in from the top of the chat panel.

### Layout

```
┌─────────────────────────────────────────────────────┐
│ ⚠️  AI wants to execute: rm -rf /tmp/cache          │
│                                  [Approve] [Reject]  │
│                                  auto-reject in 45s  │
└─────────────────────────────────────────────────────┘
```

### Behavior

- **Non-blocking**: user can continue typing while banner is visible
- **Stacking**: multiple pending commands stack vertically
- **Timeout**: countdown displayed, auto-reject at 0
- **Edit** (future): click command text to edit before approving
- **Remember** (future): "Always approve this command" checkbox

---

## Integration Points

### executeTool

```js
async function executeTool(runtime, toolName, args) {
  if (isCommandTool(toolName) && runtime.approvalManager) {
    const request = await runtime.approvalManager.request(toolName, args);
    if (!request.approved) {
      return { error: `Command rejected by user: ${request.reason}` };
    }
    // args may have been modified by user edit (future)
  }
  // ... existing execution logic
}
```

### functionLoop

No changes needed — `executeTool` already returns the result or throws. The await on approval is transparent to the loop.

### Settings

Add `AiSettings.safetyRules` domain model, validated in `SettingService`.

---

## Future

- **Per-session trust**: approve once for the same command in a session
- **Edit command**: user edits the command parameters before approval
- **Audit log**: all approved/rejected commands logged with timestamp
- **Learning mode**: AI learns which commands need approval based on user behavior
- **Rate limiting**: prevent AI from spamming approval requests
