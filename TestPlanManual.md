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
- <img width="2819" height="1245" alt="image" src="https://github.com/user-attachments/assets/6636bca5-ded2-4659-81f2-115f8de9cc84" />

### Telnet
- [ ] Configure telnet connection
- [ ] Send commands
- <img width="1981" height="1073" alt="image" src="https://github.com/user-attachments/assets/c619d238-37b0-4f9e-b94c-560dc3bf0247" />

### WinRM (PowerShell Remoting)
- [ ] Configure WinRM connection
- [ ] PowerShell commands execute remotely
- <img width="2065" height="982" alt="image" src="https://github.com/user-attachments/assets/f2ddf406-f090-4b9f-81d5-069e25bcea33" />


## 4. Remote Desktop

### RDP
- [ ] Opens Microsoft Remote Desktop (mstsc) with configured host

### VNC
- [ ] Connection succeeds
- [ ] Copy/paste text works bidirectionally
- [ ] Resize works
- <img width="3201" height="1778" alt="image" src="https://github.com/user-attachments/assets/7990bfe9-48d3-4eed-bce7-8eaf3839b4df" />

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
<img width="3317" height="1345" alt="image" src="https://github.com/user-attachments/assets/c2f160e3-04d3-4fb7-845b-1750add53d14" />

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
<img width="3377" height="1277" alt="image" src="https://github.com/user-attachments/assets/de93b9b3-d9a8-467d-a69e-15edbe6e994d" />

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
- [ ] Ai Tools: using ssh
- <img width="1261" height="754" alt="image" src="https://github.com/user-attachments/assets/ec6c181e-274c-424b-a563-c14289668fc8" />
- [ ] Ai Tools: using winrm
- <img width="2065" height="1112" alt="image" src="https://github.com/user-attachments/assets/1eb8d91e-0512-4878-a900-6569baf9a3f0" />
- [ ] Ai Tools: using telnet
- <img width="1445" height="1058" alt="image" src="https://github.com/user-attachments/assets/b1518253-3bd7-462a-970b-2fa5db1a82d6" />
- [ ] Ai Tools: using scp
<img width="1345" height="1066" alt="image" src="https://github.com/user-attachments/assets/3c5ae059-6cf6-4974-ad85-0bed80be3b8c" />
- [ ] Ai Tools: using FTP
<img width="1548" height="687" alt="image" src="https://github.com/user-attachments/assets/0c63c798-258f-425b-a802-9d40f03c450a" />
  

## 9. Security & Error Handling

- [ ] CSP blocks inline scripts (check devtools console)
- [ ] XSS: AI chat output does NOT execute HTML/scripts (DOMPurify sanitizes)
- [ ] IPC channels are whitelisted (unexpected channels are rejected)
- [ ] Corrupted JSON data does not crash the app (caught by try-catch in profile/secret/proxy services)
- [ ] Express API requires valid token (401 on missing/invalid token)
- [ ] Proxy credentials are scoped to auto-updater lifecycle only
- [ ] Command injection: shell commands use `spawn` with argument arrays
