import { describe, expect, it } from "vitest";
import { formatContextSummary, getContextSummaryLines } from "../src/context-summary";

describe("formatContextSummary", () => {
  it("shows only the vault root line", () => {
    expect(
      formatContextSummary({
        vaultRootPath: "/Users/licheng/Vault"
      })
    ).toBe("Vault root: /Users/licheng/Vault");
  });

  it("falls back when vault root is unavailable", () => {
    expect(formatContextSummary({})).toBe("Vault root: Unavailable");
  });

  it("shows current note and selection details when present", () => {
    expect(
      formatContextSummary({
        vaultRootPath: "/vault",
        activeNotePath: "doc.md",
        selectionText: "hello"
      })
    ).toBe("Vault root: /vault\nNote: doc.md\nSelection: Yes");
  });

  it("shows session, missing, turn, and image counts when present", () => {
    expect(
      formatContextSummary({
        vaultRootPath: "/vault",
        sessionStateLabel: "Draft session",
        sessionContextCount: 2,
        missingSessionContextCount: 1,
        turnFileCount: 3,
        imageAttachmentCount: 1
      })
    ).toBe("Vault root: /vault\nSession: Draft session\nSession refs: 2\nMissing refs: 1\nTurn files: 3\nImages: 1");
  });
});

describe("getContextSummaryLines", () => {
  it("includes note and selection rows when present", () => {
    expect(
      getContextSummaryLines({
        vaultRootPath: "/Users/licheng/Vault",
        activeNotePath: "notes/today.md",
        selectionText: "hello"
      })
    ).toEqual([
      { label: "Vault root", value: "/Users/licheng/Vault" },
      { label: "Note", value: "notes/today.md" },
      { label: "Selection", value: "Yes" }
    ]);
  });

  it("appends session, missing, turn, and image counters after the vault root", () => {
    expect(
      getContextSummaryLines({
        vaultRootPath: "/Users/licheng/Vault",
        sessionStateLabel: "Saved session",
        sessionContextCount: 3,
        missingSessionContextCount: 1,
        turnFileCount: 2,
        imageAttachmentCount: 1
      })
    ).toEqual([
      { label: "Vault root", value: "/Users/licheng/Vault" },
      { label: "Session", value: "Saved session" },
      { label: "Session refs", value: "3" },
      { label: "Missing refs", value: "1" },
      { label: "Turn files", value: "2" },
      { label: "Images", value: "1" }
    ]);
  });
});
