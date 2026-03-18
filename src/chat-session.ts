export interface PersistedSummaryItem {
  readonly label: string;
  readonly preview?: string;
  readonly lines: ReadonlyArray<string>;
}

export interface PersistedUserEntry {
  readonly type: "user";
  readonly text: string;
}

export interface PersistedStatusEntry {
  readonly type: "status";
  readonly text: string;
}

export interface PersistedAssistantEntry {
  readonly type: "assistant";
  readonly metaLabel: string;
  readonly contentMarkdown: string;
  readonly summaries: ReadonlyArray<PersistedSummaryItem>;
}

export type PersistedChatEntry =
  | PersistedUserEntry
  | PersistedStatusEntry
  | PersistedAssistantEntry;

export interface PersistedSessionUsage {
  readonly threadCharsUsedEstimate: number;
  readonly sdkInputTokens: number | null;
  readonly sdkCachedInputTokens: number | null;
  readonly sdkOutputTokens: number | null;
}

export interface PersistedChatSession {
  readonly threadId: string;
  readonly entries: ReadonlyArray<PersistedChatEntry>;
  readonly contextUsage: PersistedSessionUsage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeSummaryItem(value: unknown): PersistedSummaryItem | null {
  if (!isRecord(value) || typeof value.label !== "string" || !Array.isArray(value.lines)) {
    return null;
  }

  return {
    label: value.label,
    preview: typeof value.preview === "string" ? value.preview : undefined,
    lines: value.lines.filter((line): line is string => typeof line === "string")
  };
}

function sanitizeEntry(value: unknown): PersistedChatEntry | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  switch (value.type) {
    case "user":
    case "status":
      return typeof value.text === "string"
        ? { type: value.type, text: value.text }
        : null;
    case "assistant":
      if (typeof value.metaLabel !== "string" || typeof value.contentMarkdown !== "string") {
        return null;
      }

      return {
        type: "assistant",
        metaLabel: value.metaLabel,
        contentMarkdown: value.contentMarkdown,
        summaries: Array.isArray(value.summaries)
          ? value.summaries
              .map(sanitizeSummaryItem)
              .filter((item): item is PersistedSummaryItem => item !== null)
          : []
      };
    default:
      return null;
  }
}

export function sanitizePersistedChatSession(value: unknown): PersistedChatSession | null {
  if (!isRecord(value) || typeof value.threadId !== "string" || !value.threadId.trim()) {
    return null;
  }

  if (!Array.isArray(value.entries) || !isRecord(value.contextUsage)) {
    return null;
  }

  return {
    threadId: value.threadId,
    entries: value.entries
      .map(sanitizeEntry)
      .filter((entry): entry is PersistedChatEntry => entry !== null),
    contextUsage: {
      threadCharsUsedEstimate:
        typeof value.contextUsage.threadCharsUsedEstimate === "number"
          ? value.contextUsage.threadCharsUsedEstimate
          : 0,
      sdkInputTokens:
        typeof value.contextUsage.sdkInputTokens === "number"
          ? value.contextUsage.sdkInputTokens
          : null,
      sdkCachedInputTokens:
        typeof value.contextUsage.sdkCachedInputTokens === "number"
          ? value.contextUsage.sdkCachedInputTokens
          : null,
      sdkOutputTokens:
        typeof value.contextUsage.sdkOutputTokens === "number"
          ? value.contextUsage.sdkOutputTokens
          : null
    }
  };
}
