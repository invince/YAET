# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [7.2.4] - 2026-09-05 Sept review
### Security
- **Express `/api` auth hardening**: Missing/wrong token returns 403 (`timingSafeEqual`); loopback assertion; CORS whitelist (P0-S1)
- **Express loopback binding**: Listen on `127.0.0.1:13012` instead of `0.0.0.0` (P0-S2)
- **Master key never leaves renderer**: `masterkey.get` → `masterkey.exists` + `masterkey.match` (main process timing-safe comparison) + `crypto.encrypt/decrypt` (main process encryption); renderer CryptoJS dependency removed (P0-S5)
- **External plugin Phase 1-4 security hardening**: `npm install --ignore-scripts`; restricted IPC wrapper (manifest-declared channels only); restricted secretService wrapper; external plugins default `disabled` (must be explicitly enabled via `enabled.json`); manifest SHA-256 integrity check; optional HMAC-SHA256 signature; `secretService` filtered by `secretTypes`; `projectRequire` whitelist; CSP removes `unsafe-inline`/`unsafe-eval`, frontend blob URL loading (P0-S4)
- **local-file path traversal fix**: save-temp folder whitelist + resolve double assertion; open rejects executable extensions; read 2MB cap; watch limit 20 (P0-S6)
- **readFrontend path traversal fix**: charset + discovered ID set + resolve assertion (P0-S7)
- **customSession arbitrary binary fix**: Removed `parseCommand()`; switched to `shell:true` + `extractProgramName()` + `validateExecutable()`; process tracking + 5-minute timeout reaper (P0-S8)
- **AI secret/proxy privilege escalation fix**: `executeTool` ignores AI-passed `secretId/proxyId`, uses profile-bound credentials only; 16 tool schemas remove `secretId/proxyId` parameters; `listProfiles()` returns only `{id, name, type}` (P0-1)
- **AI terminal_open approval + chunk bypass fix**: `terminal_open` added to `SENSITIVE_TOOLS`; `*_write/delete/rename/copy/move/create/download` all go through approval; `_isDangerous` segments by `; && ||`/newlines, strips `sudo/su` + flags/`VAR=`/wrappers, basename comparison, fullwidth space normalization, regex try-wrap (P0-2)
- **AI download sandbox**: `localPath` must fall within download directory; base64 capped at 512KB (P0-3)
- **AI regex ReDoS protection**: `_sanitizeRules` pre-compiles: max 50 rules, nested quantifier heuristic discard, invalid discard (P0-4)
### Changed
- **File explorer factory**: SCP/SFTP/FTP/Samba four-file backend merged into `file-explorer-backend.factory` (eliminated ~300 lines of mirrored code)
- **VNC handler cleanup**: Removed redundant VNC handler code
- **SSH DEBUG log gating**: ssh2 `debug` callback now attached only when `SSH_DEBUG=1` and logged at `debug` level (off by default, no more wire-protocol log spam)
- **ai-chat styles split**: `ai-chat.component.scss` (695 lines) split into 7 partials (`_header`, `_history`, `_messages`, `_input`, `_message-content`, `_tools`, `_resize`); entry file only composes them via `@use`
### Added
- **AI function cancellation**: AbortController real cancel (loop + HTTP + tools); configurable 120s timeout; input param non-pollution; token budget cutoff (P1-1)
- **AI context optimization**: Single injection (agent backend increment/user pinned, chat-only bounded tail); fixed `ts/timestamp` increment dead bug (P1-2)
- **AI read binary protection**: NUL byte detection + 128KB truncation + configurable `maxBytes` (P1-3)
- **AI session alive probe unified**: `isSessionAlive` consolidated + `terminal_open` whitelist + `lastSentTimestamps` cleanup (P1-4)
- **ACP fixes**: Session key fix (prevents zombie processes) + `fetch-models` fix + buffer queue + system context (P1-5)
- **MCP `ssh_sudo_execute`**: New sudo execution tool
- **AI progress dedup**: Same tool+args updates in-place, no more chat flooding (P2)
- **AI approval preview**: `_getApprovalPreview` covers open/write/delete/copy/move/rename/mkdir/download (P2)
- **Profile field migration script**: `scripts/migrate-profile-fields.js` (+ `npm run migrate:profiles`) converts legacy flat profile fields (`sshProfile`, `sambaProfile`, …) into `profileData[profileType]`, re-encrypts and writes back; idempotent, supports `--dry-run`, resolves master key from `--master-key` / `YAET_MASTER_KEY` / keytar

## [7.2.3]
###
- MCP activation: add sudo tools.

## [7.2.2]
###
- MCP activation

## [7.2.1] - 2026-08-30
### Changed
- **Architecture Documentation**: Comprehensive update of all documentation to reflect the 4-layer architecture (Runtime, Plugin, Service, Adapter layers)
- Updated README.md and README.cn.md with architecture diagrams, plugin inventory, and MCP/ACP details
- Rewrote AI-Integration.md to reflect current plugin-based architecture
- Updated AI integration docs with accurate file paths and tool counts (33+ tools)

