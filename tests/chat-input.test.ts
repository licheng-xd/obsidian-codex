import { describe, expect, it } from "vitest";
import { shouldSubmitFromKeydown } from "../src/chat-input";

describe("shouldSubmitFromKeydown", () => {
  it("submits on bare Enter", () => {
    expect(shouldSubmitFromKeydown({ key: "Enter" })).toBe(true);
  });

  it("does not submit on Command/Ctrl+Enter so newline can be inserted", () => {
    expect(shouldSubmitFromKeydown({ key: "Enter", metaKey: true })).toBe(false);
    expect(shouldSubmitFromKeydown({ key: "Enter", ctrlKey: true })).toBe(false);
  });

  it("does not submit while composing text with IME", () => {
    expect(shouldSubmitFromKeydown({ key: "Enter", isComposing: true })).toBe(false);
  });

  it("does not submit on other modified Enter combinations", () => {
    expect(shouldSubmitFromKeydown({ key: "Enter", shiftKey: true })).toBe(false);
    expect(shouldSubmitFromKeydown({ key: "Enter", altKey: true })).toBe(false);
  });
});
