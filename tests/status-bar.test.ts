import { describe, expect, it } from "vitest";
import { MODEL_OPTIONS } from "../src/types";
import {
  formatLastTurnUsage,
  formatTurnWindowUsage,
  getModelContextWindow,
  getModelSelectLabel,
  getReasoningEffortLabel
} from "../src/status-bar";

describe("status-bar helpers", () => {
  it("formats real turn token usage against the model context window", () => {
    expect(formatTurnWindowUsage("gpt-5.4", null)).toBe("Turn pending");
    expect(formatTurnWindowUsage("gpt-5.4", 12034)).toBe("Turn 1% · 12k / 1.1M");
    expect(formatTurnWindowUsage("gpt-5.3-codex", 48000)).toBe("Turn 12% · 48k / 400k");
  });

  it("falls back to raw input tokens when the model window is unknown", () => {
    expect(formatTurnWindowUsage("custom-model", 12034)).toBe("Turn 12k");
  });

  it("formats last turn usage", () => {
    expect(formatLastTurnUsage(12034, 2000, 800)).toBe("Last turn: in 12k / cached 2k / out 800");
  });

  it("shows pending state when usage is unavailable", () => {
    expect(formatLastTurnUsage(null, null, null)).toBe("Last turn: pending");
  });

  it("maps model ids to official client labels", () => {
    expect(getModelSelectLabel("gpt-5.4")).toBe("GPT-5.4");
    expect(getModelSelectLabel("gpt-5.3-codex")).toBe("GPT-5.3-Codex");
    expect(getModelSelectLabel("custom-model")).toBe("custom-model");
  });

  it("maps supported models to official context windows", () => {
    expect(getModelContextWindow("gpt-5.4")).toBe(1_050_000);
    expect(getModelContextWindow("gpt-5.3-codex")).toBe(400_000);
    expect(getModelContextWindow("custom-model")).toBeNull();
  });

  it("keeps only the curated quick model options", () => {
    expect(MODEL_OPTIONS.map((option) => option.id)).toEqual([
      "gpt-5.4",
      "gpt-5.3-codex"
    ]);
  });

  it("maps reasoning effort to Chinese labels", () => {
    expect(getReasoningEffortLabel("low")).toBe("低");
    expect(getReasoningEffortLabel("medium")).toBe("中");
    expect(getReasoningEffortLabel("high")).toBe("高");
    expect(getReasoningEffortLabel("xhigh")).toBe("超高");
  });
});
