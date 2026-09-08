# Yet Another Electron Terminal (YAET)

English | [Chinese](./README.cn.md)

## Description

YAET is a comprehensive remote connection and management tool built with Angular and Electron. It provides a unified interface for managing remote servers, executing commands, transferring files, and accessing remote desktops — all from a single application.

## Key Features

### 🖥️ Terminal Connections
- **SSH**: Secure shell connections with key-based and password authentication
- **Telnet**: Legacy telnet protocol support
- **WinRM**: Windows Remote Management for PowerShell sessions
- **Serial**: Serial port terminal for connecting to hardware devices (routers, switches, embedded boards, etc.) with configurable baud rate, data bits, stop bits, parity, and flow control
- **Local Terminal**: Integrated local shell access (CMD, PowerShell, PowerShell 7, Bash)
- <img width="3552" height="2094" alt="image" src="https://github.com/user-attachments/assets/6a55a46b-0dfe-46cd-bcf8-16967a791a5e" />
- <img width="3530" height="2190" alt="image" src="https://github.com/user-attachments/assets/da9e3f0b-5b67-412d-b179-556899d9e120" />
- serial example: <img width="2871" height="1920" alt="image" src="https://github.com/user-attachments/assets/6ad9f9b7-854e-4cef-a780-73e5981bca03" />

### 📁 Remote File Explorer
- **SCP/SFTP**: Secure file transfer over SSH
- **FTP**: Standard FTP protocol support
- **SMB/SAMBA**: Windows file sharing protocol
- **WebDav**:  External Plugin Example.  Web-based Distributed Authoring and Versioning.
- **S3**: Amazon Simple Storage Service (S3) is a service offered by Amazon Web Services (AWS) that provides object storage through a web service interface
- s3 example: <img width="3330" height="969" alt="image" src="https://github.com/user-attachments/assets/aa4d5122-9230-47e3-850e-4c15ed3a62e7" />


### 🖼️ Remote Desktop
- **VNC**: Virtual Network Computing for remote desktop access
- **RDP**: Remote Desktop Protocol (Windows)
- **SPICE**: External Plugin Example. The Simple Protocol for Independent Computing Environments — a remote-display system built for virtual environments

- vnc example <img width="3540" height="2177" alt="image" src="https://github.com/user-attachments/assets/6d73f239-5061-42d9-bc66-d4ed000843a7" />
- spice example <img width="3300" height="1677" alt="image" src="https://github.com/user-attachments/assets/749d8391-921c-4f6f-8369-0607774477c7" />


### ⚡ Custom Commands
- Create your own custom commands/connections
- <img width="2809" height="2035" alt="image" src="https://github.com/user-attachments/assets/0269e8f0-5f74-4bff-a590-0d6172f93e17" />


### 🔐 Secrets Management
- Secure password storage using system keychain to encrypt
- SSH key management with passphrase support
- Reusable credentials across multiple profiles
- Support for login/password and SSH key authentication
- Master-key change re-encrypts every encrypted file atomically in the main process (never from renderer memory)
- Keep a backup of `~/.yaet/`: if the keyring key no longer matches the files, decryption fails with `Malformed UTF-8 data` / `No master key defined` — restore the files, then put the matching-era master key back into the keyring (delete + first-time setup); never save or Force Continue while the key mismatches, or empty data will overwrite the good files
- <img width="2879" height="1653" alt="image" src="https://github.com/user-attachments/assets/3ea5f344-2c70-4eb9-a310-bca7f8451cd1" />


### ☁️ Cloud Sync
- Synchronize profiles and settings (all encrypted via system keychain) across devices via your own git repository (could be GitHub, GitLab, or even your own git server). We don't provide cloud sync service. All is up to you.
- Seamless multi-device workflow
- <img width="2366" height="2058" alt="image" src="https://github.com/user-attachments/assets/48432c20-cabc-44e5-86ac-83c30c7bca71" />


