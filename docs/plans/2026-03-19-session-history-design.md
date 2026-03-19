# Session History Design

## 背景

当前插件只持久化 `lastSession`，因此它只能恢复“上一次会话”。这满足了单会话续聊，但无法支持用户在多个 Codex thread 之间回看和切换，也无法满足“最近 7 个历史会话”的需求。

本次需求要求：

1. 最多保存最近 7 个历史会话
2. 在输入框右上角、`New Chat` 按钮前增加历史会话按钮
3. 点击按钮后弹出最近 7 个会话列表
4. 选中任一历史会话后，消息区切换到对应内容，并继续复用原始 Codex thread

## 目标

把当前“单活动会话”的持久化模型升级为“最近会话列表 + 当前激活会话”，同时保持现有的线程恢复语义和最小 UI 复杂度。

## 非目标

1. 本轮不做历史会话删除、重命名、pin、搜索
2. 本轮不做跨 Vault 隔离或多工作区会话分组
3. 本轮不做历史列表中的预览摘要生成优化，只使用稳定可得的本地快照

## 设计概览

### 1. 数据模型

持久化结构从：

- `lastSession: PersistedChatSession | null`

升级为：

- `recentSessions: PersistedChatSession[]`
- `activeSessionId: string | null`

其中：

1. `recentSessions` 按最近访问时间倒序排列，长度上限为 7
2. `activeSessionId` 指向当前正在聊天或刚刚切换到的会话
3. `threadId` 继续作为单会话的稳定标识，不额外引入新的 session id

### 2. 会话更新规则

1. 插件启动时，如果存在 `activeSessionId`，优先恢复该会话
2. 旧数据只有 `lastSession` 时，自动迁移为：
   - `recentSessions = [lastSession]`
   - `activeSessionId = lastSession.threadId`
3. 当前激活会话收到新内容时，更新对应快照并移动到列表头部
4. `New Chat` 不清空历史列表，只清空当前激活态
5. 用户发送首条新消息后创建新 thread，并把新会话插入头部；如果超过 7 条，丢弃最旧一条

### 3. 历史会话列表 UI

历史按钮放在 `New Chat` 之前，图标使用 `history`。

点击后弹出一个轻量浮层，内容包括最近 7 条会话：

1. 标题：优先取首条 user message 的前若干字符
   - 使用本地规则生成摘要标题，优先输出“对象 + 动作”或“对象 + 改写目标”的短标题
2. 次级信息：
   - 最近更新时间
3. 当前激活会话高亮显示

空列表时显示空状态文案，不阻断正常新建会话。

### 4. 会话切换行为

点击历史项后：

1. 更新 `activeSessionId`
2. 清空当前消息区 DOM
3. 按快照重新渲染目标会话
4. 如果当前 Vault 可提供 `workingDirectory`，调用 `resumeThread(threadId, threadOptions)` 恢复原 thread
5. 更新内存中的 `sessionEntries`、`activeThreadId` 和 usage 展示

切换操作不创建新 thread，也不重放历史消息。

### 5. 模块边界

1. `chat-session.ts`
   - 扩展多会话持久化类型和 sanitize 逻辑
   - 提供历史列表显示所需的标题/时间等元信息字段
2. `plugin-state.ts`
   - 负责读写新结构，并兼容旧 `lastSession`
3. `main.ts`
   - 改为持有 `recentSessions` 和 `activeSessionId`
4. `chat-view.ts`
   - 负责历史按钮、弹层、会话切换、会话快照更新
5. `styles.css`
   - 增加历史按钮和弹层样式

## 关键取舍

### 方案 A：保留 `lastSession`，额外增加 `recentSessions`

优点：

- 迁移简单

缺点：

- “当前会话”会有两份状态来源
- 容易出现列表头部与 `lastSession` 不一致

### 方案 B：统一成 `recentSessions + activeSessionId`

优点：

- 语义唯一
- 切换、续聊、New Chat 都是同一套状态机
- 后续扩展删除、pin、重命名更顺

缺点：

- 改动面更广

### 决策

采用方案 B。

## 测试策略

优先补纯逻辑和状态迁移测试：

1. 旧 `lastSession` 自动迁移为新结构
2. `recentSessions` 最多保留 7 条
3. 会话更新时移动到列表头部
4. 历史列表标题派生逻辑稳定
5. 视图切换历史会话时正确重渲染快照

UI 交互先以 DOM 结构和纯函数行为为主，不引入复杂 E2E。
