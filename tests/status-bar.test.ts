import { describe, expect, it } from "vitest";
import { MODEL_OPTIONS, type ContextUsage } from "../src/types";
import {
  formatEstimatedContextMeterLabel,
  formatEstimatedContextMeterTitle,
  formatExecutionStateLabel,
  formatContextWindowTitle,
  formatContextWindowUsage,
  formatLastTurnUsage,
  getEstimatedContextMeterPercentage,
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

  it("formats an explicitly estimated context meter from local history estimates", () => {
    expect(
      formatEstimatedContextMeterLabel(
        createUsage({
          threadCharsUsedEstimate: 10_000,
          threadCharsLimitEstimate: 40_000
        })
      )
    ).toBe("Est. 25%");
    expect(
      getEstimatedContextMeterPercentage(
        createUsage({
          threadCharsUsedEstimate: 120_000,
          threadCharsLimitEstimate: 40_000
        })
      )
    ).toBe(100);
  });

  it("explains that the context meter is an estimate rather than sdk authority", () => {
    expect(
      formatEstimatedContextMeterTitle(
        createUsage({
          threadCharsUsedEstimate: 12034,
          threadCharsLimitEstimate: 40000
        })
      )
    ).toContain("Estimated session context");
    expect(
      formatEstimatedContextMeterTitle(
        createUsage({
          threadCharsUsedEstimate: 12034,
          threadCharsLimitEstimate: 40000
        })
      )
    ).toContain("Not the SDK authoritative thread window");
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

  it("formats the execution state label", () => {
    expect(formatExecutionStateLabel(false)).toBe("Ready");
    expect(formatExecutionStateLabel(true)).toBe("Running");
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
