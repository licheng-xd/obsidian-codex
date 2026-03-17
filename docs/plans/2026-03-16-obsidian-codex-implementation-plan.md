# Obsidian Codex MVP Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a desktop-only Obsidian plugin with one chat sidebar, current-note and selection context injection, and a concrete OpenAI Codex SDK backend.

**Architecture:** Keep the codebase intentionally small: one plugin entry, one concrete `CodexService`, one pure `context-builder`, one `ChatView`, and minimal settings support. Before building the chat UI, verify the first technical checkpoint: Obsidian Electron can spawn the local `codex` CLI reliably in the plugin runtime.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild, Vitest, `@openai/codex-sdk`

---

### Task 1: Bootstrap Repository And Plugin Toolchain

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `manifest.json`
- Create: `versions.json`
- Create: `styles.css`
- Create: `src/main.ts`

**Step 1: Initialize git**

Run: `git init`
Expected: repository initialized in `/Users/licheng/claude_workspace/obsidian-codex`

**Step 2: Create `package.json` with minimal scripts and dependencies**

```json
{
  "name": "obsidian-codex",
  "version": "0.0.1",
  "private": true,
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@openai/codex-sdk": "^0.114.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "esbuild": "^0.27.0",
    "obsidian": "latest",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}
```

**Step 3: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created with no fatal install errors

**Step 4: Create TypeScript and build configuration**

`tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["DOM", "ES2022"],
    "strict": true,
    "types": ["node"],
    "rootDir": "src",
    "outDir": "."
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

`esbuild.config.mjs`

```js
import esbuild from "esbuild";

const production = process.argv.includes("production");

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "main.js",
  format: "cjs",
  platform: "node",
  external: ["obsidian"],
  sourcemap: production ? false : "inline",
  minify: production,
});
```

**Step 5: Create minimal plugin manifest and entry**

`manifest.json`

```json
{
  "id": "obsidian-codex",
  "name": "Obsidian Codex",
  "version": "0.0.1",
  "minAppVersion": "1.5.0",
  "description": "OpenAI Codex sidebar for Obsidian.",
  "author": "licheng",
  "isDesktopOnly": true
}
```

`src/main.ts`

```ts
import { Plugin } from "obsidian";

export default class ObsidianCodexPlugin extends Plugin {
  async onload(): Promise<void> {
    this.addCommand({
      id: "obsidian-codex-open-placeholder",
      name: "Open Obsidian Codex",
      callback: () => {}
    });
  }
}
```

**Step 6: Verify the scaffold**

Run: `npm run build`
Expected: `main.js` generated

Run: `npm run typecheck`
Expected: no TypeScript errors

**Step 7: Commit**

```bash
git add .gitignore package.json tsconfig.json esbuild.config.mjs manifest.json versions.json styles.css src/main.ts
git commit -m "chore: bootstrap obsidian codex plugin"
```

### Task 2: Prove Electron Can Spawn Codex CLI

**Files:**
- Create: `src/codex-service.ts`
- Modify: `src/main.ts`
- Modify: `styles.css`

**Step 1: Add a concrete runtime probe**

`src/codex-service.ts`

```ts
import { spawn } from "node:child_process";

export async function probeCodexCli(command = "codex"): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, ["--version"]);
    let output = "";
    let error = "";

    child.stdout.on("data", chunk => {
      output += String(chunk);
    });

    child.stderr.on("data", chunk => {
      error += String(chunk);
    });

    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(error || `codex exited with code ${code}`));
    });
  });
}
```

**Step 2: Register a temporary verification command**

Modify `src/main.ts` to add:

```ts
import { Notice, Plugin } from "obsidian";
import { probeCodexCli } from "./codex-service";

this.addCommand({
  id: "obsidian-codex-verify-runtime",
  name: "Verify Codex Runtime",
  callback: async () => {
    try {
      const version = await probeCodexCli();
      new Notice(`Codex available: ${version}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Codex probe failed: ${message}`, 8000);
    }
  }
});
```

**Step 3: Build and install the dev plugin**

Run: `npm run build`
Expected: build succeeds

Manual copy target: `{vault}/.obsidian/plugins/obsidian-codex/`
Expected: `main.js`, `manifest.json`, `styles.css` present

**Step 4: Run the first technical checkpoint in Obsidian**

Manual action:
1. Open Obsidian desktop
2. Enable the dev plugin
3. Run command `Verify Codex Runtime`

Expected success:
- Notice shows detected Codex version

Expected failure modes to document:
- `spawn codex ENOENT`
- PATH missing in Electron
- child process exits but stdout is empty

**Step 5: Commit**

```bash
git add src/main.ts src/codex-service.ts styles.css
git commit -m "feat: add codex runtime probe"
```

### Task 3: Add Minimal Plugin Settings For Runtime Control

**Files:**
- Create: `src/settings.ts`
- Create: `src/settings-tab.ts`
- Modify: `src/main.ts`
- Modify: `src/codex-service.ts`

**Step 1: Define settings shape**

`src/settings.ts`

```ts
export interface PluginSettings {
  codexPath: string;
  skipGitRepoCheck: boolean;
  sandboxMode: "read-only" | "workspace-write";
  approvalPolicy: "never" | "on-request" | "on-failure";
}

