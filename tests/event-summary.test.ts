import { describe, expect, it } from "vitest";
import { summarizeAssistantSystemEvents } from "../src/event-summary";

describe("event-summary", () => {
  it("aggregates completed system events into compact summaries", () => {
    const summaryEvents = summarizeAssistantSystemEvents([
      {
        type: "reasoning",
        itemId: "reason-1",
        text: "先浏览文件，再整理命令输出"
      },
      {
        type: "command",
        itemId: "cmd-1",
        command: "pwd",
        aggregatedOutput: "/vault",
        status: "completed",
        exitCode: 0
      },
      {
        type: "command",
        itemId: "cmd-2",
        command: "ls",
        aggregatedOutput: "a.md\nb.md",
        status: "completed",
        exitCode: 0
      },
      {
        type: "activity",
        itemId: "tool-1",
        activityType: "mcp_tool_call",
        title: "Read workspace files",
        detail: "Browsing notes",
        status: "completed"
      },
      {
        type: "file_change",
        itemId: "file-1",
        status: "completed",
        changes: [
          { path: "src/chat-view.ts", kind: "update" },
          { path: "styles.css", kind: "update" }
        ]
      }
    ]);

    expect(summaryEvents.map((event) => event.label)).toEqual([
      "已思考",
      "已运行 2 个命令",
      "已调用 1 个工具",
      "已编辑 2 个文件"
    ]);
    expect(summaryEvents[1]?.lines).toEqual([
      "pwd (Exit 0)",
      "ls (Exit 0)"
    ]);
    expect(summaryEvents[3]?.lines).toEqual([
      "修改 src/chat-view.ts",
      "修改 styles.css"
    ]);
  });
});
