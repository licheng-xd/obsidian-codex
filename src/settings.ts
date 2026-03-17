import { DEFAULT_MODEL } from "./types";

export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";
export type ApprovalPolicy = "never" | "on-request" | "on-failure";

export const YOLO_SANDBOX_MODE: SandboxMode = "danger-full-access";
export const YOLO_APPROVAL_POLICY: ApprovalPolicy = "never";

export interface PluginSettings {
  codexPath: string;
  skipGitRepoCheck: boolean;
  sandboxMode: SandboxMode;
  approvalPolicy: ApprovalPolicy;
  model: string;
  yoloMode: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  codexPath: "",
  skipGitRepoCheck: true,
  sandboxMode: "workspace-write",
  approvalPolicy: "on-request",
  model: DEFAULT_MODEL,
  yoloMode: false
};

const SANDBOX_MODES: SandboxMode[] = ["read-only", "workspace-write", "danger-full-access"];
const APPROVAL_POLICIES: ApprovalPolicy[] = ["never", "on-request", "on-failure"];

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
  const yoloMode =
    typeof data?.yoloMode === "boolean" && data.yoloMode
      ? isYoloConfiguration(sandboxMode, approvalPolicy)
      : DEFAULT_SETTINGS.yoloMode;

  return {
    codexPath: typeof data?.codexPath === "string" ? data.codexPath : DEFAULT_SETTINGS.codexPath,
    skipGitRepoCheck:
      typeof data?.skipGitRepoCheck === "boolean"
        ? data.skipGitRepoCheck
        : DEFAULT_SETTINGS.skipGitRepoCheck,
    sandboxMode,
    approvalPolicy,
    model,
    yoloMode
  };
}
