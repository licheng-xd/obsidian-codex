import { describe, expect, it } from "vitest";
import { formatContextSummary } from "../src/context-summary";

describe("formatContextSummary", () => {
  it("shows vault root and current note on separate lines", () => {
    expect(
      formatContextSummary({
        vaultRootPath: "/Users/licheng/Vault",
        activeNotePath: "notes/today.md"
      })
    ).toBe(
      "Vault root: /Users/licheng/Vault\nCurrent note: notes/today.md\nSelection: No selection"
    );
  });

  it("falls back when vault root or current note is unavailable", () => {
    expect(formatContextSummary({})).toBe(
      "Vault root: Unavailable\nCurrent note: No active note\nSelection: No selection"
    );
  });

  it("includes selected text length when a selection exists", () => {
    expect(
      formatContextSummary({
        vaultRootPath: "/vault",
        activeNotePath: "doc.md",
        selectionText: "hello"
      })
    ).toBe("Vault root: /vault\nCurrent note: doc.md\nSelection: 5 chars selected");
  });
});
