import { describe, expect, it } from "vitest";
import { finalizeCodexProbeResult, mapThreadEvent } from "../src/codex-service";
import type { ThreadEvent } from "@openai/codex-sdk";

describe("finalizeCodexProbeResult", () => {
  it("returns a trimmed version string when stdout is present", () => {
    expect(finalizeCodexProbeResult(0, "codex-cli 0.114.0\n", "")).toBe("codex-cli 0.114.0");
  });

  it("throws when the codex process exits successfully but produces no stdout", () => {
    expect(() => finalizeCodexProbeResult(0, "   \n", "")).toThrow(
      "codex exited successfully but produced no version output"
    );
  });

  it("throws stderr output when the codex process exits with a failure code", () => {
    expect(() => finalizeCodexProbeResult(1, "", "spawn codex ENOENT")).toThrow(
      "spawn codex ENOENT"
    );
  });
});

describe("mapThreadEvent", () => {
  it("maps agent items to text chunks", () => {
    const event: ThreadEvent = {
      type: "item.completed",
      item: { id: "1", type: "agent_message", text: "hello" }
    };

    expect(mapThreadEvent(event)).toEqual({ type: "text", text: "hello" });
  });

  it("maps thread errors to error chunks", () => {
    const event: ThreadEvent = { type: "error", message: "boom" };

    expect(mapThreadEvent(event)).toEqual({ type: "error", message: "boom" });
  });
});