export const DEFAULT_SETTINGS: PluginSettings = {
  codexPath: "",
  skipGitRepoCheck: true,
  sandboxMode: "workspace-write",
  approvalPolicy: "on-request"
};
```

**Step 2: Implement settings tab**

Add fields for:
- custom Codex path
- skip git repo check
- sandbox mode
- approval policy

**Step 3: Load and use settings in the runtime probe**

Update `probeCodexCli()` call site to use custom path when provided.

**Step 4: Verify settings load/save**

Run: `npm run typecheck`
Expected: no type errors

Manual action: change settings, reload plugin, verify values persist

**Step 5: Commit**

```bash
git add src/settings.ts src/settings-tab.ts src/main.ts src/codex-service.ts
git commit -m "feat: add codex runtime settings"
```

### Task 4: Implement Context Builder With Tests

**Files:**
- Create: `src/context-builder.ts`
- Create: `tests/context-builder.test.ts`
- Modify: `package.json`

**Step 1: Write failing tests**

`tests/context-builder.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { buildContextPayload } from "../src/context-builder";

describe("buildContextPayload", () => {
  it("prioritizes selection before note body", () => {
    const result = buildContextPayload({
      userInput: "summarize this",
      activeNotePath: "note.md",
      activeNoteContent: "A".repeat(40000),
      selectionText: "selected"
    });

    expect(result).toContain("selected");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/context-builder.test.ts`
Expected: FAIL because `buildContextPayload` does not exist yet

**Step 3: Implement the minimal context builder**

`src/context-builder.ts`

```ts
export interface ContextInput {
  userInput: string;
  activeNotePath?: string;
  activeNoteContent?: string;
  selectionText?: string;
}

export function buildContextPayload(input: ContextInput): string {
  const parts = [`User request:\n${input.userInput}`];

  if (input.selectionText) {
    parts.push(`Selected text:\n${input.selectionText}`);
  }

  if (input.activeNotePath && input.activeNoteContent) {
    const excerpt = input.activeNoteContent.slice(0, 12000);
    parts.push(`Active note (${input.activeNotePath}):\n${excerpt}`);
  }

  return parts.join("\n\n");
}
```

**Step 4: Expand tests to cover truncation rules**

Add cases for:
- no active editor
- no selection
- oversized note truncation
- selection overlap not duplicated in note excerpt

Run: `npm run test -- tests/context-builder.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/context-builder.ts tests/context-builder.test.ts package.json
git commit -m "feat: add context builder"
```

### Task 5: Implement Streaming Codex Service

**Files:**
- Modify: `src/codex-service.ts`
- Create: `tests/codex-service.test.ts`

**Step 1: Write failing tests for event mapping**

`tests/codex-service.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { mapThreadEvent } from "../src/codex-service";

describe("mapThreadEvent", () => {
  it("maps agent messages to UI text chunks", () => {
    const event = {
      type: "item.completed",
      item: { id: "1", type: "agent_message", text: "hello" }
    };

    expect(mapThreadEvent(event)).toEqual({ type: "text", text: "hello" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/codex-service.test.ts`
Expected: FAIL because `mapThreadEvent` does not exist yet

**Step 3: Implement concrete Codex service**

Add:
- `createThread()`
- `sendMessage()`
- `cancelCurrentTurn()`
- `mapThreadEvent()`

Key code shape:

```ts
import { Codex } from "@openai/codex-sdk";

const client = new Codex();
const thread = client.startThread({
  workingDirectory: vaultPath,
  skipGitRepoCheck: true,
  sandboxMode: "workspace-write",
  approvalPolicy: "on-request"
});
```

**Step 4: Run tests**

Run: `npm run test -- tests/codex-service.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/codex-service.ts tests/codex-service.test.ts
git commit -m "feat: add streaming codex service"
```

### Task 6: Build The Chat Sidebar View

**Files:**
- Create: `src/chat-view.ts`
- Modify: `src/main.ts`
- Modify: `styles.css`

**Step 1: Create the view skeleton**

Implement a single `ItemView` with:
- header
- context summary
- message list
- textarea
- send button
- cancel button

**Step 2: Wire send flow**

From the view:
- read current note and selection
- build prompt via `buildContextPayload()`
- call `sendMessage()`
- append text chunks as they stream

**Step 3: Wire cancel flow**

Call `cancelCurrentTurn()` and mark the message as interrupted.

**Step 4: Verify manually**

Manual action:
1. Open sidebar view
2. Select text in a note
3. Send a prompt
4. Confirm streaming response appears
5. Confirm cancel interrupts the turn

Expected:
- one active conversation in memory
- current note / selection summary visible before send
- clear error notice when Codex is unavailable

**Step 5: Commit**

```bash
git add src/chat-view.ts src/main.ts styles.css
git commit -m "feat: add codex chat sidebar"
```

### Task 7: Final Verification And Cleanup

**Files:**
- Modify: `docs/plans/2026-03-16-obsidian-codex-design.md`
- Modify: `AGENTS.md`
- Modify: `manifest.json`

**Step 1: Run automated checks**

Run: `npm run test`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

Run: `npm run build`
Expected: PASS and `main.js` regenerated

**Step 2: Run manual plugin verification**

Check:
- plugin enables successfully
- runtime probe command works
- sidebar opens
- message send works
- cancel works
- settings persist

**Step 3: Remove temporary probe UI only if the sidebar path fully covers the same diagnostic need**

Expected:
- either keep the probe command as a support tool
- or remove it deliberately and document why

**Step 4: Update docs to match reality**

Update the design doc and AGENTS only if implementation deviated from the approved plan.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: finalize obsidian codex mvp"
```
