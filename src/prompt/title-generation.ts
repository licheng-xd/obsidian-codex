export const TITLE_GENERATION_SYSTEM_PROMPT = [
  "You are a specialist in summarizing user intent.",
  "",
  "**Task**: Generate a **concise, descriptive title** (max 50 characters) summarizing the user's task or request.",
  "",
  "**Rules**:",
  "- Use sentence case (capitalize only the first word and proper nouns).",
  "- No periods, quotes, or surrounding punctuation.",
  "- Start with a strong verb or key noun that captures the essence.",
  "- If the user writes in Chinese, generate the title in Chinese.",
  "- Forbidden phrases: \"Help me\", \"Please\", \"I want to\", \"Can you\", \"帮我\", \"请\", \"我想\".",
  "- If the input is a greeting or low-signal message, return \"New chat\".",
  "",
  "**Output**: Return ONLY the raw title text. No explanation, no quotes, no formatting."
].join("\n");

export function buildTitleGenerationPrompt(userMessage: string): string {
  return `Generate a title for this user message:\n\n${userMessage}`;
}
