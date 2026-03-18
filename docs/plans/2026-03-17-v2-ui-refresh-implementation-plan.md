# Obsidian Codex V2 UI Refresh Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将聊天侧边栏重构为“克制空态 + 底部托盘”的深色界面，并把模型选择对齐官方客户端截图。

**Architecture:** 保留现有运行时与事件流逻辑，主要重构 `chat-view.ts` 的 DOM 结构、`status-bar.ts` 的展示形态、`event-cards.ts` 的视觉语言，以及 `styles.css` 的整体布局体系。新增少量纯函数支撑空态标题、模型选项和托盘格式化测试。

**Tech Stack:** TypeScript、Obsidian Plugin API、Vitest、esbuild

---

### Task 1: 更新模型与推理强度配置

**Files:**
- Modify: `src/types.ts`
- Modify: `src/settings.ts`
- Modify: `src/settings-tab.ts`
- Test: `tests/settings.test.ts`

1. 先写失败测试，覆盖新的模型默认值与推理强度默认值。
2. 更新模型预设与显示名映射。
3. 新增 `reasoningEffort` 设置与 sanitize 逻辑。
4. 验证测试通过。

### Task 2: 重构底部托盘组件

**Files:**
- Modify: `src/status-bar.ts`
- Test: `tests/status-bar.test.ts`

1. 先写失败测试，锁定新的格式化与模型显示行为。
2. 将当前状态栏组件重构为托盘底边控制条。
3. 支持模型胶囊、推理强度胶囊、工作目录标签、YOLO 开关。
4. 验证测试通过。

### Task 3: 重构事件卡片视觉语言

**Files:**
- Modify: `src/event-cards.ts`
- Test: `tests/event-cards.test.ts`

1. 先写或调整失败测试，锁定卡片 helper 行为。
2. 降噪卡片层级，统一标题/正文/状态结构。
3. 确保 reasoning、command、file_change、activity、error 都能复用同一视觉体系。
4. 验证测试通过。

### Task 4: 重构 Chat View 结构

**Files:**
- Modify: `src/chat-view.ts`
- Modify: `src/context-summary.ts`

1. 重排 DOM 结构：品牌头、中部画布、底部托盘。
2. 增加空态标题与会话态切换。
3. 将状态信息并入托盘，不再使用独立面板感布局。
4. 把模型和推理强度传入 `ThreadOptions`。

### Task 5: 重写样式

**Files:**
- Modify: `styles.css`

1. 全量替换旧布局样式。
2. 建立新的深色单画布层级。
3. 重做空态、托盘、胶囊控件、消息流、事件卡片、YOLO 开关。
4. 保持桌面侧边栏下的可滚动性与输入区稳定性。

### Task 6: 自动验证

**Files:**
- Test: `tests/*.ts`

1. 运行 `npm test`
2. 运行 `npm run typecheck`
3. 运行 `npm run build`
4. 检查 `git diff --stat`
