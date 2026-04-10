# Session Workbench Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把当前单侧栏聊天页升级为更清晰的 session workbench，在保持单视图模型的前提下补齐“新会话 / 恢复会话 / 当前会话状态”工作流，并完成一次必要的代码拆层。

**Architecture:** 保留当前 `recentSessions + activeSessionId + activeThreadId` 模型，不引入多 tab，也不承诺 fork。新增 `chat-workbench.ts` 负责会话状态纯逻辑，新增 `chat-message-renderer.ts` 负责持久化消息重渲染，`chat-view.ts` 收缩为组合根和 UI 协调层，`main.ts` 补充显式会话命令入口。

**Tech Stack:** TypeScript、Obsidian Plugin API、Vitest、esbuild、`@openai/codex-sdk`

---

### Task 1: 写会话工作台纯逻辑的失败测试

**Files:**
- Create: `tests/chat-workbench.test.ts`
- Create: `src/chat-workbench.ts`

1. 在 `tests/chat-workbench.test.ts` 先写失败测试，覆盖：
   - `new draft session` 不清空 `recentSessions`
   - 激活指定历史会话时返回正确的 `activeSessionId`
   - 更新最近会话时仍复用现有 `upsertRecentSession` 语义
2. 为即将实现的函数先确定命名：
   - `createDraftWorkbenchState()`
   - `activateRecentSession()`
   - `persistWorkbenchSession()`
3. 运行：
   - `npm test -- tests/chat-workbench.test.ts`
4. 预期：
   - FAIL，原因是 `src/chat-workbench.ts` 尚不存在或导出不完整

### Task 2: 实现最小会话工作台纯逻辑

**Files:**
- Create: `src/chat-workbench.ts`
- Test: `tests/chat-workbench.test.ts`

1. 在 `src/chat-workbench.ts` 定义工作台状态与纯函数，至少包含：
   - 当前激活会话 id
   - 当前绑定 thread id
   - 是否处于新草稿态
2. 让 `persistWorkbenchSession()` 内部继续复用 `upsertRecentSession()`，不要重新发明排序逻辑。
3. 运行：
   - `npm test -- tests/chat-workbench.test.ts`
4. 预期：
   - PASS

### Task 3: 抽出 persisted message 渲染器的失败测试

**Files:**
- Create: `src/chat-message-renderer.ts`
- Modify: `tests/chat-view-source.test.ts`

1. 先改 `tests/chat-view-source.test.ts`，锁定以下迁移目标：
   - `chat-view.ts` 不再自己持有全部 persisted assistant rendering 细节
   - `chat-view.ts` 调用新的 renderer 函数
2. 新 renderer 先规划两个导出：
   - `renderPersistedAssistantTurn()`
   - `renderPersistedSessionEntries()`
3. 运行：
   - `npm test -- tests/chat-view-source.test.ts`
4. 预期：
   - FAIL

### Task 4: 实现 persisted message 渲染器并收缩 `chat-view.ts`

**Files:**
- Create: `src/chat-message-renderer.ts`
- Modify: `src/chat-view.ts`
- Test: `tests/chat-view-source.test.ts`

1. 把以下职责从 `chat-view.ts` 提取到 `src/chat-message-renderer.ts`：
   - persisted assistant turn 重渲染
   - persisted summary item 渲染
   - persisted session entry 列表重放
2. `chat-view.ts` 只保留：
   - DOM 根节点引用
   - renderer 所需的回调和上下文拼装
3. 运行：
   - `npm test -- tests/chat-view-source.test.ts`
4. 预期：
   - PASS

### Task 5: 给主入口补会话命令的失败测试

**Files:**
- Modify: `tests/main-source.test.ts`
- Modify: `src/main.ts`

1. 先在 `tests/main-source.test.ts` 增加失败断言，要求主入口新增命令 id：
   - `new-session`
   - `resume-last-session`
   - `show-session-history`
2. 运行：
   - `npm test -- tests/main-source.test.ts`
3. 预期：
   - FAIL

### Task 6: 在 `main.ts` 注册会话命令入口

**Files:**
- Modify: `src/main.ts`
- Modify: `tests/main-source.test.ts`

1. 在 `src/main.ts` 增加新命令注册。
2. 命令行为约束：
   - `new-session`：优先激活侧栏，然后切换到新草稿态
   - `resume-last-session`：优先恢复最近更新时间最新的历史会话
   - `show-session-history`：打开或聚焦 session workbench 弹层
3. 如果当前没有 chat view，命令先调用 `activateChatView()`。
4. 运行：
   - `npm test -- tests/main-source.test.ts`
5. 预期：
   - PASS

### Task 7: 把历史弹层升级为 session workbench

**Files:**
- Modify: `src/chat-view.ts`
- Modify: `tests/chat-view-source.test.ts`

1. 调整当前历史弹层 DOM，使其包含：
   - 顶部动作区
   - `New session` 入口
   - 最近会话列表
   - 当前会话状态文案
2. 保留当前 `history` 按钮位置，不改侧栏整体布局。
3. 保证：
   - 新草稿态不会清空历史列表
   - 当前激活会话高亮仍然有效
4. 运行：
   - `npm test -- tests/chat-view-source.test.ts`

### Task 8: 用 `chat-workbench.ts` 接管会话切换与新草稿态

**Files:**
- Modify: `src/chat-view.ts`
- Modify: `src/chat-workbench.ts`
- Modify: `tests/chat-workbench.test.ts`

1. 把以下行为改为通过 `chat-workbench.ts` 协调：
   - `resetConversation()`
   - 恢复启动时的活动会话
   - 激活指定历史会话
   - 持久化当前活动会话
2. 关键约束：
   - `New session` 进入新草稿态，而不是误删历史会话
   - 恢复历史会话时继续 `resumeThread(threadId, options)`
   - 首轮发送时如果处于新草稿态，继续走 `createThread(threadOptions)`
3. 运行：
   - `npm test -- tests/chat-workbench.test.ts tests/chat-view-source.test.ts`

### Task 9: 更新 README 中的会话语义说明

**Files:**
- Modify: `README.md`

1. 在 `README.md` 的“当前能力”或“首次配置 / 使用方式”里补充：
   - 新会话不会清空历史会话
   - 最近会话可以显式恢复
   - 当前仍然是单侧栏模型，不支持多 tab
2. 不要把 fork 写成已支持能力。

### Task 10: 回归验证

**Files:**
- Modify: `src/chat-view.ts`
- Modify: `src/main.ts`
- Create: `src/chat-workbench.ts`
- Create: `src/chat-message-renderer.ts`
- Create: `tests/chat-workbench.test.ts`

1. 运行：
   - `npm test`
   - `npm run typecheck`
   - `npm run build`
2. 运行：
   - `git diff --stat`
3. 人工检查：
   - 新会话是否仍可发送首条消息
   - 恢复最近会话后是否继续复用原 `threadId`
   - 当前历史弹层是否已成为 session workbench，而不是单纯历史列表

### Task 11: 文档一致性检查

**Files:**
- Create: `docs/plans/2026-04-10-codexian-three-iteration-roadmap.md`
- Create: `docs/plans/2026-04-10-session-workbench-design.md`
- Create: `docs/plans/2026-04-10-session-workbench-implementation-plan.md`

1. 检查三份文档是否一致：
   - 路线图
   - 设计稿
   - 实现计划
2. 确认文档中没有把以下内容误写成迭代 1 已完成范围：
   - 多 tab
   - inline edit
   - 外部目录上下文
   - MCP
   - 会话 fork
