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
import * as nodePath from "node:path";
import {
  insertTextAtSelection,
  shouldInsertLineBreakFromKeydown,
  shouldSubmitFromKeydown
} from "./chat-input";
import { renderMarkdownMessage } from "./assistant-markdown";
import type {
  PersistedChatEntry,
  PersistedChatSession,
  PersistedSummaryItem
} from "./chat-session";
import { getSessionDisplayTitle, resolveSessionTitle } from "./chat-session";
import {
  activateRecentSession,
  createDraftWorkbenchState,
  getLatestRecentSession,
  persistWorkbenchSession,
  type ChatWorkbenchState
} from "./chat-workbench";
import { renderPersistedSessionEntries } from "./chat-message-renderer";
import {
  MAX_FILE_ATTACHMENTS,
  NOTE_CHAR_LIMIT,
  THREAD_CONTEXT_CHAR_LIMIT,
  buildContextPayload,
  measureLocalContextUsage,
  omitActiveNoteContext,
  type ContextInput
} from "./context-builder";
import {
  addComposerAttachment,
  countAttachmentsByKind,
  hasAttachmentPath,
  removeComposerAttachment,
  type ComposerAttachment
} from "./composer-attachments";
import { formatContextSummary } from "./context-summary";
import { CODEX_ICON } from "./codex-icon";
import { mapThreadEvent } from "./codex-service";
import { renderEventCard } from "./event-cards";
import {
  estimateMappedEventChars,
  summarizeAssistantSystemEvents,
  type SummarizableAssistantEvent
} from "./event-summary";
import { enhanceRenderedAssistantLinks } from "./assistant-link-opener";
import type ObsidianCodexPlugin from "./main";
import { findActiveMentionQuery } from "./mention-query";
import { deletePastedImage, writePastedImage } from "./pasted-image-store";
import { searchReferencePaths } from "./reference-search";
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
const MAX_IMAGE_ATTACHMENTS = 3;
const MAX_MENTION_RESULTS = 8;

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

type LiveAssistantTurnPhase = "thinking" | "working";

type VisibleAssistantEvent =
  | MappedTextEvent
  | MappedReasoningEvent
  | MappedCommandEvent
  | MappedFileChangeEvent
  | MappedActivityEvent
  | MappedErrorEvent
  | { type: "turn_failed"; message: string };

interface MentionState {
  query: string;
  rangeStart: number;
  rangeEnd: number;
  highlightedIndex: number;
  candidates: string[];
}

function normalizeAttachmentPath(path: string): string {
  return path.replaceAll("\\", "/");
}

function getAttachmentBasename(path: string): string {
  const normalizedPath = normalizeAttachmentPath(path);
  const segments = normalizedPath.split("/");
  return segments[segments.length - 1] ?? normalizedPath;
}

function formatAttachmentSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 102.4) / 10} KB`;
  }

  return `${Math.round(sizeBytes / 104857.6) / 10} MB`;
}

export class ChatView extends ItemView {
  private emptyStateEl!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private inputEl!: HTMLTextAreaElement;
  private mentionDropdownEl!: HTMLDivElement;
  private attachmentStripEl!: HTMLDivElement;
  private historyButtonEl!: HTMLButtonElement;
  private historyPopoverEl!: HTMLDivElement;
  private historyActionsEl!: HTMLDivElement;
  private historyStatusEl!: HTMLDivElement;
  private historyListEl!: HTMLDivElement;
  private cancelButtonEl!: HTMLButtonElement;
  private newChatButtonEl!: HTMLButtonElement;
  private statusBar: StatusBar | null = null;
  private sessionEntries: PersistedChatEntry[] = [];
  private recentSessions: PersistedChatSession[] = [];
  private activeSessionId: string | null = null;
  private activeThreadId: string | null = null;
  private sessionStarted = false;
  private isSending = false;
  private wasCancelled = false;
  private attachments: ComposerAttachment[] = [];
  private mentionState: MentionState | null = null;
  private attachmentIdCounter = 0;
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
    return "Codexian";
  }

  getIcon(): string {
    return CODEX_ICON;
  }

  async onOpen(): Promise<void> {
    this.render();
    this.recentSessions = [...this.plugin.recentSessions];
    this.activeSessionId = this.plugin.activeSessionId;
    this.renderHistorySessionList();
    await this.restoreActiveSession();
    void this.updateContextSummary();
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => void this.updateContextSummary()));
    this.registerDomEvent(document, "selectionchange", () => this.scheduleContextSummaryUpdate());
    this.registerDomEvent(document, "mousedown", (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !this.historyPopoverEl) {
        return;
      }

      if (
        this.historyPopoverEl.classList.contains("is-open") &&
        !this.historyPopoverEl.contains(target) &&
        !this.historyButtonEl.contains(target)
      ) {
        this.setHistoryPopoverOpen(false);
      }
    });
  }

  onClose(): Promise<void> {
    this.clearScheduledContextSummaryUpdate();
    this.clearComposerAttachments();
    this.plugin.codexService.clearThread();
    this.statusBar?.destroy();
    this.statusBar = null;
    return Promise.resolve();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("obsidian-codex-view");

    const headerEl = contentEl.createDiv({ cls: "obsidian-codex-header" });
    const brandEl = headerEl.createDiv({ cls: "obsidian-codex-brand" });
    const brandIconEl = brandEl.createSpan({ cls: "obsidian-codex-brand-icon" });
    setIcon(brandIconEl, CODEX_ICON);
    brandEl.createSpan({ cls: "obsidian-codex-brand-label", text: "Codexian" });

    const stageEl = contentEl.createDiv({ cls: "obsidian-codex-stage" });
    this.emptyStateEl = stageEl.createDiv({ cls: "obsidian-codex-empty-state" });
    this.emptyStateEl.createEl("h1", {
      cls: "obsidian-codex-empty-title",
      text: getWelcomeTitle()
    });

    this.messagesEl = stageEl.createDiv({ cls: "obsidian-codex-messages" });

    const stageActionsEl = contentEl.createDiv({ cls: "obsidian-codex-stage-actions" });
    const historyShellEl = stageActionsEl.createDiv({ cls: "obsidian-codex-history-shell" });
    this.historyButtonEl = this.createTrayActionButton(
      historyShellEl,
      "history",
      "Recent sessions",
      () => this.toggleHistoryPopover(),
      false,
      "is-history"
    );
    this.historyPopoverEl = historyShellEl.createDiv({ cls: "obsidian-codex-history-popover" });
    this.historyActionsEl = this.historyPopoverEl.createDiv({ cls: "obsidian-codex-history-actions" });
    const historyNewSessionButtonEl = this.historyActionsEl.createEl("button", {
      cls: "obsidian-codex-history-action",
      text: "New session"
    });
    historyNewSessionButtonEl.type = "button";
    historyNewSessionButtonEl.addEventListener("click", () => this.startDraftSession());
    this.historyStatusEl = this.historyPopoverEl.createDiv({ cls: "obsidian-codex-history-status" });
    this.historyListEl = this.historyPopoverEl.createDiv({ cls: "obsidian-codex-history-list" });
    this.newChatButtonEl = this.createTrayActionButton(
      stageActionsEl,
      "plus",
      "New chat",
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
    this.inputEl.placeholder = "Type a prompt";
    this.inputEl.rows = 4;

    this.registerDomEvent(this.inputEl, "focus", () => void this.updateContextSummary());
    this.registerDomEvent(this.inputEl, "input", () => this.handleComposerInput());
    this.registerDomEvent(this.inputEl, "click", () => this.handleComposerInput());
    this.registerDomEvent(this.inputEl, "keyup", () => this.handleComposerInput());
    this.registerDomEvent(this.inputEl, "paste", (event: ClipboardEvent) => {
      void this.handleInputPaste(event);
    });
    this.registerDomEvent(this.inputEl, "keydown", (event: KeyboardEvent) => {
      if (this.handleMentionKeydown(event)) {
        return;
      }

      if (
        event.key === "Backspace" &&
        !this.isSending &&
        this.attachments.length > 0 &&
        !this.inputEl.value &&
        (this.inputEl.selectionStart ?? 0) === 0 &&
        (this.inputEl.selectionEnd ?? 0) === 0
      ) {
        event.preventDefault();
        void this.removeAttachment(this.attachments[this.attachments.length - 1]);
        return;
      }

      const keyInput = {
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        isComposing: event.isComposing
      };

      if (shouldSubmitFromKeydown(keyInput)) {
        event.preventDefault();
        void this.handleSend();
        return;
      }

      if (shouldInsertLineBreakFromKeydown(keyInput)) {
        event.preventDefault();
        const selectionStart = this.inputEl.selectionStart ?? this.inputEl.value.length;
        const selectionEnd = this.inputEl.selectionEnd ?? selectionStart;
        const nextValue = insertTextAtSelection({
          value: this.inputEl.value,
          selectionStart,
          selectionEnd,
          text: "\n"
        });
        this.inputEl.value = nextValue.value;
        this.inputEl.selectionStart = nextValue.selectionStart;
        this.inputEl.selectionEnd = nextValue.selectionEnd;
        this.updateComposerState();
      }
    });
    this.mentionDropdownEl = inputShellEl.createDiv({ cls: "obsidian-codex-mention-dropdown" });
    this.attachmentStripEl = inputShellEl.createDiv({ cls: "obsidian-codex-attachment-strip" });

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

  private toggleHistoryPopover(): void {
    if (this.historyButtonEl.disabled) {
      return;
    }

    this.setHistoryPopoverOpen(!this.historyPopoverEl.classList.contains("is-open"));
  }

  private setHistoryPopoverOpen(isOpen: boolean): void {
    this.historyButtonEl.classList.toggle("is-active", isOpen);
    this.historyButtonEl.setAttribute("aria-expanded", isOpen ? "true" : "false");
    this.historyPopoverEl.classList.toggle("is-open", isOpen);
  }

  openSessionWorkbench(): void {
    this.setHistoryPopoverOpen(true);
  }

  private renderHistorySessionList(): void {
    this.updateHistoryWorkbenchState();
    this.historyListEl.replaceChildren();

    if (this.recentSessions.length === 0) {
      this.historyListEl.createDiv({
        cls: "obsidian-codex-history-empty",
        text: "No recent sessions yet."
      });
      return;
    }

    for (const session of this.recentSessions) {
      const itemEl = this.historyListEl.createDiv({
        cls: "obsidian-codex-history-item"
      });
      itemEl.tabIndex = 0;
      itemEl.setAttr("role", "button");
      itemEl.classList.toggle("is-active", session.threadId === this.activeSessionId);

      const title = getSessionDisplayTitle(session);
      const timestamp = this.formatHistoryTimestamp(session.updatedAt);
      itemEl.setAttr("aria-label", `${title} · ${timestamp}`);

      const titleEl = itemEl.createDiv({ cls: "obsidian-codex-history-item-title" });
      titleEl.setText(title);

      const metaEl = itemEl.createDiv({ cls: "obsidian-codex-history-item-meta" });
      metaEl.setText(timestamp);

      const activateSession = () => {
        void this.activatePersistedSession(session.threadId);
      };

      itemEl.addEventListener("click", activateSession);
      itemEl.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateSession();
        }
      });
    }
  }

  private updateHistoryWorkbenchState(): void {
    const activeSession = this.activeSessionId
      ? this.recentSessions.find((session) => session.threadId === this.activeSessionId)
      : null;
    const statusText = activeSession
      ? `Current session: ${getSessionDisplayTitle(activeSession)}`
      : "Current session: New draft";
    this.historyStatusEl.setText(statusText);
  }

  private formatHistoryTimestamp(updatedAt: number): string {
    if (updatedAt <= 0) {
      return "Unknown time";
    }

    return new Date(updatedAt).toLocaleString();
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

  private updateAssistantTurnLiveState(
    turn: AssistantTurnElements,
    phase: LiveAssistantTurnPhase
  ): void {
    if (turn.metaFinalized) {
      return;
    }

    turn.metaEl.classList.add("is-live");
    turn.metaLabelEl.textContent = phase === "working" ? "Working" : "Thinking";
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

  private createAttachmentId(prefix: string): string {
    this.attachmentIdCounter += 1;
    return `${prefix}-${this.attachmentIdCounter}`;
  }

  private handleComposerInput(): void {
    this.updateMentionState();
    this.updateComposerState();
  }

  private updateMentionState(): void {
    const mentionMatch = findActiveMentionQuery(
      this.inputEl.value,
      this.inputEl.selectionStart ?? this.inputEl.value.length
    );
    if (!mentionMatch) {
      this.mentionState = null;
      return;
    }

    const activeNotePath = this.app.workspace.getActiveFile()?.path;
    const candidatePaths = searchReferencePaths(
      this.app.vault.getMarkdownFiles()
        .map((file) => file.path)
        .filter((path) => !hasAttachmentPath(this.attachments, path)),
      mentionMatch.query,
      {
        activeNotePath,
        limit: MAX_MENTION_RESULTS
      }
    );
    const previousCandidate = this.mentionState?.candidates[this.mentionState.highlightedIndex];
    const nextHighlightedIndex = previousCandidate
      ? Math.max(0, candidatePaths.indexOf(previousCandidate))
      : 0;

    this.mentionState = {
      ...mentionMatch,
      highlightedIndex: Math.min(nextHighlightedIndex, Math.max(0, candidatePaths.length - 1)),
      candidates: candidatePaths
    };
  }

  private handleMentionKeydown(event: KeyboardEvent): boolean {
    if (!this.mentionState || this.isSending) {
      return false;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const candidateCount = this.mentionState.candidates.length;
      if (candidateCount === 0) {
        return true;
      }

      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (this.mentionState.highlightedIndex + direction + candidateCount) % candidateCount;
      this.mentionState = {
        ...this.mentionState,
        highlightedIndex: nextIndex
      };
      this.renderMentionDropdown();
      return true;
    }

    if ((event.key === "Enter" || event.key === "Tab") && this.mentionState.candidates.length > 0) {
      event.preventDefault();
      void this.selectMentionCandidate(this.mentionState.highlightedIndex);
      return true;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.mentionState = null;
      this.renderMentionDropdown();
      return true;
    }

    return false;
  }

  private async selectMentionCandidate(index: number): Promise<void> {
    const mentionState = this.mentionState;
    if (!mentionState) {
      return;
    }

    const candidatePath = mentionState.candidates[index];
    if (!candidatePath) {
      return;
    }

    if (
      countAttachmentsByKind(this.attachments)["vault-file"] >= MAX_FILE_ATTACHMENTS &&
      !hasAttachmentPath(this.attachments, candidatePath)
    ) {
      new Notice(`You can attach up to ${MAX_FILE_ATTACHMENTS} files per turn.`, 6000);
      return;
    }

    const nextValue = insertTextAtSelection({
      value: this.inputEl.value,
      selectionStart: mentionState.rangeStart,
      selectionEnd: mentionState.rangeEnd,
      text: ""
    });
    this.inputEl.value = nextValue.value;
    this.inputEl.selectionStart = nextValue.selectionStart;
    this.inputEl.selectionEnd = nextValue.selectionEnd;
    this.attachments = addComposerAttachment(this.attachments, {
      kind: "vault-file",
      id: this.createAttachmentId("ref"),
      path: candidatePath
    });
    this.mentionState = null;
    this.updateComposerState();
    await this.updateContextSummary();
    this.inputEl.focus();
  }

  private renderMentionDropdown(): void {
    this.mentionDropdownEl.replaceChildren();
    const isOpen = !this.isSending && this.mentionState !== null;
    this.mentionDropdownEl.classList.toggle("is-open", isOpen);
    if (!isOpen || !this.mentionState) {
      return;
    }

    if (this.mentionState.candidates.length === 0) {
      this.mentionDropdownEl.createDiv({
        cls: "obsidian-codex-mention-empty",
        text: this.mentionState.query ? "No matching files." : "No markdown files available."
      });
      return;
    }

    this.mentionState.candidates.forEach((candidatePath, index) => {
      const itemEl = this.mentionDropdownEl.createEl("button", {
        cls: `obsidian-codex-mention-item${index === this.mentionState?.highlightedIndex ? " is-selected" : ""}`
      });
      itemEl.type = "button";
      itemEl.createSpan({
        cls: "obsidian-codex-mention-item-label",
        text: getAttachmentBasename(candidatePath)
      });
      itemEl.createSpan({
        cls: "obsidian-codex-mention-item-path",
        text: candidatePath
      });
      itemEl.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      itemEl.addEventListener("click", () => {
        void this.selectMentionCandidate(index);
      });
    });
  }

  private renderAttachmentStrip(): void {
    this.attachmentStripEl.replaceChildren();
    this.attachmentStripEl.classList.toggle("is-empty", this.attachments.length === 0);
    if (this.attachments.length === 0) {
      return;
    }

    for (const attachment of this.attachments) {
      const chipEl = this.attachmentStripEl.createDiv({
        cls: `obsidian-codex-attachment-chip${attachment.kind === "pasted-image" ? " is-image" : ""}`
      });
      const bodyEl = chipEl.createDiv({ cls: "obsidian-codex-attachment-body" });
      bodyEl.createDiv({
        cls: "obsidian-codex-attachment-label",
        text: getAttachmentBasename(attachment.path)
      });

      const metaText = attachment.kind === "vault-file"
        ? attachment.path
        : [
            attachment.mimeType.replace("image/", "").toUpperCase(),
            formatAttachmentSize(attachment.sizeBytes),
            typeof attachment.width === "number" && typeof attachment.height === "number"
              ? `${attachment.width}x${attachment.height}`
              : null
          ]
            .filter((value): value is string => Boolean(value))
            .join(" · ");
      bodyEl.createDiv({
        cls: "obsidian-codex-attachment-meta",
        text: metaText
      });

      const removeButtonEl = chipEl.createEl("button", {
        cls: "obsidian-codex-attachment-remove",
        text: "×"
      });
      removeButtonEl.type = "button";
      removeButtonEl.ariaLabel = `Remove ${getAttachmentBasename(attachment.path)}`;
      removeButtonEl.disabled = this.isSending;
      removeButtonEl.addEventListener("click", () => {
        void this.removeAttachment(attachment);
      });
    }
  }

  private async handleInputPaste(event: ClipboardEvent): Promise<void> {
    if (this.isSending) {
      return;
    }

    const imageFiles = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (imageFiles.length === 0) {
      return;
    }

    const vaultRootPath = this.getVaultRootPath();
    if (!vaultRootPath) {
      new Notice("Could not determine the local vault path for pasted images.", 8000);
      return;
    }

    event.preventDefault();
    const existingImageCount = countAttachmentsByKind(this.attachments)["pasted-image"];
    const remainingSlots = Math.max(0, MAX_IMAGE_ATTACHMENTS - existingImageCount);
    if (remainingSlots === 0) {
      new Notice(`You can attach up to ${MAX_IMAGE_ATTACHMENTS} images per turn.`, 6000);
      return;
    }

    for (const imageFile of imageFiles.slice(0, remainingSlots)) {
      try {
        await this.attachPastedImage(vaultRootPath, imageFile);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(`Could not attach pasted image: ${message}`, 8000);
      }
    }

    if (imageFiles.length > remainingSlots) {
      new Notice(`Only the first ${remainingSlots} pasted image(s) were attached.`, 6000);
    }

    this.updateMentionState();
    this.updateComposerState();
    await this.updateContextSummary();
  }

  private async attachPastedImage(vaultRootPath: string, imageFile: File): Promise<void> {
    const attachmentId = this.createAttachmentId("image");
    const bytes = new Uint8Array(await imageFile.arrayBuffer());
    const writtenPath = writePastedImage(
      vaultRootPath,
      this.app.vault.configDir,
      bytes,
      imageFile.type,
      `${new Date().toISOString()}-${attachmentId}`
    );
    const imageDimensions = await this.readImageDimensions(imageFile);
    this.attachments = addComposerAttachment(this.attachments, {
      kind: "pasted-image",
      id: attachmentId,
      path: normalizeAttachmentPath(nodePath.relative(vaultRootPath, writtenPath)),
      mimeType: imageFile.type,
      sizeBytes: imageFile.size,
      width: imageDimensions.width,
      height: imageDimensions.height
    });
  }

  private async readImageDimensions(imageFile: Blob): Promise<{ width?: number; height?: number }> {
    try {
      if (typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(imageFile);
        const dimensions = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return dimensions;
      }
    } catch {
      // Fall back to Image-based probing below.
    }

    const objectUrl = URL.createObjectURL(imageFile);
    try {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          resolve({
            width: image.naturalWidth,
            height: image.naturalHeight
          });
        };
        image.onerror = () => reject(new Error("Could not read pasted image dimensions."));
        image.src = objectUrl;
      });
      return dimensions;
    } catch {
      return {};
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private async removeAttachment(attachment: ComposerAttachment | undefined): Promise<void> {
    if (!attachment) {
      return;
    }

    if (attachment.kind === "pasted-image") {
      const vaultRootPath = this.getVaultRootPath();
      if (vaultRootPath) {
        try {
          deletePastedImage(vaultRootPath, attachment.path);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          new Notice(`Could not remove cached image: ${message}`, 8000);
        }
      }
    }

    this.attachments = removeComposerAttachment(this.attachments, attachment.id);
    this.updateMentionState();
    this.updateComposerState();
    await this.updateContextSummary();
    this.inputEl.focus();
  }

  private cleanupAttachmentFiles(attachments: ReadonlyArray<ComposerAttachment>): void {
    const vaultRootPath = this.getVaultRootPath();
    for (const attachment of attachments) {
      if (attachment.kind !== "pasted-image" || !vaultRootPath) {
        continue;
      }

      try {
        deletePastedImage(vaultRootPath, attachment.path);
      } catch {
        // Ignore cache cleanup failures; stale cache files are lower risk than breaking the view.
      }
    }
  }

  private clearComposerAttachments(): void {
    this.cleanupAttachmentFiles(this.attachments);
    this.attachments = [];
    this.mentionState = null;
    if (this.attachmentStripEl && this.mentionDropdownEl) {
      this.renderAttachmentStrip();
      this.renderMentionDropdown();
    }
  }

  private updateComposerState(): void {
    this.historyButtonEl.disabled = this.isSending;
    this.cancelButtonEl.disabled = !this.isSending;
    this.inputEl.disabled = this.isSending;
    this.renderMentionDropdown();
    this.renderAttachmentStrip();
  }

  private refreshCanvasState(): void {
    const hasContent = this.messagesEl.childElementCount > 0;
    this.emptyStateEl.classList.toggle("is-hidden", hasContent);
    this.messagesEl.classList.toggle("has-content", hasContent);
  }

  private scrollMessagesToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  startDraftSession(): void {
    this.resetConversation();
  }

  async resumeLatestSession(): Promise<void> {
    const latestSession = getLatestRecentSession(this.recentSessions);
    if (!latestSession) {
      new Notice("No recent sessions yet.", 4000);
      return;
    }

    await this.activatePersistedSession(latestSession.threadId);
  }

  private resetConversation(): void {
    this.plugin.codexService.clearThread();
    const draftState = createDraftWorkbenchState(this.recentSessions);
    this.applyWorkbenchState(draftState);
    this.sessionEntries = [];
    this.sessionStarted = false;
    this.wasCancelled = false;
    this.inputEl.value = "";
    this.clearComposerAttachments();
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
    this.setHistoryPopoverOpen(false);
    this.renderHistorySessionList();
    void this.plugin.setActiveSession(draftState.activeSessionId);
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
      void this.persistActiveSession();
    }
    this.refreshCanvasState();
    this.scrollMessagesToBottom();
    return messageEl;
  }

  private async renderPersistedSession(session: PersistedChatSession): Promise<void> {
    this.messagesEl.empty();
    this.sessionEntries = [...session.entries];
    this.activeSessionId = session.threadId;
    this.activeThreadId = session.threadId;
    this.contextUsage = {
      ...this.contextUsage,
      threadCharsUsedEstimate: session.contextUsage.threadCharsUsedEstimate,
      sdkInputTokens: session.contextUsage.sdkInputTokens,
      sdkCachedInputTokens: session.contextUsage.sdkCachedInputTokens,
      sdkOutputTokens: session.contextUsage.sdkOutputTokens
    };
    this.statusBar?.updateContextUsage(this.contextUsage);
    await renderPersistedSessionEntries(session.entries, {
      createAssistantTurn: () => this.createAssistantTurn(),
      renderMarkdown: async (containerEl, markdown) => {
        await renderMarkdownMessage(
          containerEl,
          markdown,
          this.getMarkdownSourcePath(),
          (value, scratchEl, sourcePath) =>
            MarkdownRenderer.render(this.app, value, scratchEl, sourcePath, this)
        );
      },
      activateLinks: (containerEl) => {
        this.activateRenderedAssistantLinks(containerEl, this.getMarkdownSourcePath());
      },
      appendMessage: (entry) => {
        this.appendMessage(entry.type, entry.text, false);
      },
      refreshCanvasState: () => this.refreshCanvasState(),
      scrollMessagesToBottom: () => this.scrollMessagesToBottom()
    });
  }

  private async restoreActiveSession(): Promise<void> {
    const currentState = this.getWorkbenchState();
    const activationState =
      currentState.activeSessionId
        ? activateRecentSession(currentState, currentState.activeSessionId)
        : { ...currentState, selectedSession: null };
    const session = activationState.selectedSession;
    if (!session) {
      return;
    }

    this.applyWorkbenchState(activationState);
    await this.renderPersistedSession(session);

    const threadOptions = this.buildThreadOptions();
    if (threadOptions.workingDirectory) {
      this.plugin.codexService.resumeThread(session.threadId, threadOptions);
      this.sessionStarted = true;
    }
  }

  private async persistActiveSession(): Promise<void> {
    if (!this.activeThreadId || this.sessionEntries.length === 0) {
      return;
    }

    const existingSession = this.recentSessions.find((session) => session.threadId === this.activeThreadId);
    const nextSession: PersistedChatSession = {
      threadId: this.activeThreadId,
      title: resolveSessionTitle(this.sessionEntries, existingSession?.title),
      updatedAt: Date.now(),
      entries: [...this.sessionEntries],
      contextUsage: {
        threadCharsUsedEstimate: this.contextUsage.threadCharsUsedEstimate,
        sdkInputTokens: this.contextUsage.sdkInputTokens,
        sdkCachedInputTokens: this.contextUsage.sdkCachedInputTokens,
        sdkOutputTokens: this.contextUsage.sdkOutputTokens
      }
    };
    this.applyWorkbenchState(persistWorkbenchSession(this.getWorkbenchState(), nextSession));
    this.renderHistorySessionList();
    await this.plugin.saveSessionHistory(this.recentSessions, this.activeSessionId);
  }

  private async activatePersistedSession(threadId: string): Promise<void> {
    if (this.isSending || threadId === this.activeSessionId) {
      this.setHistoryPopoverOpen(false);
      return;
    }

    const activationState = activateRecentSession(this.getWorkbenchState(), threadId);
    const session = activationState.selectedSession;
    if (!session) {
      return;
    }

    this.plugin.codexService.clearThread();
    this.wasCancelled = false;
    this.sessionStarted = false;
    this.applyWorkbenchState(activationState);
    await this.renderPersistedSession(session);
    const updatedSession = { ...session, updatedAt: Date.now() };
    this.applyWorkbenchState(persistWorkbenchSession(this.getWorkbenchState(), updatedSession));
    this.renderHistorySessionList();
    await this.plugin.saveSessionHistory(this.recentSessions, threadId);

    const threadOptions = this.buildThreadOptions();
    if (threadOptions.workingDirectory) {
      this.plugin.codexService.resumeThread(threadId, threadOptions);
      this.sessionStarted = true;
    }

    this.setHistoryPopoverOpen(false);
  }

  private getWorkbenchState(): ChatWorkbenchState {
    return {
      recentSessions: [...this.recentSessions],
      activeSessionId: this.activeSessionId,
      activeThreadId: this.activeThreadId,
      isDraftSession: this.activeSessionId === null && this.activeThreadId === null
    };
  }

  private applyWorkbenchState(state: ChatWorkbenchState): void {
    this.recentSessions = [...state.recentSessions];
    this.activeSessionId = state.activeSessionId;
    this.activeThreadId = state.activeThreadId;
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
    this.activateRenderedAssistantLinks(cardEl, this.getMarkdownSourcePath());

    return cardEl;
  }

  private activateRenderedAssistantLinks(containerEl: HTMLElement, sourcePath: string): void {
    enhanceRenderedAssistantLinks(containerEl, {
      sourcePath,
      resolveLinkpath: (linktext, linkSourcePath) =>
        this.app.metadataCache.getFirstLinkpathDest(linktext, linkSourcePath),
      openLinkText: async (linktext, linkSourcePath) => {
        await this.app.workspace.openLinkText(linktext, linkSourcePath);
      }
    });
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
    this.statusBar?.updateExecutionState(isSending);
    this.updateComposerState();
  }

  private formatPendingAttachmentSummary(): string | null {
    const counts = countAttachmentsByKind(this.attachments);
    const parts: string[] = [];
    if (counts["vault-file"] > 0) {
      parts.push(`${counts["vault-file"]} file${counts["vault-file"] === 1 ? "" : "s"}`);
    }
    if (counts["pasted-image"] > 0) {
      parts.push(`${counts["pasted-image"]} image${counts["pasted-image"] === 1 ? "" : "s"}`);
    }

    return parts.length > 0 ? parts.join(", ") : null;
  }

  private formatUserTurnText(userInput: string): string {
    const trimmedInput = userInput.trim();
    const attachmentSummary = this.formatPendingAttachmentSummary();
    if (!attachmentSummary) {
      return trimmedInput;
    }

    return trimmedInput
      ? `${trimmedInput}\n\n[Attached ${attachmentSummary}]`
      : `[Attached ${attachmentSummary}]`;
  }

  private async resolveContextAttachments(): Promise<ComposerAttachment[]> {
    const resolvedAttachments: ComposerAttachment[] = [];
    for (const attachment of this.attachments) {
      if (attachment.kind === "vault-file") {
        const file = this.app.vault.getAbstractFileByPath(attachment.path);
        if (file instanceof TFile) {
          resolvedAttachments.push({
            ...attachment,
            content: await this.app.vault.cachedRead(file)
          });
        }
        continue;
      }

      resolvedAttachments.push({ ...attachment });
    }

    return resolvedAttachments;
  }

  private async updateContextSummary(): Promise<void> {
    const context = await this.collectContext("");
    const localUsage = measureLocalContextUsage(context);
    const attachmentCounts = countAttachmentsByKind(context.attachments ?? []);
    this.contextUsage = {
      ...this.contextUsage,
      localCharsUsed: localUsage.used,
      localCharsLimit: localUsage.limit
    };
    this.statusBar?.updateContextUsage(this.contextUsage);
    this.statusBar?.updateWorkingDirectory(this.getVaultRootPath());
    this.inputEl.title = formatContextSummary({
      vaultRootPath: this.getVaultRootPath(),
      activeNotePath: context.activeNotePath,
      selectionText: context.selectionText,
      referencedFileCount: attachmentCounts["vault-file"],
      imageAttachmentCount: attachmentCounts["pasted-image"]
    });
  }

  private async handleSend(): Promise<void> {
    const userInput = this.inputEl.value.trim();
    if ((!userInput && this.attachments.length === 0) || this.isSending) {
      return;
    }

    const draftInputValue = this.inputEl.value;
    const draftAttachments = [...this.attachments];

    const threadOptions = this.buildThreadOptions();
    if (!threadOptions.workingDirectory) {
      new Notice("Could not determine the local vault path.", 8000);
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
    this.setHistoryPopoverOpen(false);
    this.appendMessage("user", this.formatUserTurnText(userInput));
    this.inputEl.value = "";
    this.attachments = [];
    this.mentionState = null;
    this.updateComposerState();
    const assistantTurn = this.createAssistantTurn();
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
    let turnCompleted = false;

    try {
      for await (const event of this.plugin.codexService.sendMessage(prompt, threadOptions)) {
        if (event.type === "thread.started") {
          this.activeThreadId = event.thread_id;
          this.activeSessionId = event.thread_id;
          void this.persistActiveSession();
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
            await this.persistActiveSession();
          }
          turnCompleted = true;
          continue;
        }

        if (mapped.type === "reasoning") {
          this.updateAssistantTurnLiveState(assistantTurn, "thinking");
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

        this.updateAssistantTurnLiveState(assistantTurn, "working");
        if (!sawVisibleAssistantEvent) {
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
            await this.persistActiveSession();
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
      if (turnCompleted) {
        this.cleanupAttachmentFiles(draftAttachments);
      } else {
        this.inputEl.value = draftInputValue;
        this.attachments = draftAttachments;
        this.updateMentionState();
        this.updateComposerState();
      }
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
      const context: ContextInput = {
        userInput,
        activeNotePath: file.path,
        activeNoteContent: markdownView.editor.getValue(),
        selectionText,
        attachments: await this.resolveContextAttachments(),
        saveTargetPlan
      };

      return this.plugin.settings.includeActiveNoteContext
        ? context
        : omitActiveNoteContext(context);
    }

    if (file) {
      const context: ContextInput = {
        userInput,
        activeNotePath: file.path,
        activeNoteContent: await this.app.vault.cachedRead(file),
        attachments: await this.resolveContextAttachments(),
        saveTargetPlan
      };

      return this.plugin.settings.includeActiveNoteContext
        ? context
        : omitActiveNoteContext(context);
    }

    return {
      userInput,
      attachments: await this.resolveContextAttachments(),
      saveTargetPlan
    };
  }
}
