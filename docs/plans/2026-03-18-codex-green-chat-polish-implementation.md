# Codex Green Chat Polish Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将聊天界面进一步收敛为 Claudian 风格的正文流体验，并切换到 Codex 绿色主题。

**Architecture:** 保留现有 `ChatView + StatusBar + renderEventCard` 结构，但把 assistant 输出组织成“回合块”，其中 thinking/meta 与正文回复解耦。上下文摘要和底部控制条继续复用现有纯逻辑 helper，只缩减为 `Vault Root` 并重排视觉层级。

**Tech Stack:** TypeScript, Obsidian Plugin API, Vitest, esbuild, CSS

---

### Task 1: 缩减上下文摘要到 Vault Root

**Files:**
- Modify: `src/context-summary.ts`
- Modify: `tests/context-summary.test.ts`
- Modify: `src/chat-view.ts`

**Step 1: 写失败测试**

- 让 `getContextSummaryLines()` 只返回 `Vault root`
- 让 `formatContextSummary()` 对齐新输出

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/context-summary.test.ts`

**Step 3: 写最小实现**

- 删除 `Current note` / `Selection` 行
- `ChatView` 顶部上下文只渲染单个 vault 标签

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/context-summary.test.ts`

### Task 2: 收紧底部托盘与 YOLO 开关

**Files:**
- Modify: `src/status-bar.ts`
- Modify: `tests/status-bar.test.ts`
- Modify: `styles.css`

**Step 1: 先调整 helper 和 DOM 结构**

- 保留现有 helper API
- 缩减控件尺寸
- 让 YOLO 更接近真实滑动开关

**Step 2: 跑对应测试**

Run: `npm test -- tests/status-bar.test.ts`

**Step 3: 写样式**

- 小型胶囊 select
- 单行紧凑布局
- 绿色主题开关

### Task 3: 重构 assistant 回合块和 thinking 元信息

**Files:**
- Modify: `src/chat-view.ts`
- Modify: `src/event-cards.ts`
- Modify: `styles.css`

**Step 1: 实现回合块容器**

- 发送后创建 assistant turn 容器
- 顶部挂载 thinking meta
- 文本输出作为正文流挂载

**Step 2: 保留思考提示**

- 输出完成后把 thinking 占位改成静态 meta
- 文案形如 `Thought for <n>s`

**Step 3: 重做事件块**

- `text` 去卡片化
- `reasoning` 变成更轻的小号说明
- `command / file_change / error` 保留弱块

### Task 4: 切换绿色主题并完成整体验证

**Files:**
- Modify: `styles.css`
- Modify: `README.md`

**Step 1: 切换主色**

- 深色底 + 绿色强调
- 用户气泡、thinking、YOLO、弱边框都对齐绿色体系

**Step 2: 全量验证**

Run:

```bash
npm test
npm run typecheck
npm run build
```

**Step 3: 手工说明**

- 说明需要在 Obsidian 中观察的新点：
  - `Vault Root` 单标签
  - 绿色托盘
  - YOLO 滑动开关
  - thinking 保留元信息
  - assistant 正文流

### Task 5: 统一系统事件流

**Files:**
- Modify: `src/event-cards.ts`
- Modify: `src/chat-view.ts`
- Modify: `tests/event-cards.test.ts`
- Modify: `styles.css`

**Step 1: 扩展失败测试**

- `reasoning` 渲染成系统事件行
- `command / activity / file_change` 默认折叠
- 已展开状态在流式更新时保留
- 摘要文案使用 `已运行 / 已搜索 / 已编辑 / 已思考`

**Step 2: 实现最小渲染改动**

- reasoning 不再单独挂在 meta detail
- 统一走 `renderEventCard()`
- 只重做事件区，不动普通 assistant 正文

**Step 3: 补视觉样式**

- 事件默认是一行系统动作流
- 展开后显示内嵌明细
- 去掉重卡片感
