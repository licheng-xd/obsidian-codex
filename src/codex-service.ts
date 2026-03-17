import { spawn } from "node:child_process";
import {
  Codex,
  type CodexOptions,
  type RunStreamedResult,
  type ThreadEvent,
  type ThreadOptions,
  type TurnOptions
} from "@openai/codex-sdk";

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

export interface ThreadLike {
  runStreamed(input: string, turnOptions?: TurnOptions): Promise<RunStreamedResult>;
}

export interface CodexClientLike {
  startThread(options?: ThreadOptions): ThreadLike;
}

export interface CodexServiceOptions {
  getCodexPath: () => string;
  createClient?: (options: CodexOptions) => CodexClientLike;
}

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

function createCodexClient(options: CodexOptions): CodexClientLike {
  return new Codex(options);
}

export class CodexService {
  private client: CodexClientLike | null = null;
  private clientCodexPath = "";
  private currentThread: ThreadLike | null = null;
  private currentAbortController: AbortController | null = null;

  constructor(private readonly options: CodexServiceOptions) {}

  createThread(threadOptions: ThreadOptions): ThreadLike {
    const client = this.getOrCreateClient();
    this.currentThread = client.startThread(threadOptions);
    this.currentAbortController = null;
    return this.currentThread;
  }

  async *sendMessage(input: string, threadOptions?: ThreadOptions): AsyncGenerator<ThreadEvent> {
    const thread = this.ensureThread(threadOptions);
    this.currentAbortController?.abort();
    this.currentAbortController = new AbortController();
    const turnOptions: TurnOptions = { signal: this.currentAbortController.signal };
    const result = await thread.runStreamed(input, turnOptions);

    for await (const event of result.events) {
      yield event;
    }
  }

  cancelCurrentTurn(): void {
    this.currentAbortController?.abort();
    this.currentAbortController = null;
  }

  private ensureThread(threadOptions?: ThreadOptions): ThreadLike {
    const client = this.getOrCreateClient();
    if (!this.currentThread) {
      this.currentThread = client.startThread(threadOptions);
    }

    return this.currentThread;
  }

  private getOrCreateClient(): CodexClientLike {
    const codexPath = this.options.getCodexPath().trim();
    if (!this.client || this.clientCodexPath !== codexPath) {
      this.cancelCurrentTurn();
      this.currentThread = null;
      this.client = (this.options.createClient ?? createCodexClient)(
        codexPath ? { codexPathOverride: codexPath } : {}
      );
      this.clientCodexPath = codexPath;
    }

    return this.client;
  }
}
