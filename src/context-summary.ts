export interface ContextSummaryInput {
  vaultRootPath?: string;
  activeNotePath?: string;
  selectionText?: string;
  sessionStateLabel?: string;
  sessionContextCount?: number;
  missingSessionContextCount?: number;
  turnFileCount?: number;
  imageAttachmentCount?: number;
}

export interface ContextSummaryLine {
  label: string;
  value: string;
}

export function getContextSummaryLines(input: ContextSummaryInput): ContextSummaryLine[] {
  const vaultRootLabel = input.vaultRootPath ?? "Unavailable";
  const lines: ContextSummaryLine[] = [{ label: "Vault root", value: vaultRootLabel }];

  if (input.activeNotePath) {
    lines.push({ label: "Note", value: input.activeNotePath });
  }

  if (input.selectionText?.trim()) {
    lines.push({ label: "Selection", value: "Yes" });
  }

  if (input.sessionStateLabel) {
    lines.push({ label: "Session", value: input.sessionStateLabel });
  }

  if ((input.sessionContextCount ?? 0) > 0) {
    lines.push({ label: "Session refs", value: String(input.sessionContextCount) });
  }

  if ((input.missingSessionContextCount ?? 0) > 0) {
    lines.push({ label: "Missing refs", value: String(input.missingSessionContextCount) });
  }

  if ((input.turnFileCount ?? 0) > 0) {
    lines.push({ label: "Turn files", value: String(input.turnFileCount) });
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
