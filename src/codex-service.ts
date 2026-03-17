import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import {
  Codex,
  type CodexOptions,
  type RunStreamedResult,
  type ThreadEvent,
  type ThreadOptions,
  type TurnOptions
} from "@openai/codex-sdk";

const ENV_NODE_SHEBANG = /^#!\s*\/usr\/bin\/env(?:\s+-S)?\s+node(?:\s|$)/;
const NODE_BINARY_NAME = process.platform === "win32" ? "node.exe" : "node";

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

function cloneProcessEnv(envSource: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(envSource)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }

  return env;
}

function prependPathEntry(currentPath: string | undefined, entry: string): string {
  const entries = (currentPath ?? "").split(path.delimiter).filter(Boolean);
  if (!entries.includes(entry)) {
    entries.unshift(entry);
  }

  return entries.join(path.delimiter);
}

function resolveNodeBinDirectory(command: string): string | null {
  const resolvedCommand = command.trim();
  if (!resolvedCommand || !path.isAbsolute(resolvedCommand)) {
    return null;
  }

  try {
    const firstLine = readFileSync(resolvedCommand, "utf8").split(/\r?\n/, 1)[0] ?? "";
    if (!ENV_NODE_SHEBANG.test(firstLine)) {
      return null;
    }
  } catch {
    return null;
  }

  const nodePath = path.join(path.dirname(resolvedCommand), NODE_BINARY_NAME);
  return existsSync(nodePath) ? path.dirname(nodePath) : null;
}

function buildCodexProcessEnv(
  command: string,
  envSource: NodeJS.ProcessEnv = process.env
): Record<string, string> | undefined {
  const nodeBinDirectory = resolveNodeBinDirectory(command);

  if (!nodeBinDirectory) {
    return undefined;
  }

  const env = cloneProcessEnv(envSource);
  env.PATH = prependPathEntry(env.PATH, nodeBinDirectory);
  return env;
}

export async function probeCodexCli(command = "codex"): Promise<string> {
  return await new Promise((resolve, reject) => {
    const resolvedCommand = command.trim() || "codex";
    const env = buildCodexProcessEnv(resolvedCommand);
    const child = env
      ? spawn(resolvedCommand, ["--version"], { env })
      : spawn(resolvedCommand, ["--version"]);
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
      const clientOptions: CodexOptions = {};
      const env = buildCodexProcessEnv(codexPath);
      if (codexPath) {
        clientOptions.codexPathOverride = codexPath;
      }
      if (env) {
        clientOptions.env = env;
      }

      this.client = (this.options.createClient ?? createCodexClient)(clientOptions);
      this.clientCodexPath = codexPath;
    }

    return this.client;
  }
}
