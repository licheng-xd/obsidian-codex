export interface MentionQueryMatch {
  query: string;
  rangeStart: number;
  rangeEnd: number;
}

function isMentionBoundaryCharacter(value: string | undefined): boolean {
  return value === undefined || /\s/.test(value);
}

function isMentionTokenCharacter(value: string | undefined): boolean {
  return value !== undefined && value !== "" && !/\s/.test(value);
}

export function findActiveMentionQuery(value: string, caretOffset: number): MentionQueryMatch | null {
  const boundedCaret = Math.max(0, Math.min(caretOffset, value.length));
  const nextCharacter = value[boundedCaret];
  if (isMentionTokenCharacter(nextCharacter)) {
    return null;
  }

  let cursor = boundedCaret - 1;
  while (cursor >= 0) {
    const character = value[cursor];
    if (character === "@") {
      const previousCharacter = value[cursor - 1];
      if (!isMentionBoundaryCharacter(previousCharacter)) {
        return null;
      }

      return {
        query: value.slice(cursor + 1, boundedCaret),
        rangeStart: cursor,
        rangeEnd: boundedCaret
      };
    }

    if (/\s/.test(character)) {
      return null;
    }

    cursor -= 1;
  }

  return null;
}
