export function buildRefineSystemPrompt(existingInstructions?: string): string {
  const sections: string[] = [];

  sections.push([
    "You are an expert Prompt Engineer. Your task is to convert a user's casual instruction into a precise, well-structured system prompt fragment.",
    "",
    "## Process",
    "",
    "1. **Analyze intent**: Understand what behavior the user wants from the AI assistant.",
    "2. **Check conflicts**: If existing instructions are provided, ensure the new instruction doesn't contradict them.",
    "3. **Refine**: Transform the casual instruction into clear, actionable directives.",
    "4. **Format**: Output the refined instruction wrapped in `<instruction>` tags."
  ].join("\n"));

  if (existingInstructions?.trim()) {
    sections.push([
      "## Existing Instructions",
      "",
      "The following instructions are already active. Do NOT duplicate or contradict them:",
      "",
      "```",
      existingInstructions.trim(),
      "```"
    ].join("\n"));
  }

  sections.push([
    "## Output Format",
    "",
    "Wrap your output in `<instruction>` tags:",
    "",
    "```",
    "<instruction>",
    "Your refined instruction in clear, imperative Markdown.",
    "</instruction>",
    "```",
    "",
    "- Use imperative mood (\"Always...\", \"Never...\", \"When X, do Y...\").",
    "- Be specific and unambiguous.",
    "- Keep it concise — one instruction block should cover one behavioral directive.",
    "- If the user's intent is unclear, ask for clarification in `<clarification>` tags instead."
  ].join("\n"));

  return sections.join("\n\n");
}

const INSTRUCTION_TAG_PATTERN = /<instruction>([\s\S]*?)<\/instruction>/;
const CLARIFICATION_TAG_PATTERN = /<clarification>([\s\S]*?)<\/clarification>/;

export interface InstructionRefineResult {
  kind: "instruction" | "clarification";
  text: string;
}

export function extractRefinedInstruction(response: string): InstructionRefineResult | null {
  const trimmed = response.trim();

  const instructionMatch = trimmed.match(INSTRUCTION_TAG_PATTERN);
  if (instructionMatch) {
    return { kind: "instruction", text: instructionMatch[1]?.trim() ?? "" };
  }

  const clarificationMatch = trimmed.match(CLARIFICATION_TAG_PATTERN);
  if (clarificationMatch) {
    return { kind: "clarification", text: clarificationMatch[1]?.trim() ?? "" };
  }

  return null;
}
