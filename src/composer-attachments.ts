export interface VaultFileAttachment {
  kind: "vault-file";
  id: string;
  path: string;
  content?: string;
}

export interface PastedImageAttachment {
  kind: "pasted-image";
  id: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
}

export type ComposerAttachment = VaultFileAttachment | PastedImageAttachment;

export interface ComposerAttachmentCounts {
  "vault-file": number;
  "pasted-image": number;
}

function findAttachmentIndex(
  attachments: ReadonlyArray<ComposerAttachment>,
  attachment: ComposerAttachment
): number {
  return attachments.findIndex((candidate) => candidate.kind === attachment.kind && candidate.path === attachment.path);
}

export function addComposerAttachment(
  attachments: ReadonlyArray<ComposerAttachment>,
  attachment: ComposerAttachment
): ComposerAttachment[] {
  if (findAttachmentIndex(attachments, attachment) >= 0) {
    return [...attachments];
  }

  return [...attachments, attachment];
}

export function removeComposerAttachment(
  attachments: ReadonlyArray<ComposerAttachment>,
  target: string
): ComposerAttachment[] {
  return attachments.filter((attachment) => attachment.id !== target && attachment.path !== target);
}

export function hasAttachmentPath(
  attachments: ReadonlyArray<ComposerAttachment>,
  path: string
): boolean {
  return attachments.some((attachment) => attachment.path === path);
}

export function isNotePathExplicitlyAttached(
  attachments: ReadonlyArray<ComposerAttachment>,
  notePath: string | undefined
): boolean {
  if (!notePath) {
    return false;
  }

  return attachments.some((attachment) => attachment.kind === "vault-file" && attachment.path === notePath);
}

export function countAttachmentsByKind(
  attachments: ReadonlyArray<ComposerAttachment>
): ComposerAttachmentCounts {
  return attachments.reduce<ComposerAttachmentCounts>(
    (counts, attachment) => {
      counts[attachment.kind] += 1;
      return counts;
    },
    {
      "vault-file": 0,
      "pasted-image": 0
    }
  );
}
