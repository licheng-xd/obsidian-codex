import { describe, expect, it } from "vitest";
import {
  addComposerAttachment,
  countAttachmentsByKind,
  hasAttachmentPath,
  isNotePathExplicitlyAttached,
  removeComposerAttachment,
  type ComposerAttachment
} from "../src/composer-attachments";

const fileAttachment: ComposerAttachment = {
  kind: "vault-file",
  id: "file:notes/roadmap.md",
  path: "notes/roadmap.md"
};

const imageAttachment: ComposerAttachment = {
  kind: "pasted-image",
  id: "image:cache/paste-1.png",
  path: ".obsidian/plugins/obsidian-codex/.cache/pasted-images/paste-1.png",
  mimeType: "image/png",
  sizeBytes: 1024,
  width: 640,
  height: 480
};

describe("composer attachments", () => {
  it("does not add duplicate vault-file attachments for the same path", () => {
    expect(addComposerAttachment([fileAttachment], fileAttachment)).toEqual([fileAttachment]);
  });

  it("does not add duplicate pasted-image attachments for the same path", () => {
    expect(addComposerAttachment([imageAttachment], imageAttachment)).toEqual([imageAttachment]);
  });

  it("removes attachments by either id or path", () => {
    const attachments = [fileAttachment, imageAttachment];

    expect(removeComposerAttachment(attachments, fileAttachment.id)).toEqual([imageAttachment]);
    expect(removeComposerAttachment(attachments, imageAttachment.path)).toEqual([fileAttachment]);
  });

  it("can detect whether a path is already attached", () => {
    expect(hasAttachmentPath([fileAttachment], "notes/roadmap.md")).toBe(true);
    expect(hasAttachmentPath([fileAttachment], "notes/other.md")).toBe(false);
  });

  it("tracks whether the active note is already explicitly attached", () => {
    expect(isNotePathExplicitlyAttached([fileAttachment], "notes/roadmap.md")).toBe(true);
    expect(isNotePathExplicitlyAttached([imageAttachment], "notes/roadmap.md")).toBe(false);
  });

  it("counts attachments by kind", () => {
    expect(countAttachmentsByKind([fileAttachment, imageAttachment])).toEqual({
      "vault-file": 1,
      "pasted-image": 1
    });
  });
});
