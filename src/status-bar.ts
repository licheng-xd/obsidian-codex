import {
  DEFAULT_MODEL,
  MODEL_OPTIONS,
  MODEL_PRESETS,
  REASONING_EFFORT_OPTIONS,
  type ContextUsage,
  type ReasoningEffort
} from "./types";

const CUSTOM_MODEL_OPTION = "__custom__";

function formatCompactCount(value: number): string {
  if (value < 1000) {
    return String(value);
  }

  const compactValue = value >= 10_000 ? Math.round(value / 1000) : Math.round(value / 100) / 10;
  return `${String(compactValue).replace(/\.0$/, "")}k`;
}

export function formatContextLocal(used: number, limit: number): string {
  return `Local: ${formatCompactCount(used)} / ${formatCompactCount(limit)}`;
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

function getVaultPillLabel(workingDirectory?: string): string {
  if (!workingDirectory) {
    return "Vault unavailable";
  }

  const trimmedPath = workingDirectory.replace(/[\\/]+$/, "");
  const pathSegments = trimmedPath.split(/[\\/]/).filter(Boolean);
  const displayName = pathSegments[pathSegments.length - 1] ?? workingDirectory;
  return `Vault ${displayName}`;
}

export class StatusBar {
  private readonly rootEl: HTMLDivElement;
  private readonly usageEl: HTMLDivElement;
  private readonly controlsEl: HTMLDivElement;
  private readonly controlsPrimaryEl: HTMLDivElement;
  private readonly modelSelectEl: HTMLSelectElement;
  private readonly reasoningSelectEl: HTMLSelectElement;
  private readonly customModelInputEl: HTMLInputElement;
  private readonly localUsageEl: HTMLDivElement;
  private readonly turnUsageEl: HTMLDivElement;
  private readonly workingDirectoryEl: HTMLDivElement;
  private readonly yoloToggleEl: HTMLInputElement;

  constructor(
    containerEl: HTMLElement,
    initialModel: string,
    initialReasoningEffort: ReasoningEffort,
    initialYolo: boolean,
    private readonly callbacks: StatusBarCallbacks
  ) {
    this.rootEl = containerEl.ownerDocument.createElement("div");
    this.rootEl.className = "obsidian-codex-statusbar";

    this.usageEl = containerEl.ownerDocument.createElement("div");
    this.usageEl.className = "obsidian-codex-statusbar-usage";
    this.localUsageEl = containerEl.ownerDocument.createElement("div");
    this.localUsageEl.className = "obsidian-codex-statusbar-usage-item";
    this.turnUsageEl = containerEl.ownerDocument.createElement("div");
    this.turnUsageEl.className = "obsidian-codex-statusbar-usage-item";
    this.usageEl.append(this.localUsageEl, this.turnUsageEl);

    this.controlsEl = containerEl.ownerDocument.createElement("div");
    this.controlsEl.className = "obsidian-codex-statusbar-controls";
    this.controlsPrimaryEl = containerEl.ownerDocument.createElement("div");
    this.controlsPrimaryEl.className = "obsidian-codex-statusbar-primary";

    this.modelSelectEl = containerEl.ownerDocument.createElement("select");
    this.modelSelectEl.className = "obsidian-codex-statusbar-select";
    this.modelSelectEl.ariaLabel = "Codex model";

    for (const model of MODEL_OPTIONS) {
      const optionEl = containerEl.ownerDocument.createElement("option");
      optionEl.value = model.id;
      optionEl.textContent = model.label;
      this.modelSelectEl.appendChild(optionEl);
    }

    const customOptionEl = containerEl.ownerDocument.createElement("option");
    customOptionEl.value = CUSTOM_MODEL_OPTION;
    customOptionEl.textContent = "Custom...";
    this.modelSelectEl.appendChild(customOptionEl);

    this.customModelInputEl = containerEl.ownerDocument.createElement("input");
    this.customModelInputEl.type = "text";
    this.customModelInputEl.className = "obsidian-codex-statusbar-model-input";
    this.customModelInputEl.placeholder = DEFAULT_MODEL;
    this.customModelInputEl.ariaLabel = "Custom Codex model";

    this.modelSelectEl.addEventListener("change", () => {
      const model = this.modelSelectEl.value;
      this.syncModelControls(model === CUSTOM_MODEL_OPTION ? this.customModelInputEl.value || DEFAULT_MODEL : model);
      if (model !== CUSTOM_MODEL_OPTION) {
        void this.callbacks.onModelChange(model);
      }
    });

    this.customModelInputEl.addEventListener("change", () => {
      const model = this.customModelInputEl.value.trim() || DEFAULT_MODEL;
      this.syncModelControls(model);
      void this.callbacks.onModelChange(model);
    });

    this.reasoningSelectEl = containerEl.ownerDocument.createElement("select");
    this.reasoningSelectEl.className = "obsidian-codex-statusbar-select";
    this.reasoningSelectEl.ariaLabel = "Reasoning effort";
    for (const effort of REASONING_EFFORT_OPTIONS) {
      const optionEl = containerEl.ownerDocument.createElement("option");
      optionEl.value = effort.id;
      optionEl.textContent = effort.label;
      this.reasoningSelectEl.appendChild(optionEl);
    }
    this.reasoningSelectEl.addEventListener("change", () => {
      void this.callbacks.onReasoningEffortChange(this.reasoningSelectEl.value as ReasoningEffort);
    });

    this.workingDirectoryEl = containerEl.ownerDocument.createElement("div");
    this.workingDirectoryEl.className = "obsidian-codex-statusbar-vault";

    this.controlsPrimaryEl.append(
      this.modelSelectEl,
      this.customModelInputEl,
      this.reasoningSelectEl,
      this.workingDirectoryEl
    );

    const yoloSectionEl = containerEl.ownerDocument.createElement("label");
    yoloSectionEl.className = "obsidian-codex-statusbar-yolo";
    const yoloLabelEl = containerEl.ownerDocument.createElement("span");
    yoloLabelEl.className = "obsidian-codex-statusbar-yolo-label";
    yoloLabelEl.textContent = "YOLO";
    yoloSectionEl.appendChild(yoloLabelEl);
    this.yoloToggleEl = containerEl.ownerDocument.createElement("input");
    this.yoloToggleEl.type = "checkbox";
    this.yoloToggleEl.ariaLabel = "YOLO mode";
    this.yoloToggleEl.addEventListener("change", () => {
      void this.callbacks.onYoloChange(this.yoloToggleEl.checked);
    });
    yoloSectionEl.appendChild(this.yoloToggleEl);

    this.controlsEl.append(this.controlsPrimaryEl, yoloSectionEl);
    this.rootEl.append(this.usageEl, this.controlsEl);
    containerEl.appendChild(this.rootEl);

    this.updateContextUsage({
      localCharsUsed: 0,
      localCharsLimit: 4000,
      sdkInputTokens: null,
      sdkCachedInputTokens: null,
      sdkOutputTokens: null
    });
    this.updateModel(initialModel);
    this.updateReasoningEffort(initialReasoningEffort);
    this.updateYolo(initialYolo);
    this.updateWorkingDirectory();
  }

  updateContextUsage(usage: ContextUsage): void {
    this.localUsageEl.textContent = formatContextLocal(usage.localCharsUsed, usage.localCharsLimit);
    this.turnUsageEl.textContent = formatLastTurnUsage(
      usage.sdkInputTokens,
      usage.sdkCachedInputTokens,
      usage.sdkOutputTokens
    );
  }

  updateModel(model: string): void {
    this.syncModelControls(model);
  }

  updateReasoningEffort(effort: ReasoningEffort): void {
    this.reasoningSelectEl.value = effort;
  }

  updateYolo(enabled: boolean): void {
    this.yoloToggleEl.checked = enabled;
    this.rootEl.classList.toggle("is-yolo-active", enabled);
  }

  updateWorkingDirectory(workingDirectory?: string): void {
    this.workingDirectoryEl.textContent = getVaultPillLabel(workingDirectory);
    this.workingDirectoryEl.title = workingDirectory ?? "Vault path unavailable";
  }

  destroy(): void {
    this.rootEl.remove();
  }

  private syncModelControls(model: string): void {
    const isPreset = MODEL_PRESETS.includes(model as (typeof MODEL_PRESETS)[number]);
    this.modelSelectEl.value = isPreset ? model : CUSTOM_MODEL_OPTION;
    this.customModelInputEl.value = isPreset ? "" : model;
    this.customModelInputEl.hidden = isPreset;
  }
}
