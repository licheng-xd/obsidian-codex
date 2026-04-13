export interface ChatSubmitKeyInput {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
}

function isSubmitEnterKey(key: string): boolean {
  return key === "Enter" || key === "NumpadEnter";
}

export interface TextInsertionInput {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  text: string;
}

export interface TextInsertionResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function shouldSubmitFromKeydown(input: ChatSubmitKeyInput): boolean {
  if (!isSubmitEnterKey(input.key) || input.isComposing) {
    return false;
  }

  return !input.metaKey && !input.ctrlKey && !input.shiftKey && !input.altKey;
}

export function shouldInsertLineBreakFromKeydown(input: ChatSubmitKeyInput): boolean {
  if (!isSubmitEnterKey(input.key) || input.isComposing) {
    return false;
  }

  return Boolean(input.metaKey || input.ctrlKey) && !input.shiftKey && !input.altKey;
}

export function insertTextAtSelection(input: TextInsertionInput): TextInsertionResult {
  const boundedSelectionStart = Math.max(0, Math.min(input.selectionStart, input.value.length));
  const boundedSelectionEnd = Math.max(boundedSelectionStart, Math.min(input.selectionEnd, input.value.length));
  const value =
    `${input.value.slice(0, boundedSelectionStart)}${input.text}${input.value.slice(boundedSelectionEnd)}`;
  const caretOffset = boundedSelectionStart + input.text.length;

  return {
    value,
    selectionStart: caretOffset,
    selectionEnd: caretOffset
  };
}
