# YAET UI/UX 优化计划

> 基于项目分析生成的优化路线图，按优先级排列，逐个处理。

---

## 项目概况

- **框架**: Angular 20.3.x + Electron 39.8.10
- **UI 库**: Angular Material 20.2.x (MDC-based)
- **样式**: SCSS + CSS 混用（需统一）
- **主题**: 4 套预设主题（2 深色 + 2 浅色），使用 CSS 自定义属性
- **国际化**: 5 种语言 (en, de, fr, es, zh)

---

## 高优先级

### 1. 统一样式方案 & 设计令牌系统

**问题**:
- 混用 `.css` 和 `.scss` 文件，无明确规范
- 颜色、间距、圆角等硬编码散落在各组件
- 无统一的设计令牌（Design Tokens）

**具体任务**:
- [x] 1.1 将所有 `.css` 组件样式迁移为 `.scss`（19 个文件完成迁移）
- [x] 1.2 创建 `src/styles/_tokens.scss` 设计令牌文件
  - 颜色令牌：`$color-primary`, `$color-accent`, `$color-bg`, `$color-surface`, `$color-text`, `$color-border` 等
  - 间距令牌：`$spacing-xs`, `$spacing-sm`, `$spacing-md`, `$spacing-lg`, `$spacing-xl`
  - 圆角令牌：`$radius-sm`, `$radius-md`, `$radius-lg`
  - 阴影令牌：`$shadow-sm`, `$shadow-md`, `$shadow-lg`
  - 字体令牌：`$font-family-base`, `$font-family-mono`, `$font-size-*`
- [x] 1.3 消除以下组件中的硬编码颜色：
  - `terminal.component.scss`: `black`, `#2d2d2d`, `#424242`, `#e0e0e0`
  - `ai-chat.component.scss`: `#1e1e1e`, `#333`, `#007acc`, `#252526`, `#ff5252`
  - `modal.scss`: `#fff`, `#A9A9A9`, `#696969`, `#1976d2`, `#f44336`
  - `app.component.css`: `#3f51b5`
  - 额外修复：`file-list`、`proxy-menu`、`setting-menu`、`secrets-menu`、`profiles-menu`、`quickconnect-menu`、`cloud`、`ai-chat` 等组件
- [x] 1.4 统一组件使用 `styleUrls` 数组或 `styleUrl` 单文件的规范

**涉及文件**:
- `src/styles.scss`
- `src/styles/_tokens.scss` (新建)
- `src/app/components/**/*.css` → `.scss`
- `src/app/components/**/*.scss`

---

### 2. 主题系统修复

**问题**:
- `modal.scss` 使用硬编码浅色主题颜色，与深色主题冲突
- 部分组件未使用 CSS 自定义属性
- Sidebar 中 10+ 处 `!important` 覆盖 Material 样式

**具体任务**:
- [x] 2.1 修复 `modal.scss` 使其响应主题变量
- [x] 2.2 确保所有组件背景/文字/边框使用 `var(--app-*)` 变量（terminal、ai-chat、file-list、proxy-menu、setting-menu、secrets-menu 等已修复）
- [x] 2.3 重构 sidebar 布局，消除 `!important`（`mat-mini-fab` → `mat-icon-button`，消除 10+ 处 `!important`）
- [x] 2.4 检查并修复 `terminal.component.scss` 的 `ViewEncapsulation.None` 导致的样式泄漏（改为 `ShadowDom` 并配合 `::ng-deep` 穿透）

**涉及文件**:
- `src/modal.scss`
- `src/styles.scss`
- `src/app/components/sidebar/sidebar.component.css`
- `src/app/components/terminal/terminal.component.scss`

---

### 3. 模态框/对话框美化

**问题**:
- 模态框样式不统一
- 无 backdrop blur 效果
- Settings 固定 900x680px，无响应式适配
- 缺少统一的过渡动画

