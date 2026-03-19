# 文档索引

这个目录存放 `obsidian-codex` 的设计文档、实现计划和架构决策记录。

## 当前优先阅读

如果你想快速了解当前实现状态，建议按这个顺序读：

1. `../README.md`
   - 面向使用者和开发者的当前能力说明、安装方式和限制
2. `plans/2026-03-19-session-history-design.md`
   - 最近 7 个历史会话、会话标题和切换语义
3. `adr/2026-03-19-session-history.md`
   - 为什么从 `lastSession` 升级为 `recentSessions + activeSessionId`
4. `adr/2026-03-18-vault-save-planner.md`
   - “保存到本地”目录规划的设计取舍

## 目录说明

### `plans/`

保存阶段性设计稿和实现计划。

当前仍然有效、且最值得参考的文档：

- `2026-03-16-obsidian-codex-design.md`
- `2026-03-16-obsidian-codex-implementation-plan.md`
- `2026-03-19-session-history-design.md`
- `2026-03-19-session-history-implementation-plan.md`

### `adr/`

保存已经落地的关键架构决策。

当前主要 ADR：

- `ADR-2026-03-16-codex-backend.md`
- `2026-03-18-vault-save-planner.md`
- `2026-03-19-session-history.md`

## 历史说明

- `adr/2026-03-18-persist-last-session.md` 记录了“只持久化最后一个会话”的阶段性方案。
- 该方案已被 `adr/2026-03-19-session-history.md` 的多会话模型取代，但保留原文用于追踪演进过程。
