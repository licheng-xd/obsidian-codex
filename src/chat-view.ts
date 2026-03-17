import {
  FileSystemAdapter,
  ItemView,
  MarkdownView,
  Notice,
  WorkspaceLeaf
} from "obsidian";
import type { ThreadOptions } from "@openai/codex-sdk";
import { shouldSubmitFromKeydown } from "./chat-input";
import {
  NOTE_CHAR_LIMIT,
  buildContextPayload,
  measureLocalContextUsage,
  type ContextInput
} from "./context-builder";
import { formatContextSummary } from "./context-summary";
import { CODEX_ICON } from "./codex-icon";
import { mapThreadEvent } from "./codex-service";
import { renderEventCard } from "./event-cards";
import type ObsidianCodexPlugin from "./main";
import { DEFAULT_SETTINGS, patchPluginSettings, toggleYoloMode } from "./settings";
import { StatusBar } from "./status-bar";
import type { ContextUsage, MappedEvent } from "./types";

export const CODEX_CHAT_VIEW_TYPE = "obsidian-codex-chat";
const SELECTION_CHANGE_DEBOUNCE_MS = 120;

type ChatMessageRole = "user" | "assistant" | "status";

export class ChatView extends ItemView {
  private contextEl!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private inputEl!: HTMLTextAreaElement;
  private sendButtonEl!: HTMLButtonElement;
  private cancelButtonEl!: HTMLButtonElement;
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
    headerEl.createEl("h2", { text: "Obsidian Codex" });

    const clearButtonEl = headerEl.createEl("button", {
      cls: "mod-muted",
      text: "New Chat"
    });
    clearButtonEl.addEventListener("click", () => this.resetConversation());

    this.contextEl = contentEl.createDiv({ cls: "obsidian-codex-context" });
    this.messagesEl = contentEl.createDiv({ cls: "obsidian-codex-messages" });

    const composerEl = contentEl.createDiv({ cls: "obsidian-codex-composer" });
    this.inputEl = composerEl.createEl("textarea", {
      cls: "obsidian-codex-input"
    });
    this.inputEl.placeholder = "Ask Codex about the current note...";
    this.inputEl.rows = 5;

    this.registerDomEvent(this.inputEl, "focus", () => this.updateContextSummary());
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

    const actionsEl = composerEl.createDiv({ cls: "obsidian-codex-actions" });
    this.sendButtonEl = actionsEl.createEl("button", {
      cls: "mod-cta",
      text: "Send"
    });
    this.cancelButtonEl = actionsEl.createEl("button", {
      text: "Cancel"
    });
    this.cancelButtonEl.disabled = true;

    this.sendButtonEl.addEventListener("click", () => {
      void this.handleSend();
    });
    this.cancelButtonEl.addEventListener("click", () => this.handleCancel());

    this.statusBar?.destroy();
    this.statusBar = new StatusBar(
      contentEl,
      this.plugin.settings.model,
      this.plugin.settings.yoloMode,
      {
        onModelChange: async (model) => {
          this.plugin.settings = patchPluginSettings(this.plugin.settings, { model });
          await this.plugin.saveSettings();
          this.statusBar?.updateModel(this.plugin.settings.model);
        },
        onYoloChange: async (enabled) => {
          this.plugin.settings = toggleYoloMode(this.plugin.settings, enabled);
          await this.plugin.saveSettings();
          this.statusBar?.updateYolo(this.plugin.settings.yoloMode);
        }
      }
    );
    this.statusBar.updateContextUsage(this.contextUsage);
  }

  private resetConversation(): void {
    this.plugin.codexService.cancelCurrentTurn();
    this.sessionStarted = false;
    this.wasCancelled = false;
    this.messagesEl.empty();
    this.appendMessage("status", "Started a fresh Codex conversation.");
    this.setSendingState(false);
    this.contextUsage = {
      ...this.contextUsage,
      sdkInputTokens: null,
      sdkCachedInputTokens: null,
      sdkOutputTokens: null
    };
    this.statusBar?.updateContextUsage(this.contextUsage);
    void this.updateContextSummary();
  }

  private appendMessage(role: ChatMessageRole, text: string): HTMLDivElement {
    const messageEl = this.messagesEl.createDiv({
      cls: `obsidian-codex-message is-${role}`
    });
    messageEl.setText(text);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return messageEl;
  }

  private appendThinkingIndicator(): HTMLDivElement {
    const thinkingEl = this.messagesEl.ownerDocument.createElement("div");
    thinkingEl.className = "obsidian-codex-thinking";
    for (let index = 0; index < 3; index += 1) {
      const dotEl = thinkingEl.ownerDocument.createElement("span");
      thinkingEl.appendChild(dotEl);
    }

    this.messagesEl.appendChild(thinkingEl);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return thinkingEl;
  }

  private setSendingState(isSending: boolean): void {
    this.isSending = isSending;
    this.sendButtonEl.disabled = isSending;
    this.cancelButtonEl.disabled = !isSending;
    this.inputEl.disabled = isSending;
  }

  private async updateContextSummary(): Promise<void> {
    const context = await this.collectContext("");
    this.contextEl.setText(
      formatContextSummary({
        vaultRootPath: this.getVaultRootPath(),
        activeNotePath: context.activeNotePath,
        selectionText: context.selectionText
      })
    );
    const localUsage = measureLocalContextUsage(context);
    this.contextUsage = {
      ...this.contextUsage,
      localCharsUsed: localUsage.used,
      localCharsLimit: localUsage.limit
    };
    this.statusBar?.updateContextUsage(this.contextUsage);
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
      thinkingEl.remove();
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
          this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
          streamErrorHandled = true;
          throw new Error(mapped.message);
        }

        removeThinkingIndicator();
        sawVisibleAssistantEvent = true;
        const existingEl = "itemId" in mapped ? eventElements.get(mapped.itemId) : undefined;
        const cardEl = renderEventCard(this.messagesEl, mapped as Exclude<MappedEvent, { type: "turn_started" | "turn_completed" | "turn_failed" | "error" | "noop" }>, existingEl);
        if ("itemId" in mapped) {
          eventElements.set(mapped.itemId, cardEl);
        }
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
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
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
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
