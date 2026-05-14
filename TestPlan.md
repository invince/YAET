# YAET Test Plan

> Version: 3.1.4 | Last Updated: 2026-05-14

---

## 1. Application Startup

- [ ] Start app without any existing config files (fresh install)
  - Config directory `.yaet` should be created automatically
  - App should start without errors
  - Profiles/secrets/settings should initialize with defaults
- [ ] Start app with existing config files
  - All saved profiles, secrets, settings should load correctly
- [ ] Dev mode (`NODE_ENV=development`): Application menu should be visible
- [ ] Production mode: Application menu should be hidden
- [ ] Multiple toast notifications can be queued and displayed sequentially

## 2. Build & Package

- [ ] `npm run ng:serve` + `npm run electron:dev` works for local development
- [ ] `npm run start` works (concurrently runs both)
- [ ] `npm run build` produces a working installer
- [ ] `npm test` — all unit tests pass (currently 62+ tests)
- [ ] Release workflow creates GitHub release with artifacts

## 3. Auto Update

- [ ] **Settings > Check for Updates** button triggers update check
- [ ] When `autoUpdate` is enabled, app checks for updates at startup (production only)
- [ ] When `autoUpdate` is disabled, no automatic update check
- [ ] When an update is found, dialog prompts user to download
- [ ] After download completes, dialog prompts user to restart and install
- [ ] Proxy settings are respected during update check
- [ ] Dev mode does NOT trigger auto update

## 4. Master Key & Secrets

- [ ] First-time setup: clicking Cloud, Profile, Secret, or Quick Connect prompts to set a master key
- [ ] Setting a new master key: works without triggering re-encrypt prompt
- [ ] Changing master key with correct old key: re-encrypt prompt appears
  - [ ] Click "OK" → all settings re-encrypted
  - [ ] Click "Cancel" → no changes
- [ ] Changing master key with incorrect old key: old data becomes unreadable
- [ ] Deleting master key: confirm dialog, all secrets become inaccessible
- [ ] Master key status is updated in real-time (event-driven, no polling)

### Secrets CRUD
- [ ] Add: Password Only
- [ ] Add: Login + Password
- [ ] Add: SSH Key (with and without passphrase)
- [ ] Add: Duplicate name detection
- [ ] Edit: Change type preserves fields where possible
- [ ] Edit: Rename
- [ ] Edit: Duplicate name detection
- [ ] Delete: Associated profile references are cleared
- [ ] Icon displayed correctly in lists and dropdowns
- [ ] Quick-add from dropdown:
  - [ ] Cloud settings → Login/Password only
  - [ ] SSH/SCP profile → All types
  - [ ] VNC profile → Password only
  - [ ] New secret appears in dropdown immediately

## 5. Settings Menu

### General
- [ ] App version displayed correctly
- [ ] Check for Updates button works
- [ ] Auto-update toggle
- [ ] Proxy selection dropdown (when auto-update enabled)
- [ ] Language switcher works (EN/ZH/FR/ES/DE)
- [ ] Set/Remove master key buttons work

### UI
- [ ] Sidebar navigation options
- [ ] Profile label length setting
- [ ] Theme selection applies correctly

### Terminal
- [ ] Local terminal type selection (CMD/PowerShell/PowerShell 7/Bash)
- [ ] Default terminal on startup option
- [ ] Font size / font family settings

### Remote Desktop
- [ ] VNC settings
- [ ] RDP settings

### File Explorer
- [ ] File explorer settings
- [ ] Save button is enabled when form is valid

### AI
- [ ] AI API URL, token, model settings
- [ ] Form validation (save button enable/disable correctly for ALL tabs)

### Groups
- [ ] Add group
- [ ] Edit group name/color
- [ ] Delete group → profiles in that group move to "default"
- [ ] Tree view shows group colors

### Tags
- [ ] Add tag
- [ ] Edit tag
- [ ] Delete tag → removed from all associated profiles

### Incompatible Settings
- [ ] If saved data version is higher than app version, warning is shown and defaults are used
  - [ ] Profiles
  - [ ] Secrets
  - [ ] Settings
  - [ ] Cloud settings

## 6. Profiles

### View Modes
- [ ] Tree view (default): grouped by group name, ordered alphabetically
  - [ ] Group color displayed
  - [ ] Tag colors on items
  - [ ] Profile icons
- [ ] List view: flat list ordered alphabetically
  - [ ] Tag colors on items
  - [ ] Profile icons
- [ ] Filter by name/tag works

### Profile Operations
- [ ] New profile: all types (SSH, Telnet, WinRM, Local Terminal, VNC, RDP, SCP, FTP, Samba, Custom)
- [ ] Clone: all types, preserves group and tags, appends "Clone" to name
- [ ] Edit:
  - [ ] Type change → icon updates
  - [ ] Basic field changes
  - [ ] Group assignment
  - [ ] Tag assignment updates icon color
- [ ] Delete: confirmation, removed from list

### Quick Connect
- [ ] Quick connect form works (same validation as profiles)
- [ ] Can connect directly
- [ ] Can save to profile

## 7. Terminal

### Local Terminal
- [ ] Clicking local terminal button on sidebar opens a terminal immediately
- [ ] CMD, PowerShell, PowerShell 7, Bash all work
- [ ] "Open terminal at startup" setting works
- [ ] Switch terminal type via settings applies on next open

