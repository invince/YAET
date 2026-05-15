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
- [x] Setting a new master key: works without triggering re-encrypt prompt
- [x] Changing master key with correct old key: re-encrypt prompt appears
  - [x] Click "OK" → all settings re-encrypted
  - [x] Click "Cancel" → no changes (key still saved)
- [x] Changing master key with incorrect old key: force continue prompt
- [x] Deleting master key: via IPC
- [x] Master key status is updated in real-time (event-driven, no polling)

### Secrets CRUD
- [x] Add: Password Only
- [x] Add: Login + Password
- [x] Add: SSH Key (with and without passphrase)
- [x] Add: Duplicate name detection
- [x] Edit: Rename
- [x] Switch between secrets (no duplicate false positive)
- [x] Delete: confirmation dialog, removed from list
- [x] Edit: Change type preserves fields where possible
- [x] Edit: Change name to existing name (duplicate on edit)
- [ ] Delete: Associated profile references are cleared (blocked — needs profile CRUD first)
- [ ] Icon displayed correctly in lists and dropdowns
- [ ] Quick-add from dropdown:
  - [ ] Cloud settings → Login/Password only
  - [ ] SSH/SCP profile → All types
  - [ ] VNC profile → Password only
  - [ ] New secret appears in dropdown immediately

## 3. Settings Menu

### General
- [ ] App version displayed correctly
- [ ] Check for Updates button present and clickable
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
- [ ] VNC settings form renders
- [ ] RDP settings form renders

### File Explorer
- [ ] File explorer settings form renders
- [ ] Save button is enabled when form is valid

### AI
- [ ] AI API URL, token, model settings form renders
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

## 4. Profiles

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

## 5. Local Terminal (UI only)

- [ ] Clicking local terminal button on sidebar opens a terminal immediately
- [ ] "Open terminal at startup" setting works
- [ ] Switch terminal type via settings applies on next open

## 6. UI/UX

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
