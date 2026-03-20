import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  IMAGE_ATTACHMENT_MAX_BYTES,
  createPastedImagePath,
  deletePastedImage,
  getPastedImageCacheDirectory,
  validatePastedImage,
  writePastedImage
} from "../src/pasted-image-store";

const tempDirectories: string[] = [];

afterEach(() => {
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop();
    if (directory) {
      try {
        rmSync(directory, { recursive: true, force: true });
      } catch {
        // Ignore cleanup failures in tests.
      }
    }
  }
});

function createTempRoot(): string {
  const directory = mkdtempSync(join(tmpdir(), "codexian-paste-"));
  tempDirectories.push(directory);
  return directory;
}

describe("pasted-image-store", () => {
  it("uses the plugin cache directory inside the configured vault config dir", () => {
    expect(getPastedImageCacheDirectory("/vault", ".obsidian")).toBe(
      "/vault/.obsidian/plugins/codexian/.cache/pasted-images"
    );
  });

  it("supports custom vault config directories", () => {
    expect(getPastedImageCacheDirectory("/vault", ".config/obsidian")).toBe(
      "/vault/.config/obsidian/plugins/codexian/.cache/pasted-images"
    );
  });

  it("creates a deterministic file path for a pasted image", () => {
    expect(createPastedImagePath("/vault", ".obsidian", "image/png", "2026-03-20T05:00:00.000Z")).toBe(
      "/vault/.obsidian/plugins/codexian/.cache/pasted-images/paste-2026-03-20T05-00-00-000Z.png"
    );
  });

  it("rejects unsupported mime types", () => {
    expect(() => validatePastedImage("application/pdf", 128)).toThrow("Unsupported pasted image type");
  });

  it("rejects oversized pasted images", () => {
    expect(() => validatePastedImage("image/png", IMAGE_ATTACHMENT_MAX_BYTES + 1)).toThrow(
      "Pasted image exceeds the size limit"
    );
  });

  it("writes the pasted image to disk", () => {
    const root = createTempRoot();
    const imageBuffer = Buffer.from([1, 2, 3, 4]);
    const writtenPath = writePastedImage(root, ".obsidian", imageBuffer, "image/png", "2026-03-20T05:00:00.000Z");

    expect(readFileSync(writtenPath)).toEqual(imageBuffer);
  });

  it("deletes a pasted image by its vault-relative path", () => {
    const root = createTempRoot();
    const imageBuffer = Buffer.from([1, 2, 3, 4]);
    const writtenPath = writePastedImage(root, ".obsidian", imageBuffer, "image/png", "2026-03-20T05:00:00.000Z");

    deletePastedImage(root, ".obsidian/plugins/codexian/.cache/pasted-images/paste-2026-03-20T05-00-00-000Z.png");

    expect(() => readFileSync(writtenPath)).toThrow();
  });
});