**具体任务**:
- [x] 3.1 添加 backdrop blur 背景模糊（`styles.scss` 全局 dialog backdrop 样式）
- [x] 3.2 统一模态框圆角、阴影、内边距（通过 `_tokens.scss` 设计令牌 + 全局 dialog 样式在 `styles.scss` 中设定了主题感知的圆角/阴影/背景色）
- [x] 3.3 添加打开/关闭过渡动画（`menuAnimation` 已存在，用于 modal 切换的 slideInOut 动画）
- [x] 3.4 实现响应式模态框（max-width/max-height + media queries：`.modal` 改为 `max-width: 920px / max-height: 85vh`，`min-width: 500px`；`.settings-container` 去除固定 `900x680px` 改用响应式尺寸；`<640px` 断点全屏）
- [x] 3.5 优化模态框头部样式（统一标题、关闭按钮样式：新增 `.modal-close-btn` 类替代泛型 `button` 选择器，紧凑 28px 圆形按钮，hover 背景色微交互，标题 text-overflow ellipsis）

**涉及文件**:
- `src/modal.scss`
- `src/app/components/menu/setting-menu/`
- `src/app/components/menu/profiles-menu/`
- `src/app/components/menu/secrets-menu/`
- `src/app/components/menu/quickconnect-menu/`
- `src/app/components/dialog/`

---

## 中优先级

### 4. 标签页优化

**问题**:
- 标签文本截断仅 10 字符
- 拖拽排序缺少视觉反馈
- 无空标签状态提示

**具体任务**:
- [x] 4.1 增加标签文本截断长度至 15-20 字符（CSS `text-overflow: ellipsis` + `max-width: 120px`，配合 `matTooltip` 显示完整名称）
- [x] 4.2 添加 tooltip 显示完整标签名
- [x] 4.3 优化拖拽时的视觉反馈（添加 `tab-drop-indicator` 竖线指示放置位置，`tab-dragging` 降低透明度）
- [x] 4.4 添加空标签页状态提示（`tab-empty-state` 组件，带图标和 i18n 多语言支持）

**涉及文件**:
- `src/app/components/` (tab 相关组件)
- `src/app/app.component.html`

---

### 4.5 Profile 页面国际化

**问题**:
- Profile 表单标签和选项使用硬编码英文
- 下拉选项（Category、ConnectionType、AuthType）未翻译
- 缺少中/德/法/西语支持

**具体任务**:
- [x] 4.5.1 在 5 个语言文件（en, zh, de, fr, es）中添加 14+ 个翻译 key（profile 及子表单字段、按钮、验证消息）
- [x] 4.5.2 Profile 表单模板使用 `translate` pipe 替换硬编码文本
- [x] 4.5.3 实现 Category/ConnectionType 动态值翻译方法（`translateCategory`、`translateConnectionType`）
- [x] 4.5.4 AuthType 单选按钮标签翻译
- [x] 4.5.5 确保所有子表单（SSH、Telnet、RDP、VNC、Mosh、Serial）键名在翻译文件中完整覆盖

**涉及文件**:
- `src/assets/i18n/*.json`
- `src/app/components/menu/profile-form/`
- `src/app/components/menu/profile-form/sub-forms/*`

---

### 4.6 Cloud 同步表单国际化

**问题**:
- Cloud 同步表单标签和选项使用硬编码英文
- 下拉选项（AuthType、Sync Items）未翻译
- 缺少中/德/法/西语支持

**具体任务**:
- [x] 4.6.1 在 5 个语言文件（en, zh, de, fr, es）中添加 CLOUD 翻译 key（标题、字段、按钮、验证消息、同步项）
- [x] 4.6.2 Cloud 表单模板使用 `translate` pipe 替换硬编码文本
- [x] 4.6.3 实现 AuthType 动态值翻译方法（`translateAuthType`）
- [x] 4.6.4 Sync Items（Setting/Profile/Secret/Proxy）动态翻译
- [x] 4.6.5 上传/下载通知消息国际化

**涉及文件**:
- `src/assets/i18n/*.json`
- `src/app/components/menu/cloud/cloud.component.ts`
- `src/app/components/menu/cloud/cloud.component.html`

---

### 4.7 新式控制流语法迁移

**问题**:
- 模板中混用旧式结构指令（`*ngIf`、`*ngFor`）与新式语法（`@if`、`@for`、`@switch`）
- Angular 17+ 推荐使用新式控制流语法，性能更好、类型检查更严格

