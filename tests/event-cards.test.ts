import { describe, expect, it } from "vitest";
import {
  describeActivityType,
  describeFileChangeKind,
  formatExitCode,
  renderEventCard
} from "../src/event-cards";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }
}

class FakeElement {
  readonly children: FakeElement[] = [];
  className = "";
  open = false;
  parentElement: FakeElement | null = null;
  textContent = "";

  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDocument
  ) {}

  append(...nodes: Array<FakeElement | string>): void {
    for (const node of nodes) {
      if (typeof node === "string") {
        this.textContent += node;
        continue;
      }

      this.appendChild(node);
    }
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(): void {
    this.children.splice(0, this.children.length);
    this.textContent = "";
  }
}

function createContainer(): FakeElement {
  const doc = new FakeDocument();
  return doc.createElement("div");
}

function flattenText(element: FakeElement): string {
  return `${element.textContent}${element.children.map((child) => flattenText(child)).join("")}`;
}

describe("event-cards helpers", () => {
  it("describes file change kinds", () => {
    expect(describeFileChangeKind("add")).toBe("新增");
    expect(describeFileChangeKind("delete")).toBe("删除");
    expect(describeFileChangeKind("update")).toBe("修改");
  });

  it("formats exit codes", () => {
    expect(formatExitCode(undefined)).toBe("Running");
    expect(formatExitCode(0)).toBe("Exit 0");
    expect(formatExitCode(17)).toBe("Exit 17");
  });

  it("describes activity types", () => {
    expect(describeActivityType("mcp_tool_call")).toBe("MCP Tool");
    expect(describeActivityType("web_search")).toBe("Web Search");
    expect(describeActivityType("todo_list")).toBe("Todo List");
  });

  it("renders reasoning as a collapsed system event", () => {
    const containerEl = createContainer();
    const cardEl = renderEventCard(
      containerEl as unknown as HTMLElement,
      {
        type: "reasoning",
        itemId: "reason-1",
        text: "先浏览文件，再收缩模型列表"
      }
    ) as unknown as FakeElement;

    expect(cardEl.tagName).toBe("details");
    expect(cardEl.open).toBe(false);
    expect(cardEl.className).toContain("obsidian-codex-system-event");
    expect(flattenText(cardEl.children[0]!)).toContain("已思考");
  });

  it("renders command cards as collapsed system events by default", () => {
    const containerEl = createContainer();
    const cardEl = renderEventCard(
      containerEl as unknown as HTMLElement,
      {
        type: "command",
        itemId: "cmd-1",
        command: "pwd",
        aggregatedOutput: "/vault",
        status: "completed",
        exitCode: 0
      }
    ) as unknown as FakeElement;

    expect(cardEl.tagName).toBe("details");
    expect(cardEl.open).toBe(false);
    expect(cardEl.className).toContain("obsidian-codex-system-event");
    expect(flattenText(cardEl.children[0]!)).toContain("已运行");
    expect(flattenText(cardEl.children[0]!)).toContain("pwd");
  });

  it("renders activity cards as collapsed system events by default", () => {
    const containerEl = createContainer();
    const cardEl = renderEventCard(
      containerEl as unknown as HTMLElement,
      {
        type: "activity",
        itemId: "tool-1",
        activityType: "mcp_tool_call",
        title: "Read workspace files",
        detail: "Scanning notes",
        status: "in_progress"
      }
    ) as unknown as FakeElement;

    expect(cardEl.tagName).toBe("details");
    expect(cardEl.open).toBe(false);
    expect(flattenText(cardEl.children[0]!)).toContain("正在调用");
    expect(flattenText(cardEl.children[0]!)).toContain("Read workspace files");
  });

  it("renders file change cards as collapsed system events by default", () => {
    const containerEl = createContainer();
    const cardEl = renderEventCard(
      containerEl as unknown as HTMLElement,
      {
        type: "file_change",
        itemId: "file-1",
        status: "completed",
        changes: [{ path: "src/main.ts", kind: "update" }]
      }
    ) as unknown as FakeElement;

    expect(cardEl.tagName).toBe("details");
    expect(cardEl.open).toBe(false);
    expect(flattenText(cardEl.children[0]!)).toContain("已编辑的文件");
  });

  it("preserves expanded state when rerendering an existing command card", () => {
    const containerEl = createContainer();
    const initialEl = renderEventCard(
      containerEl as unknown as HTMLElement,
      {
        type: "command",
        itemId: "cmd-2",
        command: "ls",
        aggregatedOutput: "",
        status: "in_progress"
      }
    ) as unknown as FakeElement;

    initialEl.open = true;

    const rerenderedEl = renderEventCard(
      containerEl as unknown as HTMLElement,
      {
        type: "command",
        itemId: "cmd-2",
        command: "ls",
        aggregatedOutput: "note.md",
        status: "completed",
        exitCode: 0
      },
      initialEl as unknown as HTMLElement
    ) as unknown as FakeElement;

    expect(rerenderedEl.open).toBe(true);
  });
});
