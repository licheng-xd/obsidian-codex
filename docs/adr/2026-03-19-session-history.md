# 2026-03-19 历史会话列表

## 背景

当前插件通过 `lastSession` 只恢复最后一个会话。该方案在“重新打开后继续上次会话”场景下足够，但无法满足以下需求：

1. 保留最近多个 Codex 会话
2. 在 Obsidian 内切换到旧会话继续交流
3. 保证切换后继续复用原始 thread，而不是只展示旧消息

这已经不再是简单 UI 增量，而是一次数据存储模型升级。

## 备选方案

### 方案 A：保留 `lastSession`，新增 `recentSessions`

做法：

- `lastSession` 继续表示当前会话
- `recentSessions` 只作为历史列表展示源

优点：

- 兼容现有实现成本较低

缺点：

- 当前会话状态会重复维护
- 切换历史会话时容易出现 `lastSession` 与历史列表排序不一致

### 方案 B：统一为 `recentSessions + activeSessionId`

做法：

- 所有会话都进入 `recentSessions`
- 当前会话只由 `activeSessionId` 标识
- 切换会话、续聊、New Chat 都围绕这两个字段展开

优点：

- 数据来源唯一
- 与“最近 7 个会话 + 当前激活会话”需求完全一致
- 后续扩展删除、pin、重命名更自然

缺点：

- 要改动持久化读取、恢复流程和部分测试

### 方案 C：只做历史列表 UI，不恢复原 thread

做法：

- 历史项只展示旧快照
- 用户继续发消息时仍然进入新 thread

优点：

- 实现成本最低

缺点：

- 不满足“进入历史会话继续聊”的真实语义
- 会让 UI 连续但 thread 实际断开

## 决策

采用方案 B：

1. 插件数据模型升级为：
   - `recentSessions: PersistedChatSession[]`
   - `activeSessionId: string | null`
2. `threadId` 继续作为单会话主键
3. 历史列表最多保留 7 条
4. 选择历史会话后，恢复对应快照并调用 `resumeThread(threadId, threadOptions)`
5. `New Chat` 只结束当前激活态，不删除已有历史

## 影响

1. `loadData()` / `saveData()` 将不再以 `lastSession` 为中心
2. `chat-view.ts` 需要从“单会话 UI”切换到“活动会话可切换 UI”
3. 旧持久化数据需要自动迁移
4. 历史列表展示会新增只读派生元信息，例如标题和最近更新时间

## 后续

1. 如果用户后续需要会话删除、pin、重命名，可继续围绕同一模型扩展
2. 如果 SDK 后续提供更强的线程元信息接口，可再替换本地派生标题和时间字段
