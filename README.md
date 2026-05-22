# Yet Another Electron Terminal (YAET)

## Description

YAET is a comprehensive remote connection and management tool built with Angular and Electron. It provides a unified interface for managing remote servers, executing commands, transferring files, and accessing remote desktops — all from a single application.

## Key Features

### 🖥️ Terminal Connections
- **SSH**: Secure shell connections with key-based and password authentication
- **Telnet**: Legacy telnet protocol support
- **WinRM**: Windows Remote Management for PowerShell sessions
- **Local Terminal**: Integrated local shell access (CMD, PowerShell, PowerShell 7, Bash)
- <img width="1300" height="1000" alt="image" src="https://github.com/user-attachments/assets/25587b0e-d83e-4592-949c-4a756de1180b" />

- <img width="1500" height="800" alt="屏幕截图 2026-02-15 002126" src="https://github.com/user-attachments/assets/c174bcfc-3cd9-4b49-9e57-057eead922a6" />


### 📁 Remote File Explorer
- **SCP/SFTP**: Secure file transfer over SSH
- **FTP**: Standard FTP protocol support
- **SMB/SAMBA**: Windows file sharing protocol

### 🖼️ Remote Desktop
- **VNC**: Virtual Network Computing for remote desktop access
- **RDP**: Remote Desktop Protocol (Windows)
- <img width="1000" height="800" alt="屏幕截图 2026-02-15 002447" src="https://github.com/user-attachments/assets/0fc0ca62-eb2e-4c07-8cb5-8a8b18788025" />

### ⚡ Custom Commands
- Create your own custom commands/connections
- <img width="1400" height="700" alt="image" src="https://github.com/user-attachments/assets/596dedb1-e11b-4b8f-af12-aa989ef010cb" />


### 🔐 Secrets Management
- Secure password storage using system keychain to encrypt
- SSH key management with passphrase support
- Reusable credentials across multiple profiles
- Support for login/password and SSH key authentication
- <img width="1400" height="700" alt="屏幕截图 2026-02-15 002636" src="https://github.com/user-attachments/assets/2a709927-7001-48b1-89b3-d1c482a87d78" />


### ☁️ Cloud Sync
- Synchronize profiles and settings (all encrypted via system keychain) across devices via your own git repository (could be GitHub, GitLab, or even your own git server). We don't provide cloud sync service. All is up to you.
- Seamless multi-device workflow
- <img width="500" height="500" alt="屏幕截图 2026-02-15 003612" src="https://github.com/user-attachments/assets/394e3423-1957-4bec-afeb-40b54501e7ce" />


### 🎨 Additional Features
- Tabbed interface for multiple concurrent connections
- Split-screen view (vertical & horizontal) for side-by-side sessions
- Connection profiles with custom groups and tags
- Session reconnection after network interruptions
- Customizable themes and color schemes
- Flat and tree view modes for profile navigation

### 🤖 AI Assistant (ACP/MCP)
- **Agent Client Protocol (ACP)**: Deep integration with AI agents for automated tasks and terminal interactions.
- **Agent Mode**: Enable the AI to execute commands directly in your terminal for autonomous problem solving.
- **Context Awareness**: Ask questions about your active terminal output or specific session context.
- **Model Management**: Support for multiple LLM models with easy switching via ACP.
- **Persistent Chat History**: Manage multiple chat sessions with persistent storage, renaming, and history tracking.

## Prerequisites

- **Node.js**: v20.19+ or v22.12+ or v24+
- **Angular CLI**: 20.3.x
- **Python 3.x**: Required for native module compilation
  - **Important**: If using Python 3.13+, you must install setuptools: `pip install setuptools`
- **Build Tools** (Windows):
  - Visual Studio Build Tools with "Desktop development with C++" workload
  - Or: `npm install --global --production windows-build-tools` (legacy method)

## Setup

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd yaet
   ```

2. **Install dependencies** (requires admin rights for symbolic links on first run)
   ```bash
   npm install
   ```

### Quick Install (Linux)

For Linux users who just want to use the application, you can use the following command to download the latest AppImage and integrate it into your desktop environment:

```bash
curl -sSL https://raw.githubusercontent.com/invince/YAET/master/install.sh | bash
```

3. **Rebuild native modules** (if installation fails)
   ```bash
   npm run rebuild-native
   ```

## Development

### Local Development

**Option 1: Single command**
```bash
npm run start
```

**Option 2: Separate processes** (recommended for debugging)
```bash
# Terminal 1: Angular dev server
npm run ng:serve

