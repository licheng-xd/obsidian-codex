import { describe, expect, it } from "vitest";
import {
  buildInlineEditPrompt,
  buildInlineEditReview,
  unwrapInlineEditResponse
} from "../src/inline-edit";

describe("inline edit prompt builder", () => {
  it("builds a rewrite prompt around the selected text", () => {
    const prompt = buildInlineEditPrompt({
      mode: "rewrite-selection",
      instruction: "压缩成一句话",
      notePath: "Inbox/draft.md",
      documentText: "前文段落。\n这里是需要改写的选中文本。\n后文段落。",
      rangeStart: 6,
      rangeEnd: 17
    });

    expect(prompt).toContain("Task: Rewrite the selected text inside the current note.");
    expect(prompt).toContain("Instruction:\n压缩成一句话");
    expect(prompt).toContain("Note path: Inbox/draft.md");
    expect(prompt).toContain("Selected text:\n这里是需要改写的");
    expect(prompt).toContain("Return only the replacement text.");
  });

  it("builds an insert prompt around the cursor position", () => {
    const prompt = buildInlineEditPrompt({
      mode: "insert-at-cursor",
      instruction: "补一段过渡句",
      notePath: "Inbox/draft.md",
      documentText: "第一段。\n\n第三段。",
      rangeStart: 5,
      rangeEnd: 5
    });

    expect(prompt).toContain("Task: Generate text to insert at the cursor.");
    expect(prompt).toContain("Instruction:\n补一段过渡句");
    expect(prompt).toContain("Text before cursor:");
    expect(prompt).toContain("Text after cursor:");
    expect(prompt).toContain("Return only the text to insert.");
  });
});

describe("inline edit response normalization", () => {
  it("unwraps a single fenced block response", () => {
    expect(unwrapInlineEditResponse("```markdown\n改写后的内容\n```")).toBe("改写后的内容");
  });

  it("keeps plain text responses unchanged except trimming", () => {
    expect(unwrapInlineEditResponse("\n  改写后的内容  \n")).toBe("改写后的内容");
  });
});

describe("inline edit review model", () => {
  it("builds rewrite review labels", () => {
    expect(
      buildInlineEditReview({
        mode: "rewrite-selection",
        originalText: "旧句子",
        proposedText: "新句子"
      })
    ).toEqual({
      title: "Review inline rewrite",
      originalLabel: "Current selection",
      proposedLabel: "Proposed replacement",
      applyLabel: "Replace selection",
      originalText: "旧句子",
      proposedText: "新句子"
    });
  });

  it("builds insert review labels", () => {
    expect(
      buildInlineEditReview({
        mode: "insert-at-cursor",
        originalText: "",
        proposedText: "新增段落"
      })
    ).toEqual({
      title: "Review inline insert",
      originalLabel: "Current cursor context",
      proposedLabel: "Text to insert",
      applyLabel: "Insert text",
      originalText: "",
      proposedText: "新增段落"
    });
  });
});
