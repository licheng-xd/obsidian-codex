export interface ChatSubmitKeyInput {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
}

export function shouldSubmitFromKeydown(input: ChatSubmitKeyInput): boolean {
  if (input.key !== "Enter" || input.isComposing) {
    return false;
  }

  return !input.metaKey && !input.ctrlKey && !input.shiftKey && !input.altKey;
}
