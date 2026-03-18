import { describe, expect, it } from "vitest";
import {
  NOTE_CHAR_LIMIT,
  buildContextPayload,
  deriveDefaultSaveDirectory,
  measureLocalContextUsage
} from "../src/context-builder";

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

    expect(payload).toContain("User request:\nJust chat.");
    expect(payload).toContain("Local save guidance:");
    expect(payload).toContain("default to the vault root");
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

  it("defaults local saves to the current note sibling directory", () => {
    const payload = buildContextPayload({
      userInput: "Save this report locally",
      activeNotePath: "Projects/AI/note.md",
      activeNoteContent: "Summary"
    });

    expect(payload).toContain("Local save guidance:");
    expect(payload).toContain("default to the current note's sibling directory: Projects/AI");
    expect(payload).toContain("Do not place new files in the vault root by default.");
  });

  it("defaults local saves to the vault root for root-level notes", () => {
    const payload = buildContextPayload({
      userInput: "Save this report locally",
      activeNotePath: "note.md",
      activeNoteContent: "Summary"
    });

    expect(payload).toContain("default to the vault root.");
    expect(payload).toContain("current note already lives in the vault root");
  });

  it("truncates overly long notes according to the char limit", () => {
    const longNote = "A".repeat(NOTE_CHAR_LIMIT + 100);
    const payload = buildContextPayload({
      userInput: "Please shorten",
      activeNotePath: "long.md",
      activeNoteContent: longNote
    });

    const excerpt =
      payload
        .split("Active note (long.md):\n")[1]
        ?.split("\n\nLocal save guidance:")[0] ?? "";
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

    const noteSection =
      payload
        .split("Active note (dup.md):\n")[1]
        ?.split("\n\nLocal save guidance:")[0] ?? "";
    expect(noteSection).not.toContain("Selection is");
  });

  it("measures local context usage from selection and note excerpt", () => {
    const usage = measureLocalContextUsage({
      userInput: "Measure this",
      activeNotePath: "dup.md",
      activeNoteContent: "Selection is inside this note.",
      selectionText: "Selection is"
    });

    expect(usage).toEqual({
      used: 29,
      limit: NOTE_CHAR_LIMIT
    });
  });

  it("caps measured note usage at the note char limit", () => {
    const usage = measureLocalContextUsage({
      userInput: "Measure this",
      activeNotePath: "long.md",
      activeNoteContent: "A".repeat(NOTE_CHAR_LIMIT + 100)
    });

    expect(usage).toEqual({
      used: NOTE_CHAR_LIMIT,
      limit: NOTE_CHAR_LIMIT
    });
  });
});

describe("deriveDefaultSaveDirectory", () => {
  it("returns the sibling directory for nested notes", () => {
    expect(deriveDefaultSaveDirectory("Projects/AI/note.md")).toBe("Projects/AI");
  });

  it("returns an empty string for root-level notes", () => {
    expect(deriveDefaultSaveDirectory("note.md")).toBe("");
  });

  it("returns null when there is no active note", () => {
    expect(deriveDefaultSaveDirectory()).toBeNull();
  });
});
