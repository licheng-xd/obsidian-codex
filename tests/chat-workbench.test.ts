import { describe, expect, it } from "vitest";
import type { PersistedChatSession } from "../src/chat-session";
import {
  activateRecentSession,
  createDraftWorkbenchState,
  getLatestRecentSession,
  persistWorkbenchSession
} from "../src/chat-workbench";

function createSession(threadId: string, updatedAt: number): PersistedChatSession {
  return {
    threadId,
    updatedAt,
    title: `Session ${threadId}`,
    entries: [{ type: "user", text: `Prompt ${threadId}` }],
    contextUsage: {
      threadCharsUsedEstimate: 0,
      sdkInputTokens: null,
      sdkCachedInputTokens: null,
      sdkOutputTokens: null
    },
    persistentContextItems: []
  };
}

describe("chat workbench state", () => {
  it("creates a new draft state without dropping recent sessions", () => {
    const session = createSession("thread-1", 100);

    const state = createDraftWorkbenchState([session]);

    expect(state.recentSessions).toEqual([session]);
    expect(state.activeSessionId).toBeNull();
    expect(state.activeThreadId).toBeNull();
    expect(state.isDraftSession).toBe(true);
  });

  it("activates an existing recent session by thread id", () => {
    const first = createSession("thread-1", 100);
    const second = createSession("thread-2", 200);
    const draftState = createDraftWorkbenchState([second, first]);

    const state = activateRecentSession(draftState, "thread-1");

    expect(state.selectedSession).toEqual(first);
    expect(state.activeSessionId).toBe("thread-1");
    expect(state.activeThreadId).toBe("thread-1");
    expect(state.isDraftSession).toBe(false);
  });

  it("persists a session using recent-session upsert semantics", () => {
    const existing = createSession("thread-1", 100);
    const next = createSession("thread-2", 200);
    const draftState = createDraftWorkbenchState([existing]);

    const state = persistWorkbenchSession(draftState, next);

    expect(state.recentSessions.map((session) => session.threadId)).toEqual(["thread-2", "thread-1"]);
    expect(state.activeSessionId).toBe("thread-2");
    expect(state.activeThreadId).toBe("thread-2");
    expect(state.isDraftSession).toBe(false);
  });

  it("returns the latest session by updated time order", () => {
    const latest = createSession("thread-2", 200);
    const oldest = createSession("thread-1", 100);

    expect(getLatestRecentSession([latest, oldest])).toEqual(latest);
    expect(getLatestRecentSession([])).toBeNull();
  });
});
