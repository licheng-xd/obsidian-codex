export interface ContextSummaryInput {
  vaultRootPath?: string;
  activeNotePath?: string;
  selectionText?: string;
}

export interface ContextSummaryLine {
  label: string;
  value: string;
}

export function getContextSummaryLines(input: ContextSummaryInput): ContextSummaryLine[] {
  const vaultRootLabel = input.vaultRootPath ?? "Unavailable";
  const noteLabel = input.activeNotePath ?? "No active note";
  const selectionLabel = input.selectionText
    ? `${input.selectionText.length} chars selected`
    : "No selection";

  return [
    { label: "Vault root", value: vaultRootLabel },
    { label: "Current note", value: noteLabel },
    { label: "Selection", value: selectionLabel }
  ];
}

export function formatContextSummary(input: ContextSummaryInput): string {
  return getContextSummaryLines(input)
    .map((line) => `${line.label}: ${line.value}`)
    .join("\n");
}
