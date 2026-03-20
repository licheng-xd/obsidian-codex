import {
  MODEL_CONTEXT_WINDOWS,
  MODEL_OPTIONS,
  REASONING_EFFORT_OPTIONS,
  type ContextUsage,
  type ReasoningEffort
} from "./types";

function formatCompactCount(value: number): string {
  if (value < 1000) {
    return String(value);
  }

  if (value >= 1_000_000) {
    const compactValue = Math.round(value / 100_000) / 10;
    return `${String(compactValue).replace(/\.0$/, "")}M`;
  }

  const compactValue = value >= 10_000 ? Math.round(value / 1000) : Math.round(value / 100) / 10;
  return `${String(compactValue).replace(/\.0$/, "")}k`;
}

function formatEstimatedCount(value: number): string {
  if (value <= 0) {
    return "0";
  }

  return `~${formatCompactCount(value)}`;
}

function formatLocalContextUsage(usage: ContextUsage): string {
  return `Local ${formatCompactCount(usage.localCharsUsed)} / ${formatCompactCount(usage.localCharsLimit)}`;
}

export function getModelContextWindow(model: string): number | null {
  return MODEL_CONTEXT_WINDOWS[model as keyof typeof MODEL_CONTEXT_WINDOWS] ?? null;
}

export function formatContextWindowUsage(
  model: string,
  usage: ContextUsage
): string {
  void model;
  return formatLocalContextUsage(usage);
}

export function formatContextWindowTitle(
  model: string,
  usage: ContextUsage
): string {
  const contextWindow = getModelContextWindow(model);
  const historyEstimate = Math.max(0, Math.round(usage.threadCharsUsedEstimate));

  return [
    `Local context: ${formatCompactCount(usage.localCharsUsed)} / ${formatCompactCount(usage.localCharsLimit)} chars`,
    `Visible history est.: ${formatEstimatedCount(historyEstimate)} chars`,
    contextWindow
      ? `Configured model window: ${formatCompactCount(contextWindow)} tokens`
      : "Configured model window: unavailable",
    "Thread window: unavailable in current Codex SDK",
    formatLastTurnUsage(
      usage.sdkInputTokens,
      usage.sdkCachedInputTokens,
      usage.sdkOutputTokens
    ),
    usage.sdkInputTokens === null
      ? "Turn input note: pending"
      : "Turn input note: aggregate across the completed turn, not live thread window",
    "Auto-compact: unavailable in current Codex SDK"
  ].join(" · ");
}

export function formatLastTurnUsage(
  input: number | null,
  cached: number | null,
  output: number | null
): string {
  if (input === null || cached === null || output === null) {
    return "Last turn: pending";
  }

  return `Last turn: in ${formatCompactCount(input)} / cached ${formatCompactCount(cached)} / out ${formatCompactCount(output)}`;
}

export function getModelSelectLabel(model: string): string {
  return MODEL_OPTIONS.find((option) => option.id === model)?.label ?? model;
}

export function getReasoningEffortLabel(effort: ReasoningEffort): string {
  return REASONING_EFFORT_OPTIONS.find((option) => option.id === effort)?.label ?? effort;
}

interface StatusBarCallbacks {
  onModelChange: (model: string) => void | Promise<void>;
  onReasoningEffortChange: (effort: ReasoningEffort) => void | Promise<void>;
  onYoloChange: (enabled: boolean) => void | Promise<void>;
}

function getVaultDisplayLabel(workingDirectory?: string): string {
  if (!workingDirectory) {
    return "Vault";
  }

  const trimmedPath = workingDirectory.replace(/[\\/]+$/, "");
  const pathSegments = trimmedPath.split(/[\\/]/).filter(Boolean);
  const displayName = pathSegments[pathSegments.length - 1] ?? workingDirectory;
  return `Vault ${displayName}`;
}

