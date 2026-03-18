export const VAULT_ROOT_DIRECTORY = ".";

export type VaultSaveConfidence = "high" | "medium" | "low";
export type VaultContentType =
  | "report"
  | "analysis"
  | "meeting-note"
  | "project-doc"
  | "research-note"
  | "daily-note"
  | "general-note";

export interface GuidanceDocument {
  readonly path: string;
  readonly content: string;
}

export interface DirectorySnapshot {
  readonly path: string;
  readonly sampleFiles: ReadonlyArray<string>;
}

export interface VaultSavePlannerInput {
  readonly userInput: string;
  readonly guidanceDocuments?: ReadonlyArray<GuidanceDocument>;
  readonly directorySnapshot?: ReadonlyArray<DirectorySnapshot>;
  readonly activeNotePath?: string;
  readonly draftTitle?: string;
  readonly draftExcerpt?: string;
}

export interface VaultSaveTargetPlan {
  readonly preferredDirectory: string;
  readonly reason: string;
  readonly confidence: VaultSaveConfidence;
  readonly fallbackChain: ReadonlyArray<string>;
  readonly contentType: VaultContentType;
}

interface CandidateScore {
  readonly path: string;
  readonly score: number;
  readonly confidence: VaultSaveConfidence;
  readonly reason: string;
}

const RULE_VERB_PATTERN =
  /(放到|放在|存到|保存到|归档到|写到|放入|保存|存放|归档|use|uses|store|stores|save|saves|keep|keeps|belongs in|goes in)/i;
