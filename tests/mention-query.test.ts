import { describe, expect, it } from "vitest";
import { findActiveMentionQuery } from "../src/mention-query";

describe("findActiveMentionQuery", () => {
  it("detects an empty query immediately after @", () => {
    expect(findActiveMentionQuery("Open @", 6)).toEqual({
      query: "",
      rangeStart: 5,
      rangeEnd: 6
    });
  });

  it("extracts the current @ query and replacement range", () => {
    expect(findActiveMentionQuery("Review @road", 12)).toEqual({
      query: "road",
      rangeStart: 7,
      rangeEnd: 12
    });
  });

  it("does not trigger when the caret is in the middle of the token", () => {
    expect(findActiveMentionQuery("Review @roadmap today", 10)).toBeNull();
  });

  it("does not mistake email-like text for a mention", () => {
    expect(findActiveMentionQuery("mail me at foo@bar.com", 22)).toBeNull();
  });
});
