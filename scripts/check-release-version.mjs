import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(rootDir, relativePath), "utf8"));
}

function normalizeTagVersion(tag) {
  if (!tag) {
    return null;
  }

  return tag.replace(/^refs\/tags\//u, "");
}

const packageJson = readJson("package.json");
const manifest = readJson("manifest.json");
const versions = readJson("versions.json");
const expectedVersion = packageJson.version;
const errors = [];

if (manifest.version !== expectedVersion) {
  errors.push(
    `manifest.json version ${manifest.version} does not match package.json version ${expectedVersion}.`
  );
}

if (!Object.prototype.hasOwnProperty.call(versions, expectedVersion)) {
  errors.push(`versions.json is missing version key ${expectedVersion}.`);
} else if (versions[expectedVersion] !== manifest.minAppVersion) {
  errors.push(
    `versions.json maps ${expectedVersion} to ${versions[expectedVersion]}, expected ${manifest.minAppVersion}.`
  );
}

const tagVersion = normalizeTagVersion(process.argv[2] ?? process.env.GITHUB_REF_NAME);

if (tagVersion?.startsWith("v")) {
  errors.push(`tag version ${tagVersion} must not start with "v". Use ${expectedVersion}.`);
}

if (tagVersion && tagVersion !== expectedVersion) {
  errors.push(`tag version ${tagVersion} does not match package.json version ${expectedVersion}.`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }

  process.exit(1);
}

console.log(`Release version validated: ${expectedVersion}`);
