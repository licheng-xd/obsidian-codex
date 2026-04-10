import type { PersistedAssistantEntry, PersistedChatEntry, PersistedSummaryItem } from "./chat-session";
import { renderEventCard } from "./event-cards";
import type { MappedSummaryEvent } from "./types";

interface PersistedAssistantTurnElements {
  metaEl: HTMLDivElement;
  metaLabelEl: HTMLSpanElement;
  metaSignalEl: HTMLSpanElement;
  contentEl: HTMLDivElement;
  eventsEl: HTMLDivElement;
  metaFinalized: boolean;
}

interface PersistedSessionRendererOptions {
  createAssistantTurn: () => PersistedAssistantTurnElements;
  renderMarkdown: (containerEl: HTMLElement, markdown: string) => Promise<void>;
  activateLinks: (containerEl: HTMLElement) => void;
  appendMessage: (entry: Exclude<PersistedChatEntry, PersistedAssistantEntry>) => void;
  refreshCanvasState: () => void;
  scrollMessagesToBottom: () => void;
}

function renderPersistedSummaryItems(
  containerEl: HTMLElement,
  summaries: ReadonlyArray<PersistedSummaryItem>
): void {
  for (const [index, summary] of summaries.entries()) {
    const event: MappedSummaryEvent = {
      type: "summary",
      itemId: `persisted-summary-${index}`,
      label: summary.label,
      preview: summary.preview,
      lines: summary.lines
    };
    renderEventCard(containerEl, event);
  }
}

export async function renderPersistedAssistantTurn(
  entry: PersistedAssistantEntry,
  options: PersistedSessionRendererOptions
): Promise<void> {
  const turn = options.createAssistantTurn();
  turn.metaFinalized = true;
  turn.metaEl.classList.remove("is-live");
  turn.metaLabelEl.textContent = entry.metaLabel;
  turn.metaSignalEl.remove();
  const responseEl = turn.contentEl.createDiv({ cls: "obsidian-codex-response markdown-rendered" });
  await options.renderMarkdown(responseEl, entry.contentMarkdown);
  options.activateLinks(responseEl);
  renderPersistedSummaryItems(turn.eventsEl, entry.summaries);
  options.refreshCanvasState();
  options.scrollMessagesToBottom();
}

export async function renderPersistedSessionEntries(
  entries: ReadonlyArray<PersistedChatEntry>,
  options: PersistedSessionRendererOptions
): Promise<void> {
  for (const entry of entries) {
    if (entry.type === "assistant") {
      await renderPersistedAssistantTurn(entry, options);
      continue;
    }

    options.appendMessage(entry);
  }

  options.refreshCanvasState();
}
