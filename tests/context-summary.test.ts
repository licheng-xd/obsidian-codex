import { describe, expect, it } from "vitest";
import { formatContextSummary, getContextSummaryLines } from "../src/context-summary";

describe("formatContextSummary", () => {
  it("shows only the vault root line", () => {
    expect(
      formatContextSummary({
        vaultRootPath: "/Users/licheng/Vault",
        activeNotePath: "notes/today.md"
      })
    ).toBe("Vault root: /Users/licheng/Vault");
  });

  it("falls back when vault root is unavailable", () => {
    expect(formatContextSummary({})).toBe("Vault root: Unavailable");
  });

  it("ignores current note and selection details in compact mode", () => {
    expect(
      formatContextSummary({
        vaultRootPath: "/vault",
        activeNotePath: "doc.md",
        selectionText: "hello"
      })
    ).toBe("Vault root: /vault");
  });
});

describe("getContextSummaryLines", () => {
  it("returns only the vault root row for tray rendering", () => {
    expect(
      getContextSummaryLines({
        vaultRootPath: "/Users/licheng/Vault",
        activeNotePath: "notes/today.md",
        selectionText: "hello"
      })
    ).toEqual([{ label: "Vault root", value: "/Users/licheng/Vault" }]);
  });
});
