import { describe, expect, it } from "vitest";
import { searchReferencePaths } from "../src/reference-search";

const paths = [
  "notes/roadmap.md",
  "projects/roadmap-2026.md",
  "docs/architecture.md",
  "daily/2026-03-20.md",
  "notes/broad-topic.md"
];

describe("searchReferencePaths", () => {
  it("prioritizes basename prefix matches", () => {
    expect(searchReferencePaths(paths, "road")).toEqual([
      "notes/roadmap.md",
      "projects/roadmap-2026.md",
      "notes/broad-topic.md"
    ]);
  });

  it("falls back to path contains matches", () => {
    expect(searchReferencePaths(paths, "arch")).toEqual(["docs/architecture.md"]);
  });

  it("excludes the current active note from candidates", () => {
    expect(searchReferencePaths(paths, "road", { activeNotePath: "notes/roadmap.md" })).toEqual([
      "projects/roadmap-2026.md",
      "notes/broad-topic.md"
    ]);
  });

  it("enforces the result limit", () => {
    expect(searchReferencePaths(paths, "", { limit: 2 })).toHaveLength(2);
  });
});
