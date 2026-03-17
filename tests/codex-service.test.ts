import { describe, expect, it } from "vitest";
import {
  CodexService,
  finalizeCodexProbeResult,
  mapThreadEvent,
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
