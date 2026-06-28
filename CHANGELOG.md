# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
