import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderMarkdownMessage } from "../src/assistant-markdown";

const renderMock = vi.fn();

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  className = "";
  parentElement: FakeElement | null = null;
  textContent = "";

  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDocument
  ) {}

  get childNodes(): FakeElement[] {
    return this.children;
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.children.splice(0, this.children.length);
    this.textContent = "";
    for (const node of nodes) {
      this.appendChild(node);
    }
  }
}

function createContainer(): FakeElement {
  return new FakeDocument().createElement("div");
}

describe("assistant-markdown", () => {
  beforeEach(() => {
    renderMock.mockReset();
  });

  it("renders markdown through Obsidian MarkdownRenderer", async () => {
    renderMock.mockImplementation(async (markdown, el: FakeElement) => {
      const paragraphEl = el.ownerDocument.createElement("p");
      paragraphEl.textContent = `rendered:${markdown}`;
      el.appendChild(paragraphEl);
    });

    const containerEl = createContainer();

    await renderMarkdownMessage(
      containerEl as unknown as HTMLElement,
      "**Hello**",
      "note.md",
      renderMock
    );

    expect(renderMock).toHaveBeenCalledOnce();
    expect(containerEl.children).toHaveLength(1);
    expect(containerEl.children[0]?.tagName).toBe("p");
    expect(containerEl.children[0]?.textContent).toBe("rendered:**Hello**");
  });
});
