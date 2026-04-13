# Status Bar Context Meter And External Contexts Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不引入多 provider 抽象的前提下，借鉴 Claudian 的底部托盘能力，补齐可组合的状态栏、显式标注的上下文估算表盘，以及安全版 external contexts。

**Architecture:** 保持现有 `StatusBar` 对外 API 基本不变，先把内部拆成可组合的渲染/格式化模块，再增加只展示估算值的 context meter。external contexts 不直接放宽执行权限，只允许用户显式登记只读外部目录根，并把目录下被显式选中的文件作为新的会话级上下文来源持久化。

**Tech Stack:** TypeScript, Obsidian Plugin API, Vitest, esbuild

---

### Task 1: 重构 StatusBar 内部结构

**Files:**
- Modify: `src/status-bar.ts`
- Create: `src/status-bar/formatters.ts`
- Test: `tests/status-bar.test.ts`

**Step 1: 写重构保护测试**

- 保留并补齐 `status-bar helpers` 相关断言，确保模型标签、reasoning 标签、执行状态、local usage 文案在重构前后保持一致。

**Step 2: 运行测试确认基线**

Run: `npm test -- tests/status-bar.test.ts`
Expected: PASS

**Step 3: 做最小重构**

- 把纯格式化逻辑迁到 `src/status-bar/formatters.ts`
- `src/status-bar.ts` 保留 `StatusBar` 类和现有对外导出
- 不改变现有 DOM className 和回调签名

**Step 4: 运行测试确认无回归**

Run: `npm test -- tests/status-bar.test.ts`
Expected: PASS

### Task 2: 增加 Estimated Context Meter

**Files:**
- Modify: `src/status-bar.ts`
- Modify: `src/status-bar/formatters.ts`
- Modify: `styles.css`
- Test: `tests/status-bar.test.ts`
- Test: `tests/styles.test.ts`

**Step 1: 先写失败测试**

- 为新的 meter 文案和 tooltip 写测试：
  - 展示 `Estimated` 或 `Est.` 明确标识
  - 百分比只基于 `threadCharsUsedEstimate / threadCharsLimitEstimate`
  - tooltip 明确说明不是 SDK authoritative thread window

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/status-bar.test.ts tests/styles.test.ts`
Expected: FAIL，缺少 meter 输出或样式断言

**Step 3: 写最小实现**

- 在状态栏中增加 meter DOM
- 使用 chars estimate 计算百分比并限制在 `0-100`
- 保留现有 `Local x / y` 文案，不把 meter 冒充为真实线程窗口
- 样式上做轻量进度条和标题说明

**Step 4: 跑测试确认通过**

Run: `npm test -- tests/status-bar.test.ts tests/styles.test.ts`
Expected: PASS

### Task 3: 增加 External Contexts 配置与校验

**Files:**
- Modify: `src/settings.ts`
- Modify: `src/settings-tab.ts`
- Create: `src/external-contexts.ts`
- Test: `tests/settings.test.ts`
- Create: `tests/external-contexts.test.ts`
- Test: `tests/settings-tab-source.test.ts`

**Step 1: 先写失败测试**

- 设置新增：
  - `externalContextRootsEnabled`
  - `persistentExternalContextRoots`
- 校验新增：
  - 必须是绝对路径
  - 去重
  - 父子目录冲突检测

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/settings.test.ts tests/settings-tab-source.test.ts tests/external-contexts.test.ts`
Expected: FAIL，缺少字段或校验函数

**Step 3: 写最小实现**

- `src/external-contexts.ts` 提供 sanitize/normalize/validate helper
- 设置页增加显式开关和目录根说明文案
- 首版先不接文件选择 UI，只把安全边界和持久字段立住

**Step 4: 跑测试确认通过**

Run: `npm test -- tests/settings.test.ts tests/settings-tab-source.test.ts tests/external-contexts.test.ts`
Expected: PASS

### Task 4: 会话级 External Context Items 持久化

**Files:**
- Modify: `src/chat-session.ts`
- Modify: `src/plugin-state.ts`
- Modify: `src/main.ts`
- Modify: `src/chat-view.ts`
- Modify: `src/context-builder.ts`
- Modify: `src/persistent-context.ts`
- Test: `tests/plugin-state.test.ts`
- Test: `tests/chat-runtime-controller.test.ts`
- Test: `tests/context-builder.test.ts`
- Test: `tests/persistent-context.test.ts`

**Step 1: 先写失败测试**

- `PersistentContextItem` 扩成区分 `vault-file` / `external-file`
- 只接受位于允许 external roots 下的 `external-file`
- draft 和 persisted session 都能保留 external items
- context builder 对 external files 和 vault files 采用同样的只读裁剪注入逻辑

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/plugin-state.test.ts tests/chat-runtime-controller.test.ts tests/context-builder.test.ts tests/persistent-context.test.ts`
Expected: FAIL，当前只支持 `vault-file`

**Step 3: 写最小实现**

- 扩展持久化结构和 sanitize 逻辑
- 在 `ChatView` 里保留 external item 的会话状态
- 注入 prompt 时只传显式选择的文件内容，不传整个目录

**Step 4: 跑测试确认通过**

Run: `npm test -- tests/plugin-state.test.ts tests/chat-runtime-controller.test.ts tests/context-builder.test.ts tests/persistent-context.test.ts`
Expected: PASS

### Task 5: External Context Selector UI

**Files:**
- Modify: `src/status-bar.ts`
- Modify: `src/chat-view.ts`
- Modify: `styles.css`
- Test: `tests/chat-view-source.test.ts`
- Test: `tests/styles.test.ts`

**Step 1: 先写失败测试**

- 状态栏出现 external contexts 入口、计数 badge、空状态提示
- 区分 draft session / saved session 的 external context 语义
- 不允许在未启用 settings 时展示入口

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/chat-view-source.test.ts tests/styles.test.ts`
Expected: FAIL，缺少入口或样式

**Step 3: 写最小实现**

- 在状态栏增加 external contexts 入口
- 展示持久项与会话项数量
- 支持移除单项、清空会话项、切换是否持久
- 首版如果 Obsidian 原生目录选择能力不足，先用文本路径输入 + 校验 + Notice 反馈

**Step 4: 跑测试确认通过**

Run: `npm test -- tests/chat-view-source.test.ts tests/styles.test.ts`
Expected: PASS

### Task 6: 全量验证

**Files:**
- Modify: `README.md`

**Step 1: 更新文档**

- 补充 status bar 的 Estimated meter 说明
- 补充 external contexts 的安全边界、开启方式、草稿/会话语义

**Step 2: 运行全量验证**

Run: `npm test`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

Run: `npm run build`
Expected: PASS
