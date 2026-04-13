import type { ThreadOptions } from "@openai/codex-sdk";
import {
  activateRecentSession,
  persistWorkbenchSession,
  type ChatWorkbenchState
} from "./chat-workbench";
import type {
  PersistedChatEntry,
  PersistedChatSession,
  PersistentContextItem
} from "./chat-session";
import { resolveSessionTitle } from "./chat-session";
import { mapThreadEvent, type CodexService } from "./codex-service";
import type { ComposerAttachment } from "./composer-attachments";
import {
  buildContextPayload,
  measureLocalContextUsage,
  type ContextInput
} from "./context-builder";
import { renderEventCard } from "./event-cards";
import {
  estimateMappedEventChars,
  summarizeAssistantSystemEvents,
  type SummarizableAssistantEvent
} from "./event-summary";
import type {
  ContextUsage,
  MappedActivityEvent,
  MappedCommandEvent,
  MappedErrorEvent,
  MappedFileChangeEvent,
  MappedReasoningEvent,
  MappedSummaryEvent,
  MappedTextEvent
} from "./types";

export type ChatMessageRole = "user" | "status";

export interface ChatRuntimeAssistantTurn {
  rootEl: HTMLDivElement;
  metaEl: HTMLDivElement;
  metaLabelEl: HTMLSpanElement;
  metaSignalEl: HTMLSpanElement;
  contentEl: HTMLDivElement;
  eventsEl: HTMLDivElement;
  startedAt: number;
  metaFinalized: boolean;
}

export type ChatRuntimeAssistantTurnPhase = "thinking" | "working";

type VisibleAssistantEvent =
  | MappedTextEvent
  | MappedReasoningEvent
  | MappedCommandEvent
  | MappedFileChangeEvent
  | MappedActivityEvent
  | MappedErrorEvent
  | { type: "turn_failed"; message: string };

export interface ChatRuntimeState {
  recentSessions: PersistedChatSession[];
  activeSessionId: string | null;
  activeThreadId: string | null;
  sessionStarted: boolean;
  isSending: boolean;
  wasCancelled: boolean;
  sessionEntries: PersistedChatEntry[];
  persistentContextItems: PersistentContextItem[];
  contextUsage: ContextUsage;
}

export interface CancelActiveTurnState {
  isSending: boolean;
  wasCancelled: boolean;
}

interface StatePatch {
  recentSessions?: PersistedChatSession[];
  activeSessionId?: string | null;
  activeThreadId?: string | null;
  sessionStarted?: boolean;
  isSending?: boolean;
  wasCancelled?: boolean;
  sessionEntries?: PersistedChatEntry[];
  persistentContextItems?: PersistentContextItem[];
  contextUsage?: ContextUsage;
}

interface ChatRuntimeControllerDependencies {
  codexService: Pick<
    CodexService,
    "createThread" | "resumeThread" | "clearThread" | "cancelCurrentTurn" | "sendMessage"
  >;
  readState: () => ChatRuntimeState;
  patchState: (patch: StatePatch) => void;
  buildThreadOptions: () => ThreadOptions;
  collectContext: (userInput: string) => Promise<ContextInput>;
  captureComposerDraft: () => { inputValue: string; attachments: ComposerAttachment[] };
  clearComposerAfterSend: () => void;
  restoreComposerDraft: (inputValue: string, attachments: ComposerAttachment[]) => void;
  renderPersistedSession: (session: PersistedChatSession) => Promise<void>;
  renderHistorySessionList: () => void;
  setHistoryPopoverOpen: (isOpen: boolean) => void;
  setSendingState: (isSending: boolean) => void;
  appendMessage: (role: ChatMessageRole, text: string, persist?: boolean) => HTMLDivElement;
  formatUserTurnText: (userInput: string) => string;
  createAssistantTurn: () => ChatRuntimeAssistantTurn;
  finalizeAssistantTurnMeta: (turn: ChatRuntimeAssistantTurn, interrupted?: boolean) => void;
  updateAssistantTurnLiveState: (
    turn: ChatRuntimeAssistantTurn,
    phase: ChatRuntimeAssistantTurnPhase
  ) => void;
  renderSummarizedAssistantEvents: (
    containerEl: HTMLElement,
    events: ReadonlyArray<SummarizableAssistantEvent>
  ) => void;
  renderAssistantText: (
    containerEl: HTMLElement,
    event: MappedTextEvent,
    existingEl?: HTMLElement
  ) => Promise<HTMLDivElement>;
  removeAssistantTurnIfEmpty: (turn: ChatRuntimeAssistantTurn) => void;
  refreshCanvasState: () => void;
  scrollMessagesToBottom: () => void;
  updateContextUsage: (contextUsage: ContextUsage) => void;
  cleanupSentComposerDraft: (attachments: ReadonlyArray<ComposerAttachment>) => void;
  saveSessionHistory: (
    recentSessions: ReadonlyArray<PersistedChatSession>,
    activeSessionId: string | null
  ) => Promise<void>;
  saveDraftPersistentContext: (
    draftPersistentContextItems: ReadonlyArray<PersistentContextItem>
  ) => Promise<void>;
  updateContextSummary: () => Promise<void>;
  showNotice: (message: string, timeout?: number) => void;
}

