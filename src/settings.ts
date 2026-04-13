import { DEFAULT_MODEL, DEFAULT_REASONING_EFFORT, type ReasoningEffort } from "./types";
import { sanitizeExternalContextRoots } from "./external-contexts";

export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";
export type ApprovalPolicy = "never" | "on-request" | "on-failure";

export const YOLO_SANDBOX_MODE: SandboxMode = "danger-full-access";
export const YOLO_APPROVAL_POLICY: ApprovalPolicy = "never";

export interface PluginSettings {
  codexPath: string;
  skipGitRepoCheck: boolean;
  includeActiveNoteContext: boolean;
  sandboxMode: SandboxMode;
  approvalPolicy: ApprovalPolicy;
  model: string;
  reasoningEffort: ReasoningEffort;
  yoloMode: boolean;
  userName: string;
  customInstructions: string;
  externalContextRootsEnabled: boolean;
  persistentExternalContextRoots: string[];
}

export const DEFAULT_SETTINGS: PluginSettings = {
  codexPath: "",
  skipGitRepoCheck: true,
  includeActiveNoteContext: false,
  sandboxMode: "workspace-write",
  approvalPolicy: "on-request",
  model: DEFAULT_MODEL,
  reasoningEffort: DEFAULT_REASONING_EFFORT,
  yoloMode: false,
  userName: "",
  customInstructions: "",
  externalContextRootsEnabled: false,
  persistentExternalContextRoots: []
};

const SANDBOX_MODES: SandboxMode[] = ["read-only", "workspace-write", "danger-full-access"];
const APPROVAL_POLICIES: ApprovalPolicy[] = ["never", "on-request", "on-failure"];
const REASONING_EFFORTS: ReasoningEffort[] = ["low", "medium", "high", "xhigh"];

export function isYoloConfiguration(
  sandboxMode: SandboxMode,
  approvalPolicy: ApprovalPolicy
): boolean {
  return sandboxMode === YOLO_SANDBOX_MODE && approvalPolicy === YOLO_APPROVAL_POLICY;
}

export function patchPluginSettings(
  settings: PluginSettings,
  patch: Partial<PluginSettings>
): PluginSettings {
  return sanitizePluginSettings({
    ...settings,
    ...patch
  });
}

export function toggleYoloMode(settings: PluginSettings, enabled: boolean): PluginSettings {
  if (enabled) {
    return patchPluginSettings(settings, {
      yoloMode: true,
      sandboxMode: YOLO_SANDBOX_MODE,
      approvalPolicy: YOLO_APPROVAL_POLICY
    });
  }

  return patchPluginSettings(settings, {
    yoloMode: false,
    sandboxMode: DEFAULT_SETTINGS.sandboxMode,
    approvalPolicy: DEFAULT_SETTINGS.approvalPolicy
  });
}

export function updateExecutionSettings(
  settings: PluginSettings,
  patch: Pick<PluginSettings, "sandboxMode"> | Pick<PluginSettings, "approvalPolicy">
): PluginSettings {
  const nextSettings = {
    ...settings,
    ...patch
  };

  if (nextSettings.yoloMode && !isYoloConfiguration(nextSettings.sandboxMode, nextSettings.approvalPolicy)) {
    nextSettings.yoloMode = false;
  }

  return sanitizePluginSettings(nextSettings);
}

export function sanitizePluginSettings(
  data: Partial<PluginSettings> | null | undefined
): PluginSettings {
  const sandboxMode = SANDBOX_MODES.includes(data?.sandboxMode as SandboxMode)
    ? (data?.sandboxMode as SandboxMode)
    : DEFAULT_SETTINGS.sandboxMode;
  const approvalPolicy = APPROVAL_POLICIES.includes(data?.approvalPolicy as ApprovalPolicy)
    ? (data?.approvalPolicy as ApprovalPolicy)
    : DEFAULT_SETTINGS.approvalPolicy;
  const model =
    typeof data?.model === "string" && data.model.trim() ? data.model.trim() : DEFAULT_SETTINGS.model;
  const reasoningEffort = REASONING_EFFORTS.includes(data?.reasoningEffort as ReasoningEffort)
    ? (data?.reasoningEffort as ReasoningEffort)
    : DEFAULT_SETTINGS.reasoningEffort;
  const yoloMode =
    typeof data?.yoloMode === "boolean" && data.yoloMode
      ? isYoloConfiguration(sandboxMode, approvalPolicy)
      : DEFAULT_SETTINGS.yoloMode;
  const externalContextRootsEnabled =
    typeof data?.externalContextRootsEnabled === "boolean"
      ? data.externalContextRootsEnabled
      : DEFAULT_SETTINGS.externalContextRootsEnabled;
  const persistentExternalContextRoots = sanitizeExternalContextRoots(
    Array.isArray(data?.persistentExternalContextRoots)
      ? data.persistentExternalContextRoots
      : DEFAULT_SETTINGS.persistentExternalContextRoots
  );

  return {
    codexPath: typeof data?.codexPath === "string" ? data.codexPath : DEFAULT_SETTINGS.codexPath,
    skipGitRepoCheck:
      typeof data?.skipGitRepoCheck === "boolean"
        ? data.skipGitRepoCheck
        : DEFAULT_SETTINGS.skipGitRepoCheck,
    includeActiveNoteContext:
      typeof data?.includeActiveNoteContext === "boolean"
        ? data.includeActiveNoteContext
        : DEFAULT_SETTINGS.includeActiveNoteContext,
    sandboxMode,
    approvalPolicy,
    model,
    reasoningEffort,
    yoloMode,
    userName: typeof data?.userName === "string" ? data.userName : DEFAULT_SETTINGS.userName,
    customInstructions:
      typeof data?.customInstructions === "string"
        ? data.customInstructions
        : DEFAULT_SETTINGS.customInstructions,
    externalContextRootsEnabled,
    persistentExternalContextRoots
  };
}