## [7.2.0] - 2026-08-15
### Added
- **MCP in Production Package**: MCP server source code (`src-protocol/`) now included in the production asar package
- **Docker Terminal Plugin**: External plugin example for Docker container management
- **S3 File Explorer Plugin**: External plugin example for Amazon S3 object storage
- **Serial Terminal Plugin**: Serial port terminal connection for hardware devices (routers, switches, embedded boards)
- **macOS Support**: Fixed macOS-specific issues for cross-platform compatibility
- **ARM64 Ubuntu Support**: Added ARM64 architecture support for Ubuntu builds

### Fixed
- Fixed double session opening issue
- Fixed WebDAV external plugin issues
- Fixed E2E test mock for securityService and runtime connectors

## [7.1.5] - 2026-07-20
### Changed
- MCP server packaging improvements
- E2E test fixes

## [7.1.0] - 2026-07-10
### Added
- **External Plugin Self-Managed Dependencies**: External plugins can now declare their own `package.json` with npm dependencies, automatically installed on startup
- **SPICE Remote Desktop Plugin**: External plugin example with self-managed `spice-client` dependency
- **WebDAV File Explorer Plugin**: External plugin example with backend REST API and Web Component frontend
- **First-Launch Plugin Installation**: Dialog offers to install example external plugins on first launch

### Changed
- External plugins that conflict with bundled plugin IDs are skipped for security (external plugins are disabled by default and must be explicitly enabled)
- Plugin manifest schema extended with `frontend.profileFormElement`, `supportedAuthTypes`, `secretTypes`

## [7.0.0] - 2026-06-29
### Added
- **Plugin System Architecture (Phase 2)**: Fully modularized the connection backends. Terminal connections (SSH, Telnet, WinRM, Local) and Remote Desktops (VNC, RDP) are now individual plugins.
- **External Plugin Dependencies**: Enabled external plugins to resolve their own npm dependencies (e.g., using `context.projectRequire` to dynamic-load backend libraries).
- **Dynamic Frontend Loading**: Support loading external plugin frontend components at runtime over IPC, avoiding the need to rebuild the main application.
- Added external plugin examples:
  - **WebDav** for Remote File Explorer.
  - **SPICE** for Remote Desktop.
- Refined automated E2E test suites to test dynamic plugin loading and sandbox environments.

## [6.0.0] - 2026-06-15
### Added
- **Plugin System Architecture (Phase 1)**: Modularized session profiles and UI forms into stand-alone plugin components.
- Introduced separation between bundled plugins (shipped in the app bundle) and external plugins (loaded from `~/.yaet/plugins/<id>`).

## [5.0.0] - 2026-05-20
### Added
- **AI Security & Permissions**: Added file system manipulation limits and validation for AI operations.
- Enhanced stability and mock configuration in Playwright E2E tests.

## [4.0.0] - 2026-05-01
### Added
- **Draggable Chat Panel**: Floating, resizable UI chat interface for the AI Assistant.
- **AI Thinking Visualization**: Visual display of the AI agent's internal thinking process and steps.
- **Session Context Injection**: Real-time terminal output and session metadata context injected into the AI queries for context-aware assistance.
- **UI/UX Modernization**: Transitioned stylesheets to SCSS, redesigned form fields, animated tab transitions, and improved sidebar responsiveness.

## [3.0.0] - 2026-03-10
### Added
- **AI Assistant Integration**: Support for LLMs via:
  - **Web Mode**: Custom OpenAI-compatible endpoint integration.
  - **ACP Mode**: Agent Client Protocol integration.
- **AI Agent Tools**: Enabled the AI to execute terminal commands, modify files, and perform actions autonomously.
- **Protocol AI Tools**: Built-in toolsets for SSH, Telnet, WinRM, FTP, SFTP/SCP, and SMB connections.

## [2.0.0] - 2025-11-15
### Added
- **Secrets Management**: Secure storage for passwords, private keys, and passphrases using the system keychain (Keytar), encrypted with a master key.
- **Cloud Sync**: End-to-end encrypted synchronization of connections, settings, and secrets using personal Git repositories.
- **Proxy Management**: Support for HTTP, SOCKS4, and SOCKS5 authenticated proxies.

## [1.0.0] - 2025-07-01
### Added
- **Unified Remote Connection Manager**: Centralized interface for SSH, Telnet, WinRM, and Local Terminal sessions.
- **Remote File Explorer**: Integrated SFTP, SCP, and FTP transfer capabilities.
- **Remote Desktop**: Embedded VNC and RDP remote viewer panels.
- Features including tabs, horizontal/vertical split screens, tag/group navigation, and customizable themes.