const PATH_TOKEN_PATTERN = /(?:`([^`]+)`|"([^"]+)"|'([^']+)'|([A-Za-z0-9_\-\u4e00-\u9fa5]+(?:\/[A-Za-z0-9_\-\u4e00-\u9fa5]+)+))/gu;
const DIRECTORY_NAME_HINTS: Record<VaultContentType, ReadonlyArray<string>> = {
  report: ["report", "reports", "报告", "summary", "summaries", "analysis", "analyses"],
  analysis: ["analysis", "analyses", "review", "compare", "comparison", "对比", "分析", "调研"],
  "meeting-note": ["meeting", "meetings", "sync", "retro", "纪要", "会议", "周会", "讨论"],
  "project-doc": ["project", "projects", "spec", "specs", "doc", "docs", "proposal", "roadmap", "方案", "设计", "需求", "项目"],
  "research-note": ["research", "reference", "references", "paper", "papers", "study", "studies", "资料", "论文", "研究"],
  "daily-note": ["daily", "journal", "journals", "log", "logs", "diary", "日报", "日志", "日记"],
  "general-note": ["note", "notes", "inbox", "capture", "captures", "scratch", "memo", "memos", "笔记"]
};
const CONTENT_TYPE_KEYWORDS: Record<VaultContentType, ReadonlyArray<string>> = {
  report: ["report", "reports", "summary", "summaries", "报告", "总结", "汇总", "comparison", "对比", "评估"],
  analysis: ["analysis", "review", "compare", "comparison", "分析", "调研", "评审"],
  "meeting-note": ["meeting", "meetings", "sync", "retro", "minutes", "纪要", "会议", "讨论", "同步会"],
  "project-doc": ["project", "projects", "spec", "specs", "proposal", "roadmap", "plan", "方案", "设计", "需求", "项目"],
  "research-note": ["research", "paper", "papers", "study", "reference", "references", "资料", "论文", "研究"],
  "daily-note": ["daily", "journal", "journals", "log", "logs", "diary", "日报", "日志", "日记"],
  "general-note": ["note", "notes", "memo", "memos", "文档", "笔记"]
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeDirectory(path: string): string {
  const trimmed = path.trim().replace(/^\.?\//, "").replace(/\/+$/, "");
  return trimmed || VAULT_ROOT_DIRECTORY;
}

function uniqueDirectories(paths: ReadonlyArray<string>): string[] {
  return Array.from(new Set(paths.map(normalizeDirectory)));
}

function formatDirectoryForReason(path: string): string {
  return path === VAULT_ROOT_DIRECTORY ? "vault root" : path;
}

function formatContentTypeForReason(contentType: VaultContentType): string {
  return contentType.replace(/-/g, " ");
}

function getCandidateBasename(path: string): string {
  if (path === VAULT_ROOT_DIRECTORY) {
    return "vault root";
  }

  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

export function deriveCurrentNoteSiblingDirectory(activeNotePath?: string): string | null {
  if (!activeNotePath) {
    return null;
  }

  const lastSlashIndex = activeNotePath.lastIndexOf("/");
  if (lastSlashIndex === -1) {
    return VAULT_ROOT_DIRECTORY;
  }

  return normalizeDirectory(activeNotePath.slice(0, lastSlashIndex));
}

export function requestLooksLikeLocalSave(userInput: string): boolean {
  return /(保存|存到本地|存本地|写入文件|写到文件|导出|落盘|save|save locally|store locally|write to file|export)/i.test(
    userInput
  );
}

function classifyContentType(input: VaultSavePlannerInput): VaultContentType {
  const haystack = normalizeText(
    [input.userInput, input.draftTitle, input.draftExcerpt].filter(Boolean).join(" ")
  );

  const rankedTypes: VaultContentType[] = [
    "meeting-note",
    "daily-note",
    "report",
    "analysis",
    "project-doc",
    "research-note",
    "general-note"
  ];

  let bestType: VaultContentType = "general-note";
  let bestScore = 0;

  for (const type of rankedTypes) {
    const score = CONTENT_TYPE_KEYWORDS[type].reduce((total, keyword) => {
      return haystack.includes(normalizeText(keyword)) ? total + 1 : total;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestType;
}

function extractGuidancePathCandidates(documents: ReadonlyArray<GuidanceDocument>): string[] {
  const candidates: string[] = [];

  for (const document of documents) {
    for (const match of document.content.matchAll(PATH_TOKEN_PATTERN)) {
      const candidate = match[1] ?? match[2] ?? match[3] ?? match[4];
      if (!candidate) {
        continue;
      }

      candidates.push(candidate);
    }
  }

  return uniqueDirectories(candidates);
}

function lineMatchesContentType(line: string, contentType: VaultContentType): boolean {
  return CONTENT_TYPE_KEYWORDS[contentType].some((keyword) => line.includes(normalizeText(keyword)));
}

function buildGuidanceCandidateScores(
  candidates: ReadonlyArray<string>,
  documents: ReadonlyArray<GuidanceDocument>,
  contentType: VaultContentType
): CandidateScore[] {
  const normalizedCandidates = candidates.map((candidate) => normalizeDirectory(candidate));
  const scores: CandidateScore[] = [];

  for (const candidate of normalizedCandidates) {
    const candidateBase = normalizeText(getCandidateBasename(candidate));
    let bestScore = 0;
    let bestReason = "";

    for (const document of documents) {
      const lines = document.content.split(/\r?\n/);
      for (const rawLine of lines) {
        const line = normalizeText(rawLine);
        if (!line || !RULE_VERB_PATTERN.test(rawLine)) {
          continue;
        }

        const mentionsCandidate =
          line.includes(normalizeText(candidate)) || line.includes(candidateBase);
        if (!mentionsCandidate || !lineMatchesContentType(line, contentType)) {
          continue;
        }

        const score = line.includes(normalizeText(candidate)) ? 140 : 110;
        if (score > bestScore) {
          bestScore = score;
          bestReason = `${document.path} suggests ${formatContentTypeForReason(contentType)} content belongs in ${formatDirectoryForReason(candidate)}.`;
        }
      }
    }

    if (bestScore > 0) {
      scores.push({
        path: candidate,
        score: bestScore,
        confidence: "high",
        reason: bestReason
      });
    }
  }

  return scores;
}

function scoreDirectorySnapshot(
  snapshot: DirectorySnapshot,
  contentType: VaultContentType
): CandidateScore | null {
  const normalizedPath = normalizeDirectory(snapshot.path);
  const haystack = normalizeText([normalizedPath, ...snapshot.sampleFiles].join(" "));
  let score = 0;

  for (const hint of DIRECTORY_NAME_HINTS[contentType]) {
    const normalizedHint = normalizeText(hint);
    if (haystack.includes(normalizedHint)) {
      score += normalizedPath.includes(normalizedHint) ? 35 : 14;
    }
  }

  if (contentType === "daily-note") {
    const hasDatePattern = snapshot.sampleFiles.some((file) => /^\d{4}-\d{2}-\d{2}/.test(file));
    if (hasDatePattern) {
      score += 28;
    }
  }

  if (score === 0) {
    return null;
  }

  return {
    path: normalizedPath,
    score,
    confidence: "medium",
    reason: `directory structure and file names suggest ${formatDirectoryForReason(normalizedPath)} is used for ${formatContentTypeForReason(contentType)} content.`
  };
}

function dedupeCandidateScores(candidates: ReadonlyArray<CandidateScore>): CandidateScore[] {
  const bestByPath = new Map<string, CandidateScore>();

  for (const candidate of candidates) {
    const existing = bestByPath.get(candidate.path);
    if (!existing || candidate.score > existing.score) {
      bestByPath.set(candidate.path, candidate);
    }
  }

  return Array.from(bestByPath.values()).sort((left, right) => right.score - left.score);
}

function buildFallbackChain(activeNotePath?: string, preferredDirectory?: string): string[] {
  const siblingDirectory = deriveCurrentNoteSiblingDirectory(activeNotePath);
  const fallbackCandidates = [
    ...(siblingDirectory ? [siblingDirectory] : []),
    VAULT_ROOT_DIRECTORY
  ];

  return uniqueDirectories(fallbackCandidates).filter((path) => path !== preferredDirectory);
}

export function planVaultSaveTarget(input: VaultSavePlannerInput): VaultSaveTargetPlan {
  const contentType = classifyContentType(input);
  const guidanceDocuments = input.guidanceDocuments ?? [];
  const directorySnapshot = input.directorySnapshot ?? [];
  const candidatePaths = uniqueDirectories([
    ...directorySnapshot.map((snapshot) => snapshot.path),
    ...extractGuidancePathCandidates(guidanceDocuments)
  ]);

  const guidanceCandidates = buildGuidanceCandidateScores(candidatePaths, guidanceDocuments, contentType);
  const structuralCandidates = directorySnapshot
    .map((snapshot) => scoreDirectorySnapshot(snapshot, contentType))
    .filter((candidate): candidate is CandidateScore => candidate !== null);
  const rankedCandidates = dedupeCandidateScores([...guidanceCandidates, ...structuralCandidates]);
  const winner = rankedCandidates[0];

  if (winner) {
    return {
      preferredDirectory: winner.path,
      reason: winner.reason,
      confidence: winner.confidence,
      fallbackChain: buildFallbackChain(input.activeNotePath, winner.path),
      contentType
    };
  }

  const siblingDirectory = deriveCurrentNoteSiblingDirectory(input.activeNotePath);
  if (siblingDirectory) {
    return {
      preferredDirectory: siblingDirectory,
      reason: `No clear vault rule matched, so the current note sibling directory ${formatDirectoryForReason(siblingDirectory)} is the safest fallback.`,
      confidence: "low",
      fallbackChain: buildFallbackChain(input.activeNotePath, siblingDirectory),
      contentType
    };
  }

  return {
    preferredDirectory: VAULT_ROOT_DIRECTORY,
    reason: "No clear vault rule matched and there is no active note, so the vault root is the final fallback.",
    confidence: "low",
    fallbackChain: [],
    contentType
  };
}
