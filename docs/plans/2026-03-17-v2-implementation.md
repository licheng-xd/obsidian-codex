# Obsidian Codex V2 实现计划

## Context

当前 `main` 已完成 V1 MVP：单侧边栏聊天、基础文本流式响应、上下文注入、设置页、运行时探针、Vault root 作为默认工作目录、图标与基础交互优化。

V2 不再重复修已经落地的 V1 骨架，而是聚焦于把聊天体验向 Codex CLI 的结构化反馈靠拢：补齐更多事件类型展示、增加状态动画、补上底部状态栏中的模型切换、上下文用量信息与 YOLO 开关。

## 当前 Main 基线（不在 V2 中重复实现）

1. `CodexService` 已经是实例化 class，不再是模块级单例。
2. `codexPath` 已通过 settings 动态注入，CLI 路径修改后能影响后续会话。
3. `selectionchange` 已有 debounce，`chat-view.ts` 不需要再重复补这一项。
4. `@modelcontextprotocol/sdk` 已不在运行时依赖中，不再需要执行“迁移 devDependencies”。
5. `ChatView` 已默认将 `workingDirectory` 指向当前 Vault root。
6. `main.ts` 已完成 `CodexService` 注入，不再把它当作 V2 的修复项。
7. 当前仍需在 V2 中顺手修正的基线问题：`settings-tab.ts` 的 onChange 仍使用直接 mutation。

## 用户确认的需求

1. **核心 CLI 对齐**: 重点展示 `agent_message`、`reasoning`、`command_execution`、`file_change` 四类核心 item。
2. **非核心事件不静默丢失**: `error`、`mcp_tool_call`、`web_search`、`todo_list` 等真实 SDK item 也必须有可见反馈，至少不能默默变成 `noop`。
3. **动画效果**: thinking/等待有脉冲动画，命令执行有 spinner，完成/失败有状态图标。
4. **底部状态栏**:
   - 模型展示与切换：使用当前官方 Codex 系列预设，允许自定义。
   - Context 用量：展示本地注入字符占比 + SDK 本轮 usage 明细，不伪造“线程上下文窗口百分比”。
   - YOLO 开关：保持**持久化**设计，开启后使用 `approvalPolicy='never'` + `sandboxMode='danger-full-access'`。

## 关键设计约束

1. **SDK usage 语义**: `turn.completed.usage` 代表本轮输入/缓存输入/输出 token，用于显示“last turn usage”，不能表示整个线程已占用多少上下文窗口。
2. **YOLO 持久化是显式产品决策**: 虽然它提高风险，但本轮按用户要求继续保持持久化；计划中必须同步要求红色警示、默认关闭、设置页明确文案、README 与 ADR 记录。
3. **模型预设必须使用当前官方模型 ID**: 截至 `2026-03-17`，不再把 `o3`、`o4-mini`、`codex-mini` 作为默认预设。
4. **事件映射只对真正未知事件返回 `noop`**: 已知 SDK item 类型必须有明确映射或降级展示策略。

---

## 任务分解

### Task 1: V2 类型定义 + 主干基线同步

**修改文件:**
- `src/settings-tab.ts` — onChange 回调中使用 `{ ...this.plugin.settings, field: value }` 替代直接 mutation，并为危险模式显示明确警示文案。
- `src/settings.ts` — 补充 V2 settings 字段、默认值、sanitize 兼容处理。

**新建文件:**
- `src/types.ts` — V2 类型定义、模型预设、上下文用量定义。

`src/types.ts` 核心内容：

```typescript
export type MappedEvent =
  | MappedTextEvent
  | MappedReasoningEvent
  | MappedCommandEvent
  | MappedFileChangeEvent
  | MappedActivityEvent
  | MappedTurnStartedEvent
  | MappedTurnCompletedEvent
  | MappedTurnFailedEvent
  | MappedErrorEvent
  | MappedNoopEvent;

export const MODEL_PRESETS = [
  "gpt-5-codex",
  "gpt-5.2-codex",
  "gpt-5.1-codex-mini"
] as const;

export interface ContextUsage {
  readonly localCharsUsed: number;
  readonly localCharsLimit: number;
  readonly sdkInputTokens: number | null;
  readonly sdkCachedInputTokens: number | null;
  readonly sdkOutputTokens: number | null;
}
```

