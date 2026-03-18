import type { MappedEvent, MappedSummaryEvent } from "./types";

const SUMMARY_PREVIEW_LIMIT = 56;

export function describeFileChangeKind(kind: "add" | "delete" | "update"): string {
  switch (kind) {
    case "add":
      return "新增";
    case "delete":
      return "删除";
    case "update":
      return "修改";
  }
}

export function formatExitCode(code: number | undefined): string {
  return code === undefined ? "Running" : `Exit ${code}`;
}

export function describeActivityType(type: "mcp_tool_call" | "web_search" | "todo_list"): string {
  switch (type) {
    case "mcp_tool_call":
      return "MCP Tool";
    case "web_search":
      return "Web Search";
    case "todo_list":
      return "Todo List";
  }
}

function toSingleLinePreview(text: string, limit = SUMMARY_PREVIEW_LIMIT): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }

  return normalized.length > limit
    ? `${normalized.slice(0, limit - 1).trimEnd()}...`
    : normalized;
}

function getReasoningSummary(text: string): { label: string; preview: string } {
  return {
    label: "已思考",
    preview: toSingleLinePreview(text)
  };
}

function getCommandSummary(
  command: string,
  status: "in_progress" | "completed" | "failed"
): { label: string; preview: string } {
  return {
    label: status === "in_progress" ? "正在运行" : "已运行",
    preview: toSingleLinePreview(command)
  };
}

function getActivitySummary(
  activityType: "mcp_tool_call" | "web_search" | "todo_list",
  title: string,
  status?: "in_progress" | "completed" | "failed"
): { label: string; preview?: string } {
  if (activityType === "mcp_tool_call") {
    return {
      label: status === "in_progress" ? "正在调用" : "已调用",
      preview: toSingleLinePreview(title)
    };
  }

  if (activityType === "web_search") {
    return {
      label: status === "in_progress" ? "正在搜索" : "已搜索",
      preview: toSingleLinePreview(title)
    };
  }

  return {
    label: status === "in_progress" ? "正在更新任务列表" : "已更新任务列表",
    preview: toSingleLinePreview(title)
  };
}

function prepareCard(
  containerEl: HTMLElement,
  existingEl: HTMLElement | undefined,
  classNames: string
): HTMLDivElement {
  const cardEl = (existingEl ?? containerEl.ownerDocument.createElement("div")) as HTMLDivElement;
  cardEl.className = classNames;
  cardEl.replaceChildren();
  return cardEl;
}

function isDetailsElement(element: HTMLElement | undefined): boolean {
  return element?.tagName?.toLowerCase() === "details";
}

function prepareCollapsibleCard(
  containerEl: HTMLElement,
  existingEl: HTMLElement | undefined,
  classNames: string,
  defaultCollapsed: boolean
): {
  readonly cardEl: HTMLElement;
  readonly summaryEl: HTMLElement;
  readonly contentEl: HTMLDivElement;
} {
  const cardEl: HTMLElement = isDetailsElement(existingEl)
    ? existingEl!
    : containerEl.ownerDocument.createElement("details");
  const initialOpen = isDetailsElement(existingEl)
    ? (existingEl as HTMLDetailsElement).open
    : !defaultCollapsed;
  cardEl.className = classNames;
  (cardEl as HTMLDetailsElement).open = initialOpen;
  cardEl.replaceChildren();

  const summaryEl = containerEl.ownerDocument.createElement("summary");
  summaryEl.className = "obsidian-codex-card-summary";
  cardEl.appendChild(summaryEl);

  const contentEl = containerEl.ownerDocument.createElement("div");
  contentEl.className = "obsidian-codex-card-content";
  cardEl.appendChild(contentEl);

  appendIfNeeded(containerEl, cardEl);
  return { cardEl, summaryEl, contentEl };
}

function appendIfNeeded(containerEl: HTMLElement, cardEl: HTMLElement): void {
  if (!cardEl.parentElement) {
    containerEl.appendChild(cardEl);
  }
}

function appendTextBlock(
  cardEl: HTMLElement,
  className: string,
  text: string
): HTMLDivElement {
  const blockEl = cardEl.ownerDocument.createElement("div");
  blockEl.className = className;
  blockEl.textContent = text;
  cardEl.appendChild(blockEl);
  return blockEl;
}

function appendHeader(
  cardEl: HTMLElement,
  title: string,
  statusLabel?: string,
  statusClassName?: string
): HTMLDivElement {
  const headerEl = cardEl.ownerDocument.createElement("div");
  headerEl.className = "obsidian-codex-card-header";

  const titleEl = cardEl.ownerDocument.createElement("div");
  titleEl.className = "obsidian-codex-card-title";
  titleEl.textContent = title;
  headerEl.appendChild(titleEl);

  if (statusLabel) {
    const statusEl = cardEl.ownerDocument.createElement("span");
    statusEl.className = statusClassName ?? "obsidian-codex-card-badge";
    statusEl.textContent = statusLabel;
    headerEl.appendChild(statusEl);
  }

  cardEl.appendChild(headerEl);
  return headerEl;
}

