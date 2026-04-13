import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("chat-view history markup", () => {
  it("renders history items as custom role buttons instead of native buttons", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain('const itemEl = this.historyListEl.createDiv({');
    expect(source).toContain('itemEl.setAttr("role", "button");');
    expect(source).toContain('itemEl.tabIndex = 0;');
  });

  it("upgrades the history popover into a session workbench with an explicit new-session action", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain('this.historyActionsEl = this.historyPopoverEl.createDiv({ cls: "obsidian-codex-history-actions" });');
    expect(source).toContain('text: "New session"');
    expect(source).toContain('this.historyStatusEl = this.historyPopoverEl.createDiv({ cls: "obsidian-codex-history-status" });');
  });

  it("activates vault link opening after rendering assistant markdown", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain("this.activateRenderedAssistantLinks(cardEl, this.getMarkdownSourcePath());");
    expect(source).toContain("this.app.workspace.openLinkText(linktext, linkSourcePath)");
  });

  it("delegates persisted session rendering to the dedicated renderer module", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain('from "./chat-message-renderer"');
    expect(source).toContain("renderPersistedSessionEntries(");
    expect(source).not.toContain("private async renderPersistedAssistantTurn(");
    expect(source).not.toContain("private renderPersistedSummaryItems(");
  });

  it("delegates runtime orchestration to the dedicated runtime controller module", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain('from "./chat-runtime-controller"');
    expect(source).toContain("createChatRuntimeController(");
    expect(source).toContain("this.runtimeController.handleSend()");
    expect(source).toContain("this.runtimeController.handleCancel()");
    expect(source).toContain("this.runtimeController.restoreActiveSession()");
    expect(source).toContain("this.runtimeController.persistActiveSession()");
    expect(source).toContain("this.runtimeController.activatePersistedSession(");
    expect(source).not.toContain("private async handleSend()");
    expect(source).not.toContain("private handleCancel()");
    expect(source).not.toContain("private async restoreActiveSession()");
    expect(source).not.toContain("private async persistActiveSession()");
    expect(source).not.toContain("private async activatePersistedSession(");
  });

  it("wires paste handling, mention updates, and attachment context into the composer", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain('this.registerDomEvent(this.inputEl, "paste", (event: ClipboardEvent) => {');
    expect(source).toContain("void this.handleInputPaste(event);");
    expect(source).toContain('this.registerDomEvent(this.inputEl, "input", () => this.handleComposerInput());');
    expect(source).toContain("attachments: await this.resolveContextAttachments()");
    expect(source).toContain("this.app.vault.configDir");
  });

  it("renders attachment and mention containers inside the input shell", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain('this.mentionDropdownEl = inputShellEl.createDiv({ cls: "obsidian-codex-mention-dropdown" });');
    expect(source).toContain('this.attachmentStripEl = inputShellEl.createDiv({ cls: "obsidian-codex-attachment-strip" });');
    expect(source).toContain("const hasSessionContext = this.persistentContextItems.length > 0;");
    expect(source).toContain("const hasTurnAttachments = this.attachments.length > 0;");
    expect(source).toContain('this.attachmentStripEl.classList.toggle("is-empty", !hasSessionContext && !hasTurnAttachments);');
    expect(source).toContain('text: "Session context"');
    expect(source).toContain('text: this.getSessionContextStateLabel()');
    expect(source).toContain('text: "This turn"');
    expect(source).not.toContain('text: "Use @ or Pin current note to keep files across turns."');
    expect(source).not.toContain('text: "Paste images or add temporary attachments for this message only."');
    expect(source).toContain('Missing from vault');
    expect(source).toContain('"/clear-context"');
    expect(source).toContain("pinCurrentNote()");
  });

  it("routes the minimum slash command set through a shared dispatcher", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain('this.tryHandleSlashCommand(this.inputEl.value)');
    expect(source).toContain('case "/help"');
    expect(source).toContain('case "/pin-current-note"');
    expect(source).toContain('case "/context-status"');
    expect(source).toContain('case "/clear-context"');
    expect(source).toContain("private async tryHandleSlashCommand(input: string): Promise<boolean>");
  });

  it("warns before send when session context files have gone missing from the vault", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain("persistentContextState.missingPaths.length > 0");
    expect(source).toContain("Skipped ${missingCount} missing session context file");
  });

  it("surfaces session context lifecycle feedback for draft and saved sessions", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain('return this.activeSessionId ? "Saved session" : "Draft session";');
    expect(source).toContain('new Notice(`Removed ${getAttachmentBasename(path)} from session context.`, 4000);');
  });

  it("renders a persistent inline edit clarification banner in the tray", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain('this.inlineEditClarificationEl = trayEl.createDiv({ cls: "obsidian-codex-inline-edit-clarification" });');
    expect(source).toContain("showInlineEditClarification(message: string): void");
    expect(source).toContain("clearInlineEditClarification(): void");
  });

  it("refreshes context indicators when vault files are created, renamed, or deleted", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain('this.registerEvent(this.app.vault.on("create", () => this.refreshContextIndicators()));');
    expect(source).toContain('this.registerEvent(this.app.vault.on("rename", () => this.refreshContextIndicators()));');
    expect(source).toContain('this.registerEvent(this.app.vault.on("delete", () => this.refreshContextIndicators()));');
  });

  it("routes external context actions through the status bar only when the feature is enabled", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain("onAddExternalContext: async () => {");
    expect(source).toContain("await this.promptAndAddExternalContext();");
    expect(source).toContain("this.statusBar.updateExternalContextState({");
    expect(source).toContain("enabled: this.plugin.settings.externalContextRootsEnabled");
    expect(source).toContain("window.prompt(\"Absolute file path under an allowed external root\")");
  });

  it("uses the simplified sentence-case placeholder text", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain('this.inputEl.placeholder = "How can I help you today?";');
    expect(source).not.toContain('this.inputEl.placeholder = "很高兴为您服务";');
    expect(source).not.toContain('this.inputEl.placeholder = "Type a prompt";');
  });

  it("clears the composer immediately after send while preserving attachment cleanup hooks", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain("const draftInputValue = this.inputEl.value;");
    expect(source).toContain("const draftAttachments = [...this.attachments];");
    expect(source).toContain('this.inputEl.value = "";');
    expect(source).toContain("this.attachments = [];");
    expect(source).toContain("this.cleanupAttachmentFiles(draftAttachments);");
  });

  it("keeps the assistant turn live while work is still running and mirrors that state in the status bar", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain("this.statusBar?.updateExecutionState(isSending);");
    expect(source).toContain('turn.metaLabelEl.textContent = phase === "working" ? "Working" : "Thinking";');
  });

  it("keeps onClose synchronous while returning a resolved promise for the view lifecycle", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain("onClose(): Promise<void> {");
    expect(source).not.toContain("async onClose(): Promise<void>");
    expect(source).toContain("return Promise.resolve();");
  });
});
