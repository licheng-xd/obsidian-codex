import {
  Editor,
  FileSystemAdapter,
  MarkdownView,
  Notice,
  type EditorPosition
} from "obsidian";
import { CodexService, mapThreadEvent } from "./codex-service";
import { DEFAULT_SETTINGS, YOLO_APPROVAL_POLICY, YOLO_SANDBOX_MODE } from "./settings";
import type ObsidianCodexPlugin from "./main";
import {
  buildInlineEditPrompt,
  buildInlineEditReview,
  type InlineEditMode,
  unwrapInlineEditResponse
} from "./inline-edit";
import {
  InlineEditInstructionModal,
  InlineEditReviewModal
} from "./inline-edit-modal";

interface InlineEditSnapshot {
  editor: Editor;
  mode: InlineEditMode;
  notePath: string;
  documentText: string;
  rangeFrom: EditorPosition;
  rangeTo: EditorPosition;
  originalText: string;
  rangeStartOffset: number;
  rangeEndOffset: number;
}

function getVaultRootPath(plugin: ObsidianCodexPlugin): string | undefined {
  const adapter = plugin.app.vault.adapter;
  return adapter instanceof FileSystemAdapter ? adapter.getBasePath() : undefined;
}

function createIsolatedCodexService(plugin: ObsidianCodexPlugin): CodexService {
  return new CodexService({
    getCodexPath: () => plugin.settings.codexPath
  });
}

function captureInlineEditSnapshot(
  plugin: ObsidianCodexPlugin,
  mode: InlineEditMode
): InlineEditSnapshot | null {
  const markdownView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
  const file = markdownView?.file;
  const editor = markdownView?.editor;

  if (!markdownView || !file || !editor) {
    new Notice("Open a markdown editor before using inline edit.", 6000);
    return null;
  }

  if (editor.listSelections().length !== 1) {
    new Notice("Inline edit currently supports a single selection or cursor.", 6000);
    return null;
  }

  const documentText = editor.getValue();
  const rangeFrom = mode === "rewrite-selection" ? editor.getCursor("from") : editor.getCursor("head");
  const rangeTo = mode === "rewrite-selection" ? editor.getCursor("to") : rangeFrom;
  const originalText = mode === "rewrite-selection" ? editor.getSelection() : "";

  if (mode === "rewrite-selection" && !originalText.trim()) {
    new Notice("Select some text before running inline rewrite.", 6000);
    return null;
  }

  return {
    editor,
    mode,
    notePath: file.path,
    documentText,
    rangeFrom,
    rangeTo,
    originalText,
    rangeStartOffset: editor.posToOffset(rangeFrom),
    rangeEndOffset: editor.posToOffset(rangeTo)
  };
}

async function requestInlineEditInstruction(
  plugin: ObsidianCodexPlugin,
  mode: InlineEditMode
): Promise<string | null> {
  return await new InlineEditInstructionModal(plugin.app, mode).waitForInstruction();
}

async function generateInlineEditText(
  plugin: ObsidianCodexPlugin,
  snapshot: InlineEditSnapshot,
  instruction: string
): Promise<string> {
  const workingDirectory = getVaultRootPath(plugin);
  if (!workingDirectory) {
    throw new Error("Could not determine the local vault path.");
  }

  const prompt = buildInlineEditPrompt({
    mode: snapshot.mode,
    instruction,
    notePath: snapshot.notePath,
    documentText: snapshot.documentText,
    rangeStart: snapshot.rangeStartOffset,
    rangeEnd: snapshot.rangeEndOffset
  });
  const sandboxMode = plugin.settings.yoloMode
    ? YOLO_SANDBOX_MODE
    : plugin.settings.sandboxMode;
  const approvalPolicy = plugin.settings.yoloMode
    ? YOLO_APPROVAL_POLICY
    : plugin.settings.approvalPolicy;
  const codexService = createIsolatedCodexService(plugin);
  let latestText = "";

  for await (const event of codexService.sendMessage(prompt, {
    model: plugin.settings.model || DEFAULT_SETTINGS.model,
    modelReasoningEffort: plugin.settings.reasoningEffort,
    workingDirectory,
    skipGitRepoCheck: plugin.settings.skipGitRepoCheck,
    sandboxMode,
    approvalPolicy
  })) {
    const mapped = mapThreadEvent(event);
    if (mapped.type === "text") {
      latestText = mapped.text;
      continue;
    }

    if (mapped.type === "error" || mapped.type === "turn_failed") {
      throw new Error(mapped.message);
    }
  }

  return unwrapInlineEditResponse(latestText);
}

function applyInlineEdit(snapshot: InlineEditSnapshot, proposedText: string): void {
  if (snapshot.editor.getValue() !== snapshot.documentText) {
    new Notice("The note changed before apply. Run inline edit again to avoid a stale write.", 8000);
    return;
  }

  if (snapshot.mode === "rewrite-selection") {
    snapshot.editor.replaceRange(proposedText, snapshot.rangeFrom, snapshot.rangeTo, "obsidian-codex-inline-edit");
    const nextEnd = snapshot.editor.offsetToPos(
      snapshot.editor.posToOffset(snapshot.rangeFrom) + proposedText.length
    );
    snapshot.editor.setSelection(snapshot.rangeFrom, nextEnd);
    snapshot.editor.scrollIntoView({ from: snapshot.rangeFrom, to: nextEnd }, true);
    snapshot.editor.focus();
    return;
  }

  snapshot.editor.replaceRange(proposedText, snapshot.rangeFrom, snapshot.rangeFrom, "obsidian-codex-inline-edit");
  const insertEnd = snapshot.editor.offsetToPos(
    snapshot.editor.posToOffset(snapshot.rangeFrom) + proposedText.length
  );
  snapshot.editor.setSelection(snapshot.rangeFrom, insertEnd);
  snapshot.editor.scrollIntoView({ from: snapshot.rangeFrom, to: insertEnd }, true);
  snapshot.editor.focus();
}

export async function runInlineEditCommand(
  plugin: ObsidianCodexPlugin,
  mode: InlineEditMode
): Promise<void> {
  const snapshot = captureInlineEditSnapshot(plugin, mode);
  if (!snapshot) {
    return;
  }

  const instruction = await requestInlineEditInstruction(plugin, mode);
  if (!instruction) {
    return;
  }

  new Notice("Generating inline edit...", 3000);

  let proposedText = "";
  try {
    proposedText = await generateInlineEditText(plugin, snapshot, instruction);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    new Notice(`Inline edit failed: ${message}`, 8000);
    return;
  }

  if (!proposedText.trim()) {
    new Notice("Inline edit returned empty text.", 6000);
    return;
  }

  const confirmed = await new InlineEditReviewModal(
    plugin.app,
    buildInlineEditReview({
      mode,
      originalText: snapshot.originalText,
      proposedText
    })
  ).waitForDecision();

  if (!confirmed) {
    return;
  }

  applyInlineEdit(snapshot, proposedText);
}
