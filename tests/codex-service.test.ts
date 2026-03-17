import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  CodexService,
  finalizeCodexProbeResult,
  mapThreadEvent,
  probeCodexCli,
  type CodexClientLike,
  type ThreadLike
} from "../src/codex-service";
import type { CodexOptions, ThreadEvent, ThreadOptions, TurnOptions } from "@openai/codex-sdk";

function createEventStream(events: ThreadEvent[]): AsyncGenerator<ThreadEvent> {
  return (async function* () {
    for (const event of events) {
      yield event;
    }
  })();
}

function createFakeThread(
  events: ThreadEvent[] = [],
  onRunStreamed?: (input: string, turnOptions?: TurnOptions) => void
): ThreadLike {
  return {
    async runStreamed(input: string, turnOptions?: TurnOptions) {
      onRunStreamed?.(input, turnOptions);
      return { events: createEventStream(events) };
    }
  };
}

function createFakeClient(thread: ThreadLike, optionsLog: CodexOptions[]): (options: CodexOptions) => CodexClientLike {
  return (options: CodexOptions) => {
    optionsLog.push(options);
    return {
      startThread(_threadOptions?: ThreadOptions) {
        return thread;
      }
    };
  };
}

describe("finalizeCodexProbeResult", () => {
  it("returns a trimmed version string when stdout is present", () => {
    expect(finalizeCodexProbeResult(0, "codex-cli 0.114.0\n", "")).toBe("codex-cli 0.114.0");
  });

  it("throws when the codex process exits successfully but produces no stdout", () => {
    expect(() => finalizeCodexProbeResult(0, "   \n", "")).toThrow(
      "codex exited successfully but produced no version output"
    );
  });

  it("throws stderr output when the codex process exits with a failure code", () => {
    expect(() => finalizeCodexProbeResult(1, "", "spawn codex ENOENT")).toThrow(
      "spawn codex ENOENT"
    );
  });
});

describe("mapThreadEvent", () => {
  it("maps agent items to text chunks", () => {
    const event: ThreadEvent = {
      type: "item.completed",
      item: { id: "1", type: "agent_message", text: "hello" }
    };

    expect(mapThreadEvent(event)).toEqual({ type: "text", itemId: "1", text: "hello" });
  });

  it("maps reasoning items to reasoning events", () => {
    const event: ThreadEvent = {
      type: "item.updated",
      item: { id: "2", type: "reasoning", text: "thinking" }
    };

    expect(mapThreadEvent(event)).toEqual({ type: "reasoning", itemId: "2", text: "thinking" });
  });

  it("maps command execution items to command events", () => {
    const event: ThreadEvent = {
      type: "item.updated",
      item: {
        id: "3",
        type: "command_execution",
        command: "npm test",
        aggregated_output: "ok",
        status: "completed",
        exit_code: 0
      }
    };

    expect(mapThreadEvent(event)).toEqual({
      type: "command",
      itemId: "3",
      command: "npm test",
      aggregatedOutput: "ok",
      status: "completed",
      exitCode: 0
    });
  });

  it("maps file changes to file change events", () => {
    const event: ThreadEvent = {
      type: "item.completed",
      item: {
        id: "4",
        type: "file_change",
        status: "completed",
        changes: [{ path: "src/main.ts", kind: "update" }]
      }
    };

    expect(mapThreadEvent(event)).toEqual({
      type: "file_change",
      itemId: "4",
      status: "completed",
      changes: [{ path: "src/main.ts", kind: "update" }]
    });
  });

  it("maps MCP tool calls to activity events", () => {
    const event: ThreadEvent = {
      type: "item.updated",
      item: {
        id: "5",
        type: "mcp_tool_call",
        server: "filesystem",
        tool: "read_file",
        arguments: { path: "README.md" },
        status: "in_progress"
      }
    };

    expect(mapThreadEvent(event)).toEqual({
      type: "activity",
      itemId: "5",
      activityType: "mcp_tool_call",
      title: "filesystem/read_file",
      status: "in_progress"
    });
  });

  it("maps web searches to activity events", () => {
    const event: ThreadEvent = {
      type: "item.completed",
      item: { id: "6", type: "web_search", query: "obsidian codex plugin" }
    };

    expect(mapThreadEvent(event)).toEqual({
      type: "activity",
      itemId: "6",
      activityType: "web_search",
      title: "obsidian codex plugin"
    });
  });

  it("maps todo lists to activity events", () => {
    const event: ThreadEvent = {
      type: "item.updated",
      item: {
        id: "7",
        type: "todo_list",
        items: [
          { text: "plan", completed: true },
          { text: "build", completed: false }
        ]
      }
    };

    expect(mapThreadEvent(event)).toEqual({
      type: "activity",
      itemId: "7",
      activityType: "todo_list",
      title: "1/2 tasks complete"
    });
  });

  it("maps item-level errors to error events", () => {
    const event: ThreadEvent = {
      type: "item.completed",
      item: { id: "8", type: "error", message: "item exploded" }
    };

    expect(mapThreadEvent(event)).toEqual({
      type: "error",
      itemId: "8",
      message: "item exploded"
    });
  });

  it("maps completed turns to usage events", () => {
    const event: ThreadEvent = {
      type: "turn.completed",
      usage: {
        input_tokens: 12,
        cached_input_tokens: 3,
        output_tokens: 8
      }
    };

    expect(mapThreadEvent(event)).toEqual({
      type: "turn_completed",
      usage: {
        inputTokens: 12,
        cachedInputTokens: 3,
        outputTokens: 8
      }
    });
  });

  it("maps failed turns to readable error messages", () => {
    const event: ThreadEvent = {
      type: "turn.failed",
      error: { message: "turn failed" }
    };

    expect(mapThreadEvent(event)).toEqual({
      type: "turn_failed",
      message: "turn failed"
    });
  });

  it("maps thread errors to error chunks", () => {
    const event: ThreadEvent = { type: "error", message: "boom" };

    expect(mapThreadEvent(event)).toEqual({ type: "error", message: "boom" });
  });
});

