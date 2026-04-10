# Persistent Context Design

## 背景

当前插件已经具备：

- 单侧栏 session workbench
- `@文件` 与粘贴图片这类单轮附件
- inline edit 闭环

但上下文系统仍停留在“本轮附件”模型。用户如果在一个会话里反复围绕同一批文档工作，必须在多轮对话中重复添加相同文件，这和 `Claudian` 的“显式工作上下文可持续复用”体验还有差距。

同时，当前代码边界已经明确：

- `chat-runtime-controller.ts` 负责发送与 thread 生命周期
- `chat-view.ts` 负责 composer、DOM 和状态协调
- `context-builder.ts` 负责把当前轮上下文拼成 prompt

因此迭代 3 适合在现有结构上，把“显式附件”升级为“会话级持久上下文”。

## 目标

1. 让用户可以在会话级复用一组显式上下文。
2. 保持上下文来源和权限边界清晰。
3. 提升 agent 工作感，但不引入外部目录、MCP 或 provider 化复杂度。
4. 不破坏现有聊天主链路与 inline edit。

## 非目标

本轮明确不做：

- 外部目录上下文
- MCP server 上下文
- skills / provider 化上下文注册表
- 多类持久上下文组管理
- 默认持久化当前笔记或当前选区
- 多段批量 pin / 批量 clear

## 设计原则

### 1. 隐式上下文保持临时

当前笔记、当前选区仍然是“本轮上下文”，不自动进入会话级持久集合。

原因：

- 它们是编辑器即时态，不是用户显式确认的长期上下文
- 默认持久化会带来 stale context 和来源不透明问题

### 2. 显式上下文可以持久化

用户明确添加的内容可以跨轮保留：

- `@文件`
- `Pin current note`

这与 `Claudian` 的体验更接近：不是“自动记住一切”，而是“稳定保留用户明确加入的工作上下文”。

### 3. 持久上下文必须可见、可移除

持久上下文不能是隐藏状态，必须在 composer 区域有清晰展示，并且可以显式移除或一次性清空。

## 方案对比

### 方案 A：只持久化显式上下文

做法：

- 新增 `persistentContextItems`
- `@文件` 默认进入持久上下文
- 增加 `Pin current note`
- 当前笔记 / 当前选区仍然只参与本轮 prompt

优点：

- 语义清楚
- stale context 风险最低
- 最符合当前项目的 MVP 节奏

缺点：

- 想长期保留当前笔记时需要显式 pin 一次

### 方案 B：当前笔记默认会话级持久化

优点：

- 用户操作更少

缺点：

- 把“当前正在看什么”和“想长期保留什么”混在一起
- 很容易造成上下文污染

### 方案 C：当前笔记和当前选区都可默认持久化

优点：

- 最激进，短期看起来“更聪明”

缺点：

- 最难解释
- stale context 和误用风险最高
- 会明显超出本轮可控范围

## 决策

采用方案 A。

## 用户体验

### Composer 区域

把上下文展示拆成两层：

1. `Session context`
   - 会话级持久上下文
   - 发消息后仍保留
   - 支持单项移除和一次性清空

2. `This turn`
   - 当前轮附件
   - 当前轮发送后按现有语义清空

### 新入口

本轮新增两个最小入口：

1. `Pin current note`
   - 作用于当前活动 Markdown 文件
   - 把该文件加入会话级持久上下文

2. `/clear-context`
   - 清空当前会话的全部持久上下文

本轮不做 `/resume` 等更多 slash command，只保留这一个明确命令入口，避免过早扩面。

### `@文件` 行为调整

当前 `@文件` 添加后会进入本轮附件。

本轮改为：

- 默认加入会话级持久上下文
- 仍然显示在 composer 中，但显示在 `Session context` 区域

这样更符合“我明确引用了这个文件，后续多轮都还要围绕它工作”的实际使用习惯。

## 数据模型

### 新增 `PersistentContextItem`

建议先只支持一种类型：

- `vault-file`

结构：

```ts
interface PersistentContextItem {
  readonly kind: "vault-file";
  readonly path: string;
}
```

### 会话持久化

在 `PersistedChatSession` 中新增：

```ts
persistentContextItems: ReadonlyArray<PersistentContextItem>;
```

要求：

- 旧会话数据自动兼容为 `[]`
- 会话切换 / 恢复时一并恢复这组上下文

## 运行时语义

### 发送时的上下文拼装

每轮请求的上下文来源将变成三层：

1. 当前轮隐式上下文
   - 当前笔记
   - 当前选区

2. 会话级持久上下文
   - `persistentContextItems`

3. 当前轮临时附件
   - 粘贴图片
   - 本轮其他临时附件

其中：

- 同一路径文件如果同时出现在持久上下文和当前笔记中，仍然按现有去重语义处理
- 持久上下文中的文件内容在发送前实时读取，而不是把旧内容快照直接存进会话

### 为什么只持久化路径，不持久化内容

因为当前 Vault 文件本身是动态变化的。

如果把内容快照持久化到会话里，会产生两个问题：

- 会话恢复后看到的是旧内容
- 用户难以理解“为什么 agent 看到的不是文件现在的状态”

所以本轮只持久化路径，发送时再读取最新内容。

## 权限边界

本轮上下文边界仍然限定在 Vault 内：

- 只能 pin 当前 Vault 内 Markdown 文件
- 不能 pin 外部目录
- 不能 pin 任意系统路径

这与当前 `@文件` 的安全边界保持一致。

## 代码结构

### `chat-session.ts`

- 新增 `PersistentContextItem`
- 扩展 `PersistedChatSession`
- 做旧数据兼容与 sanitize

### `chat-view.ts`

- 增加 `sessionContextItems` 状态
- composer 中新增 `Session context` 区域渲染
- 处理 `Pin current note`
- 处理单项移除与清空

### `chat-runtime-controller.ts`

- 持久化会话时一并写入 `persistentContextItems`
- 恢复会话时一并恢复 `persistentContextItems`

### `context-builder.ts`

- 支持同时读取：
  - 会话级持久上下文
  - 当前轮附件

### `main.ts`

- 新增命令：
  - `pin-current-note`

## 错误处理

### pin 失败

场景：

- 当前没有活动 Markdown 文件
- 文件不在 Vault 内
- 文件已存在于会话上下文

策略：

- 不抛运行时异常
- 以 `Notice` 告知用户

### 会话恢复后文件不存在

场景：

- 持久上下文里的文件被删除或重命名

策略：

- 发送时自动跳过无效项
- 在 UI 中保留该项但标记失效，本轮可以先简化为仍显示、发送时忽略
- 用户可手动移除

## 测试策略

优先补三类测试：

1. `chat-session.test.ts`
   - 新字段 sanitize
   - 旧数据兼容

2. `context-builder.test.ts`
   - 持久上下文与当前轮附件共同参与 prompt
   - 去重逻辑不回归

3. source test
   - `main.ts` 新命令入口
   - `chat-view.ts` 新的 session context UI 和 `/clear-context`

## 验收标准

1. 用户能在会话级复用一组显式上下文。
2. `@文件` 和 `Pin current note` 都能进入会话级上下文。
3. `/clear-context` 能清空当前会话的持久上下文。
4. 当前笔记 / 当前选区仍然只作为临时上下文存在。
5. 会话切换与恢复后，持久上下文能一起恢复。
6. README 与文档明确记录新的上下文边界。
