import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = resolve(rootDir, "release");
const manifest = JSON.parse(readFileSync(resolve(rootDir, "manifest.json"), "utf8"));
const requiredFiles = ["main.js", "manifest.json", "styles.css"];

for (const fileName of requiredFiles) {
  if (!existsSync(resolve(rootDir, fileName))) {
    console.error(`Missing required release artifact: ${fileName}`);
    process.exit(1);
  }
}

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });

const copiedFiles = requiredFiles.map((fileName) => {
  const sourcePath = resolve(rootDir, fileName);
  const targetPath = resolve(releaseDir, fileName);

  copyFileSync(sourcePath, targetPath);

  return targetPath;
});

const zipPath = resolve(releaseDir, `${manifest.id}-${manifest.version}.zip`);

try {
  execFileSync("zip", ["-j", zipPath, ...copiedFiles], {
    stdio: "inherit"
  });
} catch (error) {
  console.error("Failed to create release zip. Ensure the `zip` command is available.");
  throw error;
}

console.log(`Release bundle created in ${releaseDir}`);
