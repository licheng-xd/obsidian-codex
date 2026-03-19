import { describe, expect, it } from "vitest";
import { readPersistedPluginData, writePersistedPluginData } from "../src/plugin-state";

describe("plugin-state", () => {
  it("reads legacy settings-only payloads without a session history", () => {
    const persisted = readPersistedPluginData({
      model: "gpt-5.4",
      skipGitRepoCheck: true
    });

    expect(persisted.settings.model).toBe("gpt-5.4");
    expect(persisted.recentSessions).toEqual([]);
    expect(persisted.activeSessionId).toBeNull();
  });

  it("reads the persisted session history when present", () => {
    const persisted = readPersistedPluginData({
      settings: {
        model: "gpt-5.3-codex"
      },
      activeSessionId: "thread-123",
      recentSessions: [
        {
          threadId: "thread-123",
          title: "会话主题",
          updatedAt: 1_710_000_000_000,
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
      ]
    });

    expect(persisted.settings.model).toBe("gpt-5.3-codex");
    expect(persisted.activeSessionId).toBe("thread-123");
    expect(persisted.recentSessions).toHaveLength(1);
    expect(persisted.recentSessions[0]?.threadId).toBe("thread-123");
    expect(persisted.recentSessions[0]?.title).toBe("会话主题");
    expect(persisted.recentSessions[0]?.entries).toHaveLength(2);
    expect(persisted.recentSessions[0]?.updatedAt).toBe(1_710_000_000_000);
    expect(persisted.recentSessions[0]?.contextUsage.threadCharsUsedEstimate).toBe(1200);
  });

  it("normalizes legacy raw titles in persisted recent sessions", () => {
    const persisted = readPersistedPluginData({
      recentSessions: [
        {
          threadId: "thread-123",
          title: "Hi",
          updatedAt: 1_710_000_000_000,
          entries: [
            { type: "user", text: "Hi" },
            {
              type: "assistant",
              metaLabel: "Thought for 1s",
              contentMarkdown: "你好",
              summaries: []
            },
            { type: "user", text: "帮我总结这份项目周报" }
          ],
          contextUsage: {
            threadCharsUsedEstimate: 1200,
            sdkInputTokens: 100,
            sdkCachedInputTokens: 10,
            sdkOutputTokens: 55
          }
        }
      ]
    });

    expect(persisted.recentSessions[0]?.title).toBe("项目周报总结");
  });

  it("migrates a legacy last session into session history", () => {
    const persisted = readPersistedPluginData({
      settings: {
        model: "gpt-5.3-codex"
      },
      lastSession: {
        threadId: "thread-legacy",
        entries: [
          { type: "user", text: "legacy hello" }
        ],
        contextUsage: {
          threadCharsUsedEstimate: 900,
          sdkInputTokens: 30,
          sdkCachedInputTokens: 3,
          sdkOutputTokens: 20
        }
      }
    });

    expect(persisted.activeSessionId).toBe("thread-legacy");
    expect(persisted.recentSessions).toHaveLength(1);
    expect(persisted.recentSessions[0]?.threadId).toBe("thread-legacy");
    expect(persisted.recentSessions[0]?.entries[0]).toEqual({
      type: "user",
      text: "legacy hello"
    });
    expect(persisted.recentSessions[0]?.title).toBe("legacy hello");
    expect(persisted.recentSessions[0]?.updatedAt).toBeGreaterThan(0);
  });

  it("writes settings with recent sessions and active session id", () => {
    const persisted = writePersistedPluginData(
      {
        model: "gpt-5.4",
        codexPath: "codex",
        sandboxMode: "read-only",
        approvalPolicy: "on-request",
        skipGitRepoCheck: false,
        includeActiveNoteContext: false,
        reasoningEffort: "medium",
        yoloMode: false
      },
      [
        {
          threadId: "thread-456",
          title: "hello again",
          updatedAt: 1_710_000_000_999,
          entries: [{ type: "user", text: "hello again" }],
          contextUsage: {
            threadCharsUsedEstimate: 42,
            sdkInputTokens: 12,
            sdkCachedInputTokens: 1,
            sdkOutputTokens: 6
          }
        }
      ],
      "thread-456"
    );

    expect(persisted.activeSessionId).toBe("thread-456");
    expect(persisted.recentSessions).toHaveLength(1);
    expect(persisted.recentSessions[0]?.title).toBe("hello again");
    expect(persisted.recentSessions[0]?.updatedAt).toBe(1_710_000_000_999);
  });
});
