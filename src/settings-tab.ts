import { App, PluginSettingTab, Setting } from "obsidian";
import type ObsidianCodexPlugin from "./main";
import {
  DEFAULT_SETTINGS,
  patchPluginSettings,
  toggleYoloMode,
  updateExecutionSettings,
  type ApprovalPolicy,
  type PluginSettings,
  type SandboxMode
} from "./settings";

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
            await this.savePatchedSettings({ codexPath: value });
          });
      });

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Default Codex model for future thread execution.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.model)
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            await this.savePatchedSettings({ model: value || DEFAULT_SETTINGS.model });
          });
      });

    new Setting(containerEl)
      .setName("Skip git repo check")
      .setDesc("Allow Codex to run inside a Vault even when it is not a git repository.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.skipGitRepoCheck).onChange(async (value) => {
          await this.savePatchedSettings({ skipGitRepoCheck: value });
        });
      });

    new Setting(containerEl)
      .setName("YOLO mode")
      .setDesc(
        "Persist a high-risk override for future Codex turns: approval policy 'never' and sandbox 'danger-full-access'."
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.yoloMode).onChange(async (value) => {
          this.plugin.settings = toggleYoloMode(this.plugin.settings, value);
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("Sandbox mode")
      .setDesc("Default sandbox mode for future Codex thread execution.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("read-only", "read-only")
          .addOption("workspace-write", "workspace-write")
          .addOption("danger-full-access", "danger-full-access")
          .setValue(this.plugin.settings.sandboxMode)
          .onChange(async (value) => {
            this.plugin.settings = updateExecutionSettings(this.plugin.settings, {
              sandboxMode: value as SandboxMode
            });
            await this.plugin.saveSettings();
            this.display();
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
            this.plugin.settings = updateExecutionSettings(this.plugin.settings, {
              approvalPolicy: value as ApprovalPolicy
            });
            await this.plugin.saveSettings();
            this.display();
          });
      });
  }

  private async savePatchedSettings(patch: Partial<PluginSettings>): Promise<void> {
    this.plugin.settings = patchPluginSettings(this.plugin.settings, patch);
    await this.plugin.saveSettings();
  }
}
