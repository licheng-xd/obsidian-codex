import type { TFile } from "obsidian";

export interface AssistantLinkOpenerOptions {
  readonly sourcePath: string;
  readonly resolveLinkpath: (linktext: string, sourcePath: string) => TFile | null;
  readonly openLinkText: (linktext: string, sourcePath: string) => Promise<void>;
}

const BOUND_DATASET_KEY = "obsidianCodexLinkBound";
const SKIPPED_TAG_NAMES = new Set(["A", "CODE", "PRE"]);
const EXTERNAL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/iu;
const FILE_REFERENCE_SUFFIX_PATTERN = /\.[A-Za-z0-9]+(?:#[^\s#]+)?$/u;
const WIKILINK_WRAPPER_PATTERN = /^\[\[([\s\S]+?)\]\]$/u;

function decodeLinkCandidate(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeHrefCandidate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#") || EXTERNAL_SCHEME_PATTERN.test(trimmed) || trimmed.startsWith("//")) {
    return null;
  }

  return decodeLinkCandidate(trimmed.replace(/^\.\/+/, ""));
}

export function normalizeVaultLinkCandidate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const wikilinkMatch = trimmed.match(WIKILINK_WRAPPER_PATTERN);
  if (wikilinkMatch?.[1]) {
    return wikilinkMatch[1].trim();
  }

  return normalizeHrefCandidate(trimmed) ?? decodeLinkCandidate(trimmed);
}

export function looksLikeStandaloneFileReference(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return trimmed.includes("/") || FILE_REFERENCE_SUFFIX_PATTERN.test(trimmed);
}

export function resolveOpenableLinkText(
  value: string,
  sourcePath: string,
  resolveLinkpath: (linktext: string, sourcePath: string) => TFile | null
): string | null {
  const normalized = normalizeVaultLinkCandidate(value);
  if (!normalized) {
    return null;
  }

  return resolveLinkpath(normalized, sourcePath) ? normalized : null;
}

function getAnchorCandidate(anchorEl: HTMLAnchorElement): string | null {
  return (
    anchorEl.getAttribute("data-href") ??
    normalizeHrefCandidate(anchorEl.getAttribute("href") ?? "") ??
    anchorEl.textContent
  );
}

function bindOpenHandler(
  anchorEl: HTMLAnchorElement,
  linktext: string,
  options: AssistantLinkOpenerOptions
): void {
  if (anchorEl.dataset[BOUND_DATASET_KEY] === "true") {
    return;
  }

  anchorEl.dataset[BOUND_DATASET_KEY] = "true";
  anchorEl.dataset.href = linktext;
  anchorEl.classList.add("internal-link", "obsidian-codex-openable-link");
  anchorEl.setAttribute("href", linktext);
  anchorEl.setAttribute("aria-label", `Open ${linktext}`);
  anchorEl.addEventListener("click", (event) => {
    event.preventDefault();
    void options.openLinkText(linktext, options.sourcePath);
  });
}

function enhanceExistingAnchors(containerEl: HTMLElement, options: AssistantLinkOpenerOptions): void {
  for (const anchorEl of Array.from(containerEl.querySelectorAll("a"))) {
    const candidate = getAnchorCandidate(anchorEl);
    if (!candidate) {
      continue;
    }

    const resolvedLink = resolveOpenableLinkText(candidate, options.sourcePath, options.resolveLinkpath);
    if (!resolvedLink) {
      continue;
    }

    bindOpenHandler(anchorEl, resolvedLink, options);
  }
}

function replaceTextNodeWithAnchor(
  textNode: ChildNode & { textContent: string | null; parentNode: ParentNode | null },
  linktext: string,
  options: AssistantLinkOpenerOptions
): void {
  const originalText = textNode.textContent ?? "";
  const trimmedText = originalText.trim();
  const parentNode = textNode.parentNode;
  if (!trimmedText || !parentNode) {
    return;
  }

  const startIndex = originalText.indexOf(trimmedText);
  const endIndex = startIndex + trimmedText.length;
  const leadingText = originalText.slice(0, startIndex);
  const trailingText = originalText.slice(endIndex);
  const document = (parentNode as HTMLElement).ownerDocument;

  if (leadingText) {
    parentNode.insertBefore(document.createTextNode(leadingText), textNode);
  }

  const anchorEl = document.createElement("a");
  anchorEl.textContent = trimmedText;
  bindOpenHandler(anchorEl, linktext, options);
  parentNode.insertBefore(anchorEl, textNode);

  if (trailingText) {
    parentNode.insertBefore(document.createTextNode(trailingText), textNode);
  }

  parentNode.removeChild(textNode);
}

function enhanceStandaloneTextNodes(containerEl: HTMLElement, options: AssistantLinkOpenerOptions): void {
  const visitNode = (node: ChildNode): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      const trimmed = text.trim();
      if (!trimmed || !looksLikeStandaloneFileReference(trimmed)) {
        return;
      }

      const resolvedLink = resolveOpenableLinkText(trimmed, options.sourcePath, options.resolveLinkpath);
      if (!resolvedLink) {
        return;
      }

      replaceTextNodeWithAnchor(node, resolvedLink, options);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as HTMLElement;
    if (SKIPPED_TAG_NAMES.has(element.tagName)) {
      return;
    }

    for (const childNode of Array.from(element.childNodes)) {
      visitNode(childNode);
    }
  };

  for (const childNode of Array.from(containerEl.childNodes)) {
    visitNode(childNode);
  }
}

export function enhanceRenderedAssistantLinks(
  containerEl: HTMLElement,
  options: AssistantLinkOpenerOptions
): void {
  enhanceExistingAnchors(containerEl, options);
  enhanceStandaloneTextNodes(containerEl, options);
}
