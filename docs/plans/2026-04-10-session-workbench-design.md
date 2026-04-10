# Session Workbench Design

## 背景

当前 `Codexian` 已经有最近会话列表和历史弹层，但它仍然更像“在单侧栏里恢复旧聊天记录”，而不是“围绕会话工作的工作台”。

现状问题主要有三类：

1. 会话动作不够显式
   - 当前 UI 更突出 `New Chat` 和历史列表，但“当前在什么会话里工作”“什么时候是新会话”“什么时候是恢复旧会话”没有形成完整心智模型。
2. 代码职责过度集中
   - `chat-view.ts` 目前同时承担视图搭建、会话恢复、thread 生命周期、输入区交互、附件、渲染与状态栏更新。
3. 后续功能很难继续加
   - 如果继续把 inline edit、上下文集合、命令入口都压进 `chat-view.ts`，维护成本会迅速升高。

因此，迭代 1 的重点不是增加很多新能力，而是把当前聊天页升级为更清晰的 session workbench。

## 目标

1. 在单侧栏模型下，建立更清晰的会话工作流：
   - 新会话
   - 恢复最近会话
   - 当前会话状态可见
2. 保持当前 `Codex thread` 连续性，不手工回放历史消息。
3. 在不引入多 tab 的前提下，完成一次必要的模块拆分。
4. 为迭代 2 的 inline edit 和迭代 3 的工作上下文系统预留稳定落点。

## 非目标

1. 本轮不做多 tab。
2. 本轮不做 provider 化抽象。
3. 本轮不做 inline edit。
4. 本轮不做外部目录、MCP、skills。
5. 本轮不做“真 fork 会话”。

关于第 5 点，需要明确记录一个实现约束：当前仓库依赖的是 `@openai/codex-sdk` thread 模型，现有代码路径里只有 `createThread()` 和 `resumeThread()` 这一类语义，没有可直接复用的“分叉当前 thread”接口。因此本轮不把 fork 作为承诺能力，避免设计目标和底层能力脱节。

## 方案对比

### 方案 A：继续在 `chat-view.ts` 上补按钮和命令

优点：

- 改动最少
- 可以很快加出更多操作入口

缺点：

- `chat-view.ts` 会继续膨胀
- 后面做 inline edit 或持久上下文时仍然会遇到相同问题
- 只能解决表层交互，不解决结构问题

### 方案 B：保持单侧栏，但提炼 session workbench 边界

优点：

- 不引入多 tab 的复杂度
- 能先把“会话工作流”讲清楚
- 能顺便拆出后续可复用的模块边界

缺点：

- 比纯 UI 打补丁改动更大
- 需要先整理当前 `chat-view.ts` 的内部职责

### 方案 C：直接做接近 Claudian 的多 tab 工作台

优点：

- 产品形态更接近长期上限

缺点：

- 会把本轮范围直接放大到视图布局、tab 状态持久化、跨 tab 草稿、更多命令和更多测试
- 对当前代码基线来说跳跃过大

## 决策

采用方案 B。

也就是：

- 继续保持一个 Obsidian 侧栏视图
- 在这个视图里把会话流转做完整
- 同时把 `chat-view.ts` 从“全能文件”拆成“组合根 + 若干职责模块”

## 设计概览

### 1. 会话模型

当前已有：

- `recentSessions`
- `activeSessionId`
- `activeThreadId`

本轮不推翻这套模型，而是明确它们的语义：

1. `activeSessionId`
   - 指向当前正在展示和继续工作的持久化会话
   - `null` 表示当前处于“全新会话草稿态”
2. `activeThreadId`
   - 指向当前绑定的 Codex thread
   - 对已恢复会话，通常与 `activeSessionId` 相同
   - 对新会话，在首轮 `thread.started` 前为空
3. `recentSessions`
   - 继续作为最近会话快照列表
   - 负责恢复展示和历史选择

这意味着“新会话”不等于“清空所有历史”，而是“进入没有绑定 thread 的新草稿态”。

### 2. 会话工作台 UI

本轮保留当前单侧栏布局，不引入 tab。

当前历史按钮区域升级为 session workbench 入口，包含两类内容：

1. 顶部动作区
   - `New session`
   - 当前会话状态提示
