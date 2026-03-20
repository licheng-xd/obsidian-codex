# Mentions And Pasted Images Implementation Plan

日期：2026-03-20

## 目标

为聊天输入区增加两类显式附件能力，并把它们统一纳入发送时的上下文构建：

- Vault 内 Markdown 文件 `@引用`
- 粘贴图片附件

## 实施原则

- 不把 `@file` token 或图片内容直接混进用户正文
- `chat-view.ts` 负责维护附件状态与交互
- `context-builder.ts` 负责把附件转换成结构化 prompt 文本
- 继续沿用当前单字符串 prompt 发送链路

## 实施批次

### 批次一：纯函数与上下文层

- 定义统一 `ComposerAttachment` 模型
- 提炼 `@query` 解析与 Vault 路径搜索排序
- 扩展 `ContextInput.attachments`
- 增加图片缓存目录写入能力

### 批次二：输入区交互

- 在输入框里监听 `@query`
- 渲染文件候选 dropdown
- 选择文件后替换为 attachment chip
- 监听 `paste`，识别图片并落盘
- 支持移除附件并清理图片缓存

### 批次三：文档与验收

- 更新设计文档与 README
- 记录输入区附件架构 ADR
- 完成 `test`、`typecheck`、`build`

## 范围边界

- `@引用` 只支持当前 Vault 内 Markdown 文件
- 图片只支持粘贴，不支持拖拽与外链
- 不扩展到外部目录、MCP、slash commands 或内联编辑
