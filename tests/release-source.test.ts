import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
    expect(workflow).toContain("- '*.*.*'");
    expect(workflow).toContain("npm run release:check -- ${GITHUB_REF_NAME}");
    expect(workflow).toContain("npm run release:bundle");
  });

  it("documents GitHub Release as the primary installation path", () => {
    const readme = readFileSync(resolve(__dirname, "../README.md"), "utf8");

    expect(readme).toContain("## 安装");
    expect(readme).toContain("GitHub Release");
    expect(readme).toContain("Vault 配置目录");
    expect(readme).not.toContain("### 1. 从源码构建");
  });

  it("requires a root LICENSE and the community-safe plugin id", () => {
    expect(existsSync(resolve(__dirname, "../LICENSE"))).toBe(true);

    const manifest = JSON.parse(
      readFileSync(resolve(__dirname, "../manifest.json"), "utf8")
    ) as {
      id: string;
      name: string;
    };

    expect(manifest.id).toBe("codexian");
    expect(manifest.name).toBe("Codexian");
  });

  it("accepts bare semver tags and rejects v-prefixed tags", () => {
    const projectRoot = resolve(__dirname, "..");
    const packageJson = JSON.parse(
      readFileSync(resolve(projectRoot, "package.json"), "utf8")
    ) as {
      version: string;
    };
    const expectedVersion = packageJson.version;

    const successOutput = execFileSync("node", ["scripts/check-release-version.mjs", expectedVersion], {
      cwd: projectRoot,
      encoding: "utf8"
    });
    expect(successOutput).toContain(`Release version validated: ${expectedVersion}`);

    expect(() =>
      execFileSync("node", ["scripts/check-release-version.mjs", `v${expectedVersion}`], {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: "pipe"
      })
    ).toThrow();
  });
});
