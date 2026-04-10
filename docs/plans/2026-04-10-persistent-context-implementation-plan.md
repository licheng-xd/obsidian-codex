# Persistent Context Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把当前“单轮附件”升级为“会话级显式持久上下文”，让 `@文件` 和 `Pin current note` 能跨轮复用，同时保持当前笔记/当前选区仍然是临时上下文。

**Architecture:** 保持现有 `chat-view.ts + chat-runtime-controller.ts + context-builder.ts` 边界，不引入 provider 化上下文系统。通过给 `PersistedChatSession` 增加 `persistentContextItems`，让会话级显式上下文随会话一起持久化与恢复；发送时实时读取这些文件的最新内容，避免快照过时。

**Tech Stack:** TypeScript、Obsidian Plugin API、Vitest、esbuild、`@openai/codex-sdk`

---

### Task 1: 先写持久上下文数据模型的失败测试

**Files:**
- Modify: `tests/chat-session.test.ts`
- Modify: `src/chat-session.ts`

1. 在 `tests/chat-session.test.ts` 先增加失败测试，覆盖：
   - 旧会话数据缺少 `persistentContextItems` 时默认回填为 `[]`
   - 非法上下文项会被过滤
   - 合法 `vault-file` 路径能被保留
2. 运行：
   - `npm test -- tests/chat-session.test.ts`
3. 预期：
   - FAIL，因为 `chat-session.ts` 尚未支持新字段

### Task 2: 实现会话级持久上下文数据结构

**Files:**
- Modify: `src/chat-session.ts`
- Test: `tests/chat-session.test.ts`

1. 在 `src/chat-session.ts` 新增：
   - `PersistentContextItem`
   - `sanitizePersistentContextItem()`
   - `PersistedChatSession.persistentContextItems`
2. 保证旧数据兼容，不要求迁移脚本。
3. 运行：
   - `npm test -- tests/chat-session.test.ts`
4. 预期：
   - PASS

### Task 3: 为 prompt 组装逻辑先写失败测试

**Files:**
- Modify: `tests/context-builder.test.ts`
- Modify: `src/context-builder.ts`

1. 在 `tests/context-builder.test.ts` 增加失败测试，覆盖：
   - 持久上下文文件能进入 prompt
   - 当前轮附件和持久上下文共同存在时不会回归
   - 当前活动笔记如果已在持久上下文中，不重复注入
2. 运行：
   - `npm test -- tests/context-builder.test.ts`
3. 预期：
   - FAIL

### Task 4: 扩展 `context-builder.ts`

**Files:**
- Modify: `src/context-builder.ts`
- Test: `tests/context-builder.test.ts`

1. 扩展 `ContextInput`，新增：
   - `persistentContextItems`
2. 发送时拼装顺序保持清晰：
   - 当前选区
   - 当前笔记摘录
   - 会话级持久上下文文件
   - 当前轮临时附件
3. 持久上下文中的文件内容按当前轮实时读取，而不是在 session 中存内容快照。
4. 运行：
   - `npm test -- tests/context-builder.test.ts`
5. 预期：
   - PASS

### Task 5: 写持久上下文纯逻辑的失败测试

**Files:**
- Create: `src/persistent-context.ts`
- Create: `tests/persistent-context.test.ts`

1. 先写失败测试，覆盖：
   - 添加新文件时去重
   - 移除指定路径
   - 清空当前会话上下文
   - `Pin current note` 复用同一 `vault-file` 结构
2. 规划导出函数：
   - `addPersistentContextItem()`
   - `removePersistentContextItem()`
   - `clearPersistentContextItems()`
3. 运行：
   - `npm test -- tests/persistent-context.test.ts`
4. 预期：
   - FAIL

### Task 6: 实现持久上下文纯逻辑

**Files:**
- Create: `src/persistent-context.ts`
- Test: `tests/persistent-context.test.ts`

1. 实现最小纯函数集合。
2. 保持只支持 `vault-file`，不要提前抽象多类型 provider。
3. 运行：
   - `npm test -- tests/persistent-context.test.ts`
4. 预期：
   - PASS

### Task 7: 给主入口增加命令入口的失败测试

**Files:**
- Modify: `tests/main-source.test.ts`
- Modify: `src/main.ts`

1. 在 `tests/main-source.test.ts` 新增失败断言，要求 `main.ts` 包含：
   - `id: "pin-current-note"`
2. 运行：
   - `npm test -- tests/main-source.test.ts`
3. 预期：
   - FAIL

### Task 8: 在 `main.ts` 注册 `Pin current note`

