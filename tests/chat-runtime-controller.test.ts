import { describe, expect, it, vi } from "vitest";
import {
  cancelActiveTurn,
  createChatRuntimeController
} from "../src/chat-runtime-controller";
import type { PersistedChatSession } from "../src/chat-session";

function createContextUsage() {
  return {
    localCharsUsed: 0,
    localCharsLimit: 4000,
    threadCharsUsedEstimate: 0,
    threadCharsLimitEstimate: 40000,
    sdkInputTokens: null,
    sdkCachedInputTokens: null,
    sdkOutputTokens: null
  };
}

function createSession(threadId: string): PersistedChatSession {
  return {
    threadId,
    title: "Session",
    updatedAt: 1,
    entries: [{ type: "user", text: "hello" }],
    contextUsage: {
      threadCharsUsedEstimate: 12,
      sdkInputTokens: null,
      sdkCachedInputTokens: null,
      sdkOutputTokens: null
    },
    persistentContextItems: [
      {
        kind: "vault-file",
        path: "notes/roadmap.md"
      }
    ]
  };
}

function createControllerHarness() {
  const state = {
    recentSessions: [] as PersistedChatSession[],
    activeSessionId: null as string | null,
    activeThreadId: null as string | null,
    sessionStarted: false,
    isSending: false,
    wasCancelled: false,
    sessionEntries: [] as Array<{ type: "user" | "status" | "assistant"; [key: string]: unknown }>,
    persistentContextItems: [] as Array<{ kind: "vault-file"; path: string }>,
    contextUsage: createContextUsage()
  };

  const deps = {
    codexService: {
      createThread: vi.fn(),
      resumeThread: vi.fn(),
      clearThread: vi.fn(),
      cancelCurrentTurn: vi.fn(),
      sendMessage: vi.fn()
    },
    readState: () => state,
    patchState: (patch: Record<string, unknown>) => {
      Object.assign(state, patch);
    },
    buildThreadOptions: () => ({ workingDirectory: "/vault" }),
    collectContext: vi.fn(),
    captureComposerDraft: () => ({ inputValue: "", attachments: [] }),
    clearComposerAfterSend: vi.fn(),
    restoreComposerDraft: vi.fn(),
    renderPersistedSession: vi.fn(async () => {}),
    renderHistorySessionList: vi.fn(),
    setHistoryPopoverOpen: vi.fn(),
    setSendingState: vi.fn(),
    appendMessage: vi.fn(),
    formatUserTurnText: vi.fn(),
    createAssistantTurn: vi.fn(),
    finalizeAssistantTurnMeta: vi.fn(),
    updateAssistantTurnLiveState: vi.fn(),
    renderSummarizedAssistantEvents: vi.fn(),
    renderAssistantText: vi.fn(),
    removeAssistantTurnIfEmpty: vi.fn(),
    refreshCanvasState: vi.fn(),
    scrollMessagesToBottom: vi.fn(),
    updateContextUsage: vi.fn(),
    cleanupSentComposerDraft: vi.fn(),
    saveSessionHistory: vi.fn(async () => {}),
    updateContextSummary: vi.fn(async () => {}),
    showNotice: vi.fn()
  };

  return {
    state,
    deps,
    controller: createChatRuntimeController(deps as never)
  };
}

describe("chat runtime controller", () => {
  it("does nothing when no turn is sending", () => {
    const cancelCurrentTurn = vi.fn();
    const state = {
      isSending: false,
      wasCancelled: false
    };

    cancelActiveTurn({
      state,
      cancelCurrentTurn
    });

    expect(state.wasCancelled).toBe(false);
    expect(cancelCurrentTurn).not.toHaveBeenCalled();
  });

  it("marks cancellation and cancels the current turn when sending", () => {
    const cancelCurrentTurn = vi.fn();
    const state = {
      isSending: true,
      wasCancelled: false
    };

    cancelActiveTurn({
      state,
      cancelCurrentTurn
    });

    expect(state.wasCancelled).toBe(true);
    expect(cancelCurrentTurn).toHaveBeenCalledTimes(1);
  });

  it("persists persistent context items with the active session", async () => {
    const harness = createControllerHarness();
    harness.state.activeThreadId = "thread-1";
    harness.state.sessionEntries = [{ type: "user", text: "hello" }];
    harness.state.persistentContextItems = [
      {
        kind: "vault-file",
        path: "notes/roadmap.md"
      }
    ];

    await harness.controller.persistActiveSession();

    expect(harness.state.recentSessions[0]?.persistentContextItems).toEqual([
      {
        kind: "vault-file",
        path: "notes/roadmap.md"
      }
    ]);
    expect(harness.deps.saveSessionHistory).toHaveBeenCalledTimes(1);
  });

  it("restores persistent context items when activating the saved session", async () => {
    const harness = createControllerHarness();
    harness.state.recentSessions = [createSession("thread-1")];
    harness.state.activeSessionId = "thread-1";

    await harness.controller.restoreActiveSession();

    expect(harness.state.persistentContextItems).toEqual([
      {
        kind: "vault-file",
        path: "notes/roadmap.md"
      }
    ]);
    expect(harness.deps.renderPersistedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        persistentContextItems: [
          {
            kind: "vault-file",
            path: "notes/roadmap.md"
          }
        ]
      })
    );
  });
});
