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

export interface VaultPersistentContextItem {
  readonly kind: "vault-file";
  readonly path: string;
}

export interface ExternalPersistentContextItem {
  readonly kind: "external-file";
  readonly path: string;
}

export type PersistentContextItem =
  | VaultPersistentContextItem
  | ExternalPersistentContextItem;

export interface PersistedChatSession {
  readonly threadId: string;
  readonly title?: string;
  readonly updatedAt: number;
  readonly entries: ReadonlyArray<PersistedChatEntry>;
  readonly contextUsage: PersistedSessionUsage;
  readonly persistentContextItems: ReadonlyArray<PersistentContextItem>;
}

export const MAX_RECENT_SESSIONS = 7;
const DEFAULT_SESSION_TITLE = "New chat";
const ACTION_SUFFIX_MAP: Record<string, string> = {
  总结: "总结",
  整理: "整理",
  分析: "分析",
  拆解: "拆解",
  翻译: "翻译",
  润色: "润色",
  提炼: "提炼",
  归纳: "归纳",
  复盘: "复盘",
  改写: "改写",
  重写: "重写",
  生成: "生成",
  撰写: "撰写",
  写: "撰写"
};
const REWRITE_ACTION_MAP: Record<string, string> = {
  整理成: "整理为",
  整理为: "整理为",
  改写成: "改写为",
  改写为: "改写为",
  重写成: "重写为",
  重写为: "重写为",
  改成: "改为",
  改为: "改为",
  转换成: "转换为",
  转换为: "转换为",
  翻译成: "翻译为",
  翻译为: "翻译为",
  写成: "写为",
  写为: "写为"
};
const LOW_SIGNAL_TITLE_PATTERN =
  /^(?:hi|hello|hey|yo|嗨|你好|您好|哈喽|在吗|在不在|继续|继续吧|继续一下|继续一下吧|好|好的|ok|okay|thanks|thank you|谢谢|收到|开始吧)$/iu;

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

export function sanitizePersistentContextItem(
  value: unknown,
  externalContextRoots: ReadonlyArray<string> = []
): PersistentContextItem | null {
  if (!isRecord(value) || typeof value.path !== "string" || !value.path.trim()) {
    return null;
  }

  if (value.kind === "vault-file") {
    return {
      kind: "vault-file",
      path: value.path
    };
  }

  if (value.kind === "external-file" && isWithinExternalContextRoots(value.path, externalContextRoots)) {
    return {
      kind: "external-file",
      path: value.path
    };
  }

  return null;
}

export function sanitizePersistedChatSession(
  value: unknown,
  externalContextRoots: ReadonlyArray<string> = []
): PersistedChatSession | null {
  if (!isRecord(value) || typeof value.threadId !== "string" || !value.threadId.trim()) {
    return null;
  }

  if (!Array.isArray(value.entries) || !isRecord(value.contextUsage)) {
    return null;
  }

  return {
    threadId: value.threadId,
    title: typeof value.title === "string" && value.title.trim()
      ? value.title.trim()
      : undefined,
    updatedAt:
      typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
        ? value.updatedAt
        : 0,
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
      },
    persistentContextItems: Array.isArray(value.persistentContextItems)
      ? value.persistentContextItems
          .map((item) => sanitizePersistentContextItem(item, externalContextRoots))
          .filter((item): item is PersistentContextItem => item !== null)
      : []
  };
}

export function upsertRecentSession(
  sessions: ReadonlyArray<PersistedChatSession>,
  nextSession: PersistedChatSession,
  limit = MAX_RECENT_SESSIONS
): PersistedChatSession[] {
  const remainingSessions = sessions.filter((session) => session.threadId !== nextSession.threadId);
  return [nextSession, ...remainingSessions].slice(0, Math.max(0, limit));
}

function deriveLegacySessionTitle(entries: ReadonlyArray<PersistedChatEntry>): string {
  const userEntry = entries.find((entry) => entry.type === "user");
  if (!userEntry) {
    return DEFAULT_SESSION_TITLE;
  }

  const normalized = userEntry.text.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return DEFAULT_SESSION_TITLE;
  }

  return normalized.slice(0, 48);
}

function normalizeTitleSource(text: string): string {
  return text
    .replace(/\r?\n/g, " ")
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[，,。.!！？；;：:\-—\s]+|[，,。.!！？；;：:\-—\s]+$/g, "");
}

function stripRequestPrefix(text: string): string {
  let normalized = text;
  const prefixes = [
    /^(?:请你|请|麻烦你|麻烦|帮我|帮忙|请帮我|请帮忙|可以请你|可以帮我|可以|能不能请你|能不能|能否请你|能否|我想让你|我想请你|我希望你)\s*/u
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of prefixes) {
      const next = normalized.replace(prefix, "");
      if (next !== normalized) {
        normalized = next.trim();
        changed = true;
      }
    }
  }

  return normalized;
}

