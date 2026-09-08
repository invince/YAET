# Yet Another Electron Terminal (YAET)

[English](./README.md) | 简体中文

## 简介

YAET 是一款基于 Angular 和 Electron 构建的全能远程连接管理工具。它在一个统一界面中集成了远程服务器管理、命令执行、文件传输和远程桌面访问功能。

## 核心功能

### 🖥️ 终端连接
- **SSH**：安全的 Shell 连接，支持密钥和密码认证
- **Telnet**：传统 Telnet 协议支持
- **WinRM**：Windows Remote Management，用于 PowerShell 会话
- **串口终端**：串口终端连接，用于连接硬件设备（路由器、交换机、嵌入式开发板等），支持配置波特率、数据位、停止位、校验位和流控制
- **本地终端**：内置本地 Shell 访问（CMD、PowerShell、PowerShell 7、Bash）
- <img width="3552" height="2094" alt="screenshot" src="https://github.com/user-attachments/assets/6a55a46b-0dfe-46cd-bcf8-16967a791a5e" />
- <img width="3530" height="2190" alt="screenshot" src="https://github.com/user-attachments/assets/da9e3f0b-5b67-412d-b179-556899d9e120" />
- serial example: <img width="2871" height="1920" alt="image" src="https://github.com/user-attachments/assets/6ad9f9b7-854e-4cef-a780-73e5981bca03" />

### 📁 远程文件浏览器
- **SCP/SFTP**：基于 SSH 的安全文件传输
- **FTP**：标准 FTP 协议支持
- **SMB/SAMBA**：Windows 文件共享协议
- **WebDav**：外部插件示例。基于 Web 的分布式创作和版本控制。
- **S3**：Amazon Simple Storage Service（S3）是 Amazon Web Services (AWS) 提供的对象存储服务，通过 Web 服务接口提供存储功能。
- s3 example: <img width="3330" height="969" alt="image" src="https://github.com/user-attachments/assets/aa4d5122-9230-47e3-850e-4c15ed3a62e7" />

### 🖼️ 远程桌面
- **VNC**：Virtual Network Computing 远程桌面访问
- **RDP**：远程桌面协议（Windows）
- **SPICE**：外部插件示例。Simple Protocol for Independent Computing Environments — 为虚拟化环境构建的远程显示系统

- vnc example <img width="3540" height="2177" alt="image" src="https://github.com/user-attachments/assets/6d73f239-5061-42d9-bc66-d4ed000843a7" />
- spice example <img width="3300" height="1677" alt="image" src="https://github.com/user-attachments/assets/749d8391-921c-4f6f-8369-0607774477c7" />

### ⚡ 自定义命令
- 创建你自己的自定义命令/连接
- <img width="2809" height="2035" alt="screenshot" src="https://github.com/user-attachments/assets/0269e8f0-5f74-4bff-a590-0d6172f93e17" />

### 🔐 密钥管理
- 使用系统密钥链加密存储密码
- SSH 密钥管理，支持密码短语
- 凭据可在多个配置文件中复用
- 支持用户名/密码和 SSH 密钥两种认证方式
- 修改主密钥时，所有加密文件在主进程中原子重加密（绝不使用渲染器内存数据）
- 请备份 `~/.yaet/`：如果密钥链里的密钥与文件对不上，所有解密会报 `Malformed UTF-8 data` / `No master key defined` —— 此时先恢复文件，再把对应时期的主密钥放回密钥链（删除后走首次设置流程）；密钥对不上时不要保存、不要 Force Continue，否则空数据会覆盖好文件
- <img width="2879" height="1653" alt="screenshot" src="https://github.com/user-attachments/assets/3ea5f344-2c70-4eb9-a310-bca7f8451cd1" />

### ☁️ 云端同步
- 通过你自己的 Git 仓库（GitHub、GitLab 或自建的 Git 服务器均可）跨设备同步配置文件和设置（全部通过系统密钥链加密）。我们不提供云端同步服务，一切由你掌控。
- 无缝多设备工作流
- <img width="2366" height="2058" alt="screenshot" src="https://github.com/user-attachments/assets/48432c20-cabc-44e5-86ac-83c30c7bca71" />

### 🏗️ 架构

YAET 采用**四层架构**，分离关注点并支持多协议访问：

