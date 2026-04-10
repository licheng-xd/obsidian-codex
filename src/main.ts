import { Notice, Plugin } from "obsidian";
import type { PersistedChatSession } from "./chat-session";
import { ChatView, CODEX_CHAT_VIEW_TYPE } from "./chat-view";
import { CODEX_ICON } from "./codex-icon";
import { CodexService, probeCodexCli } from "./codex-service";
import { registerCodexIcon } from "./icons";
import { runInlineEditCommand } from "./inline-edit-controller";
import { readPersistedPluginData, writePersistedPluginData } from "./plugin-state";
import { type PluginSettings } from "./settings";
import { ObsidianCodexSettingTab } from "./settings-tab";

export default class ObsidianCodexPlugin extends Plugin {
  settings!: PluginSettings;
  codexService!: CodexService;
  recentSessions: PersistedChatSession[] = [];
  activeSessionId: string | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    registerCodexIcon();
    this.codexService = new CodexService({
      getCodexPath: () => this.settings.codexPath
    });

    this.addSettingTab(new ObsidianCodexSettingTab(this.app, this));
    this.registerView(CODEX_CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this));
    this.addRibbonIcon(CODEX_ICON, "Open sidebar", () => {
      void this.activateChatView();
    });

    this.addCommand({
      id: "open-sidebar",
      name: "Open sidebar",
      callback: async () => {
        await this.activateChatView();
      }
    });

    this.addCommand({
      id: "verify-runtime",
      name: "Verify runtime",
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

    this.addCommand({
      id: "new-session",
      name: "New session",
      callback: async () => {
        const view = await this.getOrCreateChatView();
        view?.startDraftSession();
      }
    });

    this.addCommand({
      id: "resume-last-session",
      name: "Resume last session",
      callback: async () => {
        const view = await this.getOrCreateChatView();
        await view?.resumeLatestSession();
      }
    });

    this.addCommand({
      id: "show-session-history",
      name: "Show session history",
      callback: async () => {
        const view = await this.getOrCreateChatView();
        view?.openSessionWorkbench();
      }
    });

    this.addCommand({
      id: "pin-current-note",
      name: "Pin current note",
      callback: async () => {
        const view = await this.getOrCreateChatView();
        await view?.pinCurrentNote();
      }
    });

    this.addCommand({
      id: "inline-edit-selection",
      name: "Inline edit selection",
      editorCheckCallback: (checking) => {
        if (checking) {
          return true;
        }

        void runInlineEditCommand(this, "rewrite-selection");
        return true;
      }
    });

    this.addCommand({
      id: "inline-insert-at-cursor",
      name: "Inline insert at cursor",
      editorCheckCallback: (checking) => {
        if (checking) {
          return true;
        }

        void runInlineEditCommand(this, "insert-at-cursor");
        return true;
      }
    });
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    const persisted = readPersistedPluginData(loaded);
    this.settings = persisted.settings;
    this.recentSessions = [...persisted.recentSessions];
    this.activeSessionId = persisted.activeSessionId;
  }

  async saveSettings(): Promise<void> {
    await this.savePluginData();
  }

  async saveSessionHistory(
    recentSessions: ReadonlyArray<PersistedChatSession>,
    activeSessionId: string | null
  ): Promise<void> {
    this.recentSessions = [...recentSessions];
    this.activeSessionId = activeSessionId;
    await this.savePluginData();
  }

  async setActiveSession(activeSessionId: string | null): Promise<void> {
    this.activeSessionId = activeSessionId;
    await this.savePluginData();
  }

  private async activateChatView(): Promise<void> {
    await this.getOrCreateChatView();
  }

  private async getOrCreateChatView(): Promise<ChatView | null> {
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
    return leaf.view instanceof ChatView ? leaf.view : null;
  }

  private async savePluginData(): Promise<void> {
    await this.saveData(writePersistedPluginData(this.settings, this.recentSessions, this.activeSessionId));
  }
}
