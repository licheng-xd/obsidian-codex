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

    expect(mapThreadEvent(event)).toEqual({ type: "text", text: "hello" });
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
