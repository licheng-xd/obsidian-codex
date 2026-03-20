import { App, PluginSettingTab, Setting } from "obsidian";
import type ObsidianCodexPlugin from "./main";
import { REASONING_EFFORT_OPTIONS, type ReasoningEffort } from "./types";
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

    new Setting(containerEl)
      .setName("Path to codex")
      .setDesc("Optional absolute path to the codex executable. Leave empty to use the shell path.")
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
      .setDesc("Default model for future thread execution.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.model)
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            await this.savePatchedSettings({ model: value || DEFAULT_SETTINGS.model });
          });
      });

    new Setting(containerEl)
      .setName("Reasoning effort")
      .setDesc("Default reasoning effort for future turns.")
      .addDropdown((dropdown) => {
        for (const option of REASONING_EFFORT_OPTIONS) {
          dropdown.addOption(option.id, option.label);
        }

        dropdown.setValue(this.plugin.settings.reasoningEffort).onChange(async (value) => {
          await this.savePatchedSettings({ reasoningEffort: value as ReasoningEffort });
        });
      });

    new Setting(containerEl)
      .setName("Skip git repo check")
      .setDesc("Allow codex to run inside a vault even when it is not a git repository.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.skipGitRepoCheck).onChange(async (value) => {
          await this.savePatchedSettings({ skipGitRepoCheck: value });
        });
      });

    new Setting(containerEl)
      .setName("Include active note automatically")
      .setDesc("When enabled, each turn injects the current note excerpt. Selected text is always injected separately.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.includeActiveNoteContext).onChange(async (value) => {
          await this.savePatchedSettings({ includeActiveNoteContext: value });
        });
      });

    new Setting(containerEl)
      .setName("High-risk mode")
      .setDesc(
        "Persist a high-risk override for future turns: approval policy 'never' and sandbox 'danger-full-access'."
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
      .setDesc("Default sandbox mode for future thread execution.")
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
      .setDesc("Default approval policy for future thread execution.")
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
