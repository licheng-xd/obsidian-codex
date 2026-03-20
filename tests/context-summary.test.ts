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

  it("shows reference and image attachment counts when present", () => {
    expect(
      formatContextSummary({
        vaultRootPath: "/vault",
        referencedFileCount: 2,
        imageAttachmentCount: 1
      })
    ).toBe("Vault root: /vault\nRefs: 2\nImages: 1");
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

  it("appends attachment counters after the vault root", () => {
    expect(
      getContextSummaryLines({
        vaultRootPath: "/Users/licheng/Vault",
        referencedFileCount: 3,
        imageAttachmentCount: 1
      })
    ).toEqual([
      { label: "Vault root", value: "/Users/licheng/Vault" },
      { label: "Refs", value: "3" },
      { label: "Images", value: "1" }
    ]);
  });
});
