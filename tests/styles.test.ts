import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("styles", () => {
  it("allows selecting text inside chat messages", () => {
    const stylesheet = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

    expect(stylesheet).toMatch(
      /\.obsidian-codex-messages\s*\{[^}]*user-select:\s*text;[^}]*-webkit-user-select:\s*text;/s
    );
  });

  it("resets history list buttons so titles stay visible under theme button styles", () => {
    const stylesheet = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

    expect(stylesheet).toMatch(
      /\.obsidian-codex-history-popover\s*\{[^}]*min-width:\s*232px;[^}]*width:\s*min\(272px,\s*calc\(100vw\s*-\s*48px\)\);/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-history-item\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*min-height:\s*52px;[^}]*width:\s*100%;/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-history-item-title\s*\{[^}]*display:\s*block;[^}]*font-size:\s*13px;[^}]*text-align:\s*left;[^}]*width:\s*100%;/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-history-item-meta\s*\{[^}]*display:\s*block;[^}]*font-size:\s*10px;[^}]*text-align:\s*left;[^}]*width:\s*100%;/s
    );
  });

  it("derives codex colors from Obsidian theme variables and theme classes", () => {
    const stylesheet = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

    expect(stylesheet).toContain("--obsidian-codex-bg: var(--background-primary);");
    expect(stylesheet).toContain("--obsidian-codex-text: var(--text-normal);");
    expect(stylesheet).toContain("--obsidian-codex-accent: var(--interactive-accent);");
    expect(stylesheet).toContain(".theme-dark .obsidian-codex-view");
    expect(stylesheet).toContain(".theme-light .obsidian-codex-view");
  });
});
