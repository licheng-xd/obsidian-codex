import { spawn } from "node:child_process";
import { Codex, type Thread, type ThreadEvent, type ThreadOptions, type TurnOptions } from "@openai/codex-sdk";

export function finalizeCodexProbeResult(code: number | null, output: string, error: string): string {
  if (code !== 0) {
    throw new Error(error || `codex exited with code ${code}`);
  }

  const version = output.trim();
  if (!version) {
    throw new Error("codex exited successfully but produced no version output");
  }

  return version;
}

export async function probeCodexCli(command = "codex"): Promise<string> {
  return await new Promise((resolve, reject) => {
    const resolvedCommand = command.trim() || "codex";
    const child = spawn(resolvedCommand, ["--version"]);
    let output = "";
    let error = "";

    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      error += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      try {
        resolve(finalizeCodexProbeResult(code, output, error));
      } catch (probeError) {
        reject(probeError);
      }
    });
  });
}

const codexClient = new Codex({
  codexPathOverride: ""
});

let currentThread: Thread | null = null;
let currentAbortController: AbortController | null = null;

export function mapThreadEvent(event: ThreadEvent): { type: string; text?: string; message?: string } {
  if (event.type === "item.completed" || event.type === "item.updated") {
    const { item } = event;
    if (item.type === "agent_message") {
      return { type: "text", text: item.text };
    }
  }

  if (event.type === "error") {
    return { type: "error", message: event.message };
  }

  return { type: "noop" };
}

function ensureThread(options?: ThreadOptions): Thread {
  if (!currentThread) {
    currentThread = codexClient.startThread(options);
  }

  return currentThread;
}

export function createThread(options: ThreadOptions): Thread {
  currentThread = codexClient.startThread(options);
  currentAbortController = null;
  return currentThread;
}

export async function* sendMessage(input: string, options?: ThreadOptions): AsyncGenerator<ThreadEvent> {
  const thread = ensureThread(options);
  currentAbortController?.abort();
  currentAbortController = new AbortController();
  const turnOptions: TurnOptions = { signal: currentAbortController.signal };
  const result = await thread.runStreamed(input, turnOptions);

  for await (const event of result.events) {
    yield event;
  }
}

export function cancelCurrentTurn(): void {
  currentAbortController?.abort();
  currentAbortController = null;
}
