import {
  VAULT_ROOT_DIRECTORY,
  type VaultSaveTargetPlan
} from "./vault-save-planner";

export interface ContextInput {
  userInput: string;
  activeNotePath?: string;
  activeNoteContent?: string;
  selectionText?: string;
  saveTargetPlan?: VaultSaveTargetPlan;
}

export const NOTE_CHAR_LIMIT = 4000;
export const THREAD_CONTEXT_CHAR_LIMIT = 40000;

export function omitActiveNoteContext(input: ContextInput): ContextInput {
  return {
    ...input,
    activeNoteContent: undefined
  };
}

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

function formatSaveDirectory(path: string): string {
  return path === VAULT_ROOT_DIRECTORY ? "vault root" : path;
}

function buildSaveGuidance(plan: VaultSaveTargetPlan): string {
  const fallbackText = plan.fallbackChain.length > 0
    ? plan.fallbackChain.map(formatSaveDirectory).join(" -> ")
    : "none";

  return [
    "Local save guidance:",
    `- Preferred directory: ${formatSaveDirectory(plan.preferredDirectory)}`,
    `- Reason: ${plan.reason}`,
    `- Confidence: ${plan.confidence}`,
    `- Fallbacks: ${fallbackText}`,
    "- When saving locally, use the preferred directory unless the user explicitly asks for a different location."
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

  if (input.saveTargetPlan) {
    sections.push(buildSaveGuidance(input.saveTargetPlan));
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
