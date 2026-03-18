export const MODEL_OPTIONS = [
  { id: "gpt-5.4", label: "GPT-5.4" },
  { id: "gpt-5.3-codex", label: "GPT-5.3-Codex" }
] as const;

export const MODEL_CONTEXT_WINDOWS = {
  "gpt-5.4": 1_050_000,
  "gpt-5.3-codex": 400_000
} as const;

export const MODEL_PRESETS = MODEL_OPTIONS.map((option) => option.id);

export const DEFAULT_MODEL = MODEL_OPTIONS[0].id;

export const REASONING_EFFORT_OPTIONS = [
  { id: "low", label: "低" },
  { id: "medium", label: "中" },
  { id: "high", label: "高" },
  { id: "xhigh", label: "超高" }
] as const;

export type ReasoningEffort = (typeof REASONING_EFFORT_OPTIONS)[number]["id"];
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "xhigh";

export type ActivityType = "mcp_tool_call" | "web_search" | "todo_list";
export type CommandStatus = "in_progress" | "completed" | "failed";
export type FileChangeStatus = "completed" | "failed";
export type FileChangeKind = "add" | "delete" | "update";

export interface ContextUsage {
  readonly localCharsUsed: number;
  readonly localCharsLimit: number;
  readonly threadCharsUsedEstimate: number;
  readonly threadCharsLimitEstimate: number;
  readonly sdkInputTokens: number | null;
  readonly sdkCachedInputTokens: number | null;
  readonly sdkOutputTokens: number | null;
}

export interface TurnUsage {
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
}

export interface MappedTextEvent {
  readonly type: "text";
  readonly itemId: string;
  readonly text: string;
}

export interface MappedReasoningEvent {
  readonly type: "reasoning";
  readonly itemId: string;
  readonly text: string;
}

export interface MappedCommandEvent {
  readonly type: "command";
  readonly itemId: string;
  readonly command: string;
  readonly aggregatedOutput: string;
  readonly status: CommandStatus;
  readonly exitCode?: number;
}

export interface MappedFileChangeEvent {
  readonly type: "file_change";
  readonly itemId: string;
  readonly changes: ReadonlyArray<{
    readonly path: string;
    readonly kind: FileChangeKind;
  }>;
  readonly status: FileChangeStatus;
}

export interface MappedActivityEvent {
  readonly type: "activity";
  readonly itemId: string;
  readonly activityType: ActivityType;
  readonly title: string;
  readonly detail?: string;
  readonly status?: CommandStatus;
}

export interface MappedTurnStartedEvent {
  readonly type: "turn_started";
}

export interface MappedTurnCompletedEvent {
  readonly type: "turn_completed";
  readonly usage: TurnUsage;
}

export interface MappedTurnFailedEvent {
  readonly type: "turn_failed";
  readonly message: string;
}

export interface MappedErrorEvent {
  readonly type: "error";
  readonly message: string;
  readonly itemId?: string;
}

export interface MappedSummaryEvent {
  readonly type: "summary";
  readonly itemId: string;
  readonly label: string;
  readonly preview?: string;
  readonly lines: ReadonlyArray<string>;
}

export interface MappedNoopEvent {
  readonly type: "noop";
}

export type MappedEvent =
  | MappedTextEvent
  | MappedReasoningEvent
  | MappedCommandEvent
  | MappedFileChangeEvent
  | MappedActivityEvent
  | MappedTurnStartedEvent
  | MappedTurnCompletedEvent
  | MappedTurnFailedEvent
  | MappedErrorEvent
  | MappedNoopEvent;
