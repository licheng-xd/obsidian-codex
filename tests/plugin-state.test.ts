import { describe, expect, it } from "vitest";
import { readPersistedPluginData } from "../src/plugin-state";

describe("plugin-state", () => {
  it("reads legacy settings-only payloads without a session", () => {
    const persisted = readPersistedPluginData({
      model: "gpt-5.4",
      skipGitRepoCheck: true
    });

    expect(persisted.settings.model).toBe("gpt-5.4");
    expect(persisted.lastSession).toBeNull();
  });

  it("reads the persisted last session snapshot when present", () => {
    const persisted = readPersistedPluginData({
      settings: {
        model: "gpt-5.3-codex"
      },
      lastSession: {
        threadId: "thread-123",
        entries: [
          { type: "user", text: "hello" },
          {
            type: "assistant",
            metaLabel: "Thought for 3s",
            contentMarkdown: "Hi",
            summaries: [
              {
                label: "已运行 1 个命令",
                lines: ["pwd (Exit 0)"]
              }
            ]
          }
        ],
        contextUsage: {
          threadCharsUsedEstimate: 1200,
          sdkInputTokens: 100,
          sdkCachedInputTokens: 10,
          sdkOutputTokens: 55
        }
      }
    });

    expect(persisted.settings.model).toBe("gpt-5.3-codex");
    expect(persisted.lastSession?.threadId).toBe("thread-123");
    expect(persisted.lastSession?.entries).toHaveLength(2);
    expect(persisted.lastSession?.contextUsage.threadCharsUsedEstimate).toBe(1200);
  });
});
