import {
  FileSystemAdapter,
  ItemView,
  MarkdownView,
  Notice,
  WorkspaceLeaf,
  setIcon
} from "obsidian";
import type { ThreadOptions } from "@openai/codex-sdk";
import { shouldSubmitFromKeydown } from "./chat-input";
import {
  NOTE_CHAR_LIMIT,
  buildContextPayload,
  measureLocalContextUsage,
  type ContextInput
} from "./context-builder";
import { getContextSummaryLines } from "./context-summary";
import { CODEX_ICON } from "./codex-icon";
import { mapThreadEvent } from "./codex-service";
import { renderEventCard } from "./event-cards";
import type ObsidianCodexPlugin from "./main";
import { DEFAULT_SETTINGS, patchPluginSettings, toggleYoloMode } from "./settings";
import { StatusBar } from "./status-bar";
import type { ContextUsage, MappedEvent } from "./types";
import { getWelcomeTitle } from "./welcome-title";

export const CODEX_CHAT_VIEW_TYPE = "obsidian-codex-chat";
const SELECTION_CHANGE_DEBOUNCE_MS = 120;

type ChatMessageRole = "user" | "assistant" | "status";

export class ChatView extends ItemView {
  private contextEl!: HTMLDivElement;
  private emptyStateEl!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private inputEl!: HTMLTextAreaElement;
  private sendButtonEl!: HTMLButtonElement;
  private cancelButtonEl!: HTMLButtonElement;
  private newChatButtonEl!: HTMLButtonElement;
  private statusBar: StatusBar | null = null;
  private sessionStarted = false;
  private isSending = false;
  private wasCancelled = false;
  private selectionChangeTimer: number | null = null;
  private contextUsage: ContextUsage = {
    localCharsUsed: 0,
    localCharsLimit: NOTE_CHAR_LIMIT,
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

    const trayEl = contentEl.createDiv({ cls: "obsidian-codex-tray" });
    const trayHeaderEl = trayEl.createDiv({ cls: "obsidian-codex-tray-header" });
    this.contextEl = trayHeaderEl.createDiv({ cls: "obsidian-codex-context" });

    const trayActionsEl = trayHeaderEl.createDiv({ cls: "obsidian-codex-tray-actions" });
    this.newChatButtonEl = this.createTrayActionButton(
      trayActionsEl,
      "plus",
      "New Chat",
      () => this.resetConversation()
    );
    this.cancelButtonEl = this.createTrayActionButton(
      trayActionsEl,
      "square",
      "Cancel current turn",
      () => this.handleCancel()
    );
    this.sendButtonEl = this.createTrayActionButton(
      trayActionsEl,
      "arrow-up",
      "Send message",
      () => void this.handleSend(),
      true
    );

    const inputShellEl = trayEl.createDiv({ cls: "obsidian-codex-input-shell" });
    this.inputEl = inputShellEl.createEl("textarea", {
      cls: "obsidian-codex-input"
    });
    this.inputEl.placeholder = "How can I help you today?";
    this.inputEl.rows = 5;

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
    primary = false
  ): HTMLButtonElement {
    const buttonEl = containerEl.createEl("button", {
      cls: primary
        ? "obsidian-codex-tray-action is-primary"
        : "obsidian-codex-tray-action"
    });
    buttonEl.type = "button";
    buttonEl.ariaLabel = label;
    buttonEl.title = label;
    setIcon(buttonEl, icon);
    buttonEl.addEventListener("click", onClick);
    return buttonEl;
  }

  private updateComposerState(): void {
    const hasPendingInput = this.inputEl.value.trim().length > 0;
    this.sendButtonEl.disabled = this.isSending || !hasPendingInput;
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
    this.sessionStarted = false;
    this.wasCancelled = false;
    this.messagesEl.empty();
    this.contextUsage = {
      ...this.contextUsage,
      sdkInputTokens: null,
      sdkCachedInputTokens: null,
      sdkOutputTokens: null
    };
    this.setSendingState(false);
    this.statusBar?.updateContextUsage(this.contextUsage);
    this.refreshCanvasState();
    void this.updateContextSummary();
  }

  private appendMessage(role: ChatMessageRole, text: string): HTMLDivElement {
    const messageEl = this.messagesEl.createDiv({
      cls: `obsidian-codex-message is-${role}`
    });
    messageEl.setText(text);
    this.refreshCanvasState();
    this.scrollMessagesToBottom();
    return messageEl;
  }

