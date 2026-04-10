import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("main source", () => {
  it("registers command ids without the plugin id prefix", () => {
    const source = readFileSync(resolve(__dirname, "../src/main.ts"), "utf8");

    expect(source).toContain('id: "open-sidebar"');
    expect(source).toContain('id: "verify-runtime"');
    expect(source).toContain('id: "new-session"');
    expect(source).toContain('id: "resume-last-session"');
    expect(source).toContain('id: "show-session-history"');
    expect(source).toContain('id: "pin-current-note"');
    expect(source).toContain('id: "inline-edit-selection"');
    expect(source).toContain('id: "inline-insert-at-cursor"');
    expect(source).not.toContain('id: "codexian-open-sidebar"');
    expect(source).not.toContain('id: "codexian-verify-runtime"');
  });

  it("uses a generic sentence-case ribbon tooltip", () => {
    const source = readFileSync(resolve(__dirname, "../src/main.ts"), "utf8");

    expect(source).toContain('this.addRibbonIcon(CODEX_ICON, "Open sidebar", () => {');
    expect(source).not.toContain('this.addRibbonIcon(CODEX_ICON, "Open Codexian", () => {');
  });

  it("does not detach chat leaves during plugin unload", () => {
    const source = readFileSync(resolve(__dirname, "../src/main.ts"), "utf8");

    expect(source).not.toContain("detachLeavesOfType");
    expect(source).not.toContain("onunload()");
    expect(source).not.toContain("async onunload()");
  });
});