describe("CodexService", () => {
  const tempPathsToCleanup: string[] = [];

  function createEnvNodeCodexFixture(): { codexPath: string; nodeBinDir: string } {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), "obsidian-codex-"));
    tempPathsToCleanup.push(fixtureDir);

    const codexPath = path.join(fixtureDir, "codex");
    const nodePath = path.join(fixtureDir, "node");

    writeFileSync(codexPath, "#!/usr/bin/env node\nthis is not valid javascript;\n", "utf8");
    writeFileSync(nodePath, "#!/bin/sh\necho \"codex-cli 9.9.9\"\n", "utf8");
    chmodSync(codexPath, 0o755);
    chmodSync(nodePath, 0o755);

    return { codexPath, nodeBinDir: fixtureDir };
  }

  afterAll(() => {
    for (const tempPath of tempPathsToCleanup) {
      rmSync(tempPath, { recursive: true, force: true });
    }
  });

  it("creates a client with the current codex path from injected config", () => {
    const optionsLog: CodexOptions[] = [];
    const thread = createFakeThread();
    const service = new CodexService({
      getCodexPath: () => "/custom/bin/codex",
      createClient: createFakeClient(thread, optionsLog)
    });

    service.createThread({ workingDirectory: "/vault" });

    expect(optionsLog).toEqual([{ codexPathOverride: "/custom/bin/codex" }]);
  });

  it("recreates the client when the configured codex path changes", () => {
    const optionsLog: CodexOptions[] = [];
    let codexPath = "/custom/bin/codex-a";
    const service = new CodexService({
      getCodexPath: () => codexPath,
      createClient: createFakeClient(createFakeThread(), optionsLog)
    });

    service.createThread({ workingDirectory: "/vault-a" });
    codexPath = "/custom/bin/codex-b";
    service.createThread({ workingDirectory: "/vault-b" });

    expect(optionsLog).toEqual([
      { codexPathOverride: "/custom/bin/codex-a" },
      { codexPathOverride: "/custom/bin/codex-b" }
    ]);
  });

  it("injects the sibling node directory into the SDK env for env-node launcher scripts", () => {
    const fixture = createEnvNodeCodexFixture();
    const optionsLog: CodexOptions[] = [];
    const service = new CodexService({
      getCodexPath: () => fixture.codexPath,
      createClient: createFakeClient(createFakeThread(), optionsLog)
    });

    service.createThread({ workingDirectory: "/vault" });

    expect(optionsLog).toHaveLength(1);
    expect(optionsLog[0].codexPathOverride).toBe(fixture.codexPath);
    expect(optionsLog[0].env?.PATH?.split(path.delimiter)[0]).toBe(fixture.nodeBinDir);
  });

  it("streams events through the active thread", async () => {
    const streamedEvents: ThreadEvent[] = [{ type: "error", message: "boom" }];
    let seenInput = "";
    const service = new CodexService({
      getCodexPath: () => "",
      createClient: createFakeClient(
        createFakeThread(streamedEvents, (input) => {
          seenInput = input;
        }),
        []
      )
    });

    const received: ThreadEvent[] = [];
    for await (const event of service.sendMessage("hello", { workingDirectory: "/vault" })) {
      received.push(event);
    }

    expect(seenInput).toBe("hello");
    expect(received).toEqual(streamedEvents);
  });
});

const runProbeTest = process.platform === "win32" ? it.skip : it;

runProbeTest("probeCodexCli can execute env-node launcher scripts with a sibling node binary", async () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "obsidian-codex-probe-"));
  const originalPath = process.env.PATH;

  try {
    const codexPath = path.join(fixtureDir, "codex");
    const nodePath = path.join(fixtureDir, "node");

    writeFileSync(codexPath, "#!/usr/bin/env node\nthis is not valid javascript;\n", "utf8");
    writeFileSync(nodePath, "#!/bin/sh\necho \"codex-cli 9.9.9\"\n", "utf8");
    chmodSync(codexPath, 0o755);
    chmodSync(nodePath, 0o755);

    process.env.PATH = "/usr/bin:/bin";

    await expect(probeCodexCli(codexPath)).resolves.toBe("codex-cli 9.9.9");
  } finally {
    process.env.PATH = originalPath;
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