```
┌─────────────────────────────────────────────────────────────────┐
│                    接口层 (适配器)                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Electron  │  │AI Chat   │  │MCP Server│  │ACP Server    │   │
│  │ IPC 适配器│  │(36 工具) │  │(stdio)   │  │(stdin/stdout)│   │
│  └─────┬─────┘  └─────┬────┘  └─────┬────┘  └──────┬───────┘   │
│        └───────────────┴─────────────┴──────────────┘           │
├─────────────────────────────────────────────────────────────────┤
│                    运行时层 (逻辑)                               │
│  ┌────────────┐ ┌───────────────┐ ┌──────────────────────┐     │
│  │ RuntimeAPI │ │SessionRegistry│ │ApprovalManager       │     │
│  │(门面)      │ │(AI 上下文)    │ │(命令审批)            │     │
│  └─────┬──────┘ └───────────────┘ └──────────────────────┘     │
├─────────────────────────────────────────────────────────────────┤
│                    插件层 (连接器)                               │
│  ┌──────┐┌──────┐┌──────┐┌──────┐┌─────┐┌─────┐┌─────┐       │
│  │ SSH  ││Telnet││WinRM ││Serial││SCP  ││FTP  ││VNC  │ ...   │
│  └──────┘└──────┘└──────┘└──────┘└─────┘└─────┘└─────┘       │
├─────────────────────────────────────────────────────────────────┤
│                    服务层 (基础设施)                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ConfigService│ │SecuritySvc │ │ProxyService│ │CloudService│  │
│  │JSON 读写    │ │加密        │ │SOCKS/HTTP  │ │Git 同步    │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

- **运行时层**零 Electron 依赖 — 所有适配器共享
- **插件层**使所有连接类型可互换和可扩展
- **适配器层**是薄协议桥接 — 添加新接口只需添加新适配器
- **凭据永不暴露给 AI** — 只有配置 ID 跨进程边界

### 🎨 其他特性
- 多标签页界面，支持多个并发连接
- 分屏视图（垂直和水平），用于并排会话
- 连接配置文件，支持自定义分组和标签
- 网络中断后自动重连
- 可自定义主题和配色方案
- 平铺和树形两种视图模式浏览配置文件

### 🌐 代理管理
- **HTTP / SOCKS4 / SOCKS5**：为需要通过代理的连接配置代理服务器
- **认证代理**：可从密钥管理中复用凭据进行代理认证
- **按配置文件分配**：可为每个连接配置文件指定独立代理

### 🤖 AI 助手
- **两种提供商模式**：
  - **Web 模式**：通过 URL 和 API Key 连接任意 OpenAI 兼容 API（OpenAI、本地 LLM 等）
- **代理模式**：允许 AI 直接在终端中执行命令，实现自主问题解决
- **36 AI 工具**：配置管理、终端执行、SCP/FTP/Samba 文件操作、会话管理
- **上下文感知**：可就当前终端输出或特定会话上下文提问
- **命令审批**：危险命令需要用户批准后才能执行
- **持久聊天记录**：管理多个聊天会话，支持持久存储、重命名和历史追踪
- **可拖拽聊天面板**：可调整大小和位置的浮动聊天窗口

### 🔌 MCP / ACP 协议服务器

**MCP 服务器 (Model Context Protocol)**：
- **源码运行**：运行 `npm run mcp`（即 `node src-protocol/cli.js mcp`）启动 MCP 服务器（stdio 传输）
- **打包后运行**：安装好的二进制直接支持，无需 wrapper 脚本（源码留在 asar 内）：`~/.local/bin/YetAnotherElectronTerm.AppImage --mcp`
- **无头启动参数**：被 agent 拉起时（无显示器）需加 Electron 参数：`--mcp --no-sandbox --ozone-platform=headless`
- **主密钥**：无头环境没有系统密钥链，启动前必须 `export YAET_MASTER_KEY`（或 `YAET_MASTER_KEY_FILE` 指向 0600 权限文件），否则无法解密 profile
- **工具（8 个）**：`ssh_execute`、`ssh_sudo_execute`、`scp_list_files`、`scp_read_file`、`scp_write_file`、`scp_delete_file`、`local_execute`、`yaet_profiles`
- **凭据解析**：支持 YAET 配置文件名（从加密存储解析）或手动传入 host/username/password
- **已验证**：Hermes agent ✅

**ACP 服务器 (Agent Communication Protocol)**：
- **独立模式**：运行 `npm run acp` 启动 ACP 服务器（stdin/stdout）
- **会话管理**：创建、提示、关闭会话
- **相同工具集**：与 MCP 服务器共享工具

主密钥绝不进聊天上下文——通过环境变量传入 MCP 服务器的 `env` 块。以下两种方式都直接指向安装好的 YAET 二进制（解析顺序为 `YAET_MASTER_KEY` → `YAET_MASTER_KEY_FILE` → 系统密钥链）：

**场景 1 — 明文环境变量（最简单，agent 托管）**：在 agent 自身环境（`~/.hermes/.env`）里 `export YAET_MASTER_KEY`，再在 MCP 条目中引用：

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

**场景 2 — 密钥文件（`YAET_MASTER_KEY_FILE`，Docker / systemd 友好）**：把主密钥放进一个 `0600` 权限文件，用环境变量指向它。适用于 systemd `LoadCredential` 与 Docker secrets——这类场景把密钥作为文件而非环境变量注入：

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

用下面任一种方式提供该文件（挂载的文件内容必须与加密 `~/.yaet/profiles.json` 的主密钥一致）：

```yaml
# docker-compose.yml — 以文件形式挂载 secret
services:
  yaet:
    command: /opt/YetAnotherElectronTerm/yet-another-electron-term --mcp --no-sandbox --ozone-platform=headless
    environment:
      YAET_MASTER_KEY_FILE: /run/secrets/yaet_master_key
    secrets:
      - yaet_master_key
