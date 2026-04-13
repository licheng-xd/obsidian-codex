import { describe, expect, it } from "vitest";
import { TITLE_GENERATION_SYSTEM_PROMPT, buildTitleGenerationPrompt } from "../src/prompt/title-generation";

describe("TITLE_GENERATION_SYSTEM_PROMPT", () => {
  it("contains essential directives", () => {
    expect(TITLE_GENERATION_SYSTEM_PROMPT).toContain("concise");
    expect(TITLE_GENERATION_SYSTEM_PROMPT).toContain("50 characters");
    expect(TITLE_GENERATION_SYSTEM_PROMPT).toContain("ONLY the raw title");
  });
});

describe("buildTitleGenerationPrompt", () => {
  it("wraps user message in a generation prompt", () => {
    const prompt = buildTitleGenerationPrompt("Help me organize my meeting notes");

    expect(prompt).toContain("Generate a title");
    expect(prompt).toContain("Help me organize my meeting notes");
  });
});
