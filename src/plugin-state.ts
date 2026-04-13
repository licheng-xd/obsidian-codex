import type {
  PersistedChatSession,
  PersistentContextItem
} from "./chat-session";
import {
  deriveSessionTitle,
  MAX_RECENT_SESSIONS,
  resolveSessionTitle,
  sanitizePersistentContextItem,
  sanitizePersistedChatSession
} from "./chat-session";
import type { PluginSettings } from "./settings";
import { sanitizePluginSettings } from "./settings";

export interface PersistedPluginData {
  readonly settings: PluginSettings;
  readonly recentSessions: ReadonlyArray<PersistedChatSession>;
  readonly activeSessionId: string | null;
  readonly draftPersistentContextItems: ReadonlyArray<PersistentContextItem>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeRecentSessions(
  sessions: ReadonlyArray<PersistedChatSession>
): PersistedChatSession[] {
  return sessions.map((session) => ({
    ...session,
    title: resolveSessionTitle(session.entries, session.title)
  }));
}

export function readPersistedPluginData(value: unknown): PersistedPluginData {
  if (
    isRecord(value) &&
    ("settings" in value || "recentSessions" in value || "lastSession" in value || "draftPersistentContextItems" in value)
  ) {
    const settings = sanitizePluginSettings(value.settings as Partial<PluginSettings> | null | undefined);
    const allowedExternalRoots = settings.externalContextRootsEnabled
      ? settings.persistentExternalContextRoots
      : [];
    const recentSessions = normalizeRecentSessions((Array.isArray(value.recentSessions)
      ? value.recentSessions
          .map((session) => sanitizePersistedChatSession(session, allowedExternalRoots))
          .filter((session): session is PersistedChatSession => session !== null)
      : [])
      .slice(0, MAX_RECENT_SESSIONS));
    const requestedActiveSessionId =
      typeof value.activeSessionId === "string" && value.activeSessionId.trim()
        ? value.activeSessionId
        : null;
    const legacySession = recentSessions.length === 0
      ? sanitizePersistedChatSession(value.lastSession, allowedExternalRoots)
      : null;

    return {
      settings,
      recentSessions: legacySession
        ? [{
            ...legacySession,
            title: legacySession.title ?? deriveSessionTitle(legacySession.entries),
            updatedAt: Date.now()
          }]
        : recentSessions,
      activeSessionId: recentSessions.some((session) => session.threadId === requestedActiveSessionId)
        ? requestedActiveSessionId
        : legacySession?.threadId ?? null,
      draftPersistentContextItems: Array.isArray(value.draftPersistentContextItems)
        ? value.draftPersistentContextItems
            .map((item) => sanitizePersistentContextItem(item, allowedExternalRoots))
            .filter((item): item is PersistentContextItem => item !== null)
        : []
    };
  }

  return {
    settings: sanitizePluginSettings(value as Partial<PluginSettings> | null | undefined),
    recentSessions: [],
    activeSessionId: null,
    draftPersistentContextItems: []
  };
}

export function writePersistedPluginData(
  settings: PluginSettings,
  recentSessions: ReadonlyArray<PersistedChatSession>,
  activeSessionId: string | null,
  draftPersistentContextItems: ReadonlyArray<PersistentContextItem>
): PersistedPluginData {
  return {
    settings,
    recentSessions: normalizeRecentSessions(recentSessions.slice(0, MAX_RECENT_SESSIONS)),
    activeSessionId,
    draftPersistentContextItems: [...draftPersistentContextItems]
  };
}