function cleanTopicSegment(text: string): string {
  const normalized = normalizeTitleSource(text)
    .replace(/这个(?=[A-Za-z])/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^(?:这(?:份|篇|个|条)?|那(?:份|篇|个|条)?|该|一(?:份|篇|个|条))\s*/u, "")
    .replace(/(?:一下|一下子|一下下|看看|吧|呀|呢|吗)$/u, "")
    .replace(/(.{2,})版本$/u, "$1")
    .trim();

  return normalized || DEFAULT_SESSION_TITLE;
}

function isLowSignalTitleCandidate(text: string): boolean {
  const normalized = normalizeTitleSource(stripRequestPrefix(text)).toLowerCase();
  if (!normalized) {
    return true;
  }

  return LOW_SIGNAL_TITLE_PATTERN.test(normalized);
}

function buildReviewTitle(subject: string): string {
  const normalizedSubject = cleanTopicSegment(subject);
  if (normalizedSubject === DEFAULT_SESSION_TITLE) {
    return DEFAULT_SESSION_TITLE;
  }

  return `${normalizedSubject} 评审`.slice(0, 48);
}

function buildSummaryTitle(rawInput: string): string {
  const normalized = normalizeTitleSource(rawInput);
  if (!normalized) {
    return DEFAULT_SESSION_TITLE;
  }

  const primaryClause = normalized.split(/[。！？!?]/u)[0]?.trim() ?? normalized;
  const stripped = stripRequestPrefix(primaryClause);
  if (!stripped) {
    return DEFAULT_SESSION_TITLE;
  }

  const reviewMatch = stripped.match(
    /^(?:review一下|review下|review|评审一下|评审下|评审|审查一下|审查下|审查|检查一下|检查下|检查|看一下|看下)\s*(.+?)(?:有没有问题|是否有问题|有问题吗|行不行|可以吗)?$/iu
  );
  if (reviewMatch) {
    return buildReviewTitle(reviewMatch[1]);
  }

  const rewriteMatch = stripped.match(
    /^(?:把|将)\s*(.+?)\s*(整理成|整理为|改写成|改写为|重写成|重写为|改成|改为|转换成|转换为|翻译成|翻译为|写成|写为)\s*(.+)$/u
  );
  if (rewriteMatch) {
    const source = cleanTopicSegment(rewriteMatch[1]);
    const action = REWRITE_ACTION_MAP[rewriteMatch[2]] ?? rewriteMatch[2];
    const target = cleanTopicSegment(rewriteMatch[3]);
    return `${source}${action}${target}`.slice(0, 48);
  }

  const actionFirstMatch = stripped.match(
    /^(总结|整理|分析|拆解|翻译|润色|提炼|归纳|复盘|改写|重写|生成|撰写|写)\s*(.+)$/u
  );
  if (actionFirstMatch) {
    const action = ACTION_SUFFIX_MAP[actionFirstMatch[1]] ?? actionFirstMatch[1];
    const subject = cleanTopicSegment(actionFirstMatch[2]);
    return `${subject}${action}`.slice(0, 48);
  }

  const objectFirstMatch = stripped.match(
    /^(?:把|将)\s*(.+?)\s*(总结|整理|分析|拆解|翻译|润色|提炼|归纳|复盘|改写|重写|生成|撰写|写)(?:一下|一下子|一下下)?$/u
  );
  if (objectFirstMatch) {
    const subject = cleanTopicSegment(objectFirstMatch[1]);
    const action = ACTION_SUFFIX_MAP[objectFirstMatch[2]] ?? objectFirstMatch[2];
    return `${subject}${action}`.slice(0, 48);
  }

  return cleanTopicSegment(stripped).slice(0, 48);
}

export function deriveSessionTitle(entries: ReadonlyArray<PersistedChatEntry>): string {
  const userEntry = entries.find(
    (entry): entry is PersistedUserEntry => entry.type === "user" && !isLowSignalTitleCandidate(entry.text)
  );
  if (!userEntry) {
    return DEFAULT_SESSION_TITLE;
  }

  return buildSummaryTitle(userEntry.text);
}

export function resolveSessionTitle(
  entries: ReadonlyArray<PersistedChatEntry>,
  existingTitle?: string
): string {
  const normalizedExistingTitle = existingTitle?.trim();
  if (normalizedExistingTitle && normalizedExistingTitle !== deriveLegacySessionTitle(entries)) {
    return normalizedExistingTitle;
  }

  return deriveSessionTitle(entries);
}

export function getSessionDisplayTitle(session: PersistedChatSession): string {
  return resolveSessionTitle(session.entries, session.title);
}
import { isWithinExternalContextRoots } from "./external-contexts";
