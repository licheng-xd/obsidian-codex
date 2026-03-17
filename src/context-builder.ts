export interface ContextInput {
  userInput: string;
  activeNotePath?: string;
  activeNoteContent?: string;
  selectionText?: string;
}

export const NOTE_CHAR_LIMIT = 4000;

function sanitizeNoteContent(note: string, selection?: string): string {
  let sanitized = note;
  if (selection) {
    sanitized = sanitized.replace(selection, "");
  }
  return sanitized.slice(0, NOTE_CHAR_LIMIT);
}

export function buildContextPayload(input: ContextInput): string {
  const sections: string[] = [`User request:\n${input.userInput}`];

  if (input.selectionText) {
    sections.push(`Selected text:\n${input.selectionText}`);
  }

  if (input.activeNoteContent && input.activeNotePath) {
    const excerpt = sanitizeNoteContent(input.activeNoteContent, input.selectionText).trim();
    if (excerpt) {
      sections.push(`Active note (${input.activeNotePath}):\n${excerpt}`);
    }
  }

  return sections.join("\n\n");
}
