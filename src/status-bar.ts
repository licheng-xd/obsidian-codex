import { MODEL_OPTIONS, REASONING_EFFORT_OPTIONS, type ContextUsage, type ReasoningEffort } from "./types";
export {
  formatEstimatedContextMeterLabel,
  formatEstimatedContextMeterTitle,
  formatContextWindowTitle,
  formatContextWindowUsage,
  formatExecutionStateLabel,
  formatLastTurnUsage,
  getEstimatedContextMeterPercentage,
  getModelContextWindow,
  getModelSelectLabel,
  getReasoningEffortLabel
} from "./status-bar/formatters";
import {
  formatEstimatedContextMeterLabel,
  formatEstimatedContextMeterTitle,
  formatContextWindowTitle,
  formatContextWindowUsage,
  formatExecutionStateLabel,
  getEstimatedContextMeterPercentage,
  getModelSelectLabel,
  getReasoningEffortLabel
} from "./status-bar/formatters";

interface StatusBarCallbacks {
  onModelChange: (model: string) => void | Promise<void>;
  onReasoningEffortChange: (effort: ReasoningEffort) => void | Promise<void>;
  onYoloChange: (enabled: boolean) => void | Promise<void>;
  onAddExternalContext: () => void | Promise<void>;
  onClearExternalContext: () => void | Promise<void>;
}

interface ExternalContextStatus {
  enabled: boolean;
  rootCount: number;
  fileCount: number;
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
  private readonly externalContextGroupEl: HTMLDivElement;
  private readonly externalContextTriggerEl: HTMLSpanElement;
  private readonly externalContextMenuEl: HTMLDivElement;
  private readonly estimatedMeterEl: HTMLDivElement;
  private readonly estimatedMeterLabelEl: HTMLSpanElement;
  private readonly estimatedMeterTrackEl: HTMLSpanElement;
  private readonly estimatedMeterFillEl: HTMLSpanElement;
  private readonly executionStateEl: HTMLDivElement;
  private readonly localUsageEl: HTMLDivElement;
  private readonly workingDirectoryEl: HTMLDivElement;
  private readonly yoloLabelEl: HTMLSpanElement;
  private readonly yoloToggleEl: HTMLButtonElement;
  private currentModel: string;
  private currentReasoningEffort: ReasoningEffort;
  private isRunning = false;
  private externalContextStatus: ExternalContextStatus = {
    enabled: false,
    rootCount: 0,
    fileCount: 0
  };
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

    this.externalContextGroupEl = this.createMenuGroup(containerEl, "External contexts", "is-external");
    this.externalContextTriggerEl = this.externalContextGroupEl.querySelector("span") as HTMLSpanElement;
    this.externalContextMenuEl = this.externalContextGroupEl.querySelector(".obsidian-codex-statusbar-menu") as HTMLDivElement;

    this.localUsageEl = containerEl.ownerDocument.createElement("div");
    this.localUsageEl.className = "obsidian-codex-statusbar-meta";

    this.estimatedMeterEl = containerEl.ownerDocument.createElement("div");
    this.estimatedMeterEl.className = "obsidian-codex-statusbar-meter";
    this.estimatedMeterLabelEl = containerEl.ownerDocument.createElement("span");
    this.estimatedMeterLabelEl.className = "obsidian-codex-statusbar-meter-label";
    this.estimatedMeterTrackEl = containerEl.ownerDocument.createElement("span");
    this.estimatedMeterTrackEl.className = "obsidian-codex-statusbar-meter-track";
    this.estimatedMeterFillEl = containerEl.ownerDocument.createElement("span");
    this.estimatedMeterFillEl.className = "obsidian-codex-statusbar-meter-fill";
    this.estimatedMeterTrackEl.appendChild(this.estimatedMeterFillEl);
    this.estimatedMeterEl.append(this.estimatedMeterLabelEl, this.estimatedMeterTrackEl);

    this.executionStateEl = containerEl.ownerDocument.createElement("div");
    this.executionStateEl.className = "obsidian-codex-statusbar-meta is-execution";

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
      this.externalContextGroupEl,
      this.executionStateEl,
      this.estimatedMeterEl,
      this.localUsageEl,
      this.workingDirectoryEl
    );
    this.controlsEl.append(this.primaryEl, yoloSectionEl);
    this.rootEl.appendChild(this.controlsEl);
    containerEl.appendChild(this.rootEl);

    this.rebuildModelMenu();
    this.rebuildReasoningMenu();
    this.updateExternalContextState(this.externalContextStatus);
    this.updateContextUsage(this.currentContextUsage);
    this.updateModel(initialModel);
    this.updateReasoningEffort(initialReasoningEffort);
    this.updateExecutionState(false);
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
    this.estimatedMeterLabelEl.textContent = formatEstimatedContextMeterLabel(usage);
    this.estimatedMeterEl.title = formatEstimatedContextMeterTitle(usage);
    this.estimatedMeterFillEl.style.width = `${String(getEstimatedContextMeterPercentage(usage))}%`;
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

  updateExecutionState(isRunning: boolean): void {
    this.isRunning = isRunning;
    this.executionStateEl.textContent = formatExecutionStateLabel(isRunning);
    this.executionStateEl.title = isRunning
      ? "Codex is still executing the current turn."
      : "No turn is running.";
    this.executionStateEl.classList.toggle("is-running", isRunning);
    this.rootEl.classList.toggle("is-running", isRunning);
  }

  updateExternalContextState(status: ExternalContextStatus): void {
    this.externalContextStatus = status;
    this.externalContextTriggerEl.textContent = `External ${String(status.fileCount)}`;
    this.externalContextGroupEl.classList.toggle("is-hidden", !status.enabled || status.rootCount === 0);
    this.externalContextGroupEl.title = status.enabled
      ? `Allowed roots: ${String(status.rootCount)} · External files: ${String(status.fileCount)}`
      : "External contexts are disabled in settings.";
    this.rebuildExternalContextMenu();
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

  private rebuildExternalContextMenu(): void {
    this.externalContextMenuEl.replaceChildren();

    this.externalContextMenuEl.appendChild(
      this.createMenuItem("Add external file...", false, () => {
        void this.callbacks.onAddExternalContext();
      })
    );

    this.externalContextMenuEl.appendChild(
      this.createMenuItem(
        "Clear external files",
        false,
        () => {
          void this.callbacks.onClearExternalContext();
        },
        this.externalContextStatus.fileCount === 0
      )
    );
  }

  private createMenuItem(
    label: string,
    selected: boolean,
    onSelect: () => void,
    disabled = false
  ): HTMLButtonElement {
    const itemEl = this.rootEl.ownerDocument.createElement("button");
    itemEl.type = "button";
    itemEl.className = "obsidian-codex-statusbar-menu-item";
    if (selected) {
      itemEl.classList.add("is-selected");
    }
    itemEl.textContent = label;
    itemEl.disabled = disabled;
    itemEl.addEventListener("click", onSelect);
    return itemEl;
  }
}