secrets:
  yaet_master_key:
    file: /path/to/0600/keyfile   # chmod 600；末尾换行会被剥离
```

```ini
# systemd 单元 — LoadCredential 把文件注入 /run/credentials/yaet.service/yaet_master_key
[Service]
Environment=YAET_MASTER_KEY_FILE=/run/credentials/yaet.service/yaet_master_key
LoadCredential=yaet_master_key:/etc/yaet/yaet_master_key
```

**无头 CLI（只读摆渡）**：无桌面机器上按 `masterkey set` → `cloud download` → `doctor` → `mcp` 四步摆渡后开服。完整流程与命令手册见 [docs/headless-cli.md](docs/headless-cli.md)。

### 🧩 插件系统
- **模块化架构**：每种连接类型都是独立的插件，包含清单、后端和前端
- **10 个内置插件**：SSH、Telnet、WinRM、串口、SCP、SFTP、FTP、Samba、VNC、RDP — 位于 `plugins/` 目录
- **外部插件**：安装第三方插件到 `~/.yaet/plugins/<id>/` — 默认禁用，需用户通过 `pluginManager.enablePlugin(id)` 显式启用。与内置插件 ID 冲突的外部插件会被跳过以确保安全
- **自包含后端**：外部插件通过 `context.projectRequire()` 或自管理的 `package.json` 解析 npm 依赖
- **动态前端加载**：外部插件的前端 bundle 在运行时通过 IPC 加载 — 无需重新构建
- **共享 UI**：插件可以复用核心组件，如 `TerminalComponent`、`FileExplorerComponent` 和 `RemoteTerminalProfileFormComponent`
- **4 个示例插件**：参见 [`ext-plugins-example/`](ext-plugins-example/) — WebDAV、SPICE、S3、Docker
- 详见 [docs/plugin-development.md](docs/plugin-development.md) 了解如何编写自己的插件

## 环境要求

- **Node.js**：v20.19+ 或 v22.12+ 或 v24+
- **Angular CLI**：20.3.x
- **Python 3.x**：原生模块编译所需
  - **注意**：如果使用 Python 3.13+，必须先安装 setuptools：`pip install setuptools`
- **构建工具**（Windows）：
  - Visual Studio Build Tools，勾选"使用 C++ 的桌面开发"工作负载
  - 或者：`npm install --global --production windows-build-tools`（旧方法）

## 环境搭建

### 初始化

1. **克隆仓库**
   ```bash
   git clone <repository-url>
   cd yaet
   ```

2. **安装依赖**（首次运行需要管理员权限以创建符号链接）
   ```bash
   npm install
   ```

### 快速安装（Linux）

Linux 用户只需运行以下命令即可下载最新 AppImage 并集成到桌面环境：

```bash
curl -sSL https://raw.githubusercontent.com/invince/YAET/master/install.sh | bash
```

3. **重新编译原生模块**（安装失败时执行）
   ```bash
   npm run rebuild-native
   ```

## 开发

### 本地开发

**方式一：单一命令**
```bash
npm run start
```
启动前会自动生成插件 barrel 文件。

**方式二：分离进程**（推荐用于调试）
```bash
# 先生成插件 barrel 文件
npm run generate-plugin-barrel

# 终端 1：Angular 开发服务器
npm run ng:serve

# 终端 2：Electron 应用
npm run electron:dev
```

> **注意：** 修改插件代码后，需重新运行 `npm run generate-plugin-barrel` 或重启 `npm run start`。

> **开发/生产隔离：** 本地开发构建（`NODE_ENV=development`，即 `npm start` / `npm run electron:dev`）使用隔离的数据目录（`~/.yaet-debug`）和隔离的系统密钥链条目，测试不会触碰生产环境的 `~/.yaet` 文件和主密钥。开发工作区首次启动是空的——在里面设置一次主密钥即可。用 `NODE_ENV=development npm run mcp` 可让 MCP 服务器读取调试数据。

### 安装 Electron 依赖后

如果你安装的任何 npm 包被 Electron 主进程使用：
```bash
npm run rebuild-native
```

## 测试

### 单元测试

```bash
npm test
```

单元测试覆盖领域模型、管道、工具函数和服务层。使用 Jasmine + Karma 实现。

### E2E 测试

E2E 测试使用 **Playwright + Electron**，在编译后的 Angular 构建上运行完整的 Electron 应用实例。测试验证 UI 交互、IPC 通信和 CRUD 流程。

```bash
# 运行 E2E 测试（默认无头模式）
npm run test:e2e

