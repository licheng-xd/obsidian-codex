import { type PersistedChatSession, upsertRecentSession } from "./chat-session";

export interface ChatWorkbenchState {
  readonly recentSessions: ReadonlyArray<PersistedChatSession>;
  readonly activeSessionId: string | null;
  readonly activeThreadId: string | null;
  readonly isDraftSession: boolean;
}

export interface ActivatedRecentSessionState extends ChatWorkbenchState {
  readonly selectedSession: PersistedChatSession | null;
}

export function createDraftWorkbenchState(
  recentSessions: ReadonlyArray<PersistedChatSession>
): ChatWorkbenchState {
  return {
    recentSessions: [...recentSessions],
    activeSessionId: null,
    activeThreadId: null,
    isDraftSession: true
  };
}

export function activateRecentSession(
  state: ChatWorkbenchState,
  threadId: string
): ActivatedRecentSessionState {
  const selectedSession = state.recentSessions.find((session) => session.threadId === threadId) ?? null;
  if (!selectedSession) {
    return {
      ...state,
      selectedSession: null
    };
  }

  return {
    recentSessions: [...state.recentSessions],
    activeSessionId: selectedSession.threadId,
    activeThreadId: selectedSession.threadId,
    isDraftSession: false,
    selectedSession
  };
}

export function persistWorkbenchSession(
  state: ChatWorkbenchState,
  nextSession: PersistedChatSession
): ChatWorkbenchState {
  return {
    recentSessions: upsertRecentSession(state.recentSessions, nextSession),
    activeSessionId: nextSession.threadId,
    activeThreadId: nextSession.threadId,
    isDraftSession: false
  };
}

export function getLatestRecentSession(
  sessions: ReadonlyArray<PersistedChatSession>
): PersistedChatSession | null {
  return sessions[0] ?? null;
}
