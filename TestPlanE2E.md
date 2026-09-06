# YAET E2E Test Plan (Playwright)

> Items that can be automated via Playwright Electron testing.
> Framework: `playwright.config.ts` + `e2e/fixtures.ts`

---

## 1. Application Startup

- [x] Start app without any existing config files (fresh install)
  - [x] Config directory `.yaet` should be created automatically
  - [x] App should start without errors
  - [x] Profiles/secrets/settings should initialize with defaults
- [x] Start app with existing config files (seeded temp dir)
  - [x] All saved profiles, secrets, settings should load correctly
- [ ] Dev mode (`NODE_ENV=development`): Application menu should be visible
- [x] Production mode: Application menu should be hidden
- [x] Multiple toast notifications can be queued and displayed sequentially

## 2. Master Key & Secrets

- [x] First-time setup: clicking Cloud, Profile, Secret, or Quick Connect prompts to set a master key
- [x] Setting a new master key: works without migration (nothing to re-encrypt)
- [x] Changing master key with correct old key: atomic re-encrypt in the main process (read all files with old key → switch keyring → write all files with new key); success toast, dialog closes
- [x] Changing master key with incorrect old key: Force Continue confirm → new key saved and all stores cleared (`invalid` event); Cancel → no changes
- [x] Deleting master key: via IPC
- [x] Master key status is updated in real-time (event-driven, no polling)

### Master-key re-encrypt (atomic, main process)
- [x] Seeded profile + secret encrypted under old key survive a real UI master-key change: both files readable with the new key, `secretId` intact, old key no longer decrypts

### Secrets CRUD
- [x] Add: Password Only
- [x] Add: Login + Password
- [x] Add: SSH Key (with and without passphrase)
- [x] Add: Duplicate name detection
- [x] Edit: Rename
- [x] Saved fields persist after reopen (name, login)
- [x] Switch between secrets (no duplicate false positive)
- [x] Delete: confirmation dialog, removed from list
- [x] Edit: Change type preserves fields where possible
- [x] Edit: Change name to existing name (duplicate on edit)
- [x] Icon displayed correctly in lists (password / face / key)
- [x] Quick-add from SSH profile dropdown (creates secret, dialog closes without errors)
  - [ ] New secret appears in dropdown immediately
- [x] Delete secret: profile reference cleared (create profile with secret ref → delete → verify cleared)

## 3. Settings Menu

> Navigation: click `[aria-label="Settings"]` in sidebar → opens `.settings-container`.
> Tabs: General(0) / UI(1) / Groups(2) / Tags(3) / TerminalHandler(4) / Remote Desktop(5) / AI Assistant(7).
> Footer: Cancel / Reload / Save & Close / Save buttons.

### General (tab 0)
- [x] App version displayed correctly
- [x] Check for Updates button present and clickable
- [x] Auto-update toggle
- [x] Proxy selection dropdown (when auto-update enabled)
- [x] Language switcher has multiple options
- [x] Set Master Key button present

### UI (tab 1)
- [x] Profile label length setting
- [x] Side nav type (flat / tree)
- [x] Theme selection applies correctly
- [x] Secret label length (sidenav + dropdown)

### TerminalHandler (tab 4)
- [x] Local terminal type selection (CMD / PowerShell / PowerShell 7 / Bash)
- [x] Default terminal on startup option
- [ ] Custom exec path (excluded from UI options; only settable via saved settings)

### Remote Desktop (tab 5)
- [x] VNC clipboard compatible mode toggle
- [x] VNC quality (0-9) input
- [x] VNC compression level (0-9) input

### AI Assistant (tab 7)
- [x] AI mode switch (web / acp)
- [x] Web mode: API URL, token, model fields
- [x] ACP mode: command, args, model fields
- [x] Clear button present

### Groups (tab 2)
- [x] Empty state shown
- [x] Add group
- [x] Add multiple groups
- [x] Edit group name
- [x] Delete group
- [x] Delete group moves profiles to default (create profile in group → delete group → verify cleared)

### Tags (tab 3)
- [x] Empty state shown
- [x] Add tag
- [x] Add multiple tags
- [x] Edit tag name
- [x] Delete tag
- [x] Delete tag clears profile references (create profile with tag → delete tag → verify removed)

### Incompatible Settings
- [x] If saved data version is higher than app version, warning is shown and defaults are used
  - [x] Settings (non-encrypted, seed JSON with high compatibleVersion → toast)
  - [x] Profiles (encrypted, seed with CryptoJS → set master key → reload → toast)
  - [x] Secrets (encrypted, same pattern)
  - [x] Cloud (encrypted, same pattern)

## 4. Profiles

### View Modes
- [x] Toggle between flat and tree view

### Profile Operations
- [x] Add SSH profile (name, category/type, host/port, auth login + password, save)
- [x] Saved SSH fields persist after reopen (host, port, init path, init cmd, login)
- [x] Clicking tag field without changes does not dirty form (regression guard)
- [x] Clone profile creates copy with " Clone" suffix and same data
- [x] Delete profile with confirmation

