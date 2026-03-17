import { describe, expect, it } from "vitest";
import { formatContextLocal, formatLastTurnUsage } from "../src/status-bar";

describe("status-bar helpers", () => {
  it("formats local context usage", () => {
    expect(formatContextLocal(0, 4000)).toBe("Local: 0 / 4k");
    expect(formatContextLocal(2100, 4000)).toBe("Local: 2.1k / 4k");
  });

  it("formats last turn usage", () => {
    expect(formatLastTurnUsage(12034, 2000, 800)).toBe("Last turn: in 12k / cached 2k / out 800");
  });

  it("shows pending state when usage is unavailable", () => {
    expect(formatLastTurnUsage(null, null, null)).toBe("Last turn: pending");
  });
});
