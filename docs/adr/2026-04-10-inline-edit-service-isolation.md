# 2026-04-10 Inline Edit 请求隔离

## 背景

迭代 2 要把 inline edit 做成编辑器内直接发起、确认后写回的能力。

当前聊天侧边栏已经通过 `CodexService` 维持一个有状态的 thread：

- `createThread()` / `resumeThread()` 会写入 `currentThread`
- `sendMessage()` 会复用当前 thread
- `cancelCurrentTurn()` 也直接针对当前 service 上的活动 turn

如果 inline edit 直接复用聊天侧边栏那一份 `CodexService`，会带来两个问题：

1. 一次局部改写可能覆盖当前聊天 thread 绑定
2. inline edit 的取消或异常可能误伤正在进行的聊天回合

这已经不是单一 UI 决策，而是一次跨模块的运行时边界决策。

## 备选方案

### 方案 A：inline edit 直接复用插件级 `codexService`

优点：

- 实现最省事
- 不需要新增任何请求隔离逻辑

缺点：

- 会污染当前聊天会话的 thread 状态
- 编辑器能力和侧边栏会话强耦合
- 一旦两者交错使用，行为很难向用户解释

### 方案 B：每次 inline edit 创建独立 `CodexService`

优点：

- inline edit 与 chat thread 完全隔离
- 不会破坏当前会话工作台的连续性
- 取消、失败、空返回都只影响当前编辑命令

缺点：

- 每次 inline edit 都是一次独立请求，不复用 chat thread 上下文
- 需要单独构造 prompt 和运行参数

### 方案 C：把 `CodexService` 重构为多 thread 池

优点：

- 理论上最通用

缺点：

- 当前项目还没有第二个长期会话面板
- 会明显超出迭代 2 的最小闭环目标
- 会把“编辑闭环”问题提前升级成“复杂运行时管理”问题

## 决策

采用方案 B：

1. 侧边栏聊天继续持有插件级 `codexService`
2. 每次 inline edit 请求临时创建独立 `CodexService`
3. inline edit 不复用 chat thread，只传递本次编辑所需的局部上下文
4. inline edit 写回前检查整篇文档是否已变化，避免把过时结果写回当前笔记

## 影响

正面影响：

- inline edit 不会打断当前聊天会话
- 用户可以把“聊天”和“局部改写”当作两条并行工作流使用
- 当前代码不需要过早引入多 service / 多 thread 运行时池

负面影响：

- inline edit 不能自动继承聊天 thread 里的隐式上下文
- 如果用户在生成结果后修改了笔记，需要重新运行 inline edit

## 后续

1. 如果后续出现第二个真正长期驻留的 agent 面板，再评估是否把 `CodexService` 升级为更明确的多实例运行时层
2. 如果 SDK 后续提供更适合短命编辑任务的无状态调用路径，可再替换当前实现
