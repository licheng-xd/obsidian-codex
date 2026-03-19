import { describe, expect, it } from "vitest";
import {
  insertTextAtSelection,
  shouldInsertLineBreakFromKeydown,
  shouldSubmitFromKeydown
} from "../src/chat-input";

describe("shouldSubmitFromKeydown", () => {
  it("submits on bare Enter", () => {
    expect(shouldSubmitFromKeydown({ key: "Enter" })).toBe(true);
  });

  it("does not submit on Command/Ctrl+Enter so newline can be inserted", () => {
    expect(shouldSubmitFromKeydown({ key: "Enter", metaKey: true })).toBe(false);
    expect(shouldSubmitFromKeydown({ key: "Enter", ctrlKey: true })).toBe(false);
  });

  it("treats Command/Ctrl+Enter as an explicit line break", () => {
    expect(shouldInsertLineBreakFromKeydown({ key: "Enter", metaKey: true })).toBe(true);
    expect(shouldInsertLineBreakFromKeydown({ key: "Enter", ctrlKey: true })).toBe(true);
    expect(shouldInsertLineBreakFromKeydown({ key: "Enter", metaKey: true, shiftKey: true })).toBe(false);
  });

  it("does not submit while composing text with IME", () => {
    expect(shouldSubmitFromKeydown({ key: "Enter", isComposing: true })).toBe(false);
  });

  it("does not submit on other modified Enter combinations", () => {
    expect(shouldSubmitFromKeydown({ key: "Enter", shiftKey: true })).toBe(false);
    expect(shouldSubmitFromKeydown({ key: "Enter", altKey: true })).toBe(false);
  });
});

describe("insertTextAtSelection", () => {
  it("inserts text at the caret and moves the selection to the end", () => {
    expect(
      insertTextAtSelection({
        value: "hello world",
        selectionStart: 5,
        selectionEnd: 5,
        text: "\n"
      })
    ).toEqual({
      value: "hello\n world",
      selectionStart: 6,
      selectionEnd: 6
    });
  });

  it("replaces the current selection when inserting text", () => {
    expect(
      insertTextAtSelection({
        value: "hello world",
        selectionStart: 5,
        selectionEnd: 11,
        text: "\n"
      })
    ).toEqual({
      value: "hello\n",
      selectionStart: 6,
      selectionEnd: 6
    });
  });
});
