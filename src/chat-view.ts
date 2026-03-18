import {
  FileSystemAdapter,
  ItemView,
  MarkdownRenderer,
  MarkdownView,
  Notice,
  TFile,
  TFolder,
  WorkspaceLeaf,
  setIcon
} from "obsidian";
import type { ThreadOptions } from "@openai/codex-sdk";
import { shouldSubmitFromKeydown } from "./chat-input";
import { renderMarkdownMessage } from "./assistant-markdown";
import type {
  PersistedAssistantEntry,
  PersistedChatEntry,
  PersistedSummaryItem
} from "./chat-session";
import {
  NOTE_CHAR_LIMIT,
  THREAD_CONTEXT_CHAR_LIMIT,
  buildContextPayload,
  measureLocalContextUsage,
  type ContextInput
} from "./context-builder";
import { CODEX_ICON } from "./codex-icon";
import { mapThreadEvent } from "./codex-service";
import { renderEventCard } from "./event-cards";
import {
  estimateMappedEventChars,
  summarizeAssistantSystemEvents,
  type SummarizableAssistantEvent
} from "./event-summary";
import type ObsidianCodexPlugin from "./main";
import { DEFAULT_SETTINGS, patchPluginSettings, toggleYoloMode } from "./settings";
import { StatusBar } from "./status-bar";
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
import {
  planVaultSaveTarget,
  requestLooksLikeLocalSave,
  type DirectorySnapshot,
  type GuidanceDocument
} from "./vault-save-planner";
import { getWelcomeTitle } from "./welcome-title";

export const CODEX_CHAT_VIEW_TYPE = "obsidian-codex-chat";
const SELECTION_CHANGE_DEBOUNCE_MS = 120;
const SAVE_PLANNER_GUIDANCE_FILE_LIMIT = 4;
const SAVE_PLANNER_GUIDANCE_CHAR_LIMIT = 2000;
const SAVE_PLANNER_FOLDER_DEPTH_LIMIT = 3;
const SAVE_PLANNER_FOLDER_LIMIT = 40;
const SAVE_PLANNER_SAMPLE_FILE_LIMIT = 5;

type ChatMessageRole = "user" | "status";

interface AssistantTurnElements {
  rootEl: HTMLDivElement;
  metaEl: HTMLDivElement;
  metaLabelEl: HTMLSpanElement;
  metaSignalEl: HTMLSpanElement;
  contentEl: HTMLDivElement;
  eventsEl: HTMLDivElement;
  startedAt: number;
  metaFinalized: boolean;
}

type VisibleAssistantEvent =
  | MappedTextEvent
  | MappedReasoningEvent
  | MappedCommandEvent
  | MappedFileChangeEvent
  | MappedActivityEvent
  | MappedErrorEvent
  | { type: "turn_failed"; message: string };

export class ChatView extends ItemView {
  private emptyStateEl!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private inputEl!: HTMLTextAreaElement;
  private cancelButtonEl!: HTMLButtonElement;
  private newChatButtonEl!: HTMLButtonElement;
  private statusBar: StatusBar | null = null;
  private sessionEntries: PersistedChatEntry[] = [];
  private activeThreadId: string | null = null;
  private sessionStarted = false;
  private isSending = false;
  private wasCancelled = false;
  private selectionChangeTimer: number | null = null;
  private contextUsage: ContextUsage = {
    localCharsUsed: 0,
    localCharsLimit: NOTE_CHAR_LIMIT,
    threadCharsUsedEstimate: 0,
    threadCharsLimitEstimate: THREAD_CONTEXT_CHAR_LIMIT,
    sdkInputTokens: null,
    sdkCachedInputTokens: null,
    sdkOutputTokens: null
  };

  constructor(leaf: WorkspaceLeaf, private readonly plugin: ObsidianCodexPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return CODEX_CHAT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Obsidian Codex";
  }

  getIcon(): string {
    return CODEX_ICON;
  }

