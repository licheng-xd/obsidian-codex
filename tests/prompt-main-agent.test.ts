import { describe, expect, it } from "vitest";
import { buildSystemPrompt, formatCurrentLocalDate } from "../src/prompt/main-agent";

describe("buildSystemPrompt", () => {
  it("builds a basic system prompt with required fields", () => {
    const prompt = buildSystemPrompt({ currentDate: "2026-04-10" });

    expect(prompt).toContain("Codex");
    expect(prompt).toContain("Obsidian");
    expect(prompt).toContain("2026-04-10");
    expect(prompt).toContain("Core Principles");
    expect(prompt).toContain("Path Rules");
    expect(prompt).toContain("wikilink");
  });

  it("includes user name when provided", () => {
    const prompt = buildSystemPrompt({
      currentDate: "2026-04-10",
      userName: "Alice"
    });

    expect(prompt).toContain("**Alice**");
  });

  it("omits user name section when not provided", () => {
    const prompt = buildSystemPrompt({ currentDate: "2026-04-10" });

    expect(prompt).not.toContain("collaborating with");
  });

  it("includes vault name when provided", () => {
    const prompt = buildSystemPrompt({
      currentDate: "2026-04-10",
      vaultName: "MyVault"
    });

    expect(prompt).toContain("**MyVault**");
  });

  it("appends custom instructions when provided", () => {
    const prompt = buildSystemPrompt({
      currentDate: "2026-04-10",
      customInstructions: "Always respond in Chinese."
    });

    expect(prompt).toContain("User Custom Instructions");
    expect(prompt).toContain("Always respond in Chinese.");
  });

  it("omits custom instructions section when empty", () => {
    const prompt = buildSystemPrompt({
      currentDate: "2026-04-10",
      customInstructions: ""
    });

    expect(prompt).not.toContain("User Custom Instructions");
  });

  it("omits custom instructions section when whitespace only", () => {
    const prompt = buildSystemPrompt({
      currentDate: "2026-04-10",
      customInstructions: "   "
    });

    expect(prompt).not.toContain("User Custom Instructions");
  });

  it("formats current date using local calendar date instead of UTC iso slicing", () => {
    const date = new Date(2026, 3, 13, 0, 30, 0);

    expect(formatCurrentLocalDate(date)).toBe("2026-04-13");
  });
});
