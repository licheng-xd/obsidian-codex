import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import * as path from "node:path";

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif"
};

export const IMAGE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export function getPastedImageCacheDirectory(vaultRootPath: string): string {
  return path.join(
    vaultRootPath,
    ".obsidian",
    "plugins",
    "codexian",
    ".cache",
    "pasted-images"
  );
}

export function validatePastedImage(mimeType: string, sizeBytes: number): void {
  if (!IMAGE_EXTENSION_BY_MIME[mimeType]) {
    throw new Error(`Unsupported pasted image type: ${mimeType}`);
  }

  if (sizeBytes > IMAGE_ATTACHMENT_MAX_BYTES) {
    throw new Error(`Pasted image exceeds the size limit of ${IMAGE_ATTACHMENT_MAX_BYTES} bytes.`);
  }
}

function normalizeTimestamp(timestamp: string): string {
  return timestamp.replaceAll(":", "-").replaceAll(".", "-");
}

export function createPastedImagePath(
  vaultRootPath: string,
  mimeType: string,
  timestamp = new Date().toISOString()
): string {
  validatePastedImage(mimeType, 0);
  const extension = IMAGE_EXTENSION_BY_MIME[mimeType];
  return path.join(
    getPastedImageCacheDirectory(vaultRootPath),
    `paste-${normalizeTimestamp(timestamp)}.${extension}`
  );
}

export function writePastedImage(
  vaultRootPath: string,
  bytes: Uint8Array,
  mimeType: string,
  timestamp = new Date().toISOString()
): string {
  validatePastedImage(mimeType, bytes.byteLength);

  const targetPath = createPastedImagePath(vaultRootPath, mimeType, timestamp);
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, bytes);
  return targetPath;
}

export function deletePastedImage(vaultRootPath: string, imagePath: string): void {
  const targetPath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(vaultRootPath, imagePath);

  try {
    unlinkSync(targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
