export interface ContextInput {
  userInput: string;
  activeNotePath?: string;
  activeNoteContent?: string;
  selectionText?: string;
}

export const NOTE_CHAR_LIMIT = 4000;
export const THREAD_CONTEXT_CHAR_LIMIT = 40000;

function sanitizeNoteContent(note: string, selection?: string): string {
  let sanitized = note;
  if (selection) {
    sanitized = sanitized.replace(selection, "");
  }
  return sanitized.slice(0, NOTE_CHAR_LIMIT);
}

function buildNoteExcerpt(input: Pick<ContextInput, "activeNotePath" | "activeNoteContent" | "selectionText">): string {
  if (!input.activeNoteContent || !input.activeNotePath) {
    return "";
  }

  return sanitizeNoteContent(input.activeNoteContent, input.selectionText).trim();
}

export function deriveDefaultSaveDirectory(activeNotePath?: string): string | null {
  if (!activeNotePath) {
    return null;
  }

  const lastSlashIndex = activeNotePath.lastIndexOf("/");
  if (lastSlashIndex === -1) {
    return "";
  }

  return activeNotePath.slice(0, lastSlashIndex);
}

function buildSaveGuidance(activeNotePath?: string): string {
  const defaultSaveDirectory = deriveDefaultSaveDirectory(activeNotePath);

  if (defaultSaveDirectory) {
    return [
      "Local save guidance:",
      `- When creating or saving a new local file, default to the current note's sibling directory: ${defaultSaveDirectory}`,
      "- Use a vault-relative path inside that directory unless the user explicitly asks for a different location.",
      "- Do not place new files in the vault root by default."
    ].join("\n");
  }

  if (activeNotePath) {
    return [
      "Local save guidance:",
      "- When creating or saving a new local file, default to the vault root.",
      "- The current note already lives in the vault root, so sibling files should go there by default."
    ].join("\n");
  }

  return [
    "Local save guidance:",
    "- When creating or saving a new local file, default to the vault root.",
    "- There is no open note, so the vault root is the fallback location."
  ].join("\n");
}

export function buildContextPayload(input: ContextInput): string {
  const sections: string[] = [`User request:\n${input.userInput}`];

  if (input.selectionText) {
    sections.push(`Selected text:\n${input.selectionText}`);
  }

  const excerpt = buildNoteExcerpt(input);
  if (excerpt && input.activeNotePath) {
    sections.push(`Active note (${input.activeNotePath}):\n${excerpt}`);
  }

  sections.push(buildSaveGuidance(input.activeNotePath));

  return sections.join("\n\n");
}

export function measureLocalContextUsage(input: ContextInput): { used: number; limit: number } {
  const selectionLength = input.selectionText?.length ?? 0;
  const noteExcerptLength = buildNoteExcerpt(input).length;

  return {
    used: selectionLength + noteExcerptLength,
    limit: NOTE_CHAR_LIMIT
  };
}
