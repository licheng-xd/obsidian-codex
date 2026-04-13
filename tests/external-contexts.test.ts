import { describe, expect, it } from "vitest";
import {
  isWithinExternalContextRoots,
  normalizeExternalContextPath,
  sanitizeExternalContextRoots
} from "../src/external-contexts";

describe("external-contexts", () => {
  it("normalizes absolute roots, removes duplicates, and drops nested children", () => {
    expect(
      sanitizeExternalContextRoots([
        "/Users/demo/projects",
        "/Users/demo/projects/",
        "/Users/demo/projects/specs",
        "relative/path"
      ])
    ).toEqual(["/Users/demo/projects"]);
  });

  it("allows explicit files only when they stay inside configured roots", () => {
    expect(
      isWithinExternalContextRoots(
        "/Users/demo/projects/specs/plan.md",
        ["/Users/demo/projects"]
      )
    ).toBe(true);
    expect(
      isWithinExternalContextRoots(
        "/Users/demo/private/plan.md",
        ["/Users/demo/projects"]
      )
    ).toBe(false);
  });

  it("normalizes external file paths before membership checks", () => {
    expect(
      normalizeExternalContextPath("/Users/demo/projects/specs/../plan.md")
    ).toBe("/Users/demo/projects/plan.md");
  });
});
