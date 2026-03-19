import { describe, expect, it } from "vitest";
import { MODEL_OPTIONS, type ContextUsage } from "../src/types";
import {
  formatContextWindowTitle,
  formatContextWindowUsage,
  formatLastTurnUsage,
  getModelContextWindow,
  getModelSelectLabel,
  getReasoningEffortLabel
} from "../src/status-bar";

describe("status-bar helpers", () => {
  function createUsage(overrides: Partial<ContextUsage> = {}): ContextUsage {
    return {
      localCharsUsed: 0,
      localCharsLimit: 4000,
      threadCharsUsedEstimate: 0,
      threadCharsLimitEstimate: 40000,
      sdkInputTokens: null,
      sdkCachedInputTokens: null,
      sdkOutputTokens: null,
      ...overrides
    };
  }

  it("formats the current session estimate against the model context window", () => {
    expect(formatContextWindowUsage("gpt-5.4", createUsage())).toBe("Local 0 / 4k");
    expect(
      formatContextWindowUsage(
        "gpt-5.4",
        createUsage({
          threadCharsUsedEstimate: 220_000,
          localCharsUsed: 1200,
          sdkInputTokens: 2_400_000
        })
      )
    ).toBe("Local 1.2k / 4k");
    expect(
      formatContextWindowUsage(
        "gpt-5.3-codex",
        createUsage({
          threadCharsUsedEstimate: 48_000,
          localCharsUsed: 350,
          sdkInputTokens: 120_000
        })
      )
    ).toBe("Local 350 / 4k");
  });

  it("does not pretend to know the live thread window usage", () => {
    expect(
      formatContextWindowUsage(
        "gpt-5.4",
        createUsage({
          threadCharsUsedEstimate: 2_400_000,
          sdkInputTokens: 2_400_000
        })
      )
    ).toBe("Local 0 / 4k");
  });

  it("uses the same local-only display when the model window is unknown", () => {
    expect(
      formatContextWindowUsage(
        "custom-model",
        createUsage({
          threadCharsUsedEstimate: 12034,
          localCharsUsed: 640,
          sdkInputTokens: 48000
        })
      )
    ).toBe("Local 640 / 4k");
  });

  it("explains the limitations of SDK usage in the tooltip", () => {
    expect(
      formatContextWindowTitle(
        "gpt-5.4",
        createUsage({
          threadCharsUsedEstimate: 12034,
          localCharsUsed: 640,
          sdkInputTokens: 48000,
          sdkCachedInputTokens: 12000,
          sdkOutputTokens: 800
        })
      )
    ).toContain("Thread window: unavailable in current Codex SDK");
    expect(
      formatContextWindowTitle(
        "gpt-5.4",
        createUsage({
          threadCharsUsedEstimate: 12034
        })
      )
    ).toContain("Auto-compact: unavailable in current Codex SDK");
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
