# Lightweight UX Polish Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不新增独立面板和新持久化模型的前提下，补齐现有侧栏/设置页的可发现性、反馈一致性和澄清承接。

**Architecture:** 继续复用现有 `chat-view` 作为主交互容器，把轻量增强聚焦在 slash commands、session context 提示、settings 文案和 inline edit 反馈四个点。保持现有 `src/prompt/`、`chat-runtime-controller` 和 draft/session context 存储边界不变，只做最小 UI 和文案增强。

**Tech Stack:** TypeScript, Obsidian Plugin API, Vitest, esbuild

---

### Task 1: 最小 slash commands 集合

**Files:**
- Modify: `src/chat-view.ts`
- Test: `tests/chat-view-source.test.ts`

**Step 1: 写失败测试**

在 `tests/chat-view-source.test.ts` 里新增断言，要求源码包含：
- `/help`
- `/pin-current-note`
- `/context-status`
- slash command 解析分发逻辑

**Step 2: 跑测试确认失败**

Run: `npm test -- tests/chat-view-source.test.ts`
Expected: FAIL，缺少新增命令或处理逻辑

**Step 3: 写最小实现**

在 `src/chat-view.ts`：
- 增加 slash command 解析函数
- 让 Enter 提交前先分发 slash command
- 支持 `/help`、`/pin-current-note`、`/context-status`、`/clear-context`

**Step 4: 跑测试确认通过**

Run: `npm test -- tests/chat-view-source.test.ts`
Expected: PASS

### Task 2: session context 操作反馈和草稿/会话状态提示

**Files:**
- Modify: `src/chat-view.ts`
- Modify: `src/context-summary.ts`
- Modify: `styles.css`
- Test: `tests/chat-view-source.test.ts`
- Test: `tests/context-summary.test.ts`
- Test: `tests/styles.test.ts`

**Step 1: 写失败测试**

新增断言，要求：
- attachment strip 显示草稿态或会话态标签
- 重复 pin / 已存在上下文有明确反馈
- context summary 能区分 draft session 与 persisted session

**Step 2: 跑测试确认失败**

Run: `npm test -- tests/chat-view-source.test.ts tests/context-summary.test.ts tests/styles.test.ts`
Expected: FAIL

**Step 3: 写最小实现**

在现有 `Session context` 区块补充：
- `Draft session` / `Saved session` 状态标签
- 对重复 pin 给出 Notice
- tooltip summary 添加 session state

**Step 4: 跑测试确认通过**

Run: `npm test -- tests/chat-view-source.test.ts tests/context-summary.test.ts tests/styles.test.ts`
Expected: PASS

### Task 3: 设置页文案产品化

**Files:**
- Modify: `src/settings-tab.ts`
- Test: `tests/settings-tab-source.test.ts`

**Step 1: 写失败测试**

新增断言，要求设置页源码明确说明：
- `Your name` 只影响主聊天 prompt
- `Custom instructions` 会追加到 system prompt
- 不会修改历史会话或替代显式上下文

**Step 2: 跑测试确认失败**

Run: `npm test -- tests/settings-tab-source.test.ts`
Expected: FAIL

**Step 3: 写最小实现**

更新 `src/settings-tab.ts` 里的文案与示例，不改设置结构。

**Step 4: 跑测试确认通过**

Run: `npm test -- tests/settings-tab-source.test.ts`
Expected: PASS

### Task 4: inline edit clarification 升级为稳定侧栏反馈

**Files:**
- Modify: `src/chat-view.ts`
- Modify: `src/inline-edit-controller.ts`
- Modify: `styles.css`
- Test: `tests/chat-view-source.test.ts`
- Test: `tests/styles.test.ts`

**Step 1: 写失败测试**

新增断言，要求源码包含：
- 侧栏内 clarification 提示区
- inline edit clarification 走插件/视图反馈接口，而不是单纯 `Notice`

**Step 2: 跑测试确认失败**

Run: `npm test -- tests/chat-view-source.test.ts tests/styles.test.ts`
Expected: FAIL

**Step 3: 写最小实现**

在 `chat-view` 增加一个轻量 clarification banner：
- 可显示最近一次 inline edit clarification
- 可清除
- `inline-edit-controller` 优先调用该反馈接口；无视图时再 fallback 到 `Notice`

**Step 4: 跑测试确认通过**

Run: `npm test -- tests/chat-view-source.test.ts tests/styles.test.ts`
Expected: PASS

### Task 5: README 同步

**Files:**
- Modify: `README.md`

**Step 1: 更新文档**

补充：
- slash commands 用法
- draft session / saved session 语义
- settings 的使用边界
- inline edit clarification 反馈方式

**Step 2: 验证**

Run: `npm test -- tests/chat-view-source.test.ts tests/settings-tab-source.test.ts`
Expected: PASS

### Final Verification

**Step 1: 全量测试**

Run: `npm test`
Expected: PASS

**Step 2: 类型检查**

Run: `npm run typecheck`
Expected: PASS

**Step 3: 构建**

Run: `npm run build`
Expected: PASS