  private appendThinkingIndicator(): HTMLDivElement {
    const thinkingEl = this.messagesEl.ownerDocument.createElement("div");
    thinkingEl.className = "obsidian-codex-thinking";

    const labelEl = thinkingEl.ownerDocument.createElement("span");
    labelEl.className = "obsidian-codex-thinking-label";
    labelEl.textContent = "Thinking";
    thinkingEl.appendChild(labelEl);

    const dotsEl = thinkingEl.ownerDocument.createElement("div");
    dotsEl.className = "obsidian-codex-thinking-dots";
    for (let index = 0; index < 3; index += 1) {
      const dotEl = thinkingEl.ownerDocument.createElement("span");
      dotsEl.appendChild(dotEl);
    }
    thinkingEl.appendChild(dotsEl);

    this.messagesEl.appendChild(thinkingEl);
    this.refreshCanvasState();
    this.scrollMessagesToBottom();
    return thinkingEl;
  }

  private setSendingState(isSending: boolean): void {
    this.isSending = isSending;
    this.updateComposerState();
  }

  private async updateContextSummary(): Promise<void> {
    const context = await this.collectContext("");
    const summaryLines = getContextSummaryLines({
      vaultRootPath: this.getVaultRootPath(),
      activeNotePath: context.activeNotePath,
      selectionText: context.selectionText
    });

    this.contextEl.replaceChildren();
    for (const line of summaryLines) {
      const lineEl = this.contextEl.createDiv({ cls: "obsidian-codex-context-line" });
      lineEl.createSpan({ cls: "obsidian-codex-context-label", text: `${line.label}:` });
      lineEl.createSpan({ cls: "obsidian-codex-context-value", text: line.value });
    }

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
      this.plugin.codexService.createThread(threadOptions);
      this.sessionStarted = true;
    }

    this.wasCancelled = false;
    this.appendMessage("user", userInput);
    const thinkingEl = this.appendThinkingIndicator();
    this.inputEl.value = "";
    this.setSendingState(true);

    const eventElements = new Map<string, HTMLElement>();
    let sawVisibleAssistantEvent = false;
    let streamErrorHandled = false;

    const removeThinkingIndicator = (): void => {
      if (thinkingEl.parentElement) {
        thinkingEl.remove();
        this.refreshCanvasState();
      }
    };

    try {
      for await (const event of this.plugin.codexService.sendMessage(prompt, threadOptions)) {
        const mapped = mapThreadEvent(event);

        if (mapped.type === "noop" || mapped.type === "turn_started") {
          continue;
        }

        if (mapped.type === "turn_completed") {
          this.contextUsage = {
            ...this.contextUsage,
            sdkInputTokens: mapped.usage.inputTokens,
            sdkCachedInputTokens: mapped.usage.cachedInputTokens,
            sdkOutputTokens: mapped.usage.outputTokens
          };
          this.statusBar?.updateContextUsage(this.contextUsage);
          continue;
        }

        if (mapped.type === "error" || mapped.type === "turn_failed") {
          removeThinkingIndicator();
          renderEventCard(this.messagesEl, mapped);
          this.refreshCanvasState();
          this.scrollMessagesToBottom();
          streamErrorHandled = true;
          throw new Error(mapped.message);
        }

        removeThinkingIndicator();
        sawVisibleAssistantEvent = true;
        const existingEl = "itemId" in mapped ? eventElements.get(mapped.itemId) : undefined;
        const cardEl = renderEventCard(
          this.messagesEl,
          mapped as Exclude<
            MappedEvent,
            { type: "turn_started" | "turn_completed" | "turn_failed" | "error" | "noop" }
          >,
          existingEl
        );
        if ("itemId" in mapped) {
          eventElements.set(mapped.itemId, cardEl);
        }
        this.refreshCanvasState();
        this.scrollMessagesToBottom();
      }

      removeThinkingIndicator();

      if (!sawVisibleAssistantEvent && !streamErrorHandled) {
        this.appendMessage("status", "No response received.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.wasCancelled) {
        removeThinkingIndicator();
        this.appendMessage("status", "Interrupted.");
      } else if (!streamErrorHandled) {
        removeThinkingIndicator();
        renderEventCard(this.messagesEl, { type: "error", message });
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

  private async collectContext(userInput: string): Promise<ContextInput> {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = markdownView?.file ?? this.app.workspace.getActiveFile() ?? undefined;

    if (markdownView?.editor && file) {
      const selectionText = markdownView.editor.getSelection() || undefined;
      return {
        userInput,
        activeNotePath: file.path,
        activeNoteContent: markdownView.editor.getValue(),
        selectionText
      };
    }

    if (file) {
      return {
        userInput,
        activeNotePath: file.path,
        activeNoteContent: await this.app.vault.cachedRead(file)
      };
    }

    return { userInput };
  }
}
