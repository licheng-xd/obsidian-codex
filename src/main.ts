import { Notice, Plugin } from "obsidian";
import { probeCodexCli } from "./codex-service";

export default class ObsidianCodexPlugin extends Plugin {
  async onload(): Promise<void> {
    this.addCommand({
      id: "obsidian-codex-open-placeholder",
      name: "Open Obsidian Codex",
      callback: () => {}
    });

    this.addCommand({
      id: "obsidian-codex-verify-runtime",
      name: "Verify Codex Runtime",
      callback: async () => {
        try {
          const version = await probeCodexCli();
          new Notice(`Codex available: ${version}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          new Notice(`Codex probe failed: ${message}`, 8000);
        }
      }
    });
  }
}
