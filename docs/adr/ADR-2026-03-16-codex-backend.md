# ADR-2026-03-16: 首版后端采用 OpenAI Codex SDK

## 状态

- [x] 已采纳
- [ ] 提案中
- [ ] 已废弃
- [ ] 已替代

## 上下文

项目名为 `obsidian-codex`，但此前设计文档没有明确 `Codex` 的技术含义，导致以下关键问题无法落地：

- 无法确定首版依赖和运行时要求
- 无法确定流式响应、取消、会话恢复的能力边界
- 无法判断应该借鉴 Claudian 的哪些实现形态，哪些只适用于 Claude Code

同时，OpenAI 官方当前提供了两种本地集成路径：

- `codex exec` 非交互模式
- `@openai/codex-sdk` TypeScript SDK

Claudian 的参考价值主要在于“Obsidian UI + 本地 agent”这一整体模式，而不是直接复用其 Claude SDK 设计。

## 决策

首版后端采用 OpenAI 官方 `@openai/codex-sdk`，由插件在桌面端直接控制本地 Codex agent。

具体约束：

- `Codex` 在本项目中明确指 OpenAI Codex。
- 首版不直接对接 OpenAI 通用 HTTP API。
- 首版不以 `codex exec --json` 作为主接入面。
- 插件通过 SDK 的线程模型实现多轮会话。
- 侧边栏流式输出依赖 SDK 的 `runStreamed()`。
- 每轮请求通过 `AbortController` 执行取消。

## 理由

- 官方 Codex SDK文档明确将其定位为“更全面、更灵活”的应用内集成方式，适合把 Codex 嵌入自有应用。
- SDK 已提供 `startThread()`、`resumeThread()`、`run()`、`runStreamed()` 等直接对应聊天插件需求的能力。
- SDK 暴露 `workingDirectory`、`skipGitRepoCheck`、`sandboxMode`、`approvalPolicy` 等运行参数，便于在 Obsidian Vault 环境下施加约束。
- 相比 `codex exec`，SDK 更适合长驻的侧边栏聊天交互；`codex exec` 更适合脚本和 CI。

## 后果

正面影响：

- 可以直接围绕线程、流式事件和取消机制设计 MVP。
- 不需要自定义 CLI JSONL 解析层作为首版主路径。
- 可以用更少的本地架构抽象实现可工作的聊天体验。

负面影响：

- 运行环境需要满足 SDK 的 Node.js 要求。
- 插件仍然依赖本地 Codex CLI 存在且可调用。
- 若后续发现 Obsidian 桌面运行时与 SDK 兼容性不足，需要回退到 `codex exec --json` 方案。

## 替代方案

### 方案 A：`codex exec --json`

优点：

- 与官方 CLI 行为最贴近。
- JSONL 事件流适合脚本化消费。

缺点：

- 官方文档定位更偏自动化和 CI。
- 对侧边栏中的长期多轮交互不如 SDK 直接。

### 方案 B：直接调用 OpenAI 通用 API

优点：

- 自由度更高。

缺点：

- 会绕开 Codex 官方本地 agent 工作流。
- 需要自建更多代理、会话和工具调用约束，不符合首版目标。
