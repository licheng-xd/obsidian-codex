import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("settings-tab source", () => {
  it("avoids manual heading elements for the single settings section", () => {
    const source = readFileSync(resolve(__dirname, "../src/settings-tab.ts"), "utf8");

    expect(source).not.toContain('createEl("h1"');
    expect(source).not.toContain('createEl("h2"');
    expect(source).toContain('new Setting(containerEl)');
  });

  it("uses sentence-case labels for placeholders and dropdown options", () => {
    const source = readFileSync(resolve(__dirname, "../src/settings-tab.ts"), "utf8");

    expect(source).toContain('.setPlaceholder("Codex")');
    expect(source).toContain('.setName("Skip repository check")');
    expect(source).toContain('.addOption("read-only", "Read-only")');
    expect(source).toContain('.addOption("workspace-write", "Workspace write")');
    expect(source).toContain('.addOption("danger-full-access", "Full access")');
    expect(source).toContain('.addOption("never", "Never")');
    expect(source).toContain('.addOption("on-request", "On request")');
    expect(source).toContain('.addOption("on-failure", "On failure")');
  });

  it("documents the scope and limits of identity and custom instruction settings", () => {
    const source = readFileSync(resolve(__dirname, "../src/settings-tab.ts"), "utf8");

    expect(source).toContain("Only affects future chat turns");
    expect(source).toContain("Appended to the main chat system prompt");
    expect(source).toContain("Does not replace @-attached files, pinned context, or active note context");
  });

  it("documents the external context allowlist as an explicit security boundary", () => {
    const source = readFileSync(resolve(__dirname, "../src/settings-tab.ts"), "utf8");

    expect(source).toContain('.setName("Enable external contexts")');
    expect(source).toContain('.setName("Allowed external roots")');
    expect(source).toContain("Only absolute directories are accepted");
    expect(source).toContain("Files still need to be added explicitly from the status bar");
  });
});
