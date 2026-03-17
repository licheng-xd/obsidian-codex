import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import {
  Codex,
  type CodexOptions,
  type RunStreamedResult,
  type ThreadEvent,
  type ThreadItem,
  type ThreadOptions,
  type TurnOptions
} from "@openai/codex-sdk";
import type { MappedActivityEvent, MappedEvent, TurnUsage } from "./types";

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

function buildTurnUsage(event: Extract<ThreadEvent, { type: "turn.completed" }>): TurnUsage {
  return {
    inputTokens: event.usage.input_tokens,
    cachedInputTokens: event.usage.cached_input_tokens,
    outputTokens: event.usage.output_tokens
  };
}

function mapActivityItem(item: Extract<ThreadItem, { type: "mcp_tool_call" | "web_search" | "todo_list" }>): MappedActivityEvent {
  if (item.type === "mcp_tool_call") {
    return {
      type: "activity",
      itemId: item.id,
      activityType: "mcp_tool_call",
      title: `${item.server}/${item.tool}`,
      status: item.status
    };
  }

  if (item.type === "web_search") {
    return {
      type: "activity",
      itemId: item.id,
      activityType: "web_search",
      title: item.query
    };
  }

  const completedCount = item.items.filter((todoItem) => todoItem.completed).length;
  return {
    type: "activity",
    itemId: item.id,
    activityType: "todo_list",
    title: `${completedCount}/${item.items.length} tasks complete`
  };
}

function mapThreadItem(item: ThreadItem): MappedEvent {
  switch (item.type) {
    case "agent_message":
      return { type: "text", itemId: item.id, text: item.text };
    case "reasoning":
      return { type: "reasoning", itemId: item.id, text: item.text };
    case "command_execution":
      return {
        type: "command",
        itemId: item.id,
        command: item.command,
        aggregatedOutput: item.aggregated_output,
        status: item.status,
        exitCode: item.exit_code
      };
    case "file_change":
      return {
        type: "file_change",
        itemId: item.id,
        changes: item.changes,
        status: item.status
      };
    case "mcp_tool_call":
    case "web_search":
    case "todo_list":
      return mapActivityItem(item);
    case "error":
      return {
        type: "error",
        itemId: item.id,
        message: item.message
      };
  }
}

export function mapThreadEvent(event: ThreadEvent): MappedEvent {
  switch (event.type) {
    case "item.started":
    case "item.updated":
    case "item.completed":
      return mapThreadItem(event.item);
    case "turn.started":
      return { type: "turn_started" };
    case "turn.completed":
      return { type: "turn_completed", usage: buildTurnUsage(event) };
    case "turn.failed":
      return { type: "turn_failed", message: event.error.message };
    case "error":
      return { type: "error", message: event.message };
    default:
      return { type: "noop" };
  }
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
