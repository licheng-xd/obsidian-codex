import { describe, expect, it } from "vitest";
import {
  deriveSessionTitle,
  getSessionDisplayTitle,
  resolveSessionTitle,
  sanitizePersistedChatSession,
  upsertRecentSession,
  type PersistedChatSession
} from "../src/chat-session";

function createSession(
  threadId: string,
  userText: string,
  updatedAt: number,
  title?: string
): PersistedChatSession {
  return {
    threadId,
    title,
    updatedAt,
    entries: [{ type: "user", text: userText }],
    contextUsage: {
      threadCharsUsedEstimate: 0,
      sdkInputTokens: null,
      sdkCachedInputTokens: null,
      sdkOutputTokens: null
    },
    persistentContextItems: []
  };
}

describe("chat-session", () => {
  it("moves an updated existing session to the front without duplicating it", () => {
    const sessions = [
      createSession("thread-7", "seven", 7),
      createSession("thread-6", "six", 6),
      createSession("thread-5", "five", 5),
      createSession("thread-4", "four", 4),
      createSession("thread-3", "three", 3),
      createSession("thread-2", "two", 2),
      createSession("thread-1", "one", 1)
    ];

    const updated = upsertRecentSession(
      sessions,
      createSession("thread-3", "three updated", 30)
    );

    expect(updated).toHaveLength(7);
    expect(updated[0]?.threadId).toBe("thread-3");
    expect(updated[0]?.entries[0]).toEqual({ type: "user", text: "three updated" });
    expect(updated.filter((session) => session.threadId === "thread-3")).toHaveLength(1);
  });

  it("caps history at seven items when adding a new session", () => {
    const sessions = [
      createSession("thread-7", "seven", 7),
      createSession("thread-6", "six", 6),
      createSession("thread-5", "five", 5),
      createSession("thread-4", "four", 4),
      createSession("thread-3", "three", 3),
      createSession("thread-2", "two", 2),
      createSession("thread-1", "one", 1)
    ];

    const updated = upsertRecentSession(
      sessions,
      createSession("thread-8", "eight", 8)
    );

    expect(updated).toHaveLength(7);
    expect(updated[0]?.threadId).toBe("thread-8");
    expect(updated.map((session) => session.threadId)).not.toContain("thread-1");
  });

  it("derives a display title from the first user message", () => {
    const title = getSessionDisplayTitle(
      createSession("thread-title", "   帮我把这篇周报整理成产品复盘版本   ", 10)
    );

    expect(title).toBe("周报整理为产品复盘");
  });

  it("prefers a persisted session title when present", () => {
    const title = getSessionDisplayTitle(
      createSession("thread-title", "这条消息不该用于展示", 10, "周报整理")
    );

    expect(title).toBe("周报整理");
  });

  it("upgrades a legacy raw title to the new summary title", () => {
    const title = resolveSessionTitle(
      [{ type: "user", text: "帮我翻译这篇英文博客" }],
      "帮我翻译这篇英文博客"
    );

    expect(title).toBe("英文博客翻译");
  });

  it("derives a stable session title from entries for persistence", () => {
    const title = deriveSessionTitle([
      { type: "status", text: "Interrupted." },
      { type: "user", text: "   帮我总结这份项目周报   " },
      {
        type: "assistant",
        metaLabel: "Thought for 1s",
        contentMarkdown: "好的",
        summaries: []
      }
    ]);

    expect(title).toBe("项目周报总结");
  });

  it("builds a concise title for rewrite-style prompts", () => {
    const title = deriveSessionTitle([
      {
        type: "user",
        text: "请你把这份 PRD 改写成面向研发的技术方案"
      }
    ]);

    expect(title).toBe("PRD改写为面向研发的技术方案");
  });

  it("builds a concise title for translate-style prompts", () => {
    const title = deriveSessionTitle([
      {
        type: "user",
        text: "帮我翻译这篇英文博客"
      }
    ]);

    expect(title).toBe("英文博客翻译");
  });

  it("skips low-signal greetings and uses the first meaningful user prompt", () => {
    const title = deriveSessionTitle([
      {
        type: "user",
        text: "Hi"
      },
      {
        type: "assistant",
        metaLabel: "Thought for 1s",
        contentMarkdown: "你好",
        summaries: []
      },
      {
        type: "user",
        text: "帮我总结这份项目周报"
      }
    ]);

    expect(title).toBe("项目周报总结");
  });

  it("falls back to a generic title for greeting-only sessions", () => {
    const title = deriveSessionTitle([
      {
        type: "user",
        text: "Hi"
      }
    ]);

    expect(title).toBe("New chat");
  });

  it("builds a concise title for review prompts", () => {
    const title = deriveSessionTitle([
      {
        type: "user",
        text: "review一下popo-reader这个skill有没有问题"
      }
    ]);

    expect(title).toBe("popo-reader skill 评审");
  });

  it("falls back to a generic title when there is no user message", () => {
    const title = getSessionDisplayTitle({
      threadId: "thread-empty",
      title: undefined,
      updatedAt: 10,
      entries: [
        {
          type: "assistant",
          metaLabel: "Thought for 1s",
          contentMarkdown: "hello",
          summaries: []
        }
      ],
      contextUsage: {
        threadCharsUsedEstimate: 0,
        sdkInputTokens: null,
        sdkCachedInputTokens: null,
        sdkOutputTokens: null
      },
      persistentContextItems: []
    });

    expect(title).toBe("New chat");
  });

  it("defaults missing persistent context items to an empty array for legacy sessions", () => {
    const session = sanitizePersistedChatSession({
      threadId: "thread-legacy",
      updatedAt: 10,
      entries: [{ type: "user", text: "legacy" }],
      contextUsage: {
        threadCharsUsedEstimate: 0,
        sdkInputTokens: null,
        sdkCachedInputTokens: null,
        sdkOutputTokens: null
      }
    });

    expect(session).not.toBeNull();
    expect(session?.persistentContextItems).toEqual([]);
  });

  it("filters invalid persistent context items while keeping valid vault files", () => {
    const session = sanitizePersistedChatSession({
      threadId: "thread-persistent-context",
      updatedAt: 10,
      entries: [{ type: "user", text: "context" }],
      contextUsage: {
        threadCharsUsedEstimate: 0,
        sdkInputTokens: null,
        sdkCachedInputTokens: null,
        sdkOutputTokens: null
      },
      persistentContextItems: [
        {
          kind: "vault-file",
          path: "notes/roadmap.md"
        },
        {
          kind: "vault-file",
          path: ""
        },
        {
          kind: "external-file",
          path: "/tmp/outside.md"
        },
        "invalid"
      ]
    });

    expect(session).not.toBeNull();
    expect(session?.persistentContextItems).toEqual([
      {
        kind: "vault-file",
        path: "notes/roadmap.md"
      }
    ]);
  });

  it("keeps external files only when they are under allowed external roots", () => {
    const session = sanitizePersistedChatSession(
      {
        threadId: "thread-external-context",
        updatedAt: 10,
        entries: [{ type: "user", text: "context" }],
        contextUsage: {
          threadCharsUsedEstimate: 0,
          sdkInputTokens: null,
          sdkCachedInputTokens: null,
          sdkOutputTokens: null
        },
        persistentContextItems: [
          {
            kind: "external-file",
            path: "/Users/demo/projects/specs/plan.md"
          },
          {
            kind: "external-file",
            path: "/Users/demo/private/secret.md"
          }
        ]
      },
      ["/Users/demo/projects"]
    );

    expect(session).not.toBeNull();
    expect(session?.persistentContextItems).toEqual([
      {
        kind: "external-file",
        path: "/Users/demo/projects/specs/plan.md"
      }
    ]);
  });
});
