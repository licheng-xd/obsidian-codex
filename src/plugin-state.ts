import type { PersistedChatSession } from "./chat-session";
import { sanitizePersistedChatSession } from "./chat-session";
import type { PluginSettings } from "./settings";
import { sanitizePluginSettings } from "./settings";

export interface PersistedPluginData {
  readonly settings: PluginSettings;
  readonly lastSession: PersistedChatSession | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readPersistedPluginData(value: unknown): PersistedPluginData {
  if (isRecord(value) && ("settings" in value || "lastSession" in value)) {
    return {
      settings: sanitizePluginSettings(value.settings as Partial<PluginSettings> | null | undefined),
      lastSession: sanitizePersistedChatSession(value.lastSession)
    };
  }

  return {
    settings: sanitizePluginSettings(value as Partial<PluginSettings> | null | undefined),
    lastSession: null
  };
}

export function writePersistedPluginData(
  settings: PluginSettings,
  lastSession: PersistedChatSession | null
): PersistedPluginData {
  return {
    settings,
    lastSession
  };
}