export interface ChatRuntimeController {
  handleSend: () => Promise<void>;
  handleCancel: () => void;
  restoreActiveSession: () => Promise<void>;
  persistActiveSession: () => Promise<void>;
  activatePersistedSession: (threadId: string) => Promise<void>;
}

function toWorkbenchState(state: ChatRuntimeState) {
  return {
    recentSessions: [...state.recentSessions],
    activeSessionId: state.activeSessionId,
    activeThreadId: state.activeThreadId,
    isDraftSession: state.activeSessionId === null && state.activeThreadId === null
  };
}

function applyWorkbenchState(
  deps: ChatRuntimeControllerDependencies,
  state: ChatWorkbenchState
): void {
  deps.patchState({
    recentSessions: [...state.recentSessions],
    activeSessionId: state.activeSessionId,
    activeThreadId: state.activeThreadId
  });
}

function setContextUsage(
  deps: ChatRuntimeControllerDependencies,
  contextUsage: ContextUsage
): void {
  deps.patchState({ contextUsage });
  deps.updateContextUsage(contextUsage);
}

async function persistActiveSession(
  deps: ChatRuntimeControllerDependencies
): Promise<void> {
  const state = deps.readState();
  if (!state.activeThreadId) {
    await deps.saveDraftPersistentContext(state.persistentContextItems);
    return;
  }

  if (state.sessionEntries.length === 0) {
    return;
  }

  const existingSession = state.recentSessions.find((session) => session.threadId === state.activeThreadId);
  const nextSession: PersistedChatSession = {
    threadId: state.activeThreadId,
    title: resolveSessionTitle(state.sessionEntries, existingSession?.title),
    updatedAt: Date.now(),
    entries: [...state.sessionEntries],
    persistentContextItems: [...state.persistentContextItems],
    contextUsage: {
      threadCharsUsedEstimate: state.contextUsage.threadCharsUsedEstimate,
      sdkInputTokens: state.contextUsage.sdkInputTokens,
      sdkCachedInputTokens: state.contextUsage.sdkCachedInputTokens,
      sdkOutputTokens: state.contextUsage.sdkOutputTokens
    }
  };
  const nextWorkbenchState = persistWorkbenchSession(toWorkbenchState(state), nextSession);
  applyWorkbenchState(deps, nextWorkbenchState);
  deps.renderHistorySessionList();
  const nextState = deps.readState();
  await deps.saveDraftPersistentContext([]);
  await deps.saveSessionHistory(nextState.recentSessions, nextState.activeSessionId);
}

async function activatePersistedSession(
  deps: ChatRuntimeControllerDependencies,
  threadId: string
): Promise<void> {
  const state = deps.readState();
  if (state.isSending || threadId === state.activeSessionId) {
    deps.setHistoryPopoverOpen(false);
    return;
  }

  const activationState = activateRecentSession(toWorkbenchState(state), threadId);
  const session = activationState.selectedSession;
  if (!session) {
    return;
  }

  deps.codexService.clearThread();
  deps.patchState({
    wasCancelled: false,
    sessionStarted: false
  });
  applyWorkbenchState(deps, activationState);
  deps.patchState({
    persistentContextItems: [...session.persistentContextItems]
  });
  await deps.renderPersistedSession(session);

  const updatedSession = { ...session, updatedAt: Date.now() };
  applyWorkbenchState(
    deps,
    persistWorkbenchSession(toWorkbenchState(deps.readState()), updatedSession)
  );
  deps.renderHistorySessionList();
  {
    const nextState = deps.readState();
    await deps.saveSessionHistory(nextState.recentSessions, nextState.activeSessionId);
  }

  const threadOptions = deps.buildThreadOptions();
  if (threadOptions.workingDirectory) {
    deps.codexService.resumeThread(threadId, threadOptions);
    deps.patchState({ sessionStarted: true });
  }

  deps.setHistoryPopoverOpen(false);
}

async function restoreActiveSession(
  deps: ChatRuntimeControllerDependencies
): Promise<void> {
  const state = deps.readState();
  const activationState =
    state.activeSessionId
      ? activateRecentSession(toWorkbenchState(state), state.activeSessionId)
      : { ...toWorkbenchState(state), selectedSession: null };
  const session = activationState.selectedSession;
  if (!session) {
    return;
  }

  applyWorkbenchState(deps, activationState);
  deps.patchState({
    persistentContextItems: [...session.persistentContextItems]
  });
  await deps.renderPersistedSession(session);

  const threadOptions = deps.buildThreadOptions();
  if (threadOptions.workingDirectory) {
    deps.codexService.resumeThread(session.threadId, threadOptions);
    deps.patchState({ sessionStarted: true });
  }
}