**Files:**
- Modify: `src/main.ts`
- Test: `tests/main-source.test.ts`

1. 新命令行为：
   - 优先激活或获取 chat view
   - 调用 `ChatView.pinCurrentNote()`
2. 如果当前没有活动 Markdown 文件，由 `ChatView` 内部决定提示文案。
3. 运行：
   - `npm test -- tests/main-source.test.ts`
4. 预期：
   - PASS

### Task 9: 先锁定 `chat-view.ts` 的新 UI 结构

**Files:**
- Modify: `tests/chat-view-source.test.ts`
- Modify: `src/chat-view.ts`

1. 在 source test 里新增失败断言，要求：
   - 存在 `Session context` 区域
   - 存在 `This turn` 附件区域
   - 存在 `/clear-context` 或等效 clear action 处理逻辑
   - 存在 `pinCurrentNote()` 入口
2. 运行：
   - `npm test -- tests/chat-view-source.test.ts`
3. 预期：
   - FAIL

### Task 10: 在 `chat-view.ts` 增加会话级上下文状态与 UI

**Files:**
- Modify: `src/chat-view.ts`
- Modify: `styles.css`
- Test: `tests/chat-view-source.test.ts`

1. 新增状态：
   - `persistentContextItems`
2. 在 composer 区域渲染两个层次：
   - `Session context`
   - `This turn`
3. 支持动作：
   - `pinCurrentNote()`
   - 单项移除
   - 清空全部持久上下文
4. `@文件` 添加行为改为默认进入 `persistentContextItems`，不要再作为一次性文件附件处理。
5. 粘贴图片继续保持在 `This turn`。
6. 运行：
   - `npm test -- tests/chat-view-source.test.ts`

### Task 11: 让 runtime controller 持久化和恢复会话上下文

**Files:**
- Modify: `src/chat-runtime-controller.ts`
- Modify: `src/chat-view.ts`
- Modify: `src/chat-session.ts`

1. `persistActiveSession()` 写入 `persistentContextItems`
2. `restoreActiveSession()` 和 `activatePersistedSession()` 恢复 `persistentContextItems`
3. 保证：
   - 新会话不会污染历史会话上下文
   - 切换历史会话时一起切换对应上下文

### Task 12: 把持久上下文接入 `collectContext()`

**Files:**
- Modify: `src/chat-view.ts`
- Modify: `src/context-builder.ts`

1. `collectContext()` 在每轮发送时读取：
   - 当前选区 / 当前笔记
   - `persistentContextItems`
   - 当前轮图片附件
2. 持久文件内容读取沿用 Vault 当前内容。
3. 文件丢失时：
   - 本轮跳过
   - 不中断整个发送流程

### Task 13: 最小 slash command 支持 `/clear-context`

**Files:**
- Modify: `src/chat-view.ts`
- Modify: `tests/chat-view-source.test.ts`

1. 在现有输入框路径上新增最小解析：
   - 当输入精确匹配 `/clear-context` 时，不走普通发送
   - 直接清空当前会话的持久上下文
   - 清空输入框并给出状态反馈
2. 本轮不要扩展为完整 slash command registry。
3. 运行：
   - `npm test -- tests/chat-view-source.test.ts`

### Task 14: 更新 README 和设计文档

**Files:**
- Modify: `README.md`
- Create: `docs/plans/2026-04-10-persistent-context-design.md`
- Create: `docs/plans/2026-04-10-persistent-context-implementation-plan.md`

1. 在 `README.md` 明确记录：
   - `@文件` 现在是会话级显式上下文
   - 当前笔记 / 当前选区仍是临时上下文
   - 新增 `Pin current note`
   - 新增 `/clear-context`
2. 确认文档不要误写成：
   - 已支持外部目录
   - 已支持 MCP context
   - 已支持 provider 化上下文系统

### Task 15: 回归验证

**Files:**
- Modify: `src/chat-view.ts`
- Modify: `src/chat-runtime-controller.ts`
- Modify: `src/context-builder.ts`
- Modify: `src/chat-session.ts`
- Create: `src/persistent-context.ts`
- Create: `tests/persistent-context.test.ts`

1. 运行：
   - `npm test`
   - `npm run typecheck`
   - `npm run build`
2. 人工检查：
   - `@文件` 是否会进入会话级上下文
   - `Pin current note` 是否可用
   - `/clear-context` 是否只清空持久上下文
   - 切换最近会话时是否恢复各自上下文
   - 当前笔记 / 当前选区是否仍然只是临时上下文
