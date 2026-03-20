# Codexian 社区插件提交流水

## `community-plugins.json` 条目

```json
{
  "id": "codexian",
  "name": "Codexian",
  "author": "licheng",
  "description": "OpenAI Codex sidebar for Obsidian.",
  "repo": "licheng-xd/obsidian-codex"
}
```

## PR 标题

```text
Add plugin: Codexian
```

## PR 文案

```markdown
## Summary

Adds Codexian, a desktop-only Obsidian plugin that brings the OpenAI Codex workflow into an Obsidian sidebar.

Core capabilities in the initial release:

- Sidebar chat with streamed Codex responses
- Current note and current selection context injection
- Explicit `@` references for Markdown files inside the current Vault
- Pasted image attachments for the current turn

## Disclosures

- Requires a locally installed and authenticated OpenAI Codex CLI
- Network access is performed by the local Codex CLI when it talks to OpenAI and related network resources
- No telemetry, ads, or paywall are built into the plugin
- Pasted images are stored inside the Vault at `.obsidian/plugins/codexian/.cache/pasted-images/`
- The optional `YOLO mode` is an explicit high-risk override that relaxes approval and sandbox restrictions

## Checklist

- [x] I have read the developer policies
- [x] I have read the submission requirements for plugins
- [x] The repository root contains `README.md`, `LICENSE`, and `manifest.json`
- [x] The plugin has a GitHub release whose tag exactly matches `manifest.json#version`
- [x] The release includes `main.js`, `manifest.json`, and `styles.css` as assets
- [x] The plugin id in `manifest.json` and `community-plugins.json` is `codexian`
- [x] The plugin is desktop-only
```
