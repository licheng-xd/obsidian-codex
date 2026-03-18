export interface MarkdownRenderFn {
  (markdown: string, containerEl: HTMLElement, sourcePath: string): Promise<void>;
}

const RENDER_VERSION_DATASET_KEY = "obsidianCodexRenderVersion";

export async function renderMarkdownMessage(
  containerEl: HTMLElement,
  markdown: string,
  sourcePath: string,
  renderMarkdown: MarkdownRenderFn
): Promise<void> {
  const nextVersion = String(
    Number(containerEl.dataset[RENDER_VERSION_DATASET_KEY] ?? "0") + 1
  );
  containerEl.dataset[RENDER_VERSION_DATASET_KEY] = nextVersion;

  const scratchEl = containerEl.ownerDocument.createElement("div");
  await renderMarkdown(markdown, scratchEl, sourcePath);

  if (containerEl.dataset[RENDER_VERSION_DATASET_KEY] !== nextVersion) {
    return;
  }

  containerEl.replaceChildren(...Array.from(scratchEl.childNodes) as Node[]);
}
