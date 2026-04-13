import { describe, expect, it } from "vitest";
import { getInlineEditSystemPrompt, extractInlineEditResponse } from "../src/prompt/inline-edit";

describe("getInlineEditSystemPrompt", () => {
  it("returns a non-empty system prompt", () => {
    const prompt = getInlineEditSystemPrompt();

    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain("Selection Mode");
    expect(prompt).toContain("Cursor Mode");
    expect(prompt).toContain("<replacement>");
    expect(prompt).toContain("<insertion>");
  });
});

describe("extractInlineEditResponse", () => {
  it("extracts replacement tag content", () => {
    const result = extractInlineEditResponse(
      "Some preamble\n<replacement>Hello world</replacement>\nSome postamble"
    );

    expect(result).toEqual({ kind: "replacement", text: "Hello world" });
  });

  it("extracts insertion tag content", () => {
    const result = extractInlineEditResponse(
      "<insertion>New paragraph here</insertion>"
    );

    expect(result).toEqual({ kind: "insertion", text: "New paragraph here" });
  });

  it("extracts clarification tag content", () => {
    const result = extractInlineEditResponse(
      "<clarification>What tone should I use?</clarification>"
    );

    expect(result).toEqual({ kind: "clarification", text: "What tone should I use?" });
  });

  it("returns raw when no tags found", () => {
    const result = extractInlineEditResponse("Just plain text response");

    expect(result).toEqual({ kind: "raw", text: "Just plain text response" });
  });

  it("handles multiline content in tags", () => {
    const result = extractInlineEditResponse(
      "<replacement>Line one\nLine two\nLine three</replacement>"
    );

    expect(result).toEqual({
      kind: "replacement",
      text: "Line one\nLine two\nLine three"
    });
  });
});
