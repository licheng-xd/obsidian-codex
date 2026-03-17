import { Plugin } from "obsidian";

export default class ObsidianCodexPlugin extends Plugin {
  async onload(): Promise<void> {
    this.addCommand({
      id: "obsidian-codex-open-placeholder",
      name: "Open Obsidian Codex",
      callback: () => {}
    });
  }
}