`MappedActivityEvent` 用于承载 `mcp_tool_call`、`web_search`、`todo_list` 等非核心但真实发生的活动事件。

**测试:** `src/types.ts` 由编译器约束；`tests/settings.test.ts` 覆盖 settings 默认值与 sanitize 边界。

**验证:** `npm run typecheck && npm run test` 通过

---

### Task 2: 扩展事件映射

**修改文件:**
- `src/codex-service.ts` — `mapThreadEvent()` 返回 `MappedEvent` 联合类型，并补齐真实 SDK item 类型覆盖。
- `tests/codex-service.test.ts` — 为每种已知映射路径补测试。

**映射规则（基于 SDK `index.d.ts` 中的精确类型）:**

| SDK 事件 | item.type | → MappedEvent |
|----------|-----------|---------------|
| item.started/updated/completed | agent_message | `{ type: "text", itemId, text }` |
| item.started/updated/completed | reasoning | `{ type: "reasoning", itemId, text }` |
| item.started/updated/completed | command_execution | `{ type: "command", itemId, command, aggregatedOutput, status, exitCode? }` |
| item.completed | file_change | `{ type: "file_change", itemId, changes[], status }` |
| item.started/updated/completed | mcp_tool_call | `{ type: "activity", activityType: "mcp_tool_call", ... }` |
| item.started/updated/completed | web_search | `{ type: "activity", activityType: "web_search", ... }` |
| item.started/updated/completed | todo_list | `{ type: "activity", activityType: "todo_list", ... }` |
| item.started/updated/completed | error | `{ type: "error", itemId?, message }` |
| turn.started | — | `{ type: "turn_started" }` |
| turn.completed | — | `{ type: "turn_completed", usage }` |
| turn.failed | — | `{ type: "turn_failed", message }` |
| error | — | `{ type: "error", message }` |
| 其他未知新事件 | — | `{ type: "noop" }` |

实现要求：

1. `noop` 只保留给当前未识别的新 SDK 事件，不能再吞掉已知 item。
2. `turn.completed.usage` 只透传本轮 `input/cached/output`，不在 service 层推导伪“上下文占用百分比”。

**验证:** `npm run test` 通过

---

### Task 3: 扩展 Settings

**修改文件:**
- `src/settings.ts` — 新增字段、扩展 `SandboxMode`、补齐默认值与兼容逻辑。
- `src/settings-tab.ts` — sandbox dropdown 增加 `danger-full-access`，并为 YOLO 持久化增加显式风险说明。
- `README.md` — 明确记录 YOLO 是持久化设置、默认关闭、开启后的安全影响。

**新建文件:**
- `docs/adr/2026-03-17-persistent-yolo-mode.md` — 记录“YOLO 为持久化设置”的取舍与风险。
- `tests/settings.test.ts` — 覆盖 `sanitizePluginSettings()` 的边界情况。

新增字段：

```typescript
export interface PluginSettings {
  // ... existing fields ...
  model: string;      // 默认 "gpt-5-codex"
  yoloMode: boolean;  // 默认 false，持久化
}

export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";
```

YOLO 开关行为：

1. 开启：持久化 `yoloMode=true`，线程参数覆盖为 `approvalPolicy='never'` + `sandboxMode='danger-full-access'`。
2. 关闭：持久化 `yoloMode=false`，恢复 settings 中非 YOLO 的默认审批与沙箱策略。
3. 若用户在 settings tab 手动调整 `sandboxMode` / `approvalPolicy`，但组合不再等价于 YOLO，则自动关闭 `yoloMode`，避免持久化状态与真实线程参数不一致。

**验证:** `npm run typecheck && npm run test` 通过

---

### Task 4: 事件卡片渲染器

**新建文件:**
- `src/event-cards.ts` — 将不同 `MappedEvent` 渲染为 DOM 元素。
- `tests/event-cards.test.ts` — 覆盖纯辅助函数。

五种卡片类型 + 错误态：

