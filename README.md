# Obsidian Codex

`obsidian-codex` 是一个桌面端 Obsidian 社区插件，把 OpenAI Codex 工作流直接带进 Vault 侧边栏。

它的目标不是做一个“大而全”的 AI 编辑器，而是把本地 Codex CLI、当前笔记上下文、Vault 内文件组织和 Obsidian 原生交互稳稳接起来，让你在不离开 Obsidian 的前提下完成多轮协作、分析、写作和本地文件操作。

## 当前状态

项目目前仍处于 MVP 阶段，但已经可以稳定完成以下能力：

- 在右侧侧边栏打开 `Obsidian Codex` 聊天面板
- 使用本地 `@openai/codex-sdk` 启动和恢复多轮会话
- 默认注入选中文本；当前笔记全文注入可在设置中开关，默认关闭
- 流式显示回复、系统事件、命令执行和文件变更摘要
- 保存最近 7 个历史会话，并可在历史列表中切换和继续原 thread
- 对“保存到本地”请求做轻量目录规划，尽量遵循 Vault 的组织方式
- 提供模型、推理强度、YOLO 和运行状态的一体化底部托盘
- 支持 Codex CLI 运行时检测和自定义 `codexPath`

## 运行要求

- Obsidian Desktop `>= 1.5.0`
- 本机已安装 OpenAI Codex CLI
- 终端中 `codex --version` 可正常执行
- Obsidian 桌面端可以访问本地 Vault 路径

补充说明：

- 插件是桌面端专用，`manifest.json` 已声明 `isDesktopOnly: true`
- 当前通过本机安装的 Codex CLI / SDK 工作，不直接调用通用 OpenAI HTTP API
- 当前仓库还没有发布社区商店版本，推荐从源码构建安装

## 快速安装

### 1. 从源码构建

```bash
git clone git@github.com:licheng-xd/obsidian-codex.git
cd obsidian-codex
npm install
npm run build
```

构建完成后会得到：

- `main.js`
- `manifest.json`
- `styles.css`

### 2. 复制到 Vault 插件目录

```bash
VAULT="/path/to/your/vault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/obsidian-codex"

mkdir -p "$PLUGIN_DIR"
cp main.js "$PLUGIN_DIR/"
cp manifest.json "$PLUGIN_DIR/"
cp styles.css "$PLUGIN_DIR/"
```

### 3. 在 Obsidian 启用插件

1. 打开 `设置 -> 第三方插件`
2. 关闭安全模式
3. 启用 `Obsidian Codex`

## 首次配置

推荐第一次使用时按这个顺序走：

1. 在终端确认：

   ```bash
   codex --version
   command -v codex
   ```

2. 打开 Obsidian，执行命令 `Verify Codex Runtime`
3. 如果桌面端 Obsidian 找不到 `codex`，把 `command -v codex` 返回的绝对路径填进 `Codex path`
4. 按需要设置默认模型和推理强度
5. 只有在你完全信任当前 Vault 与本地环境时，再考虑开启 `YOLO mode`

设置页当前支持：

- `Codex path`
- `Skip git repo check`
- `Include active note automatically`
- `Model`
- `Reasoning effort`
- `YOLO mode`
- `Sandbox mode`
- `Approval policy`

## 日常使用

### 打开插件

有 3 个入口：

- 左侧 Ribbon 图标
- 命令面板 `Open Obsidian Codex`
- 已打开的右侧侧边栏标签页

### 输入交互

- `Enter`：发送消息
- `Command + Enter`：换行
- Windows / Linux 下 `Ctrl + Enter`：换行
- `Cancel`：中断当前轮
- `New Chat`：清空当前侧边栏会话并新建线程

### 会话行为

- 重新打开侧边栏时，会优先恢复当前激活会话
- 历史按钮会展示最近 7 个会话，标题在上、时间在下
- 点击历史会话后，会恢复消息快照并继续复用原始 Codex thread
- `New Chat` 只结束当前激活态，不会删除历史列表

## 状态栏指标

底部托盘里当前有两类和运行状态相关的信息：

### 1. `Context X% · ~used / window`

这是当前会话的可见历史估算值，不再直接使用 `turn.completed.usage.input_tokens` 作为“实时窗口占用”：

- 分子：插件自己统计的可见会话历史大小估算值
- 分母：当前模型的官方 context window

当前已内置的窗口映射：

- `gpt-5.4` -> `1.05M`
- `gpt-5.3-codex` -> `400k`

为什么这样做：

- Codex SDK 的 `turn.completed.usage` 表示“本轮总 usage”，不是当前线程实时占用
- 一轮里如果发生多次内部推理 / 工具循环，`input_tokens` 可以累计超过单次 context window
- 因此主展示改成 `Context`，并明确是估算值

如果是未知自定义模型，没有官方窗口映射，就只显示 `Context ~12k` 这种估算值，不伪造百分比。

### 2. Hover 说明里的估算值

悬浮到状态指标上时，还会看到：

- `Context est.`
- `Visible history`
- `Pending local`
- `Last turn`

这里会同时保留上一轮 SDK usage 说明，但只作为“上一轮总消耗”参考，不再当作当前线程窗口占用。