### 🎨 Additional Features
- Tabbed interface for multiple concurrent connections
- Split-screen view (vertical & horizontal) for side-by-side sessions
- Connection profiles with custom groups and tags
- Session reconnection after network interruptions
- Customizable themes and color schemes
- Flat and tree view modes for profile navigation

### 🌐 Proxy Management
- **HTTP / SOCKS4 / SOCKS5**: Configure proxy servers for connections that need to go through a proxy
- **Authenticated Proxies**: Reuse credentials from Secrets Management for proxy authentication
- **Per-Profile Assignment**: Assign a specific proxy to each connection profile

### 🤖 AI Assistant
- **Two Provider Modes**:
  - **Web Mode**: Connect to any OpenAI-compatible API (OpenAI, local LLM, etc.) with a URL and API key
- **Agent Mode**: Enable the AI to execute commands directly in your terminal for autonomous problem solving
- **36 AI Tools**: profile management, terminal execution, SCP/FTP/Samba file operations, session management
- **Context Awareness**: Ask questions about your active terminal output or specific session context
- **Command Approval**: Dangerous commands require user approval before execution
- **Persistent Chat History**: Manage multiple chat sessions with persistent storage, renaming, and history tracking
- **Draggable Chat Panel**: Resizable, repositionable floating chat window

### 🔌 MCP / ACP Protocol Servers

**MCP Server (Model Context Protocol)**:
- **From source**: run `npm run mcp` (i.e. `node src-protocol/cli.js mcp`) to start an MCP server via stdio transport
- **Packaged app**: the installed binary handles it directly — no wrapper script needed (source stays inside asar): `~/.local/bin/YetAnotherElectronTerm.AppImage --mcp`
- **Headless flags**: when launched by an agent (no display), add Electron flags: `--mcp --no-sandbox --ozone-platform=headless`
- **Master key**: headless environments have no OS keyring, so export `YAET_MASTER_KEY` (or `YAET_MASTER_KEY_FILE` pointing to a 0600 file) before starting — otherwise profile decryption fails
- **Tools (8)**: `ssh_execute`, `ssh_sudo_execute`, `scp_list_files`, `scp_read_file`, `scp_write_file`, `scp_delete_file`, `local_execute`, `yaet_profiles`
- **Credential resolution**: supports YAET profile names (resolved from encrypted store) or manual host/username/password
- **Tested with**: Hermes agent ✅

**ACP Server (Agent Communication Protocol)**:
- **Standalone mode**: run `npm run acp` to start an ACP server via stdin/stdout
- **Sessions**: create, prompt, close sessions with tools
- **Same toolset** as MCP server

The master key never lands in chat context — pass it via environment. Two ways to supply it to the MCP server's `env` block in the Hermes config (both point at the installed YAET binary; resolution order is `YAET_MASTER_KEY` → `YAET_MASTER_KEY_FILE` → OS keyring):

**Scenario 1 — plain env variable (simplest, agent-managed)**: export `YAET_MASTER_KEY` in the agent's own environment (`~/.hermes/.env`), then reference it in the MCP entry:

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  yaet:
    command: ~/.local/bin/YetAnotherElectronTerm.AppImage
    args:
      - --mcp
      - --no-sandbox
      - --ozone-platform=headless
    env:
      YAET_MASTER_KEY: ${YAET_MASTER_KEY}
    enabled: true
```

**Scenario 2 — key file (`YAET_MASTER_KEY_FILE`, Docker / systemd friendly)**: keep the key in a `0600` file and point the env var at it. This suits systemd `LoadCredential` and Docker secrets, where the secret is injected as a file rather than an env var:

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  yaet:
    command: ~/.local/bin/YetAnotherElectronTerm.AppImage
    args:
      - --mcp
      - --no-sandbox
      - --ozone-platform=headless
    env:
      YAET_MASTER_KEY_FILE: /run/secrets/yaet_master_key
    enabled: true
```

Provision that file either way (mounted file content must match the key that encrypted `~/.yaet/profiles.json`):