# Terminal 2: Electron app
npm run electron:dev
```

### After Installing Electron Dependencies

If you install any npm packages used by the Electron main process:
```bash
npm run rebuild-native
```

## Testing

### Unit Tests

```bash
npm test
```

Unit tests cover domain models, pipes, utility functions, and services. Implemented with Jasmine + Karma.

### E2E Tests

E2E tests use **Playwright + Electron** and run a full Electron app instance against the compiled Angular build. Tests verify UI interactions, IPC communication, and CRUD flows.

```bash
# Run e2e tests (headless, default)
npm run test:e2e

# Run e2e tests with visible window (debugging)
npm run test:e2e:headed

# Run a single test file
npx playwright test e2e/_2_master_key_secrets.spec.ts

# Run tests matching a pattern
npx playwright test -g "add Password Only"
```

**How it works:**
- Angular is built first (`ng build`), then Electron loads the built files
- Each test gets a fresh Electron instance with an isolated temp directory
- Mock keychain ([`security.mock.js`](src-electron/ipc/security.mock.js)) replaces the OS keychain — no system creds touched
- Tests run **headless** by default. Set `YAET_SHOW_WINDOW=1` for a visible window
- CI runs e2e on every PR/push ([`.github/workflows/e2e.yml`](.github/workflows/e2e.yml)) and before each release

**Current coverage (92 tests):**
| Section | Tests | Status |
|---------|-------|--------|
| 0. App Bootstrap | 4 | ✅ |
| 1. Application Startup | 7 | ✅ |
| 2. Master Key & Secrets | 19 | ✅ |
| 3. Settings Menu | 29 | ✅ |
| 4. Incompatible Settings | 4 | ✅ |
| 5. Profiles | 11 | ✅ |
| 6. Local Terminal | 3 | ✅ |
| 7. UI/UX | 7 | ✅ |
| 8. Proxy Management | 4 | ✅ |
| 9. Cloud Settings | 4 | ✅ |

See [TestPlanE2E.md](./TestPlanE2E.md) for the full test plan.

## Building & Releasing

### Build Installer

```bash
npm run build
```

This creates a distributable installer in the `dist` folder.

### Release to GitHub

Releases are now automated via **GitHub Actions**.

**Important**: You MUST manually upgrade the version in [`package.json`](package.json) before creating a release tag. The GitHub Action uses the version from `package.json` to build and name the release artifacts.

1.  **Update version**: Update the `"version"` field in [`package.json`](package.json).
2.  **Commit, Tag, and Push**:
    ```bash
    git add package.json
    git commit -m "chore: bump version to v5.x.x"
    git tag v5.x.x
    git push && git push --tags
    ```

**Prerequisites:**
- Ensure you have configured a `GH_TOKEN` secret in your repository (**Settings > Secrets and variables > Actions**).
- The workflow triggers automatically on any tag push matching `v*`.

**What it does:**
1. Triggers parallel builds on Windows and Linux (Ubuntu) runners.
2. Compiles the Angular frontend.
3. Builds the Electron installers (`.exe`, `.AppImage`, `.deb`).
4. Creates/Updates a GitHub Release and uploads all artifacts.

**Released packages:** https://github.com/invince/YAET-RELEASE

## Logs

Application logs can be found at:
- **Linux**: `~/.config/{app name}/logs/main.log`
- **macOS**: `~/Library/Logs/{app name}/main.log`
- **Windows**: `%USERPROFILE%\AppData\Roaming\{app name}\logs\main.log`

## Technology Stack

- **Frontend**: Angular 20, Angular Material
- **Desktop**: Electron 39
- **Terminal**: xterm.js
- **File Transfer**: ssh2, basic-ftp, v9u-smb2
- **Remote Desktop**: @novnc/novnc
- **AI Integration**: Agent Client Protocol (ACP) or OpenAI provider