**具体任务**:
- [x] 4.7.1 `file-list.component.html` — 11 处 `*ngIf` + 1 处 `*ngFor` → `@if`/`@for`（含 `@if`/`@else` 重构）
- [x] 4.7.2 `setting-menu.component.html` — 8 处 `*ngIf` → `@if`
- [x] 4.7.3 `proxy-form.component.html` — 5 处 `*ngIf` → `@if`
- [x] 4.7.4 `app.component.html` — 1 处 `*ngIf` → `@if`
- [x] 4.7.5 `terminal.component.html` — 1 处 `*ngIf` → `@if`
- [x] 4.7.6 `file-creator-dialog.component.html` — 1 处 `*ngIf` → `@if`
- [x] 4.7.7 `profile-form.component.html` — 1 处 `*ngFor` → `@for`

**涉及文件**:
- `src/app/components/file-explorer/custom/file-list.component.html`
- `src/app/components/menu/setting-menu/setting-menu.component.html`
- `src/app/components/menu/proxy-menu/proxy-form/proxy-form.component.html`
- `src/app/app.component.html`
- `src/app/components/terminal/terminal.component.html`
- `src/app/components/file-explorer/custom/file-creator-dialog.component.html`
- `src/app/components/menu/profile-form/profile-form.component.html`

---

### 5. AI 聊天面板优化

**问题**:
- 固定位置 350x500px，不可拖拽/调整大小
- 消息气泡样式需优化
- 缺少打字指示器

**具体任务**:
- [x] 5.1 实现可拖拽功能（鼠标在 header 上拖拽，限制在视口内，位置持久化到 localStorage）
- [x] 5.2 实现可调整大小功能（右下角拖拽手柄，范围 280-600px 宽 × 300-800px 高，持久化到 localStorage）
- [x] 5.3 优化消息气泡样式（新增 avatar 图标 + role 标签，气泡阴影，滚动条样式，代码块优化）
- [x] 5.4 添加打字指示器动画（3 点弹跳动画替代 spinner）
- [x] 5.5 优化会话历史下拉菜单样式（活跃项蓝色指示条，入场动画，改进滚动条，hover 交互增强）

**涉及文件**:
- `src/app/components/ai-chat/ai-chat.component.ts`
- `src/app/components/ai-chat/ai-chat.component.scss`
- `src/app/components/ai-chat/ai-chat.component.html`

---

### 6. 侧边栏 & 导航优化

**问题**:
- 图标按钮缺少 tooltip 提示
- 激活状态视觉反馈不够明显
- 无可折叠功能

**具体任务**:
- [ ] 6.1 为所有侧边栏图标添加 tooltip
- [ ] 6.2 优化激活状态视觉反馈（指示条、背景色等）
- [ ] 6.3 实现侧边栏可折叠功能（可选）
- [ ] 6.4 添加 hover 微交互效果

**涉及文件**:
- `src/app/components/sidebar/sidebar.component.ts`
- `src/app/components/sidebar/sidebar.component.html`
- `src/app/components/sidebar/sidebar.component.css`

---

### 7. 表单体验优化

**问题**:
- Profile form 固定宽度 300px+300px
- 缺少表单加载状态/保存反馈
- 验证错误提示样式不统一

**具体任务**:
- [ ] 7.1 Profile form 改为响应式 CSS Grid 布局
- [ ] 7.2 添加表单保存加载状态（spinner + 禁用按钮）
- [ ] 7.3 统一验证错误提示样式
- [ ] 7.4 添加成功保存的 toast 反馈

**涉及文件**:
- `src/app/components/menu/profile-form/`
- `src/app/components/menu/setting-menu/`

---

## 低优先级

### 8. 动画系统增强

**问题**:
- 当前仅 menu 和 tab 有动画
- 缺少面板切换、微交互动画

**具体任务**:
- [ ] 8.1 创建统一动画配置文件 `src/animations/`
- [ ] 8.2 添加模态框打开/关闭过渡
- [ ] 8.3 添加面板切换动画
- [ ] 8.4 添加按钮 hover/click 微交互
- [ ] 8.5 添加列表项进入/离开动画

**涉及文件**:
- `src/animations/` (扩展现有)
- 各组件 TypeScript/SCSS 文件

---

### 9. 空状态设计

**问题**:
- 无标签页、无配置文件、无密钥等场景无友好提示

**具体任务**:
- [ ] 9.1 设计空状态组件
- [ ] 9.2 应用到标签页区域
- [ ] 9.3 应用到配置文件列表
- [ ] 9.4 应用到密钥管理
- [ ] 9.5 应用到文件浏览器

