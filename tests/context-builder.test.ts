import { describe, expect, it } from "vitest";
import { NOTE_CHAR_LIMIT, buildContextPayload } from "../src/context-builder";

describe("buildContextPayload", () => {
  it("prioritizes selection before note context", () => {
    const payload = buildContextPayload({
      userInput: "Summarize this.",
      activeNotePath: "note.md",
      activeNoteContent: "A quick brown fox jumps over the lazy dog.",
      selectionText: "brown fox"
    });

    const selectionIndex = payload.indexOf("Selected text:");
    const noteIndex = payload.indexOf("Active note");
    expect(selectionIndex).toBeGreaterThan(-1);
    expect(noteIndex).toBeGreaterThan(selectionIndex);
  });

  it("returns only user request when no active editor is present", () => {
    const payload = buildContextPayload({
      userInput: "Just chat."
    });

    expect(payload).toBe("User request:\nJust chat.");
  });

  it("includes note excerpt when no selection is provided", () => {
    const payload = buildContextPayload({
      userInput: "Context please",
      activeNotePath: "doc.md",
      activeNoteContent: "First line.\nSecond line."
    });

    expect(payload).toContain("Active note (doc.md):");
    expect(payload).toContain("First line.");
  });

  it("truncates overly long notes according to the char limit", () => {
    const longNote = "A".repeat(NOTE_CHAR_LIMIT + 100);
    const payload = buildContextPayload({
      userInput: "Please shorten",
      activeNotePath: "long.md",
      activeNoteContent: longNote
    });

    const excerpt = payload.split("Active note (long.md):\n")[1] || "";
    expect(excerpt.length).toBeLessThanOrEqual(NOTE_CHAR_LIMIT);
  });

  it("does not duplicate the selection text inside the note excerpt", () => {
    const note = "Selection is inside this note.";
    const payload = buildContextPayload({
      userInput: "Avoid duplication",
      activeNotePath: "dup.md",
      activeNoteContent: note,
      selectionText: "Selection is"
    });

    const noteSection = payload.split("Active note (dup.md):\n")[1] || "";
    expect(noteSection).not.toContain("Selection is");
  });
});
