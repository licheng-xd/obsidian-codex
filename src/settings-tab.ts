import { App, PluginSettingTab, Setting } from "obsidian";
import type ObsidianCodexPlugin from "./main";

export class ObsidianCodexSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ObsidianCodexPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Obsidian Codex Settings" });

    new Setting(containerEl)
      .setName("Codex path")
      .setDesc("Optional absolute path to the codex CLI. Leave empty to use PATH.")
      .addText((text) => {
        text
          .setPlaceholder("codex")
          .setValue(this.plugin.settings.codexPath)
          .onChange(async (value) => {
            this.plugin.settings.codexPath = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Skip git repo check")
      .setDesc("Allow Codex to run inside a Vault even when it is not a git repository.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.skipGitRepoCheck).onChange(async (value) => {
          this.plugin.settings.skipGitRepoCheck = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Sandbox mode")
      .setDesc("Default sandbox mode for future Codex thread execution.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("read-only", "read-only")
          .addOption("workspace-write", "workspace-write")
          .setValue(this.plugin.settings.sandboxMode)
          .onChange(async (value) => {
            this.plugin.settings.sandboxMode = value as "read-only" | "workspace-write";
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Approval policy")
      .setDesc("Default approval policy for future Codex thread execution.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("never", "never")
          .addOption("on-request", "on-request")
          .addOption("on-failure", "on-failure")
          .setValue(this.plugin.settings.approvalPolicy)
          .onChange(async (value) => {
            this.plugin.settings.approvalPolicy = value as "never" | "on-request" | "on-failure";
            await this.plugin.saveSettings();
          });
      });
  }
}
