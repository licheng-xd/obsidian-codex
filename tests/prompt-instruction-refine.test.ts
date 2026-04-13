import { describe, expect, it } from "vitest";
import { buildRefineSystemPrompt, extractRefinedInstruction } from "../src/prompt/instruction-refine";

describe("buildRefineSystemPrompt", () => {
  it("builds a base prompt without existing instructions", () => {
    const prompt = buildRefineSystemPrompt();

    expect(prompt).toContain("Prompt Engineer");
    expect(prompt).toContain("<instruction>");
    expect(prompt).not.toContain("Existing Instructions");
  });

  it("includes existing instructions when provided", () => {
    const prompt = buildRefineSystemPrompt("Always respond in Chinese.");

    expect(prompt).toContain("Existing Instructions");
    expect(prompt).toContain("Always respond in Chinese.");
  });
});

describe("extractRefinedInstruction", () => {
  it("extracts instruction tag content", () => {
    const result = extractRefinedInstruction(
      "<instruction>Always use bullet points for lists.</instruction>"
    );

    expect(result).toEqual({
      kind: "instruction",
      text: "Always use bullet points for lists."
    });
  });

  it("extracts clarification tag content", () => {
    const result = extractRefinedInstruction(
      "<clarification>Do you mean for code comments or prose?</clarification>"
    );

    expect(result).toEqual({
      kind: "clarification",
      text: "Do you mean for code comments or prose?"
    });
  });

  it("returns null for untagged content", () => {
    const result = extractRefinedInstruction("Just some text without tags");

    expect(result).toBeNull();
  });

  it("handles multiline instruction content", () => {
    const result = extractRefinedInstruction(
      "<instruction>\n- Always respond in Chinese.\n- Use formal tone.\n</instruction>"
    );

    expect(result).toEqual({
      kind: "instruction",
      text: "- Always respond in Chinese.\n- Use formal tone."
    });
  });
});