### SSH
- [ ] Connection succeeds
- [ ] Color scheme applied correctly
- [ ] Commands execute
- [ ] `vi` / `nano` editors work
- [ ] Scrollbar works
- [ ] Clipboard: `Ctrl+Shift+C` copies selection, `Ctrl+V` / right-click pastes
- [ ] Init path (`cd` on connect) works
- [ ] Init command runs on connect
- [ ] Resize propagates correctly to remote terminal
- [ ] Reconnect: after network interruption, reconnect button appears and works
- [ ] URL handling:
  - [ ] Click → copied to clipboard
  - [ ] Ctrl+Click → opened in external browser

### Telnet
- [ ] Configure telnet connection
- [ ] Send commands
- [ *Note:* Windows 11 does not include telnet server; use a 3rd-party server like hk-telnet-server]

### WinRM (PowerShell Remoting)
- [ ] Configure WinRM connection
- [ ] PowerShell commands execute remotely
- [ *Note:* May need `winrm quickconfigure` and trusted hosts config]

## 8. Remote Desktop

### RDP
- [ ] Opens Microsoft Remote Desktop (mstsc) with configured host

### VNC
- [ ] Connection succeeds
- [ ] Copy/paste text works bidirectionally
- [ ] Resize works

## 9. File Explorer

### SCP/SFTP
- [ ] Connect
- [ ] List directory
- [ ] Navigate (cd)
- [ ] Download single file
- [ ] Download multiple files
- [ ] Upload file
- [ ] Drag & drop file to upload
- [ ] Copy/paste file
- [ ] Cut/paste file
- [ ] Copy/paste folder
- [ ] Cut/paste folder
- [ ] Create folder
- [ ] Create file
- [ ] Rename folder
- [ ] Rename file
- [ ] Delete file
- [ ] Delete folder (empty)
- [ ] Delete folder containing files
- [ ] Double-click open file → downloaded to temp → opened in native app
  - [ ] Saving the file triggers re-upload to server
- [ ] Copy current path
- [ ] Detail view toggle
- [ ] Proxy support

### FTP
- [ ] Connect
- [ ] List directory
- [ ] Navigate (cd)
- [ ] Download single file
- [ ] Download multiple files
- [ ] Upload file
- [ ] Drag & drop upload
- [ ] Create folder
- [ ] Rename folder/file
- [ ] Delete file/folder
- [ ] Double-click open → edit → auto-upload
- [ ] Init path
- [ ] FTPS (secure) — *not yet implemented*

### SMB/Samba
- [ ] Connect
- [ ] List directory
- [ ] Navigate (cd)
- [ ] Download single/multiple files
- [ ] Upload
- [ ] Drag & drop upload
- [ ] Copy/paste, cut/paste files and folders
- [ ] Create folder
- [ ] Rename folder/file
- [ ] Delete file/folder (empty and with contents)
- [ ] Double-click open → edit → auto-upload

## 10. Custom Commands

- [ ] Custom command configured in profile
- [ ] Custom command executes (e.g., launching RealVNC)

## 11. Cloud Sync

- [ ] Cloud settings form validation
- [ ] Authentication via login/password or secret
- [ ] Upload profiles/secrets to remote git repo
- [ ] Download profiles/secrets from remote git repo

## 12. AI Chat

- [ ] AI settings configured (API URL, token, model)
- [ ] Send message and receive AI response
- [ ] Markdown rendering works (code blocks, lists, etc.)
- [ ] Context mode: includes current terminal output in prompt
- [ ] Agent mode: AI response sent directly to terminal
- [ ] Messages are scrollable
- [ ] Loading state shown during API call

## 13. UI/UX

- [ ] Tab management:
  - [ ] Open multiple tabs
  - [ ] Switch between tabs
  - [ ] Close tab with middle-click on title
  - [ ] Split screen (vertical/horizontal)
  - [ ] Move tab between panes
- [ ] Themes:
  - [ ] Pink-Bluegrey (dark)
  - [ ] Purple-Green (dark)
  - [ ] Indigo-Pink (light)
  - [ ] Deep Purple-Amber (light)
- [ ] Custom scrollbar styling
- [ ] Offline: no external CDN requests (fonts/icons bundled locally)

## 14. Security & Error Handling

- [ ] CSP blocks inline scripts (check devtools console)
- [ ] XSS: AI chat output does NOT execute HTML/scripts (DOMPurify sanitizes)
- [ ] IPC channels are whitelisted (unexpected channels are rejected)
- [ ] Corrupted JSON data does not crash the app (caught by try-catch in profile/secret/proxy services)
- [ ] Express API requires valid token (401 on missing/invalid token)
- [ ] Proxy credentials are scoped to auto-updater lifecycle only
- [ ] Command injection: shell commands use `spawn` with argument arrays

## 15. Automated Tests

- [ ] `npm test` — all tests pass
  - [ ] `VersionUtils`: version comparison (equal, greater, less, different lengths)
  - [ ] `FilterKeywordPipe`: filtering, case-insensitivity, multi-provider, null safety
  - [ ] `Secret`/`Proxy`/`Profile` domain models: construction, cloning, CRUD
  - [ ] `TabInstance`: creation, name fallback
  - [ ] `GroupNode`: tree construction, sorting, empty groups, default node, patches
  - [ ] `ModelFormController`: form init, model mapping, refresh, preconditions

---

## Test Environment

- **OS**: Windows 10/11, Ubuntu 22.04+, macOS (if available)
- **Node.js**: 20.19+ / 22.12+ / 24+
- **Electron**: 35.x
- **Browser**: Chrome/Chromium (for Angular tests)

---

## Notes

- Items marked `[x]` in the original test plan have been manually verified previously.
- New features (AI Chat, manual update check, Express API auth) should be prioritized for manual testing.
- Automated tests cover domain models, pipes, and utility functions; manual testing is required for Electron IPC, UI interactions, and remote connections.
