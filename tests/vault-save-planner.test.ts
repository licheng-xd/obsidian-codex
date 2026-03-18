import { describe, expect, it } from "vitest";
import {
  VAULT_ROOT_DIRECTORY,
  deriveCurrentNoteSiblingDirectory,
  planVaultSaveTarget,
  requestLooksLikeLocalSave
} from "../src/vault-save-planner";

describe("planVaultSaveTarget", () => {
  it("falls back to the vault root when nothing else is available", () => {
    const plan = planVaultSaveTarget({
      userInput: "Save this report locally"
    });

    expect(plan.preferredDirectory).toBe(VAULT_ROOT_DIRECTORY);
    expect(plan.reason).toContain("vault root");
    expect(plan.confidence).toBe("low");
    expect(plan.fallbackChain).toEqual([]);
    expect(plan.contentType).toBe("report");
  });

  it("falls back to the current note sibling directory before the vault root", () => {
    const plan = planVaultSaveTarget({
      userInput: "Save this report locally",
      activeNotePath: "Projects/AI/note.md"
    });

    expect(plan.preferredDirectory).toBe("Projects/AI");
    expect(plan.reason).toContain("current note sibling directory");
    expect(plan.confidence).toBe("low");
    expect(plan.fallbackChain).toEqual([VAULT_ROOT_DIRECTORY]);
  });

  it("uses explicit guidance file rules first", () => {
    const plan = planVaultSaveTarget({
      userInput: "Save this report locally",
      activeNotePath: "Notes/today.md",
      guidanceDocuments: [
        {
          path: "README.md",
          content: "- 报告类文档放到 Projects/AI/reports"
        }
      ]
    });

    expect(plan.preferredDirectory).toBe("Projects/AI/reports");
    expect(plan.reason).toContain("README.md");
    expect(plan.confidence).toBe("high");
    expect(plan.fallbackChain).toEqual(["Notes", VAULT_ROOT_DIRECTORY]);
  });

  it("infers a directory from structure and file names when guidance is missing", () => {
    const plan = planVaultSaveTarget({
      userInput: "Save this report locally",
      directorySnapshot: [
        {
          path: "Projects/AI/reports",
          sampleFiles: ["claude-plugin-report.md", "codex-save-analysis.md"]
        },
        {
          path: "Research/papers",
          sampleFiles: ["vault-study.md"]
        }
      ]
    });

    expect(plan.preferredDirectory).toBe("Projects/AI/reports");
    expect(plan.reason).toContain("directory structure");
    expect(plan.confidence).toBe("medium");
  });

  it("prefers the candidate that matches the content type best", () => {
    const plan = planVaultSaveTarget({
      userInput: "Save this meeting summary locally",
      directorySnapshot: [
        {
          path: "Notes/daily",
          sampleFiles: ["2026-03-18.md"]
        },
        {
          path: "Meetings",
          sampleFiles: ["team-sync.md", "weekly-notes.md"]
        }
      ]
    });

    expect(plan.preferredDirectory).toBe("Meetings");
    expect(plan.reason).toContain("meeting note");
    expect(plan.confidence).toBe("medium");
    expect(plan.contentType).toBe("meeting-note");
  });

  it("always returns the required planner fields", () => {
    const plan = planVaultSaveTarget({
      userInput: "Save this locally",
      activeNotePath: "Projects/AI/note.md"
    });

    expect(plan).toMatchObject({
      preferredDirectory: expect.any(String),
      reason: expect.any(String),
      confidence: expect.any(String),
      fallbackChain: expect.any(Array),
      contentType: expect.any(String)
    });
  });
});

describe("deriveCurrentNoteSiblingDirectory", () => {
  it("returns the sibling directory for nested notes", () => {
    expect(deriveCurrentNoteSiblingDirectory("Projects/AI/note.md")).toBe("Projects/AI");
  });

  it("treats root-level notes as the vault root", () => {
    expect(deriveCurrentNoteSiblingDirectory("note.md")).toBe(VAULT_ROOT_DIRECTORY);
  });

  it("returns null when no note is active", () => {
    expect(deriveCurrentNoteSiblingDirectory()).toBeNull();
  });
});

describe("requestLooksLikeLocalSave", () => {
  it("detects explicit local save requests", () => {
    expect(requestLooksLikeLocalSave("把这个报告保存到本地")).toBe(true);
    expect(requestLooksLikeLocalSave("Save this report locally")).toBe(true);
  });

  it("ignores regular chat prompts", () => {
    expect(requestLooksLikeLocalSave("总结一下这个项目")).toBe(false);
  });
});
