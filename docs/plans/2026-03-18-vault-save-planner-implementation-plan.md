# Vault Save Planner Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为“保存到本地”请求增加基于 Vault 规范、目录结构和内容类型的推荐目录规划，避免默认落到 Vault 根目录。

**Architecture:** 新增纯逻辑 `vault-save-planner` 模块，先从 Vault 根目录规范文件提取目录用途，再结合目录结构样本与内容类型做打分，最后把推荐目录、原因与兜底链注入 `context-builder`。`chat-view.ts` 只负责采集 planner 所需的 Vault 信号，不承担规则判断。

**Tech Stack:** TypeScript、Obsidian Plugin API、Vitest、esbuild

---

### Task 1: 定义 planner 输入输出与失败测试

**Files:**
- Create: `src/vault-save-planner.ts`
- Create: `tests/vault-save-planner.test.ts`

1. 先写失败测试，定义 planner 的输入输出结构：
   - `guidanceDocuments`
   - `directorySnapshot`
   - `activeNotePath`
   - `userInput`
   - `draftTitle`
   - `draftExcerpt`
   - `preferredDirectory`
   - `reason`
   - `confidence`
   - `fallbackChain`
2. 覆盖最小场景：
   - 无规范文件、无目录样本、无当前笔记时回退 Vault 根目录
   - 有当前笔记时回退同级目录
3. 运行 `npm test -- tests/vault-save-planner.test.ts`
4. 预期先失败，再补最小实现。

### Task 2: 实现规范文件规则提取

**Files:**
- Modify: `src/vault-save-planner.ts`
- Test: `tests/vault-save-planner.test.ts`

1. 先写失败测试，覆盖根目录规范文件中显式提到目录用途的场景。
2. 实现最小规则提取：
   - 从 `README*`、`index*`、`MOC*`、`指南*`、`约定*`、`说明*` 文本中提取“类型 -> 目录”映射
   - 只需要支持第一版常见类型：`report`、`analysis`、`meeting-note`、`project-doc`、`research-note`、`daily-note`
3. 运行 `npm test -- tests/vault-save-planner.test.ts`
4. 提交最小通过实现。

### Task 3: 实现目录结构与命名分布推断

**Files:**
- Modify: `src/vault-save-planner.ts`
- Test: `tests/vault-save-planner.test.ts`

1. 先写失败测试，覆盖没有规范文件时仅靠目录结构推断的场景。
2. 实现目录用途推断：
   - 顶层目录名关键词匹配
   - 示例文件名关键词匹配
   - 构造候选目录与用途分值
3. 保持实现纯函数，不依赖 Obsidian API。
4. 运行 `npm test -- tests/vault-save-planner.test.ts`

### Task 4: 实现内容类型分类与最终打分

**Files:**
- Modify: `src/vault-save-planner.ts`
- Test: `tests/vault-save-planner.test.ts`

1. 先写失败测试，覆盖多个候选目录都合理时按内容类型优先的场景。
2. 实现内容类型分类：
   - 从 `userInput`、`draftTitle`、`draftExcerpt` 提取关键词
   - 匹配到预定义类型集合
3. 合并三层打分：
   - 规范文件命中
   - 目录结构与命名分布
   - 内容类型匹配
4. 输出 `preferredDirectory`、`reason`、`confidence`、`fallbackChain`
5. 运行 `npm test -- tests/vault-save-planner.test.ts`

### Task 5: 采集 Vault 规范文件与目录快照

**Files:**
- Modify: `src/chat-view.ts`
- Test: `tests/context-builder.test.ts`

1. 先写失败测试或调整现有测试，锁定新的保存提示文案。
2. 在 `chat-view.ts` 中增加轻量采集逻辑：
   - 读取 Vault 根目录下少量规范文件候选
   - 读取顶层目录与有限文件名样本
   - 采集当前打开笔记路径
3. 调用 `vault-save-planner` 生成推荐目录结果。
4. 保证异常时自动降级，不影响普通聊天流程。

### Task 6: 将 planner 结果注入 prompt

**Files:**
- Modify: `src/context-builder.ts`
- Test: `tests/context-builder.test.ts`

1. 先写失败测试，覆盖以下文案：
   - 推荐目录
   - 推荐原因
   - 兜底链
2. 调整 `ContextInput`，让其接收 planner 结果。
3. 将旧的“当前笔记同级目录优先”静态提示替换为 planner 驱动的提示。
4. 运行：
   - `npm test -- tests/context-builder.test.ts`
   - `npm test -- tests/vault-save-planner.test.ts`

### Task 7: 记录架构决策与用户文档

**Files:**
- Create: `docs/adr/2026-03-18-vault-save-planner.md`
- Modify: `README.md`

1. 记录为什么选择“规则驱动 planner + prompt 注入”，而不是直接让模型猜目录。
2. 在 README 中说明保存目录推荐的优先级和回退链。
3. 保持文档与实际实现一致。

### Task 8: 全量验证

**Files:**
- Test: `tests/*.ts`

1. 运行 `npm run typecheck`
2. 运行 `npm test`
3. 运行 `npm run build`
4. 检查 `git diff --stat`
5. 仅在验证全绿后再继续合并或提交功能代码
