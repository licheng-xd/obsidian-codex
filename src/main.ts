import { Notice, Plugin } from "obsidian";
import { probeCodexCli } from "./codex-service";
import { type PluginSettings, sanitizePluginSettings } from "./settings";
import { ObsidianCodexSettingTab } from "./settings-tab";

export default class ObsidianCodexPlugin extends Plugin {
  settings!: PluginSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new ObsidianCodexSettingTab(this.app, this));

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
          const version = await probeCodexCli(this.settings.codexPath);
          new Notice(`Codex available: ${version}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          new Notice(`Codex probe failed: ${message}`, 8000);
        }
      }
    });
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = sanitizePluginSettings(loaded as Partial<PluginSettings> | null | undefined);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