  async onOpen(): Promise<void> {
    this.render();
    await this.restoreLastSession();
    void this.updateContextSummary();
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => void this.updateContextSummary()));
    this.registerDomEvent(document, "selectionchange", () => this.scheduleContextSummaryUpdate());
  }

  async onClose(): Promise<void> {
    this.clearScheduledContextSummaryUpdate();
    this.plugin.codexService.cancelCurrentTurn();
    this.statusBar?.destroy();
    this.statusBar = null;
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("obsidian-codex-view");

    const headerEl = contentEl.createDiv({ cls: "obsidian-codex-header" });
    const brandEl = headerEl.createDiv({ cls: "obsidian-codex-brand" });
    const brandIconEl = brandEl.createSpan({ cls: "obsidian-codex-brand-icon" });
    setIcon(brandIconEl, CODEX_ICON);
    brandEl.createSpan({ cls: "obsidian-codex-brand-label", text: "Obsidian Codex" });

    const stageEl = contentEl.createDiv({ cls: "obsidian-codex-stage" });
    this.emptyStateEl = stageEl.createDiv({ cls: "obsidian-codex-empty-state" });
    this.emptyStateEl.createEl("h1", {
      cls: "obsidian-codex-empty-title",
      text: getWelcomeTitle()
    });

    this.messagesEl = stageEl.createDiv({ cls: "obsidian-codex-messages" });

    const stageActionsEl = contentEl.createDiv({ cls: "obsidian-codex-stage-actions" });
    this.newChatButtonEl = this.createTrayActionButton(
      stageActionsEl,
      "plus",
      "New Chat",
      () => this.resetConversation(),
      false,
      "is-new-chat"
    );
    this.cancelButtonEl = this.createTrayActionButton(
      stageActionsEl,
      "square",
      "Cancel current turn",
      () => this.handleCancel(),
      false,
      "is-cancel"
    );

    const trayEl = contentEl.createDiv({ cls: "obsidian-codex-tray" });
    const inputShellEl = trayEl.createDiv({ cls: "obsidian-codex-input-shell" });
    this.inputEl = inputShellEl.createEl("textarea", {
      cls: "obsidian-codex-input"
    });
    this.inputEl.placeholder = "How can I help you today?";
    this.inputEl.rows = 4;

    this.registerDomEvent(this.inputEl, "focus", () => void this.updateContextSummary());
    this.registerDomEvent(this.inputEl, "input", () => this.updateComposerState());
    this.registerDomEvent(this.inputEl, "keydown", (event: KeyboardEvent) => {
      if (
        shouldSubmitFromKeydown({
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          isComposing: event.isComposing
        })
      ) {
        event.preventDefault();
        void this.handleSend();
      }
    });

    const trayFooterEl = trayEl.createDiv({ cls: "obsidian-codex-tray-footer" });
    this.statusBar?.destroy();
    this.statusBar = new StatusBar(
      trayFooterEl,
      this.plugin.settings.model,
      this.plugin.settings.reasoningEffort,
      this.plugin.settings.yoloMode,
      {
        onModelChange: async (model: string) => {
          this.plugin.settings = patchPluginSettings(this.plugin.settings, { model });
          await this.plugin.saveSettings();
          this.statusBar?.updateModel(this.plugin.settings.model);
        },
        onReasoningEffortChange: async (reasoningEffort) => {
          this.plugin.settings = patchPluginSettings(this.plugin.settings, { reasoningEffort });
          await this.plugin.saveSettings();
          this.statusBar?.updateReasoningEffort(this.plugin.settings.reasoningEffort);
        },
        onYoloChange: async (enabled: boolean) => {
          this.plugin.settings = toggleYoloMode(this.plugin.settings, enabled);
          await this.plugin.saveSettings();
          this.statusBar?.updateYolo(this.plugin.settings.yoloMode);
        }
      }
    );
    this.statusBar.updateContextUsage(this.contextUsage);
    this.statusBar.updateWorkingDirectory(this.getVaultRootPath());
    this.refreshCanvasState();
    this.updateComposerState();
  }

  private createTrayActionButton(
    containerEl: HTMLElement,
    icon: string,
    label: string,
    onClick: () => void,
    primary = false,
    variantClassName?: string
  ): HTMLButtonElement {
    const buttonEl = containerEl.createEl("button", {
      cls: [
        "obsidian-codex-tray-action",
        primary ? "is-primary" : "",
        variantClassName ?? ""
      ].filter(Boolean).join(" ")
    });
    buttonEl.type = "button";
    buttonEl.ariaLabel = label;
    buttonEl.title = label;
    setIcon(buttonEl, icon);
    buttonEl.addEventListener("click", onClick);
    return buttonEl;
  }

  private createAssistantTurn(): AssistantTurnElements {
    const rootEl = this.messagesEl.createDiv({ cls: "obsidian-codex-turn" });

    const metaEl = rootEl.createDiv({ cls: "obsidian-codex-turn-meta is-live" });
    const metaLabelEl = metaEl.createSpan({ cls: "obsidian-codex-turn-meta-label", text: "Thinking" });
    const metaSignalEl = metaEl.createSpan({ cls: "obsidian-codex-turn-meta-signal" });
    for (let index = 0; index < 3; index += 1) {
      metaSignalEl.createSpan();
    }

    const contentEl = rootEl.createDiv({ cls: "obsidian-codex-turn-content" });
    const eventsEl = rootEl.createDiv({ cls: "obsidian-codex-turn-events" });

    this.refreshCanvasState();
    this.scrollMessagesToBottom();

    return {
      rootEl,
      metaEl,
      metaLabelEl,
      metaSignalEl,
      contentEl,
      eventsEl,
      startedAt: Date.now(),
      metaFinalized: false
    };
  }

  private finalizeAssistantTurnMeta(turn: AssistantTurnElements, interrupted = false): void {
    if (turn.metaFinalized) {
      return;
    }

    turn.metaFinalized = true;
    turn.metaEl.classList.remove("is-live");
    turn.metaEl.classList.toggle("is-interrupted", interrupted);
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - turn.startedAt) / 1000));
    turn.metaLabelEl.textContent = interrupted
      ? `Interrupted after ${elapsedSeconds}s`
      : `Thought for ${elapsedSeconds}s`;
    turn.metaSignalEl.remove();
  }

  private removeAssistantTurnIfEmpty(turn: AssistantTurnElements): void {
    const hasBody =
      turn.contentEl.childElementCount > 0 ||
      turn.eventsEl.childElementCount > 0;
    if (!hasBody) {
      turn.rootEl.remove();
      this.refreshCanvasState();
    }
  }

  private updateComposerState(): void {
    this.cancelButtonEl.disabled = !this.isSending;
    this.inputEl.disabled = this.isSending;
  }

  private refreshCanvasState(): void {
    const hasContent = this.messagesEl.childElementCount > 0;
    this.emptyStateEl.classList.toggle("is-hidden", hasContent);
    this.messagesEl.classList.toggle("has-content", hasContent);
  }

  private scrollMessagesToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private resetConversation(): void {
    this.plugin.codexService.cancelCurrentTurn();
    this.activeThreadId = null;
    this.sessionEntries = [];
    this.sessionStarted = false;
    this.wasCancelled = false;
    this.messagesEl.empty();
    this.contextUsage = {
      ...this.contextUsage,
      threadCharsUsedEstimate: 0,
      threadCharsLimitEstimate: THREAD_CONTEXT_CHAR_LIMIT,
      sdkInputTokens: null,
      sdkCachedInputTokens: null,
      sdkOutputTokens: null
    };
    this.setSendingState(false);
    this.statusBar?.updateContextUsage(this.contextUsage);
    this.refreshCanvasState();
    void this.plugin.clearLastSession();
    void this.updateContextSummary();
  }

  private appendMessage(
    role: ChatMessageRole,
    text: string,
    persist = true
  ): HTMLDivElement {
    const messageEl = this.messagesEl.createDiv({
      cls: `obsidian-codex-message is-${role}`
    });
    messageEl.setText(text);
    if (persist) {
      this.sessionEntries.push({ type: role, text });
      void this.persistLastSession();
    }
    this.refreshCanvasState();
    this.scrollMessagesToBottom();
    return messageEl;
  }

  private async renderPersistedAssistantTurn(entry: PersistedAssistantEntry): Promise<void> {
    const turn = this.createAssistantTurn();
    turn.metaFinalized = true;
    turn.metaEl.classList.remove("is-live");
    turn.metaLabelEl.textContent = entry.metaLabel;
    turn.metaSignalEl.remove();
    await renderMarkdownMessage(
      turn.contentEl.createDiv({ cls: "obsidian-codex-response markdown-rendered" }),
      entry.contentMarkdown,
      this.getMarkdownSourcePath(),
      (markdown, scratchEl, sourcePath) =>
        MarkdownRenderer.render(this.app, markdown, scratchEl, sourcePath, this)
    );
    this.renderPersistedSummaryItems(turn.eventsEl, entry.summaries);
    this.refreshCanvasState();
    this.scrollMessagesToBottom();
  }

  private renderPersistedSummaryItems(
    containerEl: HTMLElement,
    summaries: ReadonlyArray<PersistedSummaryItem>
  ): void {
    for (const [index, summary] of summaries.entries()) {
      const event: MappedSummaryEvent = {
        type: "summary",
        itemId: `persisted-summary-${index}`,
        label: summary.label,
        preview: summary.preview,
        lines: summary.lines
      };
      renderEventCard(containerEl, event);
    }
  }

  private async restoreLastSession(): Promise<void> {
    const session = this.plugin.lastSession;
    if (!session) {
      return;
    }

    this.sessionEntries = [...session.entries];
    this.activeThreadId = session.threadId;
    this.contextUsage = {
      ...this.contextUsage,
      threadCharsUsedEstimate: session.contextUsage.threadCharsUsedEstimate,
      sdkInputTokens: session.contextUsage.sdkInputTokens,
      sdkCachedInputTokens: session.contextUsage.sdkCachedInputTokens,
      sdkOutputTokens: session.contextUsage.sdkOutputTokens
    };
    this.statusBar?.updateContextUsage(this.contextUsage);

    for (const entry of session.entries) {
      if (entry.type === "assistant") {
        await this.renderPersistedAssistantTurn(entry);
      } else {
        this.appendMessage(entry.type, entry.text, false);
      }
    }

    const threadOptions = this.buildThreadOptions();
    if (threadOptions.workingDirectory) {
      this.plugin.codexService.resumeThread(session.threadId, threadOptions);
      this.sessionStarted = true;
    }
  }

  private async persistLastSession(): Promise<void> {
    if (!this.activeThreadId || this.sessionEntries.length === 0) {
      return;
    }

    await this.plugin.saveLastSession({
      threadId: this.activeThreadId,
      entries: this.sessionEntries,
      contextUsage: {
        threadCharsUsedEstimate: this.contextUsage.threadCharsUsedEstimate,
        sdkInputTokens: this.contextUsage.sdkInputTokens,
        sdkCachedInputTokens: this.contextUsage.sdkCachedInputTokens,
        sdkOutputTokens: this.contextUsage.sdkOutputTokens
      }
    });
  }

  private snapshotSummaryItems(
    summaries: ReadonlyArray<MappedSummaryEvent>
  ): PersistedSummaryItem[] {
    return summaries.map((summary) => ({
      label: summary.label,
      preview: summary.preview,
      lines: [...summary.lines]
    }));
  }

  private async renderAssistantText(
    containerEl: HTMLElement,
    event: MappedTextEvent,
    existingEl?: HTMLElement
  ): Promise<HTMLDivElement> {
    const cardEl = (existingEl ?? containerEl.ownerDocument.createElement("div")) as HTMLDivElement;
    cardEl.className = "obsidian-codex-response markdown-rendered";
    if (!cardEl.parentElement) {
      containerEl.appendChild(cardEl);
    }

    await renderMarkdownMessage(
      cardEl,
      event.text,
      this.getMarkdownSourcePath(),
      (markdown, scratchEl, sourcePath) =>
        MarkdownRenderer.render(this.app, markdown, scratchEl, sourcePath, this)
    );

    return cardEl;
  }

  private renderSummarizedAssistantEvents(
    containerEl: HTMLElement,
    events: ReadonlyArray<SummarizableAssistantEvent>
  ): void {
    const summaryEvents = summarizeAssistantSystemEvents(events);
    if (summaryEvents.length === 0) {
      return;
    }

    containerEl.replaceChildren();
    for (const event of summaryEvents) {
      renderEventCard(containerEl, event);
    }
  }

  private setSendingState(isSending: boolean): void {
    this.isSending = isSending;
    this.updateComposerState();
  }

  private async updateContextSummary(): Promise<void> {
    const context = await this.collectContext("");
    const localUsage = measureLocalContextUsage(context);
    this.contextUsage = {
      ...this.contextUsage,
      localCharsUsed: localUsage.used,
      localCharsLimit: localUsage.limit
    };
    this.statusBar?.updateContextUsage(this.contextUsage);
    this.statusBar?.updateWorkingDirectory(this.getVaultRootPath());
  }

  private async handleSend(): Promise<void> {
    const userInput = this.inputEl.value.trim();
    if (!userInput || this.isSending) {
      return;
    }

    const threadOptions = this.buildThreadOptions();
    if (!threadOptions.workingDirectory) {
      new Notice("Could not determine the local vault path for Codex.", 8000);
      return;
    }

    const context = await this.collectContext(userInput);
    const prompt = buildContextPayload(context);
    const localUsage = measureLocalContextUsage(context);
    this.contextUsage = {
      ...this.contextUsage,
      localCharsUsed: localUsage.used,
      localCharsLimit: localUsage.limit
    };
    this.statusBar?.updateContextUsage(this.contextUsage);

    if (!this.sessionStarted) {
      if (this.activeThreadId) {
        this.plugin.codexService.resumeThread(this.activeThreadId, threadOptions);
      } else {
        this.plugin.codexService.createThread(threadOptions);
      }
      this.sessionStarted = true;
    }

    this.wasCancelled = false;
    this.appendMessage("user", userInput);
    const assistantTurn = this.createAssistantTurn();
    this.inputEl.value = "";
    this.setSendingState(true);

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

    try {
      for await (const event of this.plugin.codexService.sendMessage(prompt, threadOptions)) {
        if (event.type === "thread.started") {
          this.activeThreadId = event.thread_id;
          void this.persistLastSession();
        }

        const mapped = mapThreadEvent(event);

        if (mapped.type === "noop" || mapped.type === "turn_started") {
          continue;
        }

        if (mapped.type === "turn_completed") {
          if (!assistantTurn.metaFinalized) {
            this.finalizeAssistantTurnMeta(assistantTurn);
          }
          const summaryEvents = summarizeAssistantSystemEvents(Array.from(latestSystemEvents.values()));
          if (latestSystemEvents.size > 0) {
            this.renderSummarizedAssistantEvents(
              assistantTurn.eventsEl,
              Array.from(latestSystemEvents.values())
            );
          }
          this.contextUsage = {
            ...this.contextUsage,
            threadCharsUsedEstimate:
              this.contextUsage.threadCharsUsedEstimate + turnPromptChars + turnGeneratedChars,
            sdkInputTokens: mapped.usage.inputTokens,
            sdkCachedInputTokens: mapped.usage.cachedInputTokens,
            sdkOutputTokens: mapped.usage.outputTokens
          };
          this.statusBar?.updateContextUsage(this.contextUsage);
          if (assistantMarkdown || summaryEvents.length > 0) {
            this.sessionEntries.push({
              type: "assistant",
              metaLabel: assistantTurn.metaLabelEl.textContent ?? "Thought",
              contentMarkdown: assistantMarkdown,
              summaries: this.snapshotSummaryItems(summaryEvents)
            });
            await this.persistLastSession();
          }
          continue;
        }

        if (mapped.type === "reasoning") {
          latestSystemEvents.set(mapped.itemId, mapped);
          turnGeneratedChars += trackEventChars(mapped.itemId, estimateMappedEventChars(mapped));
          sawVisibleAssistantEvent = true;
          const existingEl = eventElements.get(mapped.itemId);
          const cardEl = renderEventCard(assistantTurn.eventsEl, mapped, existingEl);
          eventElements.set(mapped.itemId, cardEl);
          this.scrollMessagesToBottom();
          continue;
        }

        if (mapped.type === "error" || mapped.type === "turn_failed") {
          this.finalizeAssistantTurnMeta(assistantTurn);
          renderEventCard(assistantTurn.eventsEl, mapped);
          this.refreshCanvasState();
          this.scrollMessagesToBottom();
          streamErrorHandled = true;
          throw new Error(mapped.message);
        }

        if (!sawVisibleAssistantEvent) {
          this.finalizeAssistantTurnMeta(assistantTurn);
          sawVisibleAssistantEvent = true;
        }

        const existingEl = "itemId" in mapped ? eventElements.get(mapped.itemId) : undefined;
        const targetContainer =
          mapped.type === "text" ? assistantTurn.contentEl : assistantTurn.eventsEl;
        const cardEl =
          mapped.type === "text"
            ? await this.renderAssistantText(
                targetContainer,
                mapped,
                existingEl
              )
            : renderEventCard(
                targetContainer,
                mapped as VisibleAssistantEvent,
                existingEl
              );
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

        this.refreshCanvasState();
        this.scrollMessagesToBottom();
      }

      if (!sawVisibleAssistantEvent && !streamErrorHandled) {
        this.removeAssistantTurnIfEmpty(assistantTurn);
        this.appendMessage("status", "No response received.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.wasCancelled) {
        if (sawVisibleAssistantEvent) {
          this.finalizeAssistantTurnMeta(assistantTurn, true);
          if (assistantMarkdown || latestSystemEvents.size > 0) {
            const summaryEvents = summarizeAssistantSystemEvents(Array.from(latestSystemEvents.values()));
            this.renderSummarizedAssistantEvents(
              assistantTurn.eventsEl,
              Array.from(latestSystemEvents.values())
            );
            this.sessionEntries.push({
              type: "assistant",
              metaLabel: assistantTurn.metaLabelEl.textContent ?? "Interrupted",
              contentMarkdown: assistantMarkdown,
              summaries: this.snapshotSummaryItems(summaryEvents)
            });
            await this.persistLastSession();
          }
        } else {
          assistantTurn.rootEl.remove();
          this.refreshCanvasState();
        }
        this.appendMessage("status", "Interrupted.");
      } else if (!streamErrorHandled) {
        this.finalizeAssistantTurnMeta(assistantTurn);
        renderEventCard(assistantTurn.eventsEl, { type: "error", message });
        this.refreshCanvasState();
        this.scrollMessagesToBottom();
        new Notice(`Codex request failed: ${message}`, 8000);
      } else {
        new Notice(`Codex request failed: ${message}`, 8000);
      }
    } finally {
      this.setSendingState(false);
      await this.updateContextSummary();
    }
  }

  private handleCancel(): void {
    if (!this.isSending) {
      return;
    }

    this.wasCancelled = true;
    this.plugin.codexService.cancelCurrentTurn();
  }

  private scheduleContextSummaryUpdate(): void {
    this.clearScheduledContextSummaryUpdate();
    this.selectionChangeTimer = window.setTimeout(() => {
      this.selectionChangeTimer = null;
      void this.updateContextSummary();
    }, SELECTION_CHANGE_DEBOUNCE_MS);
  }

  private clearScheduledContextSummaryUpdate(): void {
    if (this.selectionChangeTimer !== null) {
      window.clearTimeout(this.selectionChangeTimer);
      this.selectionChangeTimer = null;
    }
  }

  private buildThreadOptions(): ThreadOptions {
    const sandboxMode = this.plugin.settings.yoloMode
      ? "danger-full-access"
      : this.plugin.settings.sandboxMode;
    const approvalPolicy = this.plugin.settings.yoloMode ? "never" : this.plugin.settings.approvalPolicy;

    return {
      model: this.plugin.settings.model || DEFAULT_SETTINGS.model,
      modelReasoningEffort: this.plugin.settings.reasoningEffort,
      workingDirectory: this.getVaultRootPath(),
      skipGitRepoCheck: this.plugin.settings.skipGitRepoCheck,
      sandboxMode,
      approvalPolicy
    };
  }

  private getVaultRootPath(): string | undefined {
    const adapter = this.app.vault.adapter;
    return adapter instanceof FileSystemAdapter ? adapter.getBasePath() : undefined;
  }

  private getMarkdownSourcePath(): string {
    return this.app.workspace.getActiveFile()?.path ?? "";
  }

  private getLatestAssistantMarkdown(): string | undefined {
    for (let index = this.sessionEntries.length - 1; index >= 0; index -= 1) {
      const entry = this.sessionEntries[index];
      if (entry?.type === "assistant" && entry.contentMarkdown.trim()) {
        return entry.contentMarkdown;
      }
    }

    return undefined;
  }

  private extractDraftTitle(markdown?: string): string | undefined {
    if (!markdown) {
      return undefined;
    }

    const lines = markdown.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      return line.replace(/^#+\s*/, "").slice(0, 120);
    }

    return undefined;
  }

  private isGuidanceFile(file: TFile): boolean {
    const extension = file.extension.toLowerCase();
    if (extension !== "md" && extension !== "txt") {
      return false;
    }

    return /^(readme|index|moc|guide|guidelines|conventions|structure|vault|about)$/i.test(file.basename) ||
      /(指南|约定|说明|结构|索引|目录)/.test(file.basename);
  }

  private async collectVaultGuidanceDocuments(): Promise<GuidanceDocument[]> {
    const root = this.app.vault.getRoot();
    const guidanceFiles = root.children
      .filter((child): child is TFile => child instanceof TFile)
      .filter((file) => this.isGuidanceFile(file))
      .slice(0, SAVE_PLANNER_GUIDANCE_FILE_LIMIT);

    return Promise.all(
      guidanceFiles.map(async (file) => ({
        path: file.path,
        content: (await this.app.vault.cachedRead(file)).slice(0, SAVE_PLANNER_GUIDANCE_CHAR_LIMIT)
      }))
    );
  }

  private collectDirectorySnapshot(): DirectorySnapshot[] {
    const snapshots: DirectorySnapshot[] = [];
    const root = this.app.vault.getRoot();

    const visitFolder = (folder: TFolder, depth: number): void => {
      if (depth > SAVE_PLANNER_FOLDER_DEPTH_LIMIT || snapshots.length >= SAVE_PLANNER_FOLDER_LIMIT) {
        return;
      }

      if (!folder.isRoot()) {
        snapshots.push({
          path: folder.path,
          sampleFiles: this.collectDirectorySampleFiles(folder)
        });
      }

      for (const child of folder.children) {
        if (child instanceof TFolder) {
          visitFolder(child, depth + 1);
        }
      }
    };

    visitFolder(root, 0);

    return snapshots;
  }

  private collectDirectorySampleFiles(folder: TFolder): string[] {
    const sampleFiles: string[] = [];

    const collectFromFolder = (current: TFolder, depth: number): void => {
      if (depth > 1 || sampleFiles.length >= SAVE_PLANNER_SAMPLE_FILE_LIMIT) {
        return;
      }

      for (const child of current.children) {
        if (sampleFiles.length >= SAVE_PLANNER_SAMPLE_FILE_LIMIT) {
          return;
        }

        if (child instanceof TFile) {
          if (child.extension.toLowerCase() === "md" || child.extension.toLowerCase() === "txt") {
            sampleFiles.push(child.basename);
          }
          continue;
        }

        if (child instanceof TFolder) {
          collectFromFolder(child, depth + 1);
        }
      }
    };

    collectFromFolder(folder, 0);
    return sampleFiles;
  }

  private async buildSaveTargetPlan(userInput: string, activeNotePath?: string) {
    if (!requestLooksLikeLocalSave(userInput)) {
      return undefined;
    }

    const latestAssistantMarkdown = this.getLatestAssistantMarkdown();
    return planVaultSaveTarget({
      userInput,
      activeNotePath,
      guidanceDocuments: await this.collectVaultGuidanceDocuments(),
      directorySnapshot: this.collectDirectorySnapshot(),
      draftTitle: this.extractDraftTitle(latestAssistantMarkdown),
      draftExcerpt: latestAssistantMarkdown?.slice(0, 1200)
    });
  }

  private async collectContext(userInput: string): Promise<ContextInput> {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = markdownView?.file ?? this.app.workspace.getActiveFile() ?? undefined;
    const activeNotePath = file?.path;
    const saveTargetPlan = await this.buildSaveTargetPlan(userInput, activeNotePath);

    if (markdownView?.editor && file) {
      const selectionText = markdownView.editor.getSelection() || undefined;
      return {
        userInput,
        activeNotePath: file.path,
        activeNoteContent: markdownView.editor.getValue(),
        selectionText,
        saveTargetPlan
      };
    }

    if (file) {
      return {
        userInput,
        activeNotePath: file.path,
        activeNoteContent: await this.app.vault.cachedRead(file),
        saveTargetPlan
      };
    }

    return {
      userInput,
      saveTargetPlan
    };
  }
}
