import { describe, expect, it } from "vitest";
import { MODEL_OPTIONS } from "../src/types";
import {
  formatContextLocal,
  formatLastTurnUsage,
  getModelSelectLabel,
  getReasoningEffortLabel
} from "../src/status-bar";

describe("status-bar helpers", () => {
  it("formats local context usage", () => {
    expect(formatContextLocal(0, 4000)).toBe("Ctx 0% · 0");
    expect(formatContextLocal(2100, 4000)).toBe("Ctx 53% · 2.1k");
    expect(formatContextLocal(2100, 4000, 900, 40000)).toBe("Ctx 8% · 3k");
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
