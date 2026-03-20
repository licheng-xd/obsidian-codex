interface SearchReferencePathsOptions {
  activeNotePath?: string;
  limit?: number;
}

function getBasename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function scorePath(path: string, normalizedQuery: string): { rank: number; basenameLength: number; path: string } | null {
  const normalizedPath = path.toLowerCase();
  const basename = getBasename(path).toLowerCase();

  if (!normalizedQuery) {
    return {
      rank: 3,
      basenameLength: basename.length,
      path
    };
  }

  if (basename.startsWith(normalizedQuery)) {
    return {
      rank: 0,
      basenameLength: basename.length,
      path
    };
  }

  if (basename.includes(normalizedQuery)) {
    return {
      rank: 1,
      basenameLength: basename.length,
      path
    };
  }

  if (normalizedPath.includes(normalizedQuery)) {
    return {
      rank: 2,
      basenameLength: basename.length,
      path
    };
  }

  return null;
}

export function searchReferencePaths(
  paths: ReadonlyArray<string>,
  query: string,
  options: SearchReferencePathsOptions = {}
): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  const limit = options.limit ?? 8;

  return paths
    .filter((path) => path !== options.activeNotePath)
    .map((path) => scorePath(path, normalizedQuery))
    .filter((match): match is NonNullable<typeof match> => match !== null)
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      if (left.basenameLength !== right.basenameLength) {
        return left.basenameLength - right.basenameLength;
      }

      return left.path.localeCompare(right.path);
    })
    .slice(0, limit)
    .map((match) => match.path);
}
