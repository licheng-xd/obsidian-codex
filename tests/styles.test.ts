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

  it("keeps assistant turns left-aligned even when their max width is narrower than the panel", () => {
    const stylesheet = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

    expect(stylesheet).toMatch(
      /\.obsidian-codex-turn\s*\{[^}]*align-self:\s*flex-start;[^}]*margin:\s*0;/s
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

  it("keeps reasoning meta and reasoning detail on a dedicated green token", () => {
    const stylesheet = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

    expect(stylesheet).toContain("--obsidian-codex-reasoning: #82dda3;");
    expect(stylesheet).toMatch(/\.obsidian-codex-turn-meta\s*\{[^}]*color:\s*var\(--obsidian-codex-reasoning\);/s);
    expect(stylesheet).toMatch(
      /\.obsidian-codex-turn-meta-signal span\s*\{[^}]*background:\s*var\(--obsidian-codex-reasoning\);/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-system-event-detail\.is-reasoning\s*\{[^}]*color:\s*var\(--obsidian-codex-reasoning\);/s
    );
  });

  it("uses the green reasoning token for highlighted tray and statusbar controls", () => {
    const stylesheet = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

    expect(stylesheet).toMatch(
      /\.obsidian-codex-tray-action\.is-cancel:not\(:disabled\)\s*\{[^}]*background:\s*var\(--obsidian-codex-reasoning\);/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-statusbar-trigger\s*\{[^}]*color:\s*var\(--obsidian-codex-reasoning\);/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-statusbar-menu-item:hover,\s*\.obsidian-codex-statusbar-menu-item\.is-selected\s*\{[^}]*color:\s*var\(--obsidian-codex-reasoning\);/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-statusbar-switch\[aria-checked="true"\]::before\s*\{[^}]*background:\s*var\(--obsidian-codex-reasoning\);/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-statusbar\.is-yolo-active\s+\.obsidian-codex-statusbar-yolo-label\s*\{[^}]*color:\s*var\(--obsidian-codex-reasoning\);/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-statusbar-meter-fill\s*\{[^}]*background:\s*var\(--obsidian-codex-reasoning\);/s
    );
  });

  it("uses the green reasoning token for the brand icon", () => {
    const stylesheet = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

    expect(stylesheet).toMatch(
      /\.obsidian-codex-brand-icon\s*\{[^}]*color:\s*var\(--obsidian-codex-reasoning\);/s
    );
  });

  it("styles the mention dropdown and keeps selected items on the green token", () => {
    const stylesheet = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

    expect(stylesheet).toMatch(
      /\.obsidian-codex-mention-dropdown\s*\{[^}]*background:\s*var\(--obsidian-codex-popover-bg\);[^}]*border:\s*1px solid var\(--obsidian-codex-popover-border\);/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-mention-item\.is-selected,\s*\.obsidian-codex-mention-item:hover\s*\{[^}]*color:\s*var\(--obsidian-codex-reasoning\);/s
    );
  });

  it("styles attachment chips for file and image attachments", () => {
    const stylesheet = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

    expect(stylesheet).toMatch(
      /\.obsidian-codex-attachment-strip\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*flex-wrap:\s*wrap;/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-attachment-chip\s*\{[^}]*border:\s*1px solid var\(--obsidian-codex-accent-outline\);/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-attachment-chip\.is-image\s*\{[^}]*background:\s*var\(--obsidian-codex-highlight-soft\);/s
    );
  });

  it("styles empty context states and missing session context chips distinctly", () => {
    const stylesheet = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

    expect(stylesheet).toMatch(
      /\.obsidian-codex-attachment-strip\.is-empty\s*\{[^}]*display:\s*none;/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-attachment-chip\.is-missing\s*\{[^}]*background:\s*color-mix\([^}]*border-color:\s*var\(--background-modifier-error/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-attachment-chip\.is-missing\s+\.obsidian-codex-attachment-meta\s*\{[^}]*color:\s*var\(--text-error/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-attachment-chip\.is-external\s*\{[^}]*background:\s*var\(--obsidian-codex-highlight-soft\);[^}]*border-style:\s*dashed;/s
    );
  });

  it("styles the session context state badge inside the attachment strip", () => {
    const stylesheet = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

    expect(stylesheet).toMatch(
      /\.obsidian-codex-context-heading-row\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*space-between;/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-context-status\s*\{[^}]*border:\s*1px solid var\(--obsidian-codex-accent-outline\);[^}]*text-transform:\s*none;/s
    );
  });

  it("styles the inline edit clarification banner as a stable tray message", () => {
    const stylesheet = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

    expect(stylesheet).toMatch(
      /\.obsidian-codex-inline-edit-clarification\s*\{[^}]*border:\s*1px solid var\(--obsidian-codex-accent-outline\);[^}]*display:\s*none;/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-inline-edit-clarification\.is-visible\s*\{[^}]*display:\s*flex;/s
    );
  });

  it("styles the estimated context meter as a compact progress bar", () => {
    const stylesheet = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

    expect(stylesheet).toMatch(
      /\.obsidian-codex-statusbar-meter\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;/s
    );
    expect(stylesheet).toMatch(
      /\.obsidian-codex-statusbar-meter-track\s*\{[^}]*border:\s*1px solid var\(--obsidian-codex-accent-outline\);[^}]*overflow:\s*hidden;/s
    );
  });
});
