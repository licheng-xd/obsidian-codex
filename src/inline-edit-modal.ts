import { Modal, Notice } from "obsidian";
import type { App } from "obsidian";
import type { InlineEditMode, InlineEditReviewModel } from "./inline-edit";

function getInstructionModalCopy(mode: InlineEditMode): { title: string; description: string; submitLabel: string } {
  if (mode === "rewrite-selection") {
    return {
      title: "Rewrite selection",
      description: "Describe how the selected text should be rewritten.",
      submitLabel: "Generate rewrite"
    };
  }

  return {
    title: "Insert at cursor",
    description: "Describe what should be inserted at the current cursor position.",
    submitLabel: "Generate insert"
  };
}

export class InlineEditInstructionModal extends Modal {
  private readonly mode: InlineEditMode;
  private resolvePromise: ((instruction: string | null) => void) | null = null;
  private settled = false;

  constructor(app: App, mode: InlineEditMode) {
    super(app);
    this.mode = mode;
  }

  async waitForInstruction(): Promise<string | null> {
    return await new Promise<string | null>((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    const copy = getInstructionModalCopy(this.mode);
    contentEl.empty();
    this.setTitle(copy.title);

    contentEl.createEl("p", {
      cls: "obsidian-codex-inline-edit-modal-copy",
      text: copy.description
    });

    const inputEl = contentEl.createEl("textarea", {
      cls: "obsidian-codex-inline-edit-textarea"
    });
    inputEl.rows = 5;
    inputEl.placeholder = "Describe the edit";
    window.setTimeout(() => inputEl.focus(), 0);

    const actionsEl = contentEl.createDiv({ cls: "obsidian-codex-inline-edit-actions" });
    const cancelButtonEl = actionsEl.createEl("button", {
      text: "Cancel"
    });
    cancelButtonEl.type = "button";
    cancelButtonEl.addEventListener("click", () => this.close());

    const submitButtonEl = actionsEl.createEl("button", {
      cls: "mod-cta",
      text: copy.submitLabel
    });
    submitButtonEl.type = "button";
    submitButtonEl.addEventListener("click", () => {
      const instruction = inputEl.value.trim();
      if (!instruction) {
        new Notice("Instruction cannot be empty.", 4000);
        inputEl.focus();
        return;
      }

      this.settled = true;
      this.resolvePromise?.(instruction);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) {
      this.resolvePromise?.(null);
    }
    this.resolvePromise = null;
    this.settled = false;
  }
}

export class InlineEditReviewModal extends Modal {
  private readonly review: InlineEditReviewModel;
  private resolvePromise: ((confirmed: boolean) => void) | null = null;
  private settled = false;

  constructor(app: App, review: InlineEditReviewModel) {
    super(app);
    this.review = review;
  }

  async waitForDecision(): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle(this.review.title);

    const sectionsEl = contentEl.createDiv({ cls: "obsidian-codex-inline-edit-review" });

    const originalSectionEl = sectionsEl.createDiv({ cls: "obsidian-codex-inline-edit-section" });
    originalSectionEl.createEl("h3", {
      cls: "obsidian-codex-inline-edit-heading",
      text: this.review.originalLabel
    });
    originalSectionEl.createEl("pre", {
      cls: "obsidian-codex-inline-edit-pre",
      text: this.review.originalText || "(Empty)"
    });

    const proposedSectionEl = sectionsEl.createDiv({ cls: "obsidian-codex-inline-edit-section" });
    proposedSectionEl.createEl("h3", {
      cls: "obsidian-codex-inline-edit-heading",
      text: this.review.proposedLabel
    });
    proposedSectionEl.createEl("pre", {
      cls: "obsidian-codex-inline-edit-pre",
      text: this.review.proposedText || "(Empty)"
    });

    const actionsEl = contentEl.createDiv({ cls: "obsidian-codex-inline-edit-actions" });
    const cancelButtonEl = actionsEl.createEl("button", {
      text: "Cancel"
    });
    cancelButtonEl.type = "button";
    cancelButtonEl.addEventListener("click", () => this.close());

    const applyButtonEl = actionsEl.createEl("button", {
      cls: "mod-cta",
      text: this.review.applyLabel
    });
    applyButtonEl.type = "button";
    applyButtonEl.addEventListener("click", () => {
      this.settled = true;
      this.resolvePromise?.(true);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) {
      this.resolvePromise?.(false);
    }
    this.resolvePromise = null;
    this.settled = false;
  }
}
