import { getInlineEditSystemPrompt, extractInlineEditResponse, type InlineEditExtraction } from "./prompt/inline-edit";

export type InlineEditMode = "rewrite-selection" | "insert-at-cursor";

export type { InlineEditExtraction };
export { extractInlineEditResponse };

const INLINE_CONTEXT_RADIUS = 240;
const SINGLE_FENCED_BLOCK_PATTERN = /^```(?:[\w-]+)?\r?\n([\s\S]*?)\r?\n```$/;

export interface InlineEditPromptInput {
  mode: InlineEditMode;
  instruction: string;
  notePath?: string;
  documentText: string;
  rangeStart: number;
  rangeEnd: number;
}

export interface InlineEditReviewModel {
  title: string;
  originalLabel: string;
  proposedLabel: string;
  applyLabel: string;
  originalText: string;
  proposedText: string;
}

function sliceContext(text: string, start: number, end: number): { before: string; current: string; after: string } {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));

  return {
    before: text.slice(Math.max(0, safeStart - INLINE_CONTEXT_RADIUS), safeStart).trim(),
    current: text.slice(safeStart, safeEnd),
    after: text.slice(safeEnd, Math.min(text.length, safeEnd + INLINE_CONTEXT_RADIUS)).trim()
  };
}

export function buildInlineEditPrompt(input: InlineEditPromptInput): string {
  const sections: string[] = [];
  const context = sliceContext(input.documentText, input.rangeStart, input.rangeEnd);
  const instruction = input.instruction.trim();

  sections.push(getInlineEditSystemPrompt());
  sections.push("---");
  sections.push(
    input.mode === "rewrite-selection"
      ? "Task: Rewrite the selected text inside the current note."
      : "Task: Generate text to insert at the cursor."
  );
  sections.push(`Instruction:\n${instruction}`);

  if (input.notePath) {
    sections.push(`Note path: ${input.notePath}`);
  }

  if (input.mode === "rewrite-selection") {
    if (context.before) {
      sections.push(`Text before selection:\n${context.before}`);
    }
    sections.push(`Selected text:\n${context.current}`);
    if (context.after) {
      sections.push(`Text after selection:\n${context.after}`);
    }
    sections.push("Preserve surrounding language, tone, and markdown structure unless the instruction says otherwise.");
    sections.push("Return only the replacement text.");
    return sections.join("\n\n");
  }

  if (context.before) {
    sections.push(`Text before cursor:\n${context.before}`);
  }
  if (context.after) {
    sections.push(`Text after cursor:\n${context.after}`);
  }
  sections.push("Match the surrounding note's language, tone, and markdown structure unless the instruction says otherwise.");
  sections.push("Return only the text to insert.");
  return sections.join("\n\n");
}

export function unwrapInlineEditResponse(response: string): string {
  return resolveInlineEditResponse(response).text;
}

export function resolveInlineEditResponse(response: string): InlineEditExtraction {
  const extraction = extractInlineEditResponse(response);
  if (extraction.kind === "replacement" || extraction.kind === "insertion") {
    return extraction;
  }

  if (extraction.kind === "clarification") {
    return extraction;
  }

  const trimmed = response.trim();
  const fencedMatch = trimmed.match(SINGLE_FENCED_BLOCK_PATTERN);
  if (fencedMatch) {
    return { kind: "raw", text: fencedMatch[1]?.trim() ?? "" };
  }

  return { kind: "raw", text: trimmed };
}

export function buildInlineEditReview(input: {
  mode: InlineEditMode;
  originalText: string;
  proposedText: string;
}): InlineEditReviewModel {
  if (input.mode === "rewrite-selection") {
    return {
      title: "Review inline rewrite",
      originalLabel: "Current selection",
      proposedLabel: "Proposed replacement",
      applyLabel: "Replace selection",
      originalText: input.originalText,
      proposedText: input.proposedText
    };
  }

  return {
    title: "Review inline insert",
    originalLabel: "Current cursor context",
    proposedLabel: "Text to insert",
    applyLabel: "Insert text",
    originalText: input.originalText,
    proposedText: input.proposedText
  };
}