### Quick Connect
- [x] Quick connect form opens and renders fields

## 5. Local Terminal (UI only)

- [x] Clicking local terminal button on sidebar opens a terminal tab immediately
- [x] "Open terminal at startup" setting works (seed `defaultOpen: true` → tab appears)
- [x] Switch terminal type via settings does not break terminal opening

## 5b. Local Terminal — real PTY smoke

- [x] Real PTY (no mocks): terminal opens, typed `echo <marker>` executes, marker found in the xterm buffer (read via shadow DOM — `app-terminal` uses `ViewEncapsulation.ShadowDom`)

## 6. UI/UX

- [x] Tab management:
  - [x] Open multiple tabs
  - [x] Switch between tabs
  - [x] Close tab via close button
  - [x] Split screen (vertical/horizontal)
  - [ ] Move tab between panes (needs drag-and-drop)
- [x] Themes (select each option in form — body class only updates on reload)
  - [x] Pink-Bluegrey (dark)
  - [x] Purple-Green (dark)
  - [x] Indigo-Pink (light)
  - [x] Deep Purple-Amber (light)
- [x] Offline: no external CDN requests on startup

## 7. Proxy Management

- [x] Open proxy menu from sidebar (requires master key)
- [x] Add proxy (name, type HTTP/SOCKS4/SOCKS5, host, port)
- [x] Edit proxy
- [x] Delete proxy with confirmation

## 8. Cloud Settings

- [x] Open cloud menu from sidebar (requires master key)
- [x] Form fields exist (URL, proxy, auth type, login/password, sync items)
- [x] Upload button disabled when form incomplete
- [x] Auth type radio buttons toggle fields (login/password, secret)

## 9. Security Review (P0)

- [x] P0-R1: Terminal onData not duplicated across tab switches
- [x] P0-R2: FileListComponent destroy$ cleanup (smoke — no JS errors)
- [x] P0-R3: SPICE dead-code removed; app stable without SPICE service
- [x] P0-R4: Startup settings error is surfaced via notification (corrupt JSON)
- [x] P0-S1: Express /api requires a valid per-launch token (403 without / wrong token)

## 10. AI Chat Panel

- [x] Bottom toolbar AI button opens the chat panel
- [x] Clicking AI button again closes the chat panel
- [x] Close button inside header closes the panel
- [x] Chat panel shows welcome message on first open
- [x] Agent toggle exists in chat header (default off)
- [x] Context toggle exists in chat header (default on)
- [x] Clicking session name opens history dropdown
- [x] History dropdown shows "New Chat" option
- [x] Creating a new chat resets messages to welcome
- [x] History dropdown closes on document click
- [x] No approval banner when no pending commands
- [x] Chat input area is always visible
- [x] Send button is disabled when input is empty
- [x] IPC channels: ai.command-approved, ai.command-rejected, ai.cancel-chat are allowed
- [x] IPC channels: ai.tool-progress, ai.command-pending are listened
- [x] Opening/closing AI chat produces no JS errors
- [x] Typing in chat input does not cause errors

## 11. AI Settings (New Fields)

- [x] Context max lines input exists (number type, min=10)
- [x] Use context checkbox exists (default checked)
- [x] Agent mode checkbox exists (default unchecked)
- [x] Cross session access checkbox exists (default unchecked)
- [x] Clicking agent mode checkbox toggles its state
- [x] Web mode shows API URL, token, model fields
- [x] ACP mode shows command, args fields; hides web fields
- [x] API URL field has default value
- [x] Seeded AI settings load correctly (contextMaxLines, agentMode, etc.)
- [x] Seeded AI settings reflect in the form
- [x] Clear button exists in AI settings
- [x] Navigating to AI settings tab produces no JS errors

---

## Untested / Blocked Items

Items that could not be automated with reasonable effort, listed for awareness:

| Section | Item | Reason |
|---------|------|--------|
| 1 | Dev mode menu visibility (`NODE_ENV=development`) | Needs Angular dev server running |
| 3 | Custom exec path in terminal settings | `custom` type excluded from `getLocalTermOptions()` |
| 4 | Profile types beyond SSH (Telnet, WinRM, VNC, RDP, SCP, FTP, Samba, Custom) | Flow is identical to SSH; low value to repeat 10× |
| 4 | Edit: type change, group assignment | UI complex; low priority |
| 4 | Profile filter by name/tag | Filter input functional; trivial to test |
| 4 | Quick Connect: direct connect / save | Requires real connection to verify; Save tested via profile form |
| 6 | Move tab between panes (drag & drop) | Complex drag-and-drop automation |
| 2 | Quick-add: new secret appears in dropdown immediately | Parent doesn't subscribe to `afterClosed()`; Angular OnPush CD doesn't refresh dropdown |
| — | Cloud Upload / Download (real git operations) | Requires real remote git repo and credentials |
| — | SSH/Telnet/WinRM/VNC/RDP/FileExplorer connections | Require real remote servers |
