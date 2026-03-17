import { DEFAULT_MODEL, MODEL_PRESETS, type ContextUsage } from "./types";

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

interface StatusBarCallbacks {
  onModelChange: (model: string) => void | Promise<void>;
  onYoloChange: (enabled: boolean) => void | Promise<void>;
}

export class StatusBar {
  private readonly rootEl: HTMLDivElement;
  private readonly modelSelectEl: HTMLSelectElement;
  private readonly customModelInputEl: HTMLInputElement;
  private readonly localUsageEl: HTMLDivElement;
  private readonly turnUsageEl: HTMLDivElement;
  private readonly yoloToggleEl: HTMLInputElement;

  constructor(
    containerEl: HTMLElement,
    initialModel: string,
    initialYolo: boolean,
    private readonly callbacks: StatusBarCallbacks
  ) {
    this.rootEl = containerEl.ownerDocument.createElement("div");
    this.rootEl.className = "obsidian-codex-statusbar";

    const modelSectionEl = containerEl.ownerDocument.createElement("div");
    modelSectionEl.className = "obsidian-codex-statusbar-model";
    this.modelSelectEl = containerEl.ownerDocument.createElement("select");

    for (const model of MODEL_PRESETS) {
      const optionEl = containerEl.ownerDocument.createElement("option");
      optionEl.value = model;
      optionEl.textContent = model;
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

    modelSectionEl.append(this.modelSelectEl, this.customModelInputEl);

    const contextSectionEl = containerEl.ownerDocument.createElement("div");
    contextSectionEl.className = "obsidian-codex-statusbar-context";
    this.localUsageEl = containerEl.ownerDocument.createElement("div");
    this.turnUsageEl = containerEl.ownerDocument.createElement("div");
    contextSectionEl.append(this.localUsageEl, this.turnUsageEl);

    const yoloSectionEl = containerEl.ownerDocument.createElement("label");
    yoloSectionEl.className = "obsidian-codex-statusbar-yolo";
    yoloSectionEl.append("YOLO");
    this.yoloToggleEl = containerEl.ownerDocument.createElement("input");
    this.yoloToggleEl.type = "checkbox";
    this.yoloToggleEl.addEventListener("change", () => {
      void this.callbacks.onYoloChange(this.yoloToggleEl.checked);
    });
    yoloSectionEl.appendChild(this.yoloToggleEl);

    this.rootEl.append(modelSectionEl, contextSectionEl, yoloSectionEl);
    containerEl.appendChild(this.rootEl);

    this.updateContextUsage({
      localCharsUsed: 0,
      localCharsLimit: 4000,
      sdkInputTokens: null,
      sdkCachedInputTokens: null,
      sdkOutputTokens: null
    });
    this.updateModel(initialModel);
    this.updateYolo(initialYolo);
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

  updateYolo(enabled: boolean): void {
    this.yoloToggleEl.checked = enabled;
    this.rootEl.classList.toggle("is-yolo-active", enabled);
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
