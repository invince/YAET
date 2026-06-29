# Yet Another Electron TerminalHandler (YAET)

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

### 🖼️ 远程桌面
- **VNC**：Virtual Network Computing 远程桌面访问
- **SPICE**：Simple Protocol for Independent Computing Environments，为虚拟化环境构建的远程显示系统
- **RDP**：远程桌面协议（Windows）
- <img width="3540" height="2177" alt="screenshot" src="https://github.com/user-attachments/assets/6d73f239-5061-42d9-bc66-d4ed000843a7" />
- <img width="3300" height="1677" alt="screenshot" src="https://github.com/user-attachments/assets/749d8391-921c-4f6f-8369-0607774477c7" />

### ⚡ 自定义命令
- 创建你自己的自定义命令/连接
- <img width="2809" height="2035" alt="screenshot" src="https://github.com/user-attachments/assets/0269e8f0-5f74-4bff-a590-0d6172f93e17" />

### 🔐 密钥管理
- 使用系统密钥链加密存储密码
- SSH 密钥管理，支持密码短语
- 凭据可在多个配置文件中复用
- 支持用户名/密码和 SSH 密钥两种认证方式
- <img width="2879" height="1653" alt="screenshot" src="https://github.com/user-attachments/assets/3ea5f344-2c70-4eb9-a310-bca7f8451cd1" />

### ☁️ 云端同步
- 通过你自己的 Git 仓库（GitHub、GitLab 或自建的 Git 服务器均可）跨设备同步配置文件和设置（全部通过系统密钥链加密）。我们不提供云端同步服务，一切由你掌控。
- 无缝多设备工作流
- <img width="2366" height="2058" alt="screenshot" src="https://github.com/user-attachments/assets/48432c20-cabc-44e5-86ac-83c30c7bca71" />

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
  - **ACP 模式**：通过 Agent Client Protocol 集成 AI 代理，实现自动化终端交互
- **代理模式**：允许 AI 直接在终端中执行命令，实现自主问题解决
- **上下文感知**：可就当前终端输出或特定会话上下文提问
- **持久聊天记录**：管理多个聊天会话，支持持久存储、重命名和历史追踪
- **可拖拽聊天面板**：可调整大小和位置的浮动聊天窗口

### 🧩 插件系统
- **模块化架构**：每种连接类型（SSH、Telnet、WinRM 等）都是独立的插件
- **内置插件**：随应用一起发布，位于 `plugins/` 目录 — 开箱即用
- **外部插件**：安装第三方插件到 `~/.yaet/plugins/<id>/` — 如果 id 相同，会自动覆盖内置插件
- **自包含后端**：外部插件通过 `context.projectRequire` 从项目的 `node_modules` 解析 npm 依赖（如 `ssh2`）
- **动态前端加载**：外部插件的前端 bundle 在运行时通过 IPC 加载 — 无需重新构建
- **共享 UI**：插件可以复用核心组件，如 `TerminalComponent` 和 `RemoteTerminalProfileFormComponent`
- **示例**：参见 [`ext-plugins-example/`](ext-plugins-example/) 获取一个可工作的外部 SSH 插件示例
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

**方式二：分离进程**（推荐用于调试）
```bash
# 终端 1：Angular 开发服务器
npm run ng:serve

# 终端 2：Electron 应用
npm run electron:dev
```

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
- 模拟密钥链（[`security.mock.js`](src-electron/adapter/ipc/security.mock.js)）替代操作系统密钥链 —— 不接触系统凭据
- 测试默认**无头**运行。设置 `YAET_SHOW_WINDOW=1` 可显示窗口
- CI 在每次 PR/推送（[`.github/workflows/e2e.yml`](.github/workflows/e2e.yml)）和每次发布前运行 E2E

**当前覆盖（97 个测试）：**

| 模块 | 测试数 | 状态 |
|---------|-------|--------|
| 0. 应用启动 | 4 | ✅ |
| 1. 应用初始化 | 7 | ✅ |
| 2. 主密钥与密钥管理 | 19 | ✅ |
| 3. 设置菜单 | 29 | ✅ |
| 4. 不兼容设置 | 4 | ✅ |
| 5. 配置文件 | 11 | ✅ |
| 6. 本地终端 | 3 | ✅ |
| 7. UI/UX | 7 | ✅ |
| 8. 代理管理 | 4 | ✅ |
| 9. 云端设置 | 4 | ✅ |

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
    git commit -m "chore: bump version to v5.x.x"
    git tag v5.x.x
    git push && git push --tags
    ```

**前置条件：**
- 确保已在仓库中配置 `GH_TOKEN` 密钥（**Settings > Secrets and variables > Actions**）。
- 工作流在推送任何匹配 `v*` 的标签时自动触发。

**工作流内容：**
1. 在 Windows 和 Linux（Ubuntu）运行器上触发并行构建。
2. 编译 Angular 前端。
3. 构建 Electron 安装包（`.exe`、`.AppImage`、`.deb`）。
4. 创建/更新 GitHub Release 并上传所有产物。

**发布包地址：** https://github.com/invince/YAET-RELEASE

## 日志

应用日志位于：
- **Linux**：`~/.config/{应用名称}/logs/main.log`
- **macOS**：`~/Library/Logs/{应用名称}/main.log`
- **Windows**：`%USERPROFILE%\AppData\Roaming\{应用名称}\logs\main.log`

## 技术栈

- **前端**：Angular 20、Angular Material
- **桌面**：Electron 39
- **终端**：xterm.js
- **文件传输**：ssh2、basic-ftp、v9u-smb2
- **远程桌面**：@novnc/novnc
- **AI 集成**：Agent Client Protocol (ACP) 或 OpenAI 提供商
