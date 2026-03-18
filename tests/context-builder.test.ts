import { describe, expect, it } from "vitest";
import {
  NOTE_CHAR_LIMIT,
  buildContextPayload,
  measureLocalContextUsage
} from "../src/context-builder";
import { VAULT_ROOT_DIRECTORY } from "../src/vault-save-planner";

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

  it("includes planner-driven local save guidance when provided", () => {
    const payload = buildContextPayload({
      userInput: "Save this report locally",
      activeNotePath: "Projects/AI/note.md",
      activeNoteContent: "Summary",
      saveTargetPlan: {
        preferredDirectory: "Projects/AI/reports",
        reason: "README.md suggests report content belongs in Projects/AI/reports.",
        confidence: "high",
        fallbackChain: ["Projects/AI", VAULT_ROOT_DIRECTORY],
        contentType: "report"
      }
    });

    expect(payload).toContain("Local save guidance:");
    expect(payload).toContain("Preferred directory: Projects/AI/reports");
    expect(payload).toContain("Reason: README.md suggests report content belongs in Projects/AI/reports.");
    expect(payload).toContain("Fallbacks: Projects/AI -> vault root");
  });

  it("renders the vault root label when the planner points to the root", () => {
    const payload = buildContextPayload({
      userInput: "Save this report locally",
      activeNotePath: "note.md",
      activeNoteContent: "Summary",
      saveTargetPlan: {
        preferredDirectory: VAULT_ROOT_DIRECTORY,
        reason: "No clear vault rule matched and there is no active note, so the vault root is the final fallback.",
        confidence: "low",
        fallbackChain: [],
        contentType: "report"
      }
    });

    expect(payload).toContain("Preferred directory: vault root");
    expect(payload).toContain("Fallbacks: none");
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
