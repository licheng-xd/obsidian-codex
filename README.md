# Obsidian Codex

`obsidian-codex` 是一个桌面端 Obsidian 社区插件，把 OpenAI Codex 工作流放进 Vault 侧边栏。

适合已经在本机使用 Codex CLI，希望在 Obsidian 里直接进行问答、分析、写作和本地协作的用户。

## 运行要求

- Obsidian Desktop `>= 1.5.0`
- 本机已安装 OpenAI Codex CLI，并且终端里有可用的 `codex` 命令
- 终端中 `codex --version` 可以正常执行
- 插件仅支持桌面端

当前还没有上架 Obsidian 社区商店，推荐直接从 GitHub Release 安装。
仅安装 Codex app 不足以满足当前插件前置条件；本插件直接调用的是本机 Codex CLI。

## 安装

### 方式一：GitHub Release 安装（推荐）

1. 打开 [GitHub Release](https://github.com/licheng-xd/obsidian-codex/releases) 页面，下载最新的 `obsidian-codex-x.y.z.zip`
2. 解压到你的 Vault 插件目录：`.obsidian/plugins/obsidian-codex/`
3. 确认目录中有以下 3 个文件：
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. 打开 Obsidian，进入 `设置 -> 第三方插件`
5. 关闭安全模式并启用 `Obsidian Codex`

如果解压后多了一层目录，直接把这 3 个文件移动到 `.obsidian/plugins/obsidian-codex/` 即可。

### 方式二：分别下载 3 个文件

如果你不想下载 `zip`，也可以在同一个 GitHub Release 里分别下载：

- `main.js`
- `manifest.json`
- `styles.css`

然后把它们放到：

```text
<你的 Vault>/.obsidian/plugins/obsidian-codex/
```

## 首次配置

1. 在终端运行：

   ```bash
   codex --version
   command -v codex
   ```

2. 打开 Obsidian，执行命令 `Verify Codex Runtime`
3. 如果插件找不到 `codex`，把 `command -v codex` 返回的绝对路径填进设置里的 `Codex path`
4. 按需设置 `Model` 和 `Reasoning effort`
5. 只有在你完全信任当前 Vault 和本机环境时，再开启 `YOLO mode`

## 常见问题

### `Codex probe failed: spawn codex ENOENT`

说明 Obsidian 进程里找不到 `codex` 可执行文件。

先运行：

```bash
command -v codex
```

再把返回的绝对路径填进 `Codex path`。

### `Codex probe failed: env: node: No such file or directory`

这通常表示：

- 你的 `codex` 是 `#!/usr/bin/env node` 启动脚本
- Obsidian 从 GUI 启动，没有继承终端里的 Node 路径

当前插件已经兼容这个场景；如果你已填写正确的 `Codex path`，通常不需要额外处理。

### 插件加载后没有生效

优先检查：

1. `.obsidian/plugins/obsidian-codex/` 里是否是最新的 `main.js`、`manifest.json`、`styles.css`
2. 是否已经在 Obsidian 里重新加载插件或重启应用

## 开发

开发和本地验证只需要这几个命令：

```bash
npm install
npm run typecheck
npm test
npm run build
```

更多设计文档和 ADR 见 [docs/README.md](docs/README.md)。
