import { Notice, Plugin } from "obsidian";
import { ChatView, CODEX_CHAT_VIEW_TYPE } from "./chat-view";
import { probeCodexCli } from "./codex-service";
import { type PluginSettings, sanitizePluginSettings } from "./settings";
import { ObsidianCodexSettingTab } from "./settings-tab";

export default class ObsidianCodexPlugin extends Plugin {
  settings!: PluginSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new ObsidianCodexSettingTab(this.app, this));
    this.registerView(CODEX_CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this));

    this.addCommand({
      id: "obsidian-codex-open-placeholder",
      name: "Open Obsidian Codex",
      callback: async () => {
        await this.activateChatView();
      }
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

  async onunload(): Promise<void> {
    this.app.workspace.detachLeavesOfType(CODEX_CHAT_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = sanitizePluginSettings(loaded as Partial<PluginSettings> | null | undefined);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async activateChatView(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(CODEX_CHAT_VIEW_TYPE)[0];

    if (!leaf) {
      leaf = await this.app.workspace.ensureSideLeaf(CODEX_CHAT_VIEW_TYPE, "right", {
        active: true,
        reveal: true
      });
      await leaf.setViewState({
        type: CODEX_CHAT_VIEW_TYPE,
        active: true
      });
    }

    await this.app.workspace.revealLeaf(leaf);
  }
}
