export type SandboxMode = "read-only" | "workspace-write";
export type ApprovalPolicy = "never" | "on-request" | "on-failure";

export interface PluginSettings {
  codexPath: string;
  skipGitRepoCheck: boolean;
  sandboxMode: SandboxMode;
  approvalPolicy: ApprovalPolicy;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  codexPath: "",
  skipGitRepoCheck: true,
  sandboxMode: "workspace-write",
  approvalPolicy: "on-request"
};

const SANDBOX_MODES: SandboxMode[] = ["read-only", "workspace-write"];
const APPROVAL_POLICIES: ApprovalPolicy[] = ["never", "on-request", "on-failure"];

export function sanitizePluginSettings(
  data: Partial<PluginSettings> | null | undefined
): PluginSettings {
  return {
    codexPath: typeof data?.codexPath === "string" ? data.codexPath : DEFAULT_SETTINGS.codexPath,
    skipGitRepoCheck:
      typeof data?.skipGitRepoCheck === "boolean"
        ? data.skipGitRepoCheck
        : DEFAULT_SETTINGS.skipGitRepoCheck,
    sandboxMode: SANDBOX_MODES.includes(data?.sandboxMode as SandboxMode)
      ? (data?.sandboxMode as SandboxMode)
      : DEFAULT_SETTINGS.sandboxMode,
    approvalPolicy: APPROVAL_POLICIES.includes(data?.approvalPolicy as ApprovalPolicy)
      ? (data?.approvalPolicy as ApprovalPolicy)
      : DEFAULT_SETTINGS.approvalPolicy
  };
}
