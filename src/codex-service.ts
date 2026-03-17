import { spawn } from "node:child_process";

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
