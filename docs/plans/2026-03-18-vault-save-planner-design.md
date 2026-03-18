# Vault Save Planner Design

## 背景

当前插件在“保存到本地”这类请求下，主要依赖 Codex 自己根据工作目录做相对路径写入。由于 `workingDirectory` 固定是 Vault 根目录，且 prompt 中没有稳定的目录规划结果，agent 很容易直接把新文件写到 Vault 根目录。这种行为没有利用 Vault 现有的组织方法论，也不符合用户对“像 Claudian 一样智能选择目录”的预期。

## 目标

为 Obsidian Codex 增加一层可解释、可测试的 `Vault Save Planner`，在 agent 生成或保存新文件前，先由插件推导出推荐保存目录，并把该结果明确注入 prompt。目录决策顺序固定为：

1. 优先读取 Vault 根目录下的规范文件，抽取目录用途规则。
2. 如果规范不充分，再分析目录结构和现有文件命名分布。
3. 在多个候选目录中，优先选择与“要保存的内容类型”最匹配的目录。
4. 如果仍无高置信度结论，回退到当前笔记同级目录。
5. 如果当前没有打开笔记，再回退到 Vault 根目录。

## 非目标

1. 本轮不拦截底层文件写入，也不重写 Codex SDK 的工具调用。
2. 本轮不做交互式目录确认弹窗。
3. 本轮不尝试做通用语义搜索或 embedding 检索。

## 设计概览

### 1. 模块边界

新增纯逻辑模块 `src/vault-save-planner.ts`，只负责根据 Vault 信号计算推荐目录，不依赖 Obsidian 视图状态。`chat-view.ts` 负责收集 Vault 根目录下的规范文件、目录结构与当前笔记路径，并将这些输入传给 planner。`context-builder.ts` 负责把 planner 结果以明确、稳定的文案写入 prompt。

### 2. 输入信号

Planner 输入分四类：

1. `guidanceDocuments`
   - Vault 根目录下的 `README*`、`index*`、`MOC*`、`指南*`、`约定*`、`说明*`
   - 只读取少量候选文件，避免把整个 Vault 文本灌进 prompt
2. `directorySnapshot`
   - 顶层目录名
   - 目录下有限数量的示例文件名
3. `contentSignals`
   - 用户当前请求文本
   - 待保存内容的标题、首段、文件名草案或类型特征
4. `contextSignals`
   - 当前打开笔记路径
   - Vault 根目录路径

### 3. 决策链

Planner 固定按以下顺序打分：

1. 规范文件命中
   - 如果规范文档中明确写了“某类内容放某目录”，这是最高权重
2. 目录用途推断
   - 根据目录名与文件名样本推断目录用途，例如 `Projects`、`Research`、`Meetings`、`Daily`
3. 内容类型匹配
   - 在多个可行目录中，优先选最适合当前内容类型的目录
4. 兜底链
   - 当前笔记同级目录
   - Vault 根目录

### 4. 内容类型分类

第一版只做可控的规则分类，不做开放式语义理解。类型包括：

- `report`
- `analysis`
- `meeting-note`
- `project-doc`
- `research-note`
- `daily-note`
- `general-note`

类型判断同时参考：

- 用户请求里的关键词
- 生成内容的标题或首段
- 候选文件名中的词

### 5. 输出结构

Planner 输出一个明确结果：

- `preferredDirectory`
- `reason`
- `confidence`
- `fallbackChain`

`context-builder.ts` 将其写入 prompt，例如：

```text
Local save guidance:
- Preferred directory: Projects/AI/reports
- Reason: Vault guidance says reports belong under Projects/AI/reports, and the content is classified as a report.
- Fallbacks: current note directory -> vault root
- When saving locally, use the preferred directory unless the user explicitly asks for a different location.
```

### 6. 错误处理与降级

1. 规范文件读取失败时，不报错中断，直接降级到目录结构分析。
2. 目录结构无法推断时，不报错中断，继续按内容类型 + 兜底链处理。
3. 如果 planner 无法形成高置信度结论，`reason` 必须明确说明已降级。
4. 最终必须始终返回可用目录：
   - 当前笔记同级目录
   - 或 Vault 根目录

## 测试策略

优先给 planner 写纯单元测试，覆盖：

1. 规范文件明确命中目录
2. 无规范文件时从目录结构推断
3. 多候选目录时按内容类型优先
4. 无高置信度结论时退回当前笔记同级目录
5. 无当前笔记时退回 Vault 根目录
6. Prompt 中正确展示推荐目录、原因和兜底链

## 约束

1. 不改变当前会话恢复、工作目录、SDK 调用和 YOLO 行为。
2. 设计必须保持 Obsidian 桌面端性能可接受，不能全量扫描整个 Vault 内容。
3. 只有明确推荐目录时才引导 agent 使用；不能伪造“智能结果”。
4. 文案必须可解释，便于用户理解为什么文件会保存到某目录。
