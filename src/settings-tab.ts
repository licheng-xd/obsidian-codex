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

    containerEl.createEl("h3", { text: "Identity" });

    new Setting(containerEl)
      .setName("Your name")
      .setDesc("Optional. Only affects future chat turns in the main sidebar chat prompt. Does not rename history or change past sessions.")
      .addText((text) => {
        text
          .setPlaceholder("e.g. Alice")
          .setValue(this.plugin.settings.userName)
          .onChange(async (value) => {
            await this.savePatchedSettings({ userName: value });
          });
      });

    new Setting(containerEl)
      .setName("Custom instructions")
      .setDesc(
        "Appended to the main chat system prompt for future turns. Use this for tone or recurring preferences. Does not replace @-attached files, pinned context, or active note context."
      )
      .addTextArea((textarea) => {
        textarea
          .setPlaceholder("e.g. Always respond in Chinese. Prefer concise answers and Obsidian wikilinks.")
          .setValue(this.plugin.settings.customInstructions)
          .onChange(async (value) => {
            await this.savePatchedSettings({ customInstructions: value });
          });
        textarea.inputEl.rows = 4;
        textarea.inputEl.style.width = "100%";
      });

    containerEl.createEl("h3", { text: "Runtime" });

    new Setting(containerEl)
      .setName("Path to codex")
      .setDesc("Optional absolute path to the codex executable. Leave empty to use the shell path.")
      .addText((text) => {
        text
          .setPlaceholder("Codex")
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
      .setName("Skip repository check")
      .setDesc("Allow the plugin to run inside a vault even when the vault is not a repository.")
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
      .setName("Enable external contexts")
      .setDesc(
        "Allow explicit external file references from configured roots. Disabled by default because this expands readable paths beyond the vault."
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.externalContextRootsEnabled).onChange(async (value) => {
          await this.savePatchedSettings({ externalContextRootsEnabled: value });
        });
      });

    new Setting(containerEl)
      .setName("Allowed external roots")
      .setDesc(
        "Only absolute directories are accepted, one per line. Nested duplicates are collapsed automatically. Files still need to be added explicitly from the status bar."
      )
      .addTextArea((textarea) => {
        textarea
          .setPlaceholder("/Users/you/projects\n/Users/you/research")
          .setValue(this.plugin.settings.persistentExternalContextRoots.join("\n"))
          .onChange(async (value) => {
            await this.savePatchedSettings({
              persistentExternalContextRoots: value
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
            });
          });
        textarea.inputEl.rows = 3;
        textarea.inputEl.style.width = "100%";
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
          .addOption("read-only", "Read-only")
          .addOption("workspace-write", "Workspace write")
          .addOption("danger-full-access", "Full access")
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
          .addOption("never", "Never")
          .addOption("on-request", "On request")
          .addOption("on-failure", "On failure")
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
