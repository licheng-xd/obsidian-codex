# Release Installation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为插件建立 GitHub tag 自动发布链路，并把 README 改成以 Release 安装为主的简洁用户文档。

**Architecture:** 通过 `scripts/` 中的轻量发布脚本校验版本一致性并准备发布产物，GitHub Actions 在 tag push 后执行依赖安装、类型检查、构建、打包和 Release 创建。README 收敛为“简介 + 安装 + 配置 + 故障排查 + 开发”的最小结构。

**Tech Stack:** TypeScript、Node.js、GitHub Actions、Vitest、esbuild

---

### Task 1: 先写失败测试，锁定发布入口和用户安装文案

**Files:**
- Create: `tests/release-source.test.ts`

1. 写源文件级测试，先锁定以下期望：
   - `package.json` 暴露发布相关脚本入口
   - `.github/workflows/release.yml` 存在并监听裸版本 tag
   - `README.md` 主安装路径指向 GitHub Release
2. 运行 `npm test -- tests/release-source.test.ts`，确认先失败。

### Task 2: 实现版本校验与发布打包脚本

**Files:**
- Modify: `package.json`
- Create: `scripts/check-release-version.mjs`
- Create: `scripts/create-release-bundle.mjs`

1. 增加版本一致性校验脚本，统一校验 `package.json`、`manifest.json`、`versions.json` 与 tag。
2. 增加打包脚本，收集 `main.js`、`manifest.json`、`styles.css` 并生成版本化 `zip`。
3. 先跑脚本的本地无 tag 校验分支，再补带 tag 参数的校验。

### Task 3: 增加 GitHub Release 工作流

**Files:**
- Create: `.github/workflows/release.yml`
- Test: `tests/release-source.test.ts`

1. 让工作流在 `*.*.*` tag push 时执行：
   - `npm ci`
   - `npm run typecheck`
   - `npm run build`
   - `npm run release:check -- $GITHUB_REF_NAME`
   - `npm run release:bundle`
2. 使用 GitHub CLI 创建 Release 并上传 4 个附件。
3. 重新运行 `npm test -- tests/release-source.test.ts`。

### Task 4: 重写 README，收敛普通用户安装流程

**Files:**
- Modify: `README.md`
- Test: `tests/release-source.test.ts`

1. 把 GitHub Release 安装改成默认主路径。
2. 保留单文件下载作为备用路径。
3. 删除冗长的内部机制说明，仅保留必要配置与常见问题。
4. 再跑一次 `npm test -- tests/release-source.test.ts`。

### Task 5: 回归验证

**Files:**
- Modify: `docs/plans/2026-03-19-release-installation-design.md`
- Modify: `docs/plans/2026-03-19-release-installation-implementation-plan.md`

1. 运行：
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
2. 如有必要，手动执行一次 `npm run release:bundle`，确认生成 zip。
3. 检查 `git diff --stat`，确认发布链路、文档和测试都已落地。