1. **文本卡片** (`agent_message`): 沿用 V1 消息气泡样式。
2. **推理卡片** (`reasoning`): 可折叠、灰色调文本，默认收起。
3. **命令卡片** (`command_execution`): 终端图标 + 命令文本 + 状态指示器（spinner/✓/✗）+ 可折叠输出。
4. **文件变更卡片** (`file_change`): 文件图标 + 变更列表（add/delete/update 标签）。
5. **活动卡片** (`activity`): 用于 `mcp_tool_call`、`web_search`、`todo_list` 的摘要展示，至少展示类型、标题和简要状态。
6. **错误态** (`error` / `turn_failed`): 红色错误提示，不与活动卡片混淆。

核心 API:

```typescript
export function renderEventCard(
  containerEl: HTMLElement,
  event: MappedEvent,
  existingEl?: HTMLElement
): HTMLElement;
```

纯辅助函数（可测试）:

```typescript
export function describeFileChangeKind(kind: "add" | "delete" | "update"): string;
export function formatExitCode(code: number | undefined): string;
export function describeActivityType(type: "mcp_tool_call" | "web_search" | "todo_list"): string;
```

---

### Task 5: 底部状态栏

**新建文件:**
- `src/status-bar.ts` — `StatusBar` class 管理底部 DOM。
- `tests/status-bar.test.ts` — 覆盖格式化函数。

DOM 结构：

```
.obsidian-codex-statusbar
  .obsidian-codex-statusbar-model
    <select> (gpt-5-codex | gpt-5.2-codex | gpt-5.1-codex-mini | Custom...)
    <input>  (自定义模型名，选择 Custom 时显示)
  .obsidian-codex-statusbar-context
    "Local: 2.1k / 4k"
    "Last turn: in 12k / cached 2k / out 800"
  .obsidian-codex-statusbar-yolo
    <label>YOLO</label>
    <toggle>
    (激活时容器增加 .is-yolo-active，红色警示背景)
```

API:

```typescript
export class StatusBar {
  constructor(containerEl, initialModel, initialYolo, callbacks);
  updateContextUsage(usage: ContextUsage): void;
  updateModel(model: string): void;
  updateYolo(enabled: boolean): void;
  destroy(): void;
}
```

纯格式化函数（可测试）:

```typescript
export function formatContextLocal(used: number, limit: number): string;
export function formatLastTurnUsage(
  input: number | null,
  cached: number | null,
  output: number | null
): string;
```

状态栏约束：

1. 本地上下文仍显示 `used / limit`。
2. SDK usage 显示的是“本轮 usage 明细”，不是“整个线程已占用多少上下文窗口”。
3. YOLO toggle 直接写回持久化 settings，并在 UI 上持续反映当前高风险状态。

---

### Task 6: Chat View 改造

**修改文件:**
- `src/chat-view.ts` — 集成事件卡片、思考动画、状态栏和更完整的事件循环。

关键变更：

1. **Thinking 指示器**: `turn.started` 显示脉冲动画（三个点）；收到第一个可见 item 后隐藏。
2. **事件循环重写**: `handleSend()` 中根据 `mapped.type` 分发到不同渲染路径，使用 `Map<itemId, HTMLElement>` 追踪卡片元素实现 in-place 更新。
3. **状态栏集成**: `render()` 末尾创建 `StatusBar` 实例，注入到 composer 下方。
4. **模型传递**: `buildThreadOptions()` 增加 `model` 字段从 settings 读取。
5. **YOLO 传递**: `buildThreadOptions()` 根据持久化 `yoloMode` 覆盖 `approvalPolicy` 和 `sandboxMode`。
6. **Context 用量**: `turn.completed` 事件触发 `statusBar.updateContextUsage()`，写入本地注入统计和本轮 SDK usage。
7. **非核心事件可见性**: `activity` / `error` 路径必须进入 UI，不能被 silently dropped。

说明：

1. `main.ts` 中的 `CodexService` 注入已在当前主干完成，不再作为 V2 范围内的重复工作。
2. 本任务不新增“线程上下文窗口百分比”推导逻辑。

---

### Task 7: CSS 动画与卡片样式

**修改文件:**
- `styles.css` — 新增以下样式块。

