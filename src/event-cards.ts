import type { MappedEvent } from "./types";

export function describeFileChangeKind(kind: "add" | "delete" | "update"): string {
  switch (kind) {
    case "add":
      return "Added";
    case "delete":
      return "Deleted";
    case "update":
      return "Updated";
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

export function renderEventCard(
  containerEl: HTMLElement,
  event: MappedEvent,
  existingEl?: HTMLElement
): HTMLElement {
  switch (event.type) {
    case "text": {
      const cardEl = prepareCard(
        containerEl,
        existingEl,
        "obsidian-codex-message is-assistant obsidian-codex-card is-text"
      );
      cardEl.textContent = event.text;
      appendIfNeeded(containerEl, cardEl);
      return cardEl;
    }
    case "reasoning": {
      const expanded = existingEl?.dataset.expanded === "true";
      const cardEl = prepareCard(containerEl, existingEl, "obsidian-codex-card is-reasoning");
      cardEl.dataset.expanded = expanded ? "true" : "false";

      const summaryButtonEl = cardEl.ownerDocument.createElement("button");
      summaryButtonEl.className = "obsidian-codex-card-toggle";
      summaryButtonEl.type = "button";
      summaryButtonEl.textContent = expanded ? "Reasoning ▾" : "Reasoning ▸";

      const bodyEl = appendTextBlock(cardEl, "obsidian-codex-card-body", event.text);
      bodyEl.hidden = !expanded;

      summaryButtonEl.addEventListener("click", () => {
        const nextExpanded = cardEl.dataset.expanded !== "true";
        cardEl.dataset.expanded = nextExpanded ? "true" : "false";
        summaryButtonEl.textContent = nextExpanded ? "Reasoning ▾" : "Reasoning ▸";
        bodyEl.hidden = !nextExpanded;
      });

      cardEl.prepend(summaryButtonEl);
      appendIfNeeded(containerEl, cardEl);
      return cardEl;
    }
    case "command": {
      const cardEl = prepareCard(containerEl, existingEl, "obsidian-codex-card is-command");
      const headerEl = appendTextBlock(cardEl, "obsidian-codex-card-title", "Command");
      const statusEl = cardEl.ownerDocument.createElement("span");
      statusEl.className = `obsidian-codex-command-status is-${event.status}`;
      statusEl.textContent = event.status === "in_progress" ? "Running" : formatExitCode(event.exitCode);
      headerEl.appendChild(statusEl);
      appendTextBlock(cardEl, "obsidian-codex-card-code", event.command);

      if (event.aggregatedOutput) {
        const outputEl = cardEl.ownerDocument.createElement("pre");
        outputEl.className = "obsidian-codex-card-output";
        outputEl.textContent = event.aggregatedOutput;
        cardEl.appendChild(outputEl);
      }

      appendIfNeeded(containerEl, cardEl);
      return cardEl;
    }
    case "file_change": {
      const cardEl = prepareCard(containerEl, existingEl, "obsidian-codex-card is-file-change");
      appendTextBlock(
        cardEl,
        "obsidian-codex-card-title",
        `File changes (${event.status === "completed" ? "Completed" : "Failed"})`
      );
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

      cardEl.appendChild(listEl);
      appendIfNeeded(containerEl, cardEl);
      return cardEl;
    }
    case "activity": {
      const cardEl = prepareCard(containerEl, existingEl, "obsidian-codex-card is-activity");
      appendTextBlock(cardEl, "obsidian-codex-card-title", describeActivityType(event.activityType));
      appendTextBlock(cardEl, "obsidian-codex-card-body", event.title);
      if (event.detail) {
        appendTextBlock(cardEl, "obsidian-codex-card-detail", event.detail);
      }
      if (event.status) {
        appendTextBlock(cardEl, "obsidian-codex-card-status", `Status: ${event.status}`);
      }
      appendIfNeeded(containerEl, cardEl);
      return cardEl;
    }
    case "error":
    case "turn_failed": {
      const cardEl = prepareCard(containerEl, existingEl, "obsidian-codex-card is-error");
      appendTextBlock(cardEl, "obsidian-codex-card-title", "Error");
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
