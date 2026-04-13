import {
  MODEL_CONTEXT_WINDOWS,
  MODEL_OPTIONS,
  REASONING_EFFORT_OPTIONS,
  type ContextUsage,
  type ReasoningEffort
} from "../types";

function formatCompactCount(value: number): string {
  if (value < 1000) {
    return String(value);
  }

  if (value >= 1_000_000) {
    const compactValue = Math.round(value / 100_000) / 10;
    return `${String(compactValue).replace(/\.0$/, "")}M`;
  }

  const compactValue = value >= 10_000 ? Math.round(value / 1000) : Math.round(value / 100) / 10;
  return `${String(compactValue).replace(/\.0$/, "")}k`;
}

function formatEstimatedCount(value: number): string {
  if (value <= 0) {
    return "0";
  }

  return `~${formatCompactCount(value)}`;
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  if (value >= 100) {
    return 100;
  }

  return Math.round(value);
}

function formatLocalContextUsage(usage: ContextUsage): string {
  return `Local ${formatCompactCount(usage.localCharsUsed)} / ${formatCompactCount(usage.localCharsLimit)}`;
}

export function getModelContextWindow(model: string): number | null {
  return MODEL_CONTEXT_WINDOWS[model as keyof typeof MODEL_CONTEXT_WINDOWS] ?? null;
}

export function formatContextWindowUsage(
  model: string,
  usage: ContextUsage
): string {
  void model;
  return formatLocalContextUsage(usage);
}

export function formatContextWindowTitle(
  model: string,
  usage: ContextUsage
): string {
  const contextWindow = getModelContextWindow(model);
  const historyEstimate = Math.max(0, Math.round(usage.threadCharsUsedEstimate));

  return [
    `Local context: ${formatCompactCount(usage.localCharsUsed)} / ${formatCompactCount(usage.localCharsLimit)} chars`,
    `Visible history est.: ${formatEstimatedCount(historyEstimate)} chars`,
    contextWindow
      ? `Configured model window: ${formatCompactCount(contextWindow)} tokens`
      : "Configured model window: unavailable",
    "Thread window: unavailable in current Codex SDK",
    formatLastTurnUsage(
      usage.sdkInputTokens,
      usage.sdkCachedInputTokens,
      usage.sdkOutputTokens
    ),
    usage.sdkInputTokens === null
      ? "Turn input note: pending"
      : "Turn input note: aggregate across the completed turn, not live thread window",
    "Auto-compact: unavailable in current Codex SDK"
  ].join(" · ");
}

export function getEstimatedContextMeterPercentage(usage: ContextUsage): number {
  const estimatedLimit = Math.max(0, Math.round(usage.threadCharsLimitEstimate));
  const estimatedUsed = Math.max(0, Math.round(usage.threadCharsUsedEstimate));

  if (estimatedLimit === 0) {
    return 0;
  }

  return clampPercentage((estimatedUsed / estimatedLimit) * 100);
}

export function formatEstimatedContextMeterLabel(usage: ContextUsage): string {
  return `Est. ${String(getEstimatedContextMeterPercentage(usage))}%`;
}

export function formatEstimatedContextMeterTitle(usage: ContextUsage): string {
  const estimatedUsed = Math.max(0, Math.round(usage.threadCharsUsedEstimate));
  const estimatedLimit = Math.max(0, Math.round(usage.threadCharsLimitEstimate));

  return [
    `Estimated session context: ${formatEstimatedCount(estimatedUsed)} / ${formatEstimatedCount(estimatedLimit)} chars`,
    "Derived from visible history and local context only",
    "Not the SDK authoritative thread window"
  ].join(" · ");
}

export function formatLastTurnUsage(
  input: number | null,
  cached: number | null,
  output: number | null
): string {
  if (input === null || cached === null || output === null) {
    return "Last turn: pending";
  }

  return `Last turn: in ${formatCompactCount(input)} / cached ${formatCompactCount(cached)} / out ${formatCompactCount(output)}`;
}

export function formatExecutionStateLabel(isRunning: boolean): string {
  return isRunning ? "Running" : "Ready";
}

export function getModelSelectLabel(model: string): string {
  return MODEL_OPTIONS.find((option) => option.id === model)?.label ?? model;
}

export function getReasoningEffortLabel(effort: ReasoningEffort): string {
  return REASONING_EFFORT_OPTIONS.find((option) => option.id === effort)?.label ?? effort;
}
