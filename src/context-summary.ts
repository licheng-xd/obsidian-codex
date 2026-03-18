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
  return [{ label: "Vault root", value: vaultRootLabel }];
}

export function formatContextSummary(input: ContextSummaryInput): string {
  return getContextSummaryLines(input)
    .map((line) => `${line.label}: ${line.value}`)
    .join("\n");
}
