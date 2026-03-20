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

  it("activates vault link opening after rendering assistant markdown", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain("this.activateRenderedAssistantLinks(responseEl, this.getMarkdownSourcePath());");
    expect(source).toContain("this.activateRenderedAssistantLinks(cardEl, this.getMarkdownSourcePath());");
    expect(source).toContain("this.app.workspace.openLinkText(linktext, linkSourcePath)");
  });

  it("wires paste handling, mention updates, and attachment context into the composer", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain('this.registerDomEvent(this.inputEl, "paste", (event: ClipboardEvent) => {');
    expect(source).toContain("void this.handleInputPaste(event);");
    expect(source).toContain('this.registerDomEvent(this.inputEl, "input", () => this.handleComposerInput());');
    expect(source).toContain("attachments: await this.resolveContextAttachments()");
  });

  it("renders attachment and mention containers inside the input shell", () => {
    const source = readFileSync(resolve(__dirname, "../src/chat-view.ts"), "utf8");

    expect(source).toContain('this.mentionDropdownEl = inputShellEl.createDiv({ cls: "obsidian-codex-mention-dropdown" });');
    expect(source).toContain('this.attachmentStripEl = inputShellEl.createDiv({ cls: "obsidian-codex-attachment-strip" });');
  });
});
