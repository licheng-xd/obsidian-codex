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
});