**涉及文件**:
- `src/app/components/empty-state/` (新建)
- 各相关组件

---

### 10. 可访问性 (a11y)

**问题**:
- 缺少 ARIA 标签
- 无键盘快捷键支持
- 焦点管理不完善

**具体任务**:
- [ ] 10.1 为交互元素添加 ARIA 标签
- [ ] 10.2 实现键盘快捷键系统
- [ ] 10.3 添加快捷键提示面板
- [ ] 10.4 优化模态框焦点陷阱
- [ ] 10.5 确保颜色对比度符合 WCAG 标准

**涉及文件**:
- 全局模板文件
- `src/app/services/shortcut.service.ts` (可能需要新建)

---

## 执行顺序建议

```
阶段 1: 基础建设
  → 1. 统一样式方案 & 设计令牌系统
  → 2. 主题系统修复

阶段 2: 核心组件美化
  → 3. 模态框/对话框美化
  → 4. 标签页优化
  → 5. AI 聊天面板优化

阶段 3: 交互体验提升
  → 6. 侧边栏 & 导航优化
  → 7. 表单体验优化
  → 8. 动画系统增强

阶段 4: 完善与打磨
  → 9. 空状态设计
  → 10. 可访问性
```

---

## 进度追踪

| 任务 | 状态 | 备注 |
|------|------|------|
| 1. 统一样式方案 & 设计令牌 | ✅ 已完成 | 19个CSS→SCSS迁移，tokens系统建立，硬编码颜色消除 |
| 2. 主题系统修复 | ✅ 已完成 | sidebar !important 消除（mat-mini-fab→mat-icon-button），terminal ViewEncapsulation.ShadowDom，app.component 硬编码颜色修复，file-list/proxy-menu 颜色令牌化 |
| 3. 模态框/对话框美化 | ✅ 已完成 | 3.1 backdrop blur ✅, 3.2 统一令牌样式 ✅, 3.3 过渡动画（已有）✅, 3.4 响应式布局 ✅, 3.5 头部样式统一 ✅ |
| 4. 标签页优化 | ✅ 已完成 | 4.1 CSS text-overflow ellipsis + max-width 120px + matTooltip 显示完整名称 ✅, 4.2 tooltip 已实现 ✅, 4.3 tab-drop-indicator 竖线指示器 + tab-dragging 透明度反馈 ✅, 4.4 tab-empty-state 空状态组件（图标 + i18n 5 语言）✅ |
| 4.5. Profile 页面 i18n | ✅ 已完成 | 14 个新翻译 key 添加到 5 个语言文件，profile-form 及 6 个子表单模板全部使用 translate pipe，Category/ConnectionType 动态值翻译方法，AuthType 单选按钮翻译 |
| 4.6. Cloud 同步表单 i18n | ✅ 已完成 | CLOUD 翻译 key 添加到 5 个语言文件，表单模板全部使用 translate pipe，AuthType/Sync Items 动态翻译，上传/下载通知消息国际化 |
| 4.7. 新式控制流语法迁移 | ✅ 已完成 | 7 个文件中 31 处旧式结构指令（29 `*ngIf` + 2 `*ngFor`）全部替换为 `@if`/`@for`，编译验证通过 |
| 5. AI 聊天面板优化 | ✅ 已完成 | 5.1 可拖拽（header 拖拽，persist localStorage）✅, 5.2 可调整大小（右下角手柄 280-600×300-800px）✅, 5.3 气泡样式优化（avatar+role标签+阴影）✅, 5.4 打字指示器（3 点弹跳动画）✅, 5.5 历史下拉优化（活跃指示条+入场动画）✅ |
| 6. 侧边栏 & 导航优化 | 🔄 部分完成 | sidebar `!important` 消除（归入 2.3）✅; ESC 键关闭拦截修复：移除自定义 HostListener，改用 `mat-sidenav [disableClose]="true"` 内建属性 ✅ |
| 7. 表单体验优化 | ⬜ 未开始 | |
| 8. 动画系统增强 | ⬜ 未开始 | |
| 9. 空状态设计 | ⬜ 未开始 | |
| 10. 可访问性 | ⬜ 未开始 | |
