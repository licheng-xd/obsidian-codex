export interface ContextSummaryInput {
  vaultRootPath?: string;
  activeNotePath?: string;
  selectionText?: string;
  referencedFileCount?: number;
  imageAttachmentCount?: number;
}

export interface ContextSummaryLine {
  label: string;
  value: string;
}

export function getContextSummaryLines(input: ContextSummaryInput): ContextSummaryLine[] {
  const vaultRootLabel = input.vaultRootPath ?? "Unavailable";
  const lines: ContextSummaryLine[] = [{ label: "Vault root", value: vaultRootLabel }];

  if ((input.referencedFileCount ?? 0) > 0) {
    lines.push({ label: "Refs", value: String(input.referencedFileCount) });
  }

  if ((input.imageAttachmentCount ?? 0) > 0) {
    lines.push({ label: "Images", value: String(input.imageAttachmentCount) });
  }

  return lines;
}

export function formatContextSummary(input: ContextSummaryInput): string {
  return getContextSummaryLines(input)
    .map((line) => `${line.label}: ${line.value}`)
    .join("\n");
}