1. **思考动画**: `.obsidian-codex-thinking` + `@keyframes obsidian-codex-pulse`（三个脉冲圆点）。
2. **卡片基础**: `.obsidian-codex-card` 带左侧彩色边框。
3. **推理卡片**: `.is-reasoning` 灰色边框 + 斜体淡色文本 + 折叠动画。
4. **命令卡片**: `.is-command` 蓝色边框 + monospace 字体 + spinner/checkmark/X 状态。
5. **文件变更卡片**: `.is-file-change` 黄色边框 + add（绿）/delete（红）/update（黄）标签。
6. **活动卡片**: `.is-activity` 使用中性或青色边框，和命令/文件变更视觉区分。
7. **错误态**: `.is-error` 使用红色边框和醒目提示。
8. **状态栏**: `.obsidian-codex-statusbar` + `.is-yolo-active` 红色警示态。
9. **Spinner 动画**: `@keyframes obsidian-codex-spin`。

所有颜色使用 Obsidian CSS 变量（`--color-green`、`--color-red`、`--color-yellow`、`--interactive-accent`、`--text-muted` 等）。

---

## 文件变更汇总

**新建 (7):**
| 文件 | 用途 | 预估行数 |
|------|------|---------|
| `src/types.ts` | V2 类型定义、模型预设、上下文用量 | ~120 |
| `src/event-cards.ts` | 事件卡片渲染 + 辅助函数 | ~220 |
| `src/status-bar.ts` | 底部状态栏组件 | ~180 |
| `docs/adr/2026-03-17-persistent-yolo-mode.md` | YOLO 持久化决策记录 | ~80 |
| `tests/settings.test.ts` | settings sanitize 与 YOLO 兼容逻辑测试 | ~80 |
| `tests/event-cards.test.ts` | 卡片辅助函数测试 | ~60 |
| `tests/status-bar.test.ts` | 状态栏格式化函数测试 | ~70 |

**修改 (6):**
| 文件 | 主要变更 |
|------|---------|
| `src/codex-service.ts` | 扩展 `mapThreadEvent()`，补齐真实 SDK item 类型覆盖 |
| `src/settings.ts` | 新增 `model` / `yoloMode` + 扩展 `SandboxMode` |
| `src/settings-tab.ts` | 修复 mutation + `danger-full-access` + YOLO 风险提示 |
| `src/chat-view.ts` | 事件循环重写 + 动画 + 状态栏集成 |
| `styles.css` | 动画、卡片、状态栏样式 |
| `README.md` | 补充模型预设与 YOLO 持久化说明 |

**扩展测试 (1):**
| 文件 | 覆盖范围 |
|------|---------|
| `tests/codex-service.test.ts` | 扩展事件映射与 usage 语义测试 |

## 任务依赖

```
Task 1 (types + settings baseline)
  ├─→ Task 2 (事件映射) ─────→ Task 6 (Chat View)
  ├─→ Task 3 (Settings) ────→ Task 5 (状态栏) ──→ Task 6
  └─→ Task 4 (事件卡片) ────→ Task 6
                                       ↓
                               Task 7 (CSS)
```

Task 2/3/4 可并行开发。Task 6 是集成点。Task 7 可与 Task 6 同步进行。

## 验证计划

1. `npm run typecheck` — 类型检查通过。
2. `npm run test` — 所有测试通过。
3. `npm run build` — 构建成功。
4. 手工验证：
   - 发送消息后看到 thinking 脉冲动画。
   - 命令执行时看到 spinner，完成后变为 ✓，失败时变为 ✗。
   - 推理摘要以折叠灰色卡片展示。
   - 文件变更卡片正确显示 add/delete/update 标签。
   - `mcp_tool_call`、`web_search`、`todo_list` 不会静默消失，至少展示为活动卡片。
   - item 级错误和 turn 级错误都能进入可见错误态。
   - 底部状态栏：模型下拉切换生效，自定义模型输入可用。
   - 底部状态栏：Context 显示为 `Local used/limit` + `Last turn input/cached/output`，不再出现伪“SDK 百分比”。
   - YOLO 开关：开启时红色警示、重载插件后保持开启；关闭后持久化恢复为关闭态。
   - 设置页手动改动 `sandboxMode` / `approvalPolicy` 后，若不再等价于 YOLO 组合，`yoloMode` 自动关闭。
