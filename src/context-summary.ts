export interface ContextSummaryInput {
  vaultRootPath?: string;
  activeNotePath?: string;
  selectionText?: string;
}

export function formatContextSummary(input: ContextSummaryInput): string {
  const vaultRootLabel = input.vaultRootPath ?? "Unavailable";
  const noteLabel = input.activeNotePath ?? "No active note";
  const selectionLabel = input.selectionText
    ? `${input.selectionText.length} chars selected`
    : "No selection";

  return `Vault root: ${vaultRootLabel} / Current note: ${noteLabel} / ${selectionLabel}`;
}