export class StatusBar {
  private readonly rootEl: HTMLDivElement;
  private readonly controlsEl: HTMLDivElement;
  private readonly primaryEl: HTMLDivElement;
  private readonly modelGroupEl: HTMLDivElement;
  private readonly modelTriggerEl: HTMLSpanElement;
  private readonly modelMenuEl: HTMLDivElement;
  private readonly reasoningGroupEl: HTMLDivElement;
  private readonly reasoningTriggerEl: HTMLSpanElement;
  private readonly reasoningMenuEl: HTMLDivElement;
  private readonly localUsageEl: HTMLDivElement;
  private readonly workingDirectoryEl: HTMLDivElement;
  private readonly yoloLabelEl: HTMLSpanElement;
  private readonly yoloToggleEl: HTMLButtonElement;
  private currentModel: string;
  private currentReasoningEffort: ReasoningEffort;
  private currentContextUsage: ContextUsage = {
    localCharsUsed: 0,
    localCharsLimit: 4000,
    threadCharsUsedEstimate: 0,
    threadCharsLimitEstimate: 40000,
    sdkInputTokens: null,
    sdkCachedInputTokens: null,
    sdkOutputTokens: null
  };

  constructor(
    containerEl: HTMLElement,
    initialModel: string,
    initialReasoningEffort: ReasoningEffort,
    initialYolo: boolean,
    private readonly callbacks: StatusBarCallbacks
  ) {
    this.currentModel = initialModel;
    this.currentReasoningEffort = initialReasoningEffort;
    this.rootEl = containerEl.ownerDocument.createElement("div");
    this.rootEl.className = "obsidian-codex-statusbar";

    this.controlsEl = containerEl.ownerDocument.createElement("div");
    this.controlsEl.className = "obsidian-codex-statusbar-controls";
    this.primaryEl = containerEl.ownerDocument.createElement("div");
    this.primaryEl.className = "obsidian-codex-statusbar-primary";

    this.modelGroupEl = this.createMenuGroup(containerEl, "Model", "is-model");
    this.modelTriggerEl = this.modelGroupEl.querySelector("span") as HTMLSpanElement;
    this.modelMenuEl = this.modelGroupEl.querySelector(".obsidian-codex-statusbar-menu") as HTMLDivElement;

    this.reasoningGroupEl = this.createMenuGroup(containerEl, "Reasoning effort", "is-reasoning");
    this.reasoningTriggerEl = this.reasoningGroupEl.querySelector("span") as HTMLSpanElement;
    this.reasoningMenuEl = this.reasoningGroupEl.querySelector(".obsidian-codex-statusbar-menu") as HTMLDivElement;

    this.localUsageEl = containerEl.ownerDocument.createElement("div");
    this.localUsageEl.className = "obsidian-codex-statusbar-meta";

    this.workingDirectoryEl = containerEl.ownerDocument.createElement("div");
    this.workingDirectoryEl.className = "obsidian-codex-statusbar-meta is-vault";

    const yoloSectionEl = containerEl.ownerDocument.createElement("div");
    yoloSectionEl.className = "obsidian-codex-statusbar-yolo";
    this.yoloLabelEl = containerEl.ownerDocument.createElement("span");
    this.yoloLabelEl.className = "obsidian-codex-statusbar-yolo-label";
    this.yoloLabelEl.textContent = "YOLO";
    this.yoloToggleEl = containerEl.ownerDocument.createElement("button");
    this.yoloToggleEl.type = "button";
    this.yoloToggleEl.className = "obsidian-codex-statusbar-switch";
    this.yoloToggleEl.ariaLabel = "High-risk mode";
    this.yoloToggleEl.role = "switch";
    this.yoloToggleEl.addEventListener("click", () => {
      void this.callbacks.onYoloChange(this.yoloToggleEl.getAttribute("aria-checked") !== "true");
    });
    yoloSectionEl.append(this.yoloLabelEl, this.yoloToggleEl);

    this.primaryEl.append(
      this.modelGroupEl,
      this.reasoningGroupEl,
      this.localUsageEl,
      this.workingDirectoryEl
    );
    this.controlsEl.append(this.primaryEl, yoloSectionEl);
    this.rootEl.appendChild(this.controlsEl);
    containerEl.appendChild(this.rootEl);

    this.rebuildModelMenu();
    this.rebuildReasoningMenu();
    this.updateContextUsage(this.currentContextUsage);
    this.updateModel(initialModel);
    this.updateReasoningEffort(initialReasoningEffort);
    this.updateYolo(initialYolo);
    this.updateWorkingDirectory();
  }