## 上下文注入规则

每次发送消息时，插件会构造最小上下文：

1. 用户输入
2. 当前选中文本
3. 当前笔记正文摘录（仅在 `Include active note automatically` 开启时注入）

当前实现细节：

- 选中文本优先于正文注入
- 当前笔记全文默认不自动注入；这样 `New Chat` 更接近真正的空白会话
- 正文摘录截断到 `4000` 字符
- 如果选中文本已包含在正文里，会从正文摘录里移除一次，避免重复注入

## 本地保存目录规则

当用户明确要求“保存到本地”时，插件不会再只按 Vault 根目录盲存，而是先做一次轻量目录规划：

1. 优先读取 Vault 根目录下的 `README`、索引、指南、约定等规范文件
2. 如果规范不明确，再分析目录结构和现有文件命名分布
3. 如果有多个合理目录，优先选择与待保存内容类型最匹配的目录
4. 如果仍无高置信度结论，回退到当前笔记同级目录
5. 如果当前没有打开笔记，再回退到 Vault 根目录

当前实现仍然是“planner 先算推荐目录，再把结果注入 prompt”，不是底层强制拦截写文件路径。

## 安全说明

### `YOLO mode`

`YOLO mode` 是持久化高风险开关。

开启后，未来线程默认会使用：

- `approvalPolicy = never`
- `sandboxMode = danger-full-access`

也就是说，默认安全边界会被明显放宽。这个模式只应该在你完全信任当前 Vault、当前仓库和本机环境时使用。

### 默认边界

当前插件仍然遵循以下原则：

- 工作目录默认为当前 Vault 根目录
- 上下文默认只自动注入用户输入和显式选区
- 当前笔记全文注入需要由设置显式开启
- 不会因为插件重启而自动丢失最近历史会话

## 故障排查

### `Codex probe failed: spawn codex ENOENT`

说明 Obsidian 进程里找不到 `codex` 可执行文件。

处理方式：

```bash
command -v codex
```

把返回值填进插件设置里的 `Codex path`。

### `Codex probe failed: env: node: No such file or directory`

通常是：

- 你的 `codex` 是 `#!/usr/bin/env node` 启动脚本
- Obsidian 从 GUI 启动，没有继承终端里的 Node 路径

当前插件已经兼容这个场景：如果 `codexPath` 指向绝对路径 launcher，会自动把同目录里的 `node` 注入子进程 `PATH`。

### 插件加载失败

优先检查：

1. 插件目录里是否是最新的 `main.js`、`manifest.json`、`styles.css`
2. 代码改动后是否重新执行了 `npm run build`
3. 是否已经重载或重启了 Obsidian

## 开发

### 常用命令

```bash
npm install
npm run typecheck
npm test
npm run build
```

含义：

- `npm run typecheck`：TypeScript 类型检查
- `npm test`：Vitest 单元测试
- `npm run build`：esbuild 构建插件产物

### 项目结构

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
│   ├── vault-save-planner.ts
│   ├── status-bar.ts
│   ├── event-cards.ts
│   ├── assistant-markdown.ts
│   ├── chat-session.ts
│   └── plugin-state.ts
├── tests/
├── manifest.json
├── styles.css
├── esbuild.config.mjs
└── tsconfig.json
```

核心模块：

- `src/main.ts`
  负责插件生命周期、命令注册、Ribbon 入口和 View 激活
- `src/chat-view.ts`
  负责聊天侧边栏 UI、上下文收集、会话恢复、发送/取消交互
- `src/codex-service.ts`
  负责 Codex CLI 探针、SDK client/thread 生命周期和流式事件消费
- `src/context-builder.ts`
  负责构建发送给 Codex 的上下文文本
- `src/vault-save-planner.ts`
  负责“保存到本地”时的目录推荐规则
- `src/status-bar.ts`
  负责底部托盘状态展示、模型和推理强度控制

## 已知限制

- 历史会话当前不支持删除、pin、重命名和搜索
- 当前上下文源仍然只包含用户输入、当前选区和可选的当前笔记摘录
- 还没有“直接把回复应用回笔记”的编辑流
- 还没有移动端支持
- 保存目录规划目前是规则驱动的 prompt 注入，不是底层硬拦截

## 相关文档

- 设计文档：`docs/plans/2026-03-16-obsidian-codex-design.md`
- 初始实现计划：`docs/plans/2026-03-16-obsidian-codex-implementation-plan.md`
- 历史会话设计：`docs/plans/2026-03-19-session-history-design.md`
- 历史会话 ADR：`docs/adr/2026-03-19-session-history.md`
- 保存目录规划 ADR：`docs/adr/2026-03-18-vault-save-planner.md`
- 文档索引：`docs/README.md`

## 路线图

下一阶段更值得继续做的是：

- 更细粒度的上下文来源选择
- 内联编辑 / 应用修改
- Prompt 模板和快捷命令
- 更强的本地写文件保护与确认交互

## 声明

这是一个个人维护的 Obsidian 社区插件实验项目，不是 OpenAI 或 Obsidian 官方产品。