```yaml
# docker-compose.yml — secret mounted as a file
services:
  yaet:
    command: /opt/YetAnotherElectronTerm/yet-another-electron-term --mcp --no-sandbox --ozone-platform=headless
    environment:
      YAET_MASTER_KEY_FILE: /run/secrets/yaet_master_key
    secrets:
      - yaet_master_key
secrets:
  yaet_master_key:
    file: /path/to/0600/keyfile   # chmod 600; trailing newline is stripped
```

```ini
# systemd unit — LoadCredential injects the file at /run/credentials/yaet.service/yaet_master_key
[Service]
Environment=YAET_MASTER_KEY_FILE=/run/credentials/yaet.service/yaet_master_key
LoadCredential=yaet_master_key:/etc/yaet/yaet_master_key
```

**Headless CLI (read-only bootstrap)**: on machines without a desktop,
`masterkey set` → `cloud download` → `doctor` → `mcp`.
See [docs/headless-cli.md](docs/headless-cli.md) for the full flow and command reference.

### 🧩 Plugin System
- **Modular architecture**: each connection type is an independent plugin with manifest, backend, and frontend
- **10 bundled plugins**: SSH, Telnet, WinRM, Serial, SCP, SFTP, FTP, Samba, VNC, RDP — ship with the app under `plugins/`
- **External plugins**: install third-party plugins to `~/.yaet/plugins/<id>/` — they are disabled by default and must be explicitly enabled via `pluginManager.enablePlugin(id)`. External plugins that conflict with bundled plugin IDs are skipped for security
- **Self-contained backends**: external plugins resolve npm dependencies via `context.projectRequire()` or self-managed `package.json`
- **Dynamic frontend loading**: external plugin frontend bundles are loaded at runtime via IPC — no rebuild required
- **Shared UI**: plugins can reuse core components like `TerminalComponent`, `FileExplorerComponent`, and `RemoteTerminalProfileFormComponent`
- **4 example plugins**: see [`ext-plugins-example/`](ext-plugins-example/) — WebDAV, SPICE, S3, Docker
- See [docs/plugin-development.md](docs/plugin-development.md) for how to write your own plugin

### 🏗️ Architecture

YAET uses a **4-layer architecture** that separates concerns and enables multi-protocol access:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Interface Layer (Adapters)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Electron  │  │AI Chat   │  │MCP Server│  │ACP Server    │   │
│  │ IPC Adapter│ │(36 tools)│  │(stdio)   │  │(stdin/stdout)│   │
│  └─────┬─────┘  └─────┬────┘  └─────┬────┘  └──────┬───────┘   │
│        └───────────────┴─────────────┴──────────────┘           │
├─────────────────────────────────────────────────────────────────┤
│                    Runtime Layer (Logic)                         │
│  ┌────────────┐ ┌───────────────┐ ┌──────────────────────┐     │
│  │ RuntimeAPI │ │SessionRegistry│ │ApprovalManager       │     │
│  │(facade)    │ │(AI context)   │ │(command approval)    │     │
│  └─────┬──────┘ └───────────────┘ └──────────────────────┘     │
├─────────────────────────────────────────────────────────────────┤
│                    Plugin Layer (Connectors)                     │
│  ┌──────┐┌──────┐┌──────┐┌──────┐┌─────┐┌─────┐┌─────┐       │
│  │ SSH  ││Telnet││WinRM ││Serial││SCP  ││FTP  ││VNC  │ ...   │
│  └──────┘└──────┘└──────┘└──────┘└─────┘└─────┘└─────┘       │
├─────────────────────────────────────────────────────────────────┤
│                    Services Layer (Infrastructure)               │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ConfigService│ │SecuritySvc │ │ProxyService│ │CloudService│  │
│  │JSON I/O     │ │Encryption  │ │SOCKS/HTTP  │ │Git sync    │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

- **Runtime Layer** has zero Electron dependency — shared by all adapters
- **Plugin Layer** makes all connection types interchangeable and extensible
- **Adapter Layer** is a thin protocol bridge — adding a new interface means adding a new adapter
- **Credentials never exposed to AI** — only profile IDs cross the process boundary

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
This automatically generates the plugin barrel file before starting.

