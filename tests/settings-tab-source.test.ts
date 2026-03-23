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
});
