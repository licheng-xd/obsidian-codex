# 2026-03-18 持久化最后一个会话

## 背景

Obsidian 侧边栏关闭、插件重载或桌面端重启后，用户希望默认继续上次 Codex 会话，而不是自动开启新线程。

当前实现的问题是：

- `CodexService` 只在内存中保存 `currentThread`
- `ChatView` 只在当前视图实例生命周期内维护消息 DOM
- `saveData()` 仅保存插件设置，不保存聊天会话

这会导致视图重新打开后 UI 和底层 thread 都丢失。

## 备选方案

### 方案 A：持久化真实 `thread_id` + 持久化会话快照

做法：

- 在插件数据中保存 `lastSession`
- 保存 `thread_id`
- 保存已渲染的消息快照、系统事件摘要和最近一轮 usage
- 打开侧边栏时恢复 UI，并通过 SDK `resumeThread(thread_id, options)` 恢复同一线程

优点：

- 用户语义最正确，是真正的“继续上次会话”
- 不需要把历史消息重放给新线程
- 与 Codex SDK 的线程模型一致

缺点：

- 插件需要维护一份最小会话快照
- 涉及 `main.ts`、`chat-view.ts`、`codex-service.ts` 的持久化和恢复路径

### 方案 B：只持久化 UI，不恢复真实线程

优点：

- 实现简单

缺点：

- 视觉上连续，模型上下文实际上断开
- 用户下一轮消息会进入新线程，和需求不符

### 方案 C：重放历史消息到新线程

优点：

- 理论上也能“接近恢复”

缺点：

- 成本高
- 工具调用和内部 agent 状态不可可靠重建
- 容易与原线程行为偏离

## 决策

采用方案 A：

- 插件数据增加 `lastSession`
- `CodexService` 增加 `resumeThread(threadId, options)`
- `ChatView` 恢复上次 UI 快照，并在可用时自动恢复底层线程
- `New Chat` 明确清空 `lastSession`，只有用户主动触发才开启新会话

## 影响

- `loadData()` / `saveData()` 不再只处理 settings，而是统一处理 `{ settings, lastSession }`
- README 中“当前聊天会话只在当前插件实例生命周期内维护”的描述失效，需要更新
- 该能力只恢复“最后一个会话”，不引入历史会话列表

## 后续

- 如果未来需要“会话列表 / 命名 / pin / 删除”，再在 `lastSession` 之外扩展多会话存储模型
- 如果 SDK 后续暴露更强的线程快照能力，可再评估是否缩减本地 UI 快照内容
