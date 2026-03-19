import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("release distribution source", () => {
  it("exposes release validation and bundle scripts in package.json", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, "../package.json"), "utf8")
    ) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["release:check"]).toBeDefined();
    expect(packageJson.scripts?.["release:bundle"]).toBeDefined();
  });

  it("defines a release workflow triggered by version tags", () => {
    const workflowPath = resolve(__dirname, "../.github/workflows/release.yml");

    expect(existsSync(workflowPath)).toBe(true);

    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("tags:");
    expect(workflow).toContain("- 'v*'");
    expect(workflow).toContain("npm run release:check -- ${GITHUB_REF_NAME}");
    expect(workflow).toContain("npm run release:bundle");
  });

  it("documents GitHub Release as the primary installation path", () => {
    const readme = readFileSync(resolve(__dirname, "../README.md"), "utf8");

    expect(readme).toContain("## 安装");
    expect(readme).toContain("GitHub Release");
    expect(readme).toContain(".obsidian/plugins/obsidian-codex");
    expect(readme).not.toContain("### 1. 从源码构建");
  });
});
