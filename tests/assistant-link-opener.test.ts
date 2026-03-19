import { describe, expect, it, vi } from "vitest";
import {
  looksLikeStandaloneFileReference,
  normalizeVaultLinkCandidate,
  resolveOpenableLinkText
} from "../src/assistant-link-opener";

describe("assistant-link-opener", () => {
  it("normalizes wikilinks and decodes relative link text", () => {
    expect(normalizeVaultLinkCandidate("[[Projects/中泰证券/分析.md]]")).toBe("Projects/中泰证券/分析.md");
    expect(normalizeVaultLinkCandidate("./Projects/%E4%B8%AD%E6%B3%B0%E8%AF%81%E5%88%B8/%E5%88%86%E6%9E%90.md"))
      .toBe("Projects/中泰证券/分析.md");
  });

  it("detects standalone file references", () => {
    expect(looksLikeStandaloneFileReference("中泰证券-定制开发工作量预估分析.md")).toBe(true);
    expect(looksLikeStandaloneFileReference("Projects/中泰证券/中泰证券-定制开发工作量预估分析.md")).toBe(true);
    expect(looksLikeStandaloneFileReference("我已经把文件保存好了")).toBe(false);
  });

  it("returns link text only when it resolves to a vault file", () => {
    const resolveLinkpath = vi.fn((linktext: string) =>
      linktext === "Projects/中泰证券/分析.md" ? ({ path: linktext } as never) : null
    );

    expect(
      resolveOpenableLinkText(
        "Projects/中泰证券/分析.md",
        "note.md",
        resolveLinkpath
      )
    ).toBe("Projects/中泰证券/分析.md");

    expect(
      resolveOpenableLinkText(
        "missing.md",
        "note.md",
        resolveLinkpath
      )
    ).toBeNull();
  });
});
