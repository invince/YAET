# YAET Manual Test Plan

> Items that require real remote servers, external infrastructure, human verification, or OS-level interaction.

---

## 1. Build & Package

- [ ] `npm run ng:serve` + `npm run electron:dev` works for local development
- [ ] `npm run start` works (concurrently runs both)
- [ ] `npm run build` produces a working installer
- [ ] `npm test` — all unit tests pass
- [ ] Release workflow creates GitHub release with artifacts

## 2. Auto Update

- [ ] **Settings > Check for Updates** button triggers update check
- [ ] When `autoUpdate` is enabled, app checks for updates at startup (production only)
- [ ] When `autoUpdate` is disabled, no automatic update check
- [ ] When an update is found, dialog prompts user to download
- [ ] After download completes, dialog prompts user to restart and install
- [ ] Proxy settings are respected during update check
- [ ] Dev mode does NOT trigger auto update

## 3. Terminal — Remote Connections

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

### WinRM (PowerShell Remoting)
- [ ] Configure WinRM connection
- [ ] PowerShell commands execute remotely

## 4. Remote Desktop

### RDP
- [ ] Opens Microsoft Remote Desktop (mstsc) with configured host

### VNC
- [ ] Connection succeeds
- [ ] Copy/paste text works bidirectionally
- [ ] Resize works

## 5. File Explorer

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

## 6. Custom Commands

- [ ] Custom command configured in profile
- [ ] Custom command executes (e.g., launching RealVNC)

## 7. Cloud Sync

- [ ] Cloud settings form validation
- [ ] Authentication via login/password or secret
- [ ] Upload profiles/secrets to remote git repo
- [ ] Download profiles/secrets from remote git repo

## 8. AI Chat

- [ ] AI settings configured (API URL, token, model)
- [ ] Send message and receive AI response
- [ ] Markdown rendering works (code blocks, lists, etc.)
- [ ] Context mode: includes current terminal output in prompt
- [ ] Agent mode: AI response sent directly to terminal
- [ ] Messages are scrollable
- [ ] Loading state shown during API call

## 9. Security & Error Handling

- [ ] CSP blocks inline scripts (check devtools console)
- [ ] XSS: AI chat output does NOT execute HTML/scripts (DOMPurify sanitizes)
- [ ] IPC channels are whitelisted (unexpected channels are rejected)
- [ ] Corrupted JSON data does not crash the app (caught by try-catch in profile/secret/proxy services)
- [ ] Express API requires valid token (401 on missing/invalid token)
- [ ] Proxy credentials are scoped to auto-updater lifecycle only
- [ ] Command injection: shell commands use `spawn` with argument arrays