2. 最近会话列表
   - 标题
   - 更新时间
   - 当前激活项高亮

交互规则：

1. 点击 `New session`
   - 清空当前消息区
   - 清空当前 thread 绑定
   - 保留 `recentSessions`
   - 进入新草稿态
2. 点击最近会话
   - 切换展示
   - 恢复 `activeSessionId`
   - 调用 `resumeThread(threadId, options)`
3. 发送首条新消息
   - 如果当前是新草稿态，则创建新 thread
   - 在 `thread.started` 后写入新的 `activeThreadId`

### 3. 命令入口

在当前 `open-sidebar`、`verify-runtime` 基础上，补三类命令：

1. `new-session`
   - 直接把当前视图切到新草稿态
2. `resume-last-session`
   - 优先恢复最近更新时间最新的一条历史会话
3. `show-session-history`
   - 打开或聚焦 session workbench 弹层

这样做的目的不是“命令越多越好”，而是让会话工作流具备键盘入口，减少对点击浮层的依赖。

### 4. 模块拆分

本轮不做大型目录重构，但要把 `chat-view.ts` 的主要职责拆出去。

建议拆成以下模块：

1. `src/chat-workbench.ts`
   - 纯函数
   - 负责会话列表更新、激活态计算、草稿态切换、最近会话选择等状态逻辑
2. `src/chat-message-renderer.ts`
   - 负责 user/status/assistant 历史重渲染
   - 负责 persisted assistant turn 的还原
3. `src/chat-runtime-controller.ts`
   - 负责发送、取消、thread 创建与恢复
   - 负责围绕 `CodexService` 的会话生命周期协调

`chat-view.ts` 保留为组合根，负责：

- 持有视图级 DOM 引用
- 组装各模块
- 协调 Obsidian 生命周期

### 5. 持久化与恢复规则

当前已有的恢复语义继续保留，但补上更清晰的规则：

1. 启动视图时
   - 如果有 `activeSessionId`，恢复对应会话
   - 否则进入新草稿态
2. 新草稿态发送首轮消息时
   - 不复用历史 thread
   - 由 `CodexService.createThread()` 建立新 thread
3. 已有持久化会话发送消息时
   - 优先走 `resumeThread(threadId, options)`
4. `New session`
   - 只重置当前激活态
   - 不丢失历史列表

### 6. 线程与 fork 约束

本轮明确不实现 `fork current session`。

原因：

1. 当前代码依赖 `Codex thread` 原生连续性，而不是插件手工回放全量历史。
2. 现有路径没有稳定的“从某个 thread checkpoint 分叉一个新 thread”的语义。
3. 如果强行在本轮做 fork，只能退化成“复制可见消息快照后重新起新 thread”，这会混淆能力边界。

因此，本轮把 fork 记录为后续待评估能力，不写进迭代 1 的验收标准。

## 关键取舍

### 为什么不直接上多 tab

因为当前最紧急的问题不是“同时开多个会话”，而是“单会话工作流语义不够完整，且代码结构不利于继续演进”。先把单侧栏 workbench 做清楚，再评估多 tab 是否真的必要。

### 为什么本轮要先拆层

因为：

1. 迭代 2 的 inline edit 需要一个更清晰的运行时协调边界
2. 迭代 3 的持久上下文集合会继续加重 composer 和会话状态复杂度
3. 如果本轮不拆层，后两轮都会在一个更脆弱的基础上继续加功能

## 测试策略

本轮优先补三类测试：

1. 纯状态测试
   - `chat-workbench.ts` 的会话切换、最近会话更新、新草稿态切换
2. 源码结构测试
   - 锁定 `main.ts` 的新增命令 id
   - 锁定 `chat-view.ts` 不再内联一部分会话逻辑
3. 回归测试
   - 保证历史恢复、发送链路、已有持久化读写不被破坏

不引入 E2E，也不在本轮构造复杂 DOM 交互测试。

## 验收标准

1. 单侧栏中存在明确的 session workbench 入口。
2. 用户可以显式开启新会话并恢复最近会话。
3. 恢复会话后继续复用原始 `Codex thread`。
4. `chat-view.ts` 的职责明显收窄。
5. `README` 与计划文档准确记录新的会话模型和边界。
