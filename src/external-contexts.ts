import { isAbsolute, normalize, relative, sep } from "node:path";

export function normalizeExternalContextPath(input: string): string {
  const normalized = normalize(input.trim());
  if (normalized.length > 1 && normalized.endsWith(sep)) {
    return normalized.replace(new RegExp(`${sep.replace(/\\/g, "\\\\")}+$`), "");
  }

  return normalized;
}

function isNestedPath(parentPath: string, candidatePath: string): boolean {
  const rel = relative(parentPath, candidatePath);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

export function sanitizeExternalContextRoots(paths: ReadonlyArray<string>): string[] {
  const normalizedRoots = paths
    .filter((path): path is string => typeof path === "string")
    .map((path) => normalizeExternalContextPath(path))
    .filter((path) => path.length > 0 && isAbsolute(path))
    .sort((left, right) => left.length - right.length);

  const acceptedRoots: string[] = [];
  for (const rootPath of normalizedRoots) {
    if (
      acceptedRoots.some(
        (acceptedPath) => acceptedPath === rootPath || isNestedPath(acceptedPath, rootPath)
      )
    ) {
      continue;
    }

    acceptedRoots.push(rootPath);
  }

  return acceptedRoots;
}

export function isWithinExternalContextRoots(
  filePath: string,
  rootPaths: ReadonlyArray<string>
): boolean {
  const normalizedPath = normalizeExternalContextPath(filePath);
  if (!normalizedPath || !isAbsolute(normalizedPath)) {
    return false;
  }

  return sanitizeExternalContextRoots(rootPaths).some((rootPath) => {
    const rel = relative(rootPath, normalizedPath);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  });
}
