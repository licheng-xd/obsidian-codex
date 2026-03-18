# Obsidian Codex

`obsidian-codex` 是一个桌面端 Obsidian 社区插件，用来把 OpenAI Codex 工作流嵌入到 Obsidian 侧边栏中。

当前仓库处于 MVP 阶段，重点是先打通一个稳定、可验证、可扩展的本地 Codex 集成闭环，而不是一次性做完整的 AI 编辑器。

## 当前能力

- 在 Obsidian 右侧打开 `Obsidian Codex` 聊天侧边栏
- 调用本地 `@openai/codex-sdk` 启动多轮 Codex 会话
- 注入当前笔记与选中文本作为上下文
- 显示 `Vault root`、`Current note` 和选区摘要
- 支持流式回复与取消当前轮
- 支持运行时探针，验证 Codex CLI 是否可用
- 支持 `codexPath`、`skipGitRepoCheck`、`sandboxMode`、`approvalPolicy`、`model`、`reasoningEffort`、`yoloMode` 设置
- 提供 Ribbon 图标和侧边栏标签页图标

## 非目标

当前版本还没有覆盖这些能力：

- 移动端支持
- 行内编辑和 diff 应用
- 会话持久化 / 历史会话管理
- 多笔记、多文件夹、多资源源的复杂上下文拼装
- Prompt 模板、Slash Commands、MCP 配置面板

## 运行要求

- Obsidian Desktop `>= 1.5.0`
- 本地已安装 OpenAI Codex CLI
- 终端中 `codex --version` 可正常执行
- 桌面环境可访问本地 Vault 路径

补充说明：

- 本插件是桌面端插件，`manifest.json` 中已声明 `isDesktopOnly: true`
- 插件默认通过本机安装的 Codex CLI / SDK 工作，不直接调用通用 OpenAI HTTP API

## 安装方式

### 方式一：从源码构建

```bash
git clone git@github.com:licheng-xd/obsidian-codex.git
cd obsidian-codex
npm install
npm run build
```

构建完成后，会得到：

- `main.js`
- `manifest.json`
- `styles.css`

将这三个文件复制到你的 Vault 插件目录：

```bash
VAULT="/path/to/your/vault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/obsidian-codex"

mkdir -p "$PLUGIN_DIR"
cp main.js "$PLUGIN_DIR/"
cp manifest.json "$PLUGIN_DIR/"
cp styles.css "$PLUGIN_DIR/"
```

然后在 Obsidian 中：

1. 打开“设置 -> 第三方插件”
2. 打开安全模式后启用 `Obsidian Codex`

### 方式二：开发模式联调

```bash
npm install
npm run build
```

把构建产物同步到目标 Vault 的插件目录后，重载 Obsidian 即可。

当前仓库没有提供热更新脚手架，MVP 阶段建议使用 `npm run build` 后手动覆盖插件目录。

## 首次配置

插件设置页包含以下选项：

- `Codex path`
  说明：可选，填写 Codex CLI 的绝对路径；留空时走 `PATH`
- `Skip git repo check`
  说明：允许在不是 Git 仓库的 Vault 中运行 Codex
- `Model`
  说明：未来 Codex 线程执行默认使用的模型名，默认 `gpt-5.4`
- `Reasoning effort`
  说明：未来 Codex 线程默认推理强度，支持 `低 / 中 / 高 / 超高`
- `YOLO mode`
  说明：持久化高风险开关；开启后未来线程默认使用 `approvalPolicy='never'` 与 `sandboxMode='danger-full-access'`
- `Sandbox mode`
  说明：当前线程默认沙箱策略
- `Approval policy`
  说明：当前线程默认审批策略

推荐首次配置流程：

1. 先在终端确认：
   ```bash
   codex --version
   command -v codex
   ```
2. 打开 Obsidian 后执行命令 `Verify Codex Runtime`
3. 如果桌面端 Obsidian 找不到 `codex`，把 `command -v codex` 返回的绝对路径填入 `Codex path`
4. 如需切换默认模型，在 `Model` 中填写完整模型 ID
5. 如需对齐官方客户端体验，可同时在侧边栏托盘或设置页里调整 `Reasoning effort`

安全说明：

- `YOLO mode` 是**持久化设置**，关闭插件或重启 Obsidian 后仍会保留
- 开启后，未来线程会以 `never + danger-full-access` 运行，默认安全边界会被放宽
- 仅建议在你完全信任当前 Vault 与执行环境时启用

## 使用方式

### 打开插件

支持三种入口：

- 左侧 Ribbon 图标
- 命令面板中的 `Open Obsidian Codex`
- 已打开的右侧侧边栏标签页

