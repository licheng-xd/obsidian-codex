import { describe, expect, it } from "vitest";
import { buildCodexIconSvg } from "../src/codex-icon";

describe("buildCodexIconSvg", () => {
  it("returns an SVG with the OpenAI-style viewBox and theme-aware fill", () => {
    const svg = buildCodexIconSvg();

    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 256 260"');
    expect(svg).toContain('fill="currentColor"');
    expect(svg).toContain("<path");
  });
});
