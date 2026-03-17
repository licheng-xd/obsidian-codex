import { describe, expect, it } from "vitest";
import { formatContextSummary } from "../src/context-summary";

describe("formatContextSummary", () => {
  it("shows vault root and current note together in the summary", () => {
    expect(
      formatContextSummary({
        vaultRootPath: "/Users/licheng/Vault",
        activeNotePath: "notes/today.md"
      })
    ).toBe(
      "Vault root: /Users/licheng/Vault / Current note: notes/today.md / No selection"
    );
  });

  it("falls back when vault root or current note is unavailable", () => {
    expect(formatContextSummary({})).toBe(
      "Vault root: Unavailable / Current note: No active note / No selection"
    );
  });

  it("includes selected text length when a selection exists", () => {
    expect(
      formatContextSummary({
        vaultRootPath: "/vault",
        activeNotePath: "doc.md",
        selectionText: "hello"
      })
    ).toBe("Vault root: /vault / Current note: doc.md / 5 chars selected");
  });
});
