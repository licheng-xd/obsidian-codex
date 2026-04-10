import {
  VAULT_ROOT_DIRECTORY,
  type VaultSaveTargetPlan
} from "./vault-save-planner";
import type { PersistentContextItem } from "./chat-session";
import {
  isNotePathExplicitlyAttached,
  type ComposerAttachment
} from "./composer-attachments";

export interface ResolvedPersistentContextItem extends PersistentContextItem {
  readonly content?: string;
}

export interface ContextInput {
  userInput: string;
  activeNotePath?: string;
  activeNoteContent?: string;
  selectionText?: string;
  persistentContextItems?: ResolvedPersistentContextItem[];
  attachments?: ComposerAttachment[];
  saveTargetPlan?: VaultSaveTargetPlan;
}

export const NOTE_CHAR_LIMIT = 4000;
export const THREAD_CONTEXT_CHAR_LIMIT = 40000;
export const FILE_ATTACHMENT_CHAR_LIMIT = 1500;
export const MAX_FILE_ATTACHMENTS = 5;

export function omitActiveNoteContext(input: ContextInput): ContextInput {
  return {
    ...input,
    activeNoteContent: undefined
  };
}

function sanitizeNoteContent(note: string, selection?: string): string {
  let sanitized = note;
  if (selection) {
    sanitized = sanitized.replace(selection, "");
  }
  return sanitized.slice(0, NOTE_CHAR_LIMIT);
}

function buildNoteExcerpt(input: Pick<ContextInput, "activeNotePath" | "activeNoteContent" | "selectionText">): string {
  if (!input.activeNoteContent || !input.activeNotePath) {
    return "";
  }

  return sanitizeNoteContent(input.activeNoteContent, input.selectionText).trim();
}

interface ReferencedFileContext {
  readonly path: string;
  readonly content: string;
}

function collectReferencedFileContext(input: Pick<ContextInput, "persistentContextItems" | "attachments">): ReferencedFileContext[] {
  const referencedFiles: ReferencedFileContext[] = [];
  const seenPaths = new Set<string>();

  for (const item of input.persistentContextItems ?? []) {
    const content = (item.content ?? "").slice(0, FILE_ATTACHMENT_CHAR_LIMIT).trim();
    if (!content || seenPaths.has(item.path)) {
      continue;
    }

    referencedFiles.push({
      path: item.path,
      content
    });
    seenPaths.add(item.path);
  }

  for (const attachment of input.attachments ?? []) {
    if (attachment.kind !== "vault-file") {
      continue;
    }

    const content = (attachment.content ?? "").slice(0, FILE_ATTACHMENT_CHAR_LIMIT).trim();
    if (!content || seenPaths.has(attachment.path)) {
      continue;
    }

    referencedFiles.push({
      path: attachment.path,
      content
    });
    seenPaths.add(attachment.path);
  }

  return referencedFiles.slice(0, MAX_FILE_ATTACHMENTS);
}

function buildReferencedFileAttachments(input: Pick<ContextInput, "persistentContextItems" | "attachments">): string {
  const fileAttachments = collectReferencedFileContext(input);

  if (fileAttachments.length === 0) {
    return "";
  }

  return [
    "Referenced files:",
    ...fileAttachments.map((attachment) => `- path: ${attachment.path}\n  content:\n${attachment.content}`)
  ].join("\n");
}

function buildAttachedImagesSection(attachments: ReadonlyArray<ComposerAttachment> | undefined): string {
  const imageAttachments = attachments?.filter(
    (attachment): attachment is Extract<ComposerAttachment, { kind: "pasted-image" }> => attachment.kind === "pasted-image"
  );

  if (!imageAttachments || imageAttachments.length === 0) {
    return "";
  }

  return [
    "Attached images:",
    "If attached images are relevant, inspect them directly from the provided local paths.",
    ...imageAttachments.map((attachment) => {
      const dimensions =
        typeof attachment.width === "number" && typeof attachment.height === "number"
          ? `${attachment.width}x${attachment.height}`
          : "unknown";

      return [
        `- path: ${attachment.path}`,
        `  mime: ${attachment.mimeType}`,
        `  size: ${attachment.sizeBytes} bytes`,
        `  dimensions: ${dimensions}`
      ].join("\n");
    })
  ].join("\n");
}

function formatSaveDirectory(path: string): string {
  return path === VAULT_ROOT_DIRECTORY ? "vault root" : path;
}

function buildSaveGuidance(plan: VaultSaveTargetPlan): string {
  const fallbackText = plan.fallbackChain.length > 0
    ? plan.fallbackChain.map(formatSaveDirectory).join(" -> ")
    : "none";

  return [
    "Local save guidance:",
    `- Preferred directory: ${formatSaveDirectory(plan.preferredDirectory)}`,
    `- Reason: ${plan.reason}`,
    `- Confidence: ${plan.confidence}`,
    `- Fallbacks: ${fallbackText}`,
    "- When saving locally, use the preferred directory unless the user explicitly asks for a different location."
  ].join("\n");
}

export function buildContextPayload(input: ContextInput): string {
  const sections: string[] = [`User request:\n${input.userInput}`];

  if (input.selectionText) {
    sections.push(`Selected text:\n${input.selectionText}`);
  }

  const excerpt = buildNoteExcerpt(input);
  const activeNoteAlreadyReferenced =
    input.activeNotePath &&
    (isNotePathExplicitlyAttached(input.attachments ?? [], input.activeNotePath) ||
      (input.persistentContextItems ?? []).some((item) => item.path === input.activeNotePath));
  if (excerpt && input.activeNotePath && !activeNoteAlreadyReferenced) {
    sections.push(`Active note (${input.activeNotePath}):\n${excerpt}`);
  }

  const referencedFiles = buildReferencedFileAttachments(input);
  if (referencedFiles) {
    sections.push(referencedFiles);
  }

  const attachedImages = buildAttachedImagesSection(input.attachments);
  if (attachedImages) {
    sections.push(attachedImages);
  }

  if (input.saveTargetPlan) {
    sections.push(buildSaveGuidance(input.saveTargetPlan));
  }

  return sections.join("\n\n");
}

export function measureLocalContextUsage(input: ContextInput): { used: number; limit: number } {
  const selectionLength = input.selectionText?.length ?? 0;
  const visibleFileAttachments = collectReferencedFileContext(input);
  const noteExcerptLength =
    input.activeNotePath &&
    (isNotePathExplicitlyAttached(input.attachments ?? [], input.activeNotePath) ||
      (input.persistentContextItems ?? []).some((item) => item.path === input.activeNotePath))
      ? 0
      : buildNoteExcerpt(input).length;
  const fileAttachmentLength = visibleFileAttachments
    .reduce((total, attachment) => total + attachment.content.length, 0);

  return {
    used: selectionLength + noteExcerptLength + fileAttachmentLength,
    limit: NOTE_CHAR_LIMIT + FILE_ATTACHMENT_CHAR_LIMIT * visibleFileAttachments.length
  };
}