**Option 2: Separate processes** (recommended for debugging)
```bash
# First, generate plugin barrel file
npm run generate-plugin-barrel

# Terminal 1: Angular dev server
npm run ng:serve

# Terminal 2: Electron app
npm run electron:dev
```

> **Note:** If you modify plugin code, re-run `npm run generate-plugin-barrel` or restart `npm run start`.

> **Dev/prod isolation:** local dev builds (`NODE_ENV=development`, i.e. `npm start` / `npm run electron:dev`) use an isolated data directory (`~/.yaet-debug`) and an isolated OS-keychain entry, so testing never touches your production `~/.yaet` files or master key. Your dev workspace starts empty — set a master key there once. Run `NODE_ENV=development npm run mcp` to point the MCP server at debug data.

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
- Mock keychain ([`security.mock.js`](src-electron/adapter/ipc/security.mock.js)) replaces the OS keychain — no system creds touched. It is loaded **only during e2e tests** via [`electronMain.e2e.js`](src-electron/electronMain.e2e.js), which intercepts `require.cache` before the real `security.js` loads; the production app always uses the real OS keychain (keytar).
- Tests run **headless** by default. Set `YAET_SHOW_WINDOW=1` for a visible window
- CI runs the e2e suite on every version tag (`v*`) before release ([`.github/workflows/build.yml`](.github/workflows/build.yml)); the suite also runs under the sandboxed renderer, so it covers the production security posture

**Current coverage (139 E2E tests):**
| Section | Tests | Status |
|---------|-------|--------|
| 1. Application Startup | 7 | ✅ |
| 2. Master Key & Secrets | 19 | ✅ |
| 3. Settings Menu | 29 | ✅ |
| 3. Incompatible Settings | 4 | ✅ |
| 4. Profiles | 11 | ✅ |
| 5. Local Terminal (UI + real-PTY smoke) | 4 | ✅ |
| 5. Master-key re-encrypt (atomic, main process) | 1 | ✅ |
| 6. UI/UX | 7 | ✅ |
| 7. Proxy Management | 4 | ✅ |
| 8. Cloud Settings | 4 | ✅ |
| 9. Security Review (P0) | 9 | ✅ |
| 10. AI Chat Panel | 22 | ✅ |
| 11. AI Settings | 18 | ✅ |

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
    git commit -m "chore: bump version to v7.x.x"
    git tag v7.x.x
    git push && git push --tags
    ```

**Prerequisites:**
- Ensure you have configured a `GH_TOKEN` secret in your repository (**Settings > Secrets and variables > Actions**).
- The workflow triggers automatically on any tag push matching `v*`.

**What it does:**
1. Runs the full e2e suite first (release is blocked on green e2e).
2. Triggers parallel builds on Windows, Linux (x64 + ARM64), and macOS runners.
3. Compiles the Angular frontend.
4. Builds the Electron installers (`.exe`, `.AppImage`, `.deb`, `.dmg`/`.zip`).
5. Creates/Updates a GitHub Release and uploads all artifacts.

**Released packages:** https://github.com/invince/YAET-RELEASE

## Logs

Application logs can be found at:
- **Linux**: `~/.config/YetAnotherElectronTerm/logs/main.log`
- **macOS**: `~/Library/Logs/YetAnotherElectronTerm/main.log`
- **Windows**: `%USERPROFILE%\AppData\Roaming\YetAnotherElectronTerm\logs\main.log`

## Technology Stack

- **Frontend**: Angular 20, Angular Material
- **Desktop**: Electron 39
- **Terminal**: xterm.js
- **File Transfer**: ssh2 (SFTP), basic-ftp (FTP), v9u-smb2 (SMB)
- **Remote Desktop**: @novnc/novnc (VNC)
- **AI Integration**: OpenAI-compatible API, function calling (36 tools)
- **Protocols**: MCP (Model Context Protocol), ACP (Agent Communication Protocol)
- **Security**: AES encryption (main process, CryptoJS), system keychain (keytar), master key never exposed to renderer
- **Plugins**: Bundled + external plugin architecture with dynamic loading
