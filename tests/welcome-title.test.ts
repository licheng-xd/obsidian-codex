import { describe, expect, it } from "vitest";
import { getWelcomeTitle } from "../src/welcome-title";

describe("getWelcomeTitle", () => {
  it("builds a weekday-based greeting", () => {
    expect(getWelcomeTitle(new Date("2026-03-17T12:00:00Z"))).toBe("Happy Tuesday");
  });
});
