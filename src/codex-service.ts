import { spawn } from "node:child_process";

export async function probeCodexCli(command = "codex"): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, ["--version"]);
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
      if (code === 0) {
        resolve(output.trim());
        return;
      }

      reject(new Error(error || `codex exited with code ${code}`));
    });
  });
}
