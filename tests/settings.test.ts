import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  sanitizePluginSettings,
  toggleYoloMode,
  updateExecutionSettings
} from "../src/settings";

describe("sanitizePluginSettings", () => {
  it("returns defaults when data is missing", () => {
    expect(sanitizePluginSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("accepts official client model list and reasoning effort fields", () => {
    expect(
      sanitizePluginSettings({
        codexPath: "/custom/bin/codex",
        skipGitRepoCheck: false,
        sandboxMode: "danger-full-access",
        approvalPolicy: "never",
        model: "gpt-5.3-codex",
        reasoningEffort: "xhigh",
        yoloMode: true
      })
    ).toEqual({
      codexPath: "/custom/bin/codex",
      skipGitRepoCheck: false,
      sandboxMode: "danger-full-access",
      approvalPolicy: "never",
      model: "gpt-5.3-codex",
      reasoningEffort: "xhigh",
      yoloMode: true
    });
  });

  it("falls back to defaults for invalid V2 fields", () => {
    expect(
      sanitizePluginSettings({
        sandboxMode: "invalid" as "read-only",
        approvalPolicy: "invalid" as "never",
        model: 123 as unknown as string,
        reasoningEffort: "ultra" as "high",
        yoloMode: "true" as unknown as boolean
      })
    ).toEqual({
      ...DEFAULT_SETTINGS,
      sandboxMode: DEFAULT_SETTINGS.sandboxMode,
      approvalPolicy: DEFAULT_SETTINGS.approvalPolicy,
      model: DEFAULT_SETTINGS.model,
      reasoningEffort: DEFAULT_SETTINGS.reasoningEffort,
      yoloMode: DEFAULT_SETTINGS.yoloMode
    });
  });

  it("enables YOLO with persistent dangerous defaults", () => {
    expect(toggleYoloMode(DEFAULT_SETTINGS, true)).toEqual({
      ...DEFAULT_SETTINGS,
      sandboxMode: "danger-full-access",
      approvalPolicy: "never",
      yoloMode: true
    });
  });

  it("turns off YOLO when execution settings diverge", () => {
    const yoloSettings = toggleYoloMode(DEFAULT_SETTINGS, true);

    expect(updateExecutionSettings(yoloSettings, { sandboxMode: "read-only" })).toEqual({
      ...yoloSettings,
      sandboxMode: "read-only",
      yoloMode: false
    });
  });
});