### 运行时检测

命令面板运行 `Verify Codex Runtime`：

- 成功时显示类似 `Codex available: codex-cli x.y.z`
- 失败时会显示错误详情，便于定位本地环境问题

### 聊天交互

侧边栏支持基础多轮聊天：

- `Enter`：直接发送消息
- `Command + Enter`：换行
- Windows / Linux 下 `Ctrl + Enter`：换行
- `Cancel`：中断当前流式回复
- `New Chat`：清空当前侧边栏对话并重建会话
- 底部托盘提供模型、推理强度、Vault、YOLO 一体化控制

### 上下文注入规则

每次发送消息时，插件会构造一个最小上下文：

1. 用户输入
2. 当前编辑器选中文本
3. 当前笔记正文摘录

当前实现的细节：

- 选中文本优先于正文注入
- 正文片段会截断到 `4000` 字符
- 如果选中文本已经存在，会从正文摘录中移除一次，避免重复注入

## 故障排查

### `Codex probe failed: spawn codex ENOENT`

说明 Obsidian 进程中找不到 `codex` 可执行文件。

处理方式：

```bash
command -v codex
```

把返回值填入插件设置里的 `Codex path`。

### `Codex probe failed: env: node: No such file or directory`

这通常出现在：

- 你安装的 `codex` 是 `#!/usr/bin/env node` 启动脚本
- Obsidian 是从 GUI 启动的，没有继承终端里的 Node.js 路径

当前插件已经兼容这个场景：

- 当 `codexPath` 指向绝对路径 launcher 时
- 插件会自动把同目录里的 `node` 注入子进程 `PATH`

如果仍失败，优先确认：

```bash
command -v node
command -v codex
```

### 插件加载失败

优先检查：

1. 插件目录里是否包含最新的 `main.js`、`manifest.json`、`styles.css`
2. 是否在修改代码后重新执行了 `npm run build`
3. 是否重载或重启了 Obsidian

## 开发命令

```bash
npm install
npm test
npm run typecheck
npm run build
```

含义：

- `npm test`：运行 Vitest 单元测试
- `npm run typecheck`：运行 TypeScript 无输出类型检查
- `npm run build`：使用 esbuild 构建 `main.js`

## 项目结构

```text
.
├── docs/
│   ├── adr/
│   └── plans/
├── src/
│   ├── main.ts
│   ├── chat-view.ts
│   ├── codex-service.ts
│   ├── context-builder.ts
│   ├── context-summary.ts
│   ├── chat-input.ts
│   ├── settings.ts
│   ├── settings-tab.ts
│   ├── codex-icon.ts
│   └── icons.ts
├── tests/
├── manifest.json
├── styles.css
├── esbuild.config.mjs
└── tsconfig.json
```

核心模块说明：

- `src/main.ts`
  负责插件生命周期、命令注册、Ribbon 入口、View 激活
- `src/chat-view.ts`
  负责聊天侧边栏 UI、上下文摘要、发送/取消交互
- `src/codex-service.ts`
  负责 Codex CLI 探针、SDK client/thread 生命周期、流式事件消费
- `src/context-builder.ts`
  负责构建注入给 Codex 的文本上下文
- `src/settings.ts` / `src/settings-tab.ts`
  负责默认设置、兼容清洗和设置页 UI

## 验证建议

自动验证：

```bash
npm test
npm run typecheck
npm run build
```

手工验证建议按以下顺序：

1. 插件启用成功
2. `Verify Codex Runtime` 成功
3. `Open Obsidian Codex` 打开右侧侧边栏
4. 输入消息后能看到流式回复
5. `Cancel` 可中断回复
6. 设置改动在重载后仍保留

## 已知限制

- 当前聊天会话只在当前插件实例生命周期内维护
- 还没有会话恢复 UI，也没有历史会话面板
- 当前上下文源仅包含当前笔记与当前选区
- 还没有对回复内容执行“写回笔记”的编辑动作
- 还没有移动端适配

## 文档

- 设计文档：`docs/plans/2026-03-16-obsidian-codex-design.md`
- 实现计划：`docs/plans/2026-03-16-obsidian-codex-implementation-plan.md`
- 架构决策：`docs/adr/ADR-2026-03-16-codex-backend.md`

## 路线图

下一阶段优先考虑：

- 会话持久化与恢复
- 更细粒度的上下文选择
- 内联编辑 / 应用修改
- Prompt 模板与命令快捷入口
- 更完整的安全边界与确认交互

## 声明

本项目是一个个人维护的 Obsidian 社区插件实验项目，不是 OpenAI 或 Obsidian 官方产品。
