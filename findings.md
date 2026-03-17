# Findings & Decisions

## Requirements
- Build an Obsidian plugin whose project goal is to reference `https://github.com/YishenTu/claudian` and implement an Obsidian version of a Codex plugin.
- The reference repository should inform architecture and feature scope, but the deliverable is an Obsidian plugin codebase in this workspace.
- Work should follow a design-first process before implementation.

## Research Findings
- The current workspace is effectively empty and has no existing plugin scaffold yet.
- The workspace is not currently initialized as a git repository.
- The reference project `YishenTu/claudian` is an Obsidian plugin that embeds Claude Code into the vault, turning the vault into the agent working directory.
- The reference repository currently exposes a mature Obsidian plugin layout with `src/`, `tests/`, `manifest.json`, `esbuild.config.mjs`, `package.json`, and release-oriented plugin packaging.
- Claudian's documented feature set is broad: chat sidebar, inline edit, file mentions, slash commands, skills, custom agents, MCP support, model selection, plan mode, and security controls.
- Claudian explicitly depends on a locally installed Claude Code CLI and targets desktop Obsidian.
- Claudian is implemented as a TypeScript Obsidian plugin bundled with `esbuild`, using Jest for tests and the `@anthropic-ai/claude-agent-sdk` plus MCP SDK as runtime dependencies.
- The plugin manifest is conventional for Obsidian desktop plugins: `main.js` entry, desktop-only, and release artifacts expected as `main.js`, `manifest.json`, and `styles.css`.
- The current published version in the reference repo is `1.3.69`, indicating an actively iterated codebase rather than a minimal starter.
- The user has now prioritized initializing a project-level `AGENTS.md` according to Codex best practices before moving forward with feature design.
- The user has now explicitly selected the MVP scope: chat sidebar plus current note and selected text context injection.
- The design should therefore optimize for a narrow, composable first version rather than agent parity with Claudian.
- OpenAI's official Codex docs now clearly distinguish:
- OpenAI's official Codex docs now clearly distinguish:
  - `codex exec` for scripts and CI style automation
  - `@openai/codex-sdk` for embedding Codex into applications and internal tools
- Inspection of the published `@openai/codex-sdk@0.114.0` package shows first-class thread APIs:
  - `startThread()`
  - `resumeThread()`
  - `run()`
  - `runStreamed()`
  - thread options including `workingDirectory`, `skipGitRepoCheck`, `sandboxMode`, `approvalPolicy`
- Claudian communicates with Claude through `@anthropic-ai/claude-agent-sdk` directly in-process; it does not hand-roll an HTTP client.
- Claudian uses the vault path as working directory and appends editor context to prompts, but its XML prompt format and broad feature layering are not required for this MVP.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Discovery starts from local workspace plus the referenced repository | Need both the target environment and the source inspiration before proposing architecture |
| The first implementation should likely target a reduced Claudian subset rather than parity | The reference feature set is large and the current workspace is greenfield |
| Create a project-level `AGENTS.md` in Chinese with TypeScript/desktop-plugin assumptions | Matches the user's request and provides working governance for follow-up implementation |
| Use send-time context snapshots for active note and current selection | This keeps the UI layer simple and avoids coupling a long-running request to mutable editor state |
| Exclude auto-write and multi-file referencing from the first version | Keeps the MVP small, safer, and easier to verify |
| Adopt OpenAI Codex SDK instead of Claude SDK patterns or a generic adapter abstraction | Gives a concrete implementation target aligned with the project name and official app-integration path |
| Keep V1 to a single thread in one sidebar view | Simplifies state management while preserving a useful multi-turn experience |
| Use an explicit context budget with selection-first truncation | Avoids the failure mode of injecting entire long notes into one turn |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| No existing project files are present in the workspace | Plan to scaffold the plugin after design approval |
| `executing-plans` requires worktree isolation, but the workspace started without a git repository or initial commit | Initialized a repository baseline first, then created a dedicated feature worktree before implementation |
| The implementation plan's initial `tsconfig.json` combined `include: ["tests/**/*.ts"]` with `rootDir: "src"` and `outDir: "."`, which breaks `tsc --noEmit` | Adjusted the real scaffold to use `rootDir: "."` and no `outDir`, keeping test files type-checkable |
| `@openai/codex-sdk@0.114.0`'s published type declarations require `@modelcontextprotocol/sdk/types.js`, but the dependency is not pulled into this app's type-checking environment automatically | Replaced the missing third-party declaration with a local ambient type shim so `npm run typecheck` stays green without shipping an unused MCP dependency |
| The module-level `Codex` client prevented the settings-driven `codexPath` from ever taking effect after plugin load | Replaced the singleton with an injected `CodexService` instance that reads the current path from plugin settings and recreates the client when the path changes |
| `@modelcontextprotocol/sdk` was only present to satisfy missing third-party types, not because the plugin uses MCP directly | Replaced the package dependency with a local ambient type shim for `@modelcontextprotocol/sdk/types.js` |
| Bundling behavior for `@openai/codex-sdk` needed confirmation before changing esbuild externals | Kept the SDK bundled: Obsidian plugins ship `main.js` as the runtime artifact, and `main.js` no longer contains a runtime import for `@openai/codex-sdk` after build |

## Resources
- Reference repository: `https://github.com/YishenTu/claudian`
- Workspace root: `/Users/licheng/claude_workspace/obsidian-codex`
- GitHub repository page opened on 2026-03-16: `https://github.com/YishenTu/claudian`
- Temporary local clone for inspection: `/tmp/claudian-ref-1618`
- Design doc: `/Users/licheng/claude_workspace/obsidian-codex/docs/plans/2026-03-16-obsidian-codex-design.md`
- ADR: `/Users/licheng/claude_workspace/obsidian-codex/docs/adr/ADR-2026-03-16-codex-backend.md`
- Official Codex overview: `https://developers.openai.com/codex/`
- Official Codex SDK docs: `https://developers.openai.com/codex/sdk`
- Official non-interactive mode docs: `https://developers.openai.com/codex/noninteractive`
- Official AGENTS.md guidance: `https://developers.openai.com/codex/guides/agents-md`
- Official Codex best practices: `https://developers.openai.com/codex/learn/best-practices`

## Visual/Browser Findings
- Repository structure includes `.github/workflows`, `scripts`, `src`, `tests`, `manifest.json`, `package.json`, `tsconfig.json`, and `versions.json`.
- README positions the plugin as an Obsidian-native wrapper around Claude Code with vault-scoped agent capabilities.
- Documented features include context attachment, inline editing, custom prompt commands, skills, custom agents, MCP support, model controls, plan mode, and permission/security modes.
- Package metadata confirms a standard Obsidian plugin toolchain: TypeScript, `esbuild`, ESLint, Jest, and `obsidian` typings.
- Runtime dependencies center on the Claude Agent SDK and MCP SDK, which strongly suggests the plugin uses the Claude Code agent runtime rather than shelling out to a raw LLM API directly.
- OpenAI official docs describe Codex as OpenAI's coding agent and document a separate Codex SDK for in-app integration.
- Official non-interactive docs position `codex exec` as script/CI oriented and expose JSONL event streaming.
- Official best-practices docs recommend keeping `AGENTS.md` short and practical rather than turning it into a bloated process document.
- The user approved the revised design and asked to carry two final doc adjustments into the implementation-plan handoff:
  - call out the Electron child-process risk explicitly
  - remove residual wording that implies unnecessary pre-abstraction
- The implementation plan now treats `spawn codex` viability inside Obsidian Electron as the first technical checkpoint before chat UI build-out.
