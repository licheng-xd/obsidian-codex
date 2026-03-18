# Session Resume Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist the last Codex chat session so reopening the view or restarting Obsidian restores and continues the previous conversation unless the user explicitly starts a new chat.

**Architecture:** Store a sanitized `lastSession` snapshot alongside plugin settings in plugin data. Restore the prior chat shell from that snapshot on view open, and resume the underlying Codex SDK thread via `resumeThread(threadId, options)` so future messages continue the same conversation. `New Chat` clears both the UI snapshot and persisted thread identity.

**Tech Stack:** TypeScript, Obsidian Plugin API, `@openai/codex-sdk`, Vitest

---

### Task 1: Add persisted plugin/session data helpers

**Files:**
- Create: `src/chat-session.ts`
- Create: `src/plugin-state.ts`
- Test: `tests/plugin-state.test.ts`

### Task 2: Add Codex thread resume support

**Files:**
- Modify: `src/codex-service.ts`
- Modify: `tests/codex-service.test.ts`

### Task 3: Restore and persist chat sessions in ChatView

**Files:**
- Modify: `src/chat-view.ts`
- Modify: `src/main.ts`
- Modify: `src/settings.ts`

### Task 4: Verify and document the behavior

**Files:**
- Create: `docs/adr/2026-03-18-persist-last-session.md`
- Modify: `README.md`
- Run: `npm test`
- Run: `npm run typecheck`
- Run: `npm run build`
