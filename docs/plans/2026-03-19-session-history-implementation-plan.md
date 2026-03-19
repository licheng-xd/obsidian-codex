# Session History Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为聊天视图增加最近 7 个历史会话的持久化、切换和继续续聊能力。

**Architecture:** 将现有 `lastSession` 单会话模型升级为 `recentSessions + activeSessionId`。`chat-view.ts` 负责历史按钮、弹层列表和切换渲染，`plugin-state.ts` 与 `main.ts` 负责新旧持久化兼容和会话读写，切换后继续调用 `resumeThread(threadId, options)` 保持原 thread 连续性。

**Tech Stack:** TypeScript、Obsidian Plugin API、Vitest、esbuild

---

### Task 1: 定义多会话持久化结构并写失败测试

**Files:**
- Modify: `src/chat-session.ts`
- Modify: `src/plugin-state.ts`
- Modify: `tests/plugin-state.test.ts`

1. 先写失败测试，定义 `recentSessions` 与 `activeSessionId` 的读写形态。
2. 增加旧 `lastSession` 自动迁移测试。
3. 运行 `npm test -- tests/plugin-state.test.ts`，确认先失败。

### Task 2: 实现多会话 sanitize 与插件持久化兼容

**Files:**
- Modify: `src/chat-session.ts`
- Modify: `src/plugin-state.ts`
- Modify: `src/main.ts`
- Test: `tests/plugin-state.test.ts`

1. 补最小实现，让新结构和旧结构都能正确读入。
2. 把 `main.ts` 从 `lastSession` 改为 `recentSessions` / `activeSessionId`。
3. 运行 `npm test -- tests/plugin-state.test.ts`，确认转绿。

### Task 3: 提炼历史会话排序与显示元信息

**Files:**
- Modify: `src/chat-session.ts`
- Create: `tests/chat-session.test.ts`

1. 先写失败测试，覆盖：
   - 最多保留 7 条
   - 更新会话时移动到头部
   - 标题从首条 user message 派生
2. 实现纯函数帮助方法，避免把排序和标题派生塞进视图层。
3. 运行 `npm test -- tests/chat-session.test.ts`。

### Task 4: 接入聊天视图的多会话状态

**Files:**
- Modify: `src/chat-view.ts`

1. 让视图启动时恢复 `activeSessionId` 对应的会话，而不是固定只读 `lastSession`。
2. 将当前发送中的快照写回活动会话，并保持历史排序。
3. 调整 `New Chat`，只清空当前激活态，不清空历史列表。

### Task 5: 先写失败测试，锁定历史按钮与切换行为

**Files:**
- Create: `tests/chat-history.test.ts`
- Modify: `src/chat-view.ts`

1. 写 DOM 级最小测试，锁定：
   - 历史按钮出现在 `New Chat` 前
   - 历史列表能渲染最近会话
   - 点击历史项后切换到对应快照
2. 运行 `npm test -- tests/chat-history.test.ts`，确认先失败。

### Task 6: 实现历史按钮、弹层列表与切换渲染

**Files:**
- Modify: `src/chat-view.ts`
- Modify: `styles.css`
- Test: `tests/chat-history.test.ts`

1. 增加 `history` 图标按钮和弹层 DOM。
2. 渲染最近 7 条历史会话标题、时间和消息数。
3. 点击后切换 `activeSessionId`、重渲染消息区并恢复 thread。
4. 运行 `npm test -- tests/chat-history.test.ts`。

### Task 7: 文档与回归验证

**Files:**
- Create: `docs/adr/2026-03-19-session-history.md`
- Create: `docs/plans/2026-03-19-session-history-design.md`
- Create: `docs/plans/2026-03-19-session-history-implementation-plan.md`

1. 确认文档与实现一致。
2. 运行：
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
3. 检查 `git diff --stat`，确认改动面与计划一致。