# 运行 E2E 测试（显示窗口，用于调试）
npm run test:e2e:headed

# 运行单个测试文件
npx playwright test e2e/_2_master_key_secrets.spec.ts

# 按模式匹配运行测试
npx playwright test -g "add Password Only"
```

**工作原理：**
- 先编译 Angular（`ng build`），然后 Electron 加载编译产物
- 每个测试使用独立的临时目录启动全新 Electron 实例
- 模拟密钥链（[`security.mock.js`](src-electron/adapter/ipc/security.mock.js)）替代操作系统密钥链 —— 不接触系统凭据。仅在 e2e 测试中通过 [`electronMain.e2e.js`](src-electron/electronMain.e2e.js) 加载（在 `require.cache` 中拦截真实 `security.js`）；生产应用始终使用真实系统密钥链（keytar）。
- 测试默认**无头**运行。设置 `YAET_SHOW_WINDOW=1` 可显示窗口
- CI 在每次版本标签（`v*`）推送时先跑全量 E2E（绿了才发布，[`.github/workflows/build.yml`](.github/workflows/build.yml)）；该套件同样跑在沙盒渲染器下，覆盖生产安全姿态

**当前覆盖（139 个 E2E 测试）：**

| 模块 | 测试数 | 状态 |
|---------|-------|--------|
| 1. 应用启动 | 7 | ✅ |
| 2. 主密钥与密钥管理 | 19 | ✅ |
| 3. 设置菜单 | 29 | ✅ |
| 3. 不兼容设置 | 4 | ✅ |
| 4. 配置文件 | 11 | ✅ |
| 5. 本地终端（UI + 真 PTY） | 4 | ✅ |
| 5. 主密钥重加密（原子操作，主进程） | 1 | ✅ |
| 6. UI/UX | 7 | ✅ |
| 7. 代理管理 | 4 | ✅ |
| 8. 云端设置 | 4 | ✅ |
| 9. 安全审查（P0） | 9 | ✅ |
| 10. AI 聊天面板 | 22 | ✅ |
| 11. AI 设置 | 18 | ✅ |

完整测试计划参见 [TestPlanE2E.md](./TestPlanE2E.md)。

## 构建与发布

### 构建安装包

```bash
npm run build
```

这会在 `dist` 目录中生成可分发的安装包。

### 发布到 GitHub

发布现已通过 **GitHub Actions** 自动化。

**重要**：创建发布标签前，必须手动升级 [`package.json`](package.json) 中的版本号。GitHub Action 会使用 `package.json` 中的版本号来构建和命名发布产物。

1.  **更新版本**：修改 [`package.json`](package.json) 中的 `"version"` 字段。
2.  **提交、打标签并推送**：
    ```bash
    git add package.json
    git commit -m "chore: bump version to v7.x.x"
    git tag v7.x.x
    git push && git push --tags
    ```

**前置条件：**
- 确保已在仓库中配置 `GH_TOKEN` 密钥（**Settings > Secrets and variables > Actions**）。
- 工作流在推送任何匹配 `v*` 的标签时自动触发。

**工作流内容：**
1. 先跑全量 E2E（绿了才继续发布）。
2. 在 Windows、Linux（x64 + ARM64）、macOS 运行器上触发并行构建。
3. 编译 Angular 前端。
4. 构建 Electron 安装包（`.exe`、`.AppImage`、`.deb`、`.dmg`/`.zip`）。
5. 创建/更新 GitHub Release 并上传所有产物。

**发布包地址：** https://github.com/invince/YAET-RELEASE

## 日志

应用日志位于：
- **Linux**：`~/.config/YetAnotherElectronTerm/logs/main.log`
- **macOS**：`~/Library/Logs/YetAnotherElectronTerm/main.log`
- **Windows**：`%USERPROFILE%\AppData\Roaming\YetAnotherElectronTerm\logs\main.log`

## 技术栈

- **前端**：Angular 20、Angular Material
- **桌面**：Electron 39
- **终端**：xterm.js
- **文件传输**：ssh2 (SFTP)、basic-ftp (FTP)、v9u-smb2 (SMB)
- **远程桌面**：@novnc/novnc (VNC)
- **AI 集成**：OpenAI 兼容 API、函数调用（36 工具）
- **协议**：MCP (Model Context Protocol)、ACP (Agent Communication Protocol)
- **安全**：AES 加密（主进程内，CryptoJS）、系统密钥链 (keytar)、主密钥永不出渲染器
- **插件**：内置 + 外部插件架构，支持动态加载