export function cancelActiveTurn({
  state,
  cancelCurrentTurn
}: {
  state: CancelActiveTurnState;
  cancelCurrentTurn: () => void;
}): void {
  if (!state.isSending) {
    return;
  }

  state.wasCancelled = true;
  cancelCurrentTurn();
}

async function handleSend(
  deps: ChatRuntimeControllerDependencies
): Promise<void> {
  const state = deps.readState();
  const draft = deps.captureComposerDraft();
  const userInput = draft.inputValue.trim();
  if ((!userInput && draft.attachments.length === 0) || state.isSending) {
    return;
  }

  const draftInputValue = draft.inputValue;
  const draftAttachments = [...draft.attachments];

  const threadOptions = deps.buildThreadOptions();
  if (!threadOptions.workingDirectory) {
    deps.showNotice("Could not determine the local vault path.", 8000);
    return;
  }

  const context = await deps.collectContext(userInput);
  const prompt = buildContextPayload(context);
  const localUsage = measureLocalContextUsage(context);
  setContextUsage(deps, {
    ...deps.readState().contextUsage,
    localCharsUsed: localUsage.used,
    localCharsLimit: localUsage.limit
  });

  {
    const nextState = deps.readState();
    if (!nextState.sessionStarted) {
      if (nextState.activeThreadId) {
        deps.codexService.resumeThread(nextState.activeThreadId, threadOptions);
      } else {
        deps.codexService.createThread(threadOptions);
      }
      deps.patchState({ sessionStarted: true });
    }
  }

  deps.patchState({ wasCancelled: false });
  deps.setHistoryPopoverOpen(false);
  deps.appendMessage("user", deps.formatUserTurnText(userInput));
  deps.clearComposerAfterSend();
  const assistantTurn = deps.createAssistantTurn();
  deps.setSendingState(true);

  const eventElements = new Map<string, HTMLElement>();
  const latestSystemEvents = new Map<string, SummarizableAssistantEvent>();
  const eventSizeByItemId = new Map<string, number>();
  const trackEventChars = (itemId: string, size: number): number => {
    const previousSize = eventSizeByItemId.get(itemId) ?? 0;
    const nextSize = Math.max(previousSize, size);
    eventSizeByItemId.set(itemId, nextSize);
    return nextSize - previousSize;
  };
  const turnPromptChars = prompt.length;
  let turnGeneratedChars = 0;
  let assistantMarkdown = "";
  let sawVisibleAssistantEvent = false;
  let streamErrorHandled = false;
  let turnCompleted = false;

  try {
    for await (const event of deps.codexService.sendMessage(prompt, threadOptions)) {
      if (event.type === "thread.started") {
        deps.patchState({
          activeThreadId: event.thread_id,
          activeSessionId: event.thread_id
        });
        await persistActiveSession(deps);
      }

      const mapped = mapThreadEvent(event);

      if (mapped.type === "noop" || mapped.type === "turn_started") {
        continue;
      }

      if (mapped.type === "turn_completed") {
        if (!assistantTurn.metaFinalized) {
          deps.finalizeAssistantTurnMeta(assistantTurn);
        }
        const summaryEvents = summarizeAssistantSystemEvents(Array.from(latestSystemEvents.values()));
        if (latestSystemEvents.size > 0) {
          deps.renderSummarizedAssistantEvents(
            assistantTurn.eventsEl,
            Array.from(latestSystemEvents.values())
          );
        }
        const currentUsage = deps.readState().contextUsage;
        setContextUsage(deps, {
          ...currentUsage,
          threadCharsUsedEstimate: currentUsage.threadCharsUsedEstimate + turnPromptChars + turnGeneratedChars,
          sdkInputTokens: mapped.usage.inputTokens,
          sdkCachedInputTokens: mapped.usage.cachedInputTokens,
          sdkOutputTokens: mapped.usage.outputTokens
        });
        if (assistantMarkdown || summaryEvents.length > 0) {
          deps.patchState({
            sessionEntries: [
              ...deps.readState().sessionEntries,
              {
                type: "assistant",
                metaLabel: assistantTurn.metaLabelEl.textContent ?? "Thought",
                contentMarkdown: assistantMarkdown,
                summaries: snapshotSummaryItems(summaryEvents)
              }
            ]
          });
          await persistActiveSession(deps);
        }
        turnCompleted = true;
        continue;
      }

      if (mapped.type === "reasoning") {
        deps.updateAssistantTurnLiveState(assistantTurn, "thinking");
        latestSystemEvents.set(mapped.itemId, mapped);
        turnGeneratedChars += trackEventChars(mapped.itemId, estimateMappedEventChars(mapped));
        sawVisibleAssistantEvent = true;
        const existingEl = eventElements.get(mapped.itemId);
        const cardEl = renderEventCard(assistantTurn.eventsEl, mapped, existingEl);
        eventElements.set(mapped.itemId, cardEl);
        deps.scrollMessagesToBottom();
        continue;
      }

      if (mapped.type === "error" || mapped.type === "turn_failed") {
        deps.finalizeAssistantTurnMeta(assistantTurn);
        renderEventCard(assistantTurn.eventsEl, mapped);
        deps.refreshCanvasState();
        deps.scrollMessagesToBottom();
        streamErrorHandled = true;
        throw new Error(mapped.message);
      }

      deps.updateAssistantTurnLiveState(assistantTurn, "working");
      if (!sawVisibleAssistantEvent) {
        sawVisibleAssistantEvent = true;
      }

      const existingEl = "itemId" in mapped ? eventElements.get(mapped.itemId) : undefined;
      const targetContainer =
        mapped.type === "text" ? assistantTurn.contentEl : assistantTurn.eventsEl;
      const cardEl =
        mapped.type === "text"
          ? await deps.renderAssistantText(targetContainer, mapped, existingEl)
          : renderEventCard(targetContainer, mapped as VisibleAssistantEvent, existingEl);
      if (mapped.type === "text") {
        assistantMarkdown = mapped.text;
      }
      if ("itemId" in mapped) {
        eventElements.set(mapped.itemId, cardEl);
        if (mapped.type !== "text") {
          latestSystemEvents.set(mapped.itemId, mapped as SummarizableAssistantEvent);
        }
        turnGeneratedChars += trackEventChars(mapped.itemId, estimateMappedEventChars(mapped));
      }

      deps.refreshCanvasState();
      deps.scrollMessagesToBottom();
    }

    if (!sawVisibleAssistantEvent && !streamErrorHandled) {
      deps.removeAssistantTurnIfEmpty(assistantTurn);
      deps.appendMessage("status", "No response received.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (deps.readState().wasCancelled) {
      if (sawVisibleAssistantEvent) {
        deps.finalizeAssistantTurnMeta(assistantTurn, true);
        if (assistantMarkdown || latestSystemEvents.size > 0) {
          const summaryEvents = summarizeAssistantSystemEvents(Array.from(latestSystemEvents.values()));
          deps.renderSummarizedAssistantEvents(
            assistantTurn.eventsEl,
            Array.from(latestSystemEvents.values())
          );
          deps.patchState({
            sessionEntries: [
              ...deps.readState().sessionEntries,
              {
                type: "assistant",
                metaLabel: assistantTurn.metaLabelEl.textContent ?? "Interrupted",
                contentMarkdown: assistantMarkdown,
                summaries: snapshotSummaryItems(summaryEvents)
              }
            ]
          });
          await persistActiveSession(deps);
        }
      } else {
        assistantTurn.rootEl.remove();
        deps.refreshCanvasState();
      }
      deps.appendMessage("status", "Interrupted.");
    } else if (!streamErrorHandled) {
      deps.finalizeAssistantTurnMeta(assistantTurn);
      renderEventCard(assistantTurn.eventsEl, { type: "error", message });
      deps.refreshCanvasState();
      deps.scrollMessagesToBottom();
      deps.showNotice(`Codex request failed: ${message}`, 8000);
    } else {
      deps.showNotice(`Codex request failed: ${message}`, 8000);
    }
  } finally {
    deps.setSendingState(false);
    if (turnCompleted) {
      deps.cleanupSentComposerDraft(draftAttachments);
    } else {
      deps.restoreComposerDraft(draftInputValue, draftAttachments);
    }
    await deps.updateContextSummary();
  }
}

function snapshotSummaryItems(
  summaries: ReadonlyArray<MappedSummaryEvent>
) {
  return summaries.map((summary) => ({
    label: summary.label,
    preview: summary.preview,
    lines: [...summary.lines]
  }));
}

export function createChatRuntimeController(
  dependencies: ChatRuntimeControllerDependencies
): ChatRuntimeController {
  return {
    handleSend: async () => await handleSend(dependencies),
    handleCancel: () => {
      const state = dependencies.readState();
      cancelActiveTurn({
        state,
        cancelCurrentTurn: () => dependencies.codexService.cancelCurrentTurn()
      });
      dependencies.patchState({ wasCancelled: state.wasCancelled });
    },
    restoreActiveSession: async () => await restoreActiveSession(dependencies),
    persistActiveSession: async () => await persistActiveSession(dependencies),
    activatePersistedSession: async (threadId: string) =>
      await activatePersistedSession(dependencies, threadId)
  };
}
