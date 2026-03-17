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

function buildNoteExcerpt(input: Pick<ContextInput, "activeNotePath" | "activeNoteContent" | "selectionText">): string {
  if (!input.activeNoteContent || !input.activeNotePath) {
    return "";
  }

  return sanitizeNoteContent(input.activeNoteContent, input.selectionText).trim();
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
