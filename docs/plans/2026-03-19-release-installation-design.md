# Release Installation Design

## 背景

当前 README 把“从源码构建”作为默认安装方式，用户需要自行下载仓库、安装依赖并运行 `build`。这对非技术用户不友好，也与 Obsidian 社区插件常见的“下载发布产物后直接安装”路径不一致。

当前仓库已经具备生成运行产物的基础条件：

- `manifest.json`
- `versions.json`
- `main.js`
- `styles.css`

缺少的是一条面向最终用户的标准发布链路，以及一份以安装为中心、而不是以开发为中心的 README。

## 目标

把插件安装体验调整为：

1. 用户不需要下载源码
2. 用户不需要本地执行 `npm install` 或 `npm run build`
3. GitHub Release 自动提供可安装产物
4. README 首页优先服务普通安装用户，而不是插件开发者

## 非目标

1. 本轮不接入 Obsidian 社区插件商店
2. 本轮不引入 `changesets`、`semantic-release` 等更重的版本管理方案
3. 本轮不改动插件运行时功能、设置项或会话能力

## 设计概览

### 1. 发布入口

使用 Git tag 作为唯一发布入口，格式约定为 `vX.Y.Z`。

发布动作由 GitHub Actions 自动执行：

1. 监听 `v*` tag push
2. 安装依赖
3. 运行类型检查和构建
4. 校验版本号一致性
5. 生成 Release 附件
6. 自动创建 GitHub Release 并上传产物

### 2. 发布产物

每次 Release 附带以下 4 个文件：

1. `main.js`
2. `manifest.json`
3. `styles.css`
4. `obsidian-codex-X.Y.Z.zip`

其中 `zip` 仅包含安装所需的 3 个文件，不包含源码、测试或文档。

### 3. 版本约束

为避免 Release 版本混乱，发布前统一校验以下 4 处版本：

1. `package.json#version`
2. `manifest.json#version`
3. `versions.json` 中存在对应版本键
4. Git tag 去掉前缀 `v` 后与上述版本一致

若任一不一致，工作流直接失败，不创建 Release。

### 4. README 重写策略

README 调整为“安装优先，开发靠后”的结构：

1. 插件简介
2. 运行要求
3. 安装方式
   - 默认推荐：从 GitHub Release 下载 `zip`
   - 备用方式：分别下载 `main.js`、`manifest.json`、`styles.css`
4. 首次配置
5. 常见问题
6. 开发说明（简短保留）

以下内容从主 README 删除或下沉：

1. 过长的状态栏内部机制说明
2. 详细上下文注入实现原理
3. 面向开发者的源码安装流程作为默认主路径
4. 与普通安装用户无关的内部策略说明

## 方案对比

### 方案 A：只补本地打包命令

优点：

- 改动最小
- 不需要配置 GitHub Actions

缺点：

- 发版仍依赖本地人工打包和上传
- 容易出现忘记上传、上传错文件或版本不一致

### 方案 B：GitHub tag 自动构建并创建 Release

优点：

- 用户安装路径最短
- 维护者发版动作清晰稳定
- 版本一致性可以在 CI 中强制校验

缺点：

- 需要新增工作流与打包脚本

### 方案 C：引入完整语义化发版工具

优点：

- 长期自动化程度最高

缺点：

- 超出当前 MVP 所需
- 会引入额外流程复杂度

## 决策

采用方案 B：

- 使用 Git tag 触发自动 Release
- 同时提供 `zip` 与 3 个单文件下载
- README 以 GitHub Release 安装为主

## 模块边界

1. `package.json`
   - 增加发布校验和打包脚本入口
2. `scripts/`
   - 封装版本校验与 Release 打包逻辑
3. `.github/workflows/release.yml`
   - 定义 tag 发布工作流
4. `README.md`
   - 改写用户安装说明

## 验收标准

1. 推送合法 tag 后，GitHub 自动创建 Release
2. Release 同时包含 `zip` 和 3 个单文件
3. 用户无需下载源码即可完成安装
4. README 顶部首屏可直接看到安装入口
5. 本地至少通过一次 `npm run typecheck` 和 `npm run build`