function appendSystemEventSummary(
  summaryEl: HTMLElement,
  label: string,
  preview?: string
): HTMLDivElement {
  const rowEl = summaryEl.ownerDocument.createElement("div");
  rowEl.className = "obsidian-codex-system-event-row";

  const labelEl = summaryEl.ownerDocument.createElement("span");
  labelEl.className = "obsidian-codex-system-event-label";
  labelEl.textContent = label;
  rowEl.appendChild(labelEl);

  if (preview) {
    const previewEl = summaryEl.ownerDocument.createElement("span");
    previewEl.className = "obsidian-codex-system-event-preview";
    previewEl.textContent = preview;
    rowEl.appendChild(previewEl);
  }

  summaryEl.appendChild(rowEl);
  return rowEl;
}

export function renderEventCard(
  containerEl: HTMLElement,
  event: MappedEvent | MappedSummaryEvent,
  existingEl?: HTMLElement
): HTMLElement {
  switch (event.type) {
    case "text": {
      const cardEl = prepareCard(
        containerEl,
        existingEl,
        "obsidian-codex-response"
      );
      cardEl.textContent = event.text;
      appendIfNeeded(containerEl, cardEl);
      return cardEl;
    }
    case "reasoning": {
      const { cardEl, summaryEl, contentEl } = prepareCollapsibleCard(
        containerEl,
        existingEl,
        "obsidian-codex-system-event is-reasoning",
        true
      );
      const summary = getReasoningSummary(event.text);
      appendSystemEventSummary(summaryEl, summary.label, summary.preview);
      appendTextBlock(contentEl, "obsidian-codex-system-event-detail is-reasoning", event.text);
      return cardEl;
    }
    case "command": {
      const { cardEl, summaryEl, contentEl } = prepareCollapsibleCard(
        containerEl,
        existingEl,
        "obsidian-codex-system-event is-command",
        true
      );
      const summary = getCommandSummary(event.command, event.status);
      appendSystemEventSummary(summaryEl, summary.label, summary.preview);
      appendTextBlock(contentEl, "obsidian-codex-card-code", event.command);

      if (event.aggregatedOutput) {
        const outputEl = cardEl.ownerDocument.createElement("pre");
        outputEl.className = "obsidian-codex-card-output";
        outputEl.textContent = event.aggregatedOutput;
        contentEl.appendChild(outputEl);
      }

      return cardEl;
    }
    case "file_change": {
      const { cardEl, summaryEl, contentEl } = prepareCollapsibleCard(
        containerEl,
        existingEl,
        "obsidian-codex-system-event is-file-change",
        true
      );
      appendSystemEventSummary(summaryEl, "已编辑的文件");
      const listEl = cardEl.ownerDocument.createElement("ul");
      listEl.className = "obsidian-codex-file-change-list";

      for (const change of event.changes) {
        const itemEl = cardEl.ownerDocument.createElement("li");
        const badgeEl = cardEl.ownerDocument.createElement("span");
        badgeEl.className = `obsidian-codex-file-change-badge is-${change.kind}`;
        badgeEl.textContent = describeFileChangeKind(change.kind);
        itemEl.appendChild(badgeEl);
        itemEl.append(` ${change.path}`);
        listEl.appendChild(itemEl);
      }

      contentEl.appendChild(listEl);
      return cardEl;
    }
    case "activity": {
      const { cardEl, summaryEl, contentEl } = prepareCollapsibleCard(
        containerEl,
        existingEl,
        "obsidian-codex-system-event is-activity",
        true
      );
      const summary = getActivitySummary(event.activityType, event.title, event.status);
      appendSystemEventSummary(summaryEl, summary.label, summary.preview);
      appendTextBlock(contentEl, "obsidian-codex-card-body", event.title);
      if (event.detail) {
        appendTextBlock(contentEl, "obsidian-codex-card-detail", event.detail);
      }
      return cardEl;
    }
    case "summary": {
      const { cardEl, summaryEl, contentEl } = prepareCollapsibleCard(
        containerEl,
        existingEl,
        "obsidian-codex-system-event is-summary",
        true
      );
      appendSystemEventSummary(summaryEl, event.label, event.preview);

      const listEl = cardEl.ownerDocument.createElement("div");
      listEl.className = "obsidian-codex-system-event-list";
      for (const line of event.lines) {
        appendTextBlock(listEl, "obsidian-codex-system-event-detail", line);
      }
      contentEl.appendChild(listEl);
      return cardEl;
    }
    case "error":
    case "turn_failed": {
      const cardEl = prepareCard(containerEl, existingEl, "obsidian-codex-tool-block is-error");
      appendHeader(cardEl, "Error", "Failed", "obsidian-codex-card-badge is-danger");
      appendTextBlock(cardEl, "obsidian-codex-card-body", event.message);
      appendIfNeeded(containerEl, cardEl);
      return cardEl;
    }
    case "turn_started":
    case "turn_completed":
    case "noop":
      return existingEl ?? containerEl.ownerDocument.createElement("div");
  }
}
