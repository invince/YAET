# Yet Another Electron Terminal (YAET)

## Description

YAET is a comprehensive remote connection and management tool built with Angular and Electron. It provides a unified interface for managing remote servers, executing commands, transferring files, and accessing remote desktops - all from a single application.

## Key Features

### 🖥️ Terminal Connections
- **SSH**: Secure shell connections with key-based and password authentication
- **Telnet**: Legacy telnet protocol support
- **WinRM**: Windows Remote Management for PowerShell sessions
- **Local Terminal**: Integrated local shell access

### 📁 Remote File Explorer
- **SCP/SFTP**: Secure file transfer over SSH
- **FTP**: Standard FTP protocol support
- **SMB/SAMBA**: Windows file sharing protocol

### 🖼️ Remote Desktop
- **VNC**: Virtual Network Computing for remote desktop access
- **RDP**: Remote Desktop Protocol (Windows)

### ⚡ Custom Commands
- Create your own custom commands/connections

### 🔐 Secrets Management
- Secure password storage using system keychain
- SSH key management with passphrase support
- Reusable credentials across multiple profiles
- Support for login/password and SSH key authentication

### ☁️ Cloud Sync
- Synchronize profiles and settings across devices via your own git repository (could be github, gitlab, or even your own git server). We don't provide cloud sync service. All is up to you.
- Backup and restore configurations
- Seamless multi-device workflow

### 🎨 Additional Features
- Tabbed interface for multiple concurrent connections
- Split-screen view for side-by-side sessions
- Connection profiles with custom groups and tags
- Session reconnection after network interruptions
- Customizable themes and color schemes

## Prerequisites

- **Node.js**: v20.19+ or v22.12+ or v24+
- **Angular CLI**: Latest version
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

3. **Rebuild native modules** (if installation fails)
   ```bash
   npm run rebuild-native
   ```

4. **Configure Syncfusion** (required for file explorer UI)
   - Create `config/config.json`
   - Add your Syncfusion license key

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

## Building & Releasing

### Build Installer

```bash
npm run build
```

This creates a distributable installer in the `dist` folder.

### Release to GitHub

```bash
npm run release
```

**Prerequisites:**
- Set `GH_TOKEN` environment variable with your GitHub personal access token
- Ensure you have push access to the repository

**What it does:**
1. Increments the version number
2. Builds the installer
3. Creates a GitHub release (as pre-release)
4. Uploads the installer for auto-updater

**Post-release steps:**
- Manually push code changes to GitHub
- Approve the pre-release on GitHub to make it public

**Released packages:** https://github.com/invince/YAET-RELEASE

## Logs

Application logs can be found at:
- **Linux**: `~/.config/{app name}/logs/main.log`
- **macOS**: `~/Library/Logs/{app name}/main.log`
- **Windows**: `%USERPROFILE%\AppData\Roaming\{app name}\logs\main.log`

## Technology Stack

- **Frontend**: Angular 21, Angular Material
- **Desktop**: Electron 31
- **Terminal**: xterm.js
- **File Transfer**: ssh2, basic-ftp, v9u-smb2
- **Remote Desktop**: @novnc/novnc