  updateContextUsage(usage: ContextUsage): void {
    this.currentContextUsage = usage;
    this.localUsageEl.textContent = formatContextWindowUsage(
      this.currentModel,
      usage
    );
    this.localUsageEl.title = formatContextWindowTitle(this.currentModel, usage);
  }

  updateModel(model: string): void {
    this.currentModel = model;
    this.modelTriggerEl.textContent = getModelSelectLabel(model);
    this.rebuildModelMenu();
    this.updateContextUsage(this.currentContextUsage);
  }

  updateReasoningEffort(effort: ReasoningEffort): void {
    this.currentReasoningEffort = effort;
    this.reasoningTriggerEl.textContent = getReasoningEffortLabel(effort);
    this.rebuildReasoningMenu();
  }

  updateYolo(enabled: boolean): void {
    this.yoloToggleEl.setAttribute("aria-checked", enabled ? "true" : "false");
    this.rootEl.classList.toggle("is-yolo-active", enabled);
  }

  updateWorkingDirectory(workingDirectory?: string): void {
    this.workingDirectoryEl.textContent = getVaultDisplayLabel(workingDirectory);
    this.workingDirectoryEl.title = workingDirectory ?? "Vault path unavailable";
  }

  destroy(): void {
    this.rootEl.remove();
  }

  private createMenuGroup(
    containerEl: HTMLElement,
    label: string,
    variantClassName: string
  ): HTMLDivElement {
    const groupEl = containerEl.ownerDocument.createElement("div");
    groupEl.className = `obsidian-codex-statusbar-menu-group ${variantClassName}`;

    const triggerEl = containerEl.ownerDocument.createElement("span");
    triggerEl.className = "obsidian-codex-statusbar-trigger";
    triggerEl.setAttribute("aria-label", label);
    groupEl.appendChild(triggerEl);

    const menuEl = containerEl.ownerDocument.createElement("div");
    menuEl.className = "obsidian-codex-statusbar-menu";
    groupEl.appendChild(menuEl);

    return groupEl;
  }

  private rebuildModelMenu(): void {
    this.modelMenuEl.replaceChildren();

    for (const option of MODEL_OPTIONS) {
      this.modelMenuEl.appendChild(
        this.createMenuItem(option.label, option.id === this.currentModel, () => {
          void this.callbacks.onModelChange(option.id);
        })
      );
    }
  }

  private rebuildReasoningMenu(): void {
    this.reasoningMenuEl.replaceChildren();

    for (const option of REASONING_EFFORT_OPTIONS) {
      this.reasoningMenuEl.appendChild(
        this.createMenuItem(option.label, option.id === this.currentReasoningEffort, () => {
          void this.callbacks.onReasoningEffortChange(option.id);
        })
      );
    }
  }

  private createMenuItem(
    label: string,
    selected: boolean,
    onSelect: () => void
  ): HTMLButtonElement {
    const itemEl = this.rootEl.ownerDocument.createElement("button");
    itemEl.type = "button";
    itemEl.className = "obsidian-codex-statusbar-menu-item";
    if (selected) {
      itemEl.classList.add("is-selected");
    }
    itemEl.textContent = label;
    itemEl.addEventListener("click", onSelect);
    return itemEl;
  }
}
