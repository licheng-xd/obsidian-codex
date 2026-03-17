import {
  FileSystemAdapter,
  ItemView,
  MarkdownView,
  Notice,
  WorkspaceLeaf
} from "obsidian";
import { buildContextPayload, type ContextInput } from "./context-builder";
import { formatContextSummary } from "./context-summary";
import { CODEX_ICON } from "./codex-icon";
import { mapThreadEvent } from "./codex-service";
import type ObsidianCodexPlugin from "./main";

export const CODEX_CHAT_VIEW_TYPE = "obsidian-codex-chat";
const SELECTION_CHANGE_DEBOUNCE_MS = 120;

type ChatMessageRole = "user" | "assistant" | "status";

export class ChatView extends ItemView {
  private contextEl!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private inputEl!: HTMLTextAreaElement;
  private sendButtonEl!: HTMLButtonElement;
  private cancelButtonEl!: HTMLButtonElement;
  private activeAssistantEl: HTMLDivElement | null = null;
  private sessionStarted = false;
  private isSending = false;
  private wasCancelled = false;
  private selectionChangeTimer: number | null = null;

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
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
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
  }

  private resetConversation(): void {
    this.plugin.codexService.cancelCurrentTurn();
    this.sessionStarted = false;
    this.wasCancelled = false;
    this.activeAssistantEl = null;
    this.messagesEl.empty();
    this.appendMessage("status", "Started a fresh Codex conversation.");
    this.setSendingState(false);
  }

  private appendMessage(role: ChatMessageRole, text: string): HTMLDivElement {
    const messageEl = this.messagesEl.createDiv({
      cls: `obsidian-codex-message is-${role}`
    });
    messageEl.setText(text);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return messageEl;
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

    if (!this.sessionStarted) {
      this.plugin.codexService.createThread(threadOptions);
      this.sessionStarted = true;
    }

    this.wasCancelled = false;
    this.appendMessage("user", userInput);
    this.activeAssistantEl = this.appendMessage("assistant", "Thinking...");
    this.inputEl.value = "";
    this.setSendingState(true);

    let assistantText = "";

    try {
      for await (const event of this.plugin.codexService.sendMessage(prompt, threadOptions)) {
        if (event.type === "turn.failed") {
          throw new Error(event.error.message);
        }

        const mapped = mapThreadEvent(event);
        if (mapped.type === "text" && mapped.text !== undefined) {
          assistantText = mapped.text;
          this.activeAssistantEl.setText(assistantText);
        }

        if (mapped.type === "error" && mapped.message) {
          throw new Error(mapped.message);
        }
      }

      if (!assistantText) {
        this.activeAssistantEl.setText("No response received.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.wasCancelled) {
        const interruptedText = assistantText
          ? `${assistantText}\n\nInterrupted.`
          : "Interrupted.";
        this.activeAssistantEl.setText(interruptedText);
      } else {
        this.activeAssistantEl.addClass("is-error");
        this.activeAssistantEl.setText(`Error: ${message}`);
        new Notice(`Codex request failed: ${message}`, 8000);
      }
    } finally {
      this.activeAssistantEl = null;
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

  private buildThreadOptions(): {
    workingDirectory?: string;
    skipGitRepoCheck: boolean;
    sandboxMode: ObsidianCodexPlugin["settings"]["sandboxMode"];
    approvalPolicy: ObsidianCodexPlugin["settings"]["approvalPolicy"];
  } {
    return {
      workingDirectory: this.getVaultRootPath(),
      skipGitRepoCheck: this.plugin.settings.skipGitRepoCheck,
      sandboxMode: this.plugin.settings.sandboxMode,
      approvalPolicy: this.plugin.settings.approvalPolicy
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
