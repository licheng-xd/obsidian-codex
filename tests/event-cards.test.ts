import { describe, expect, it } from "vitest";
import { describeActivityType, describeFileChangeKind, formatExitCode } from "../src/event-cards";

describe("event-cards helpers", () => {
  it("describes file change kinds", () => {
    expect(describeFileChangeKind("add")).toBe("Added");
    expect(describeFileChangeKind("delete")).toBe("Deleted");
    expect(describeFileChangeKind("update")).toBe("Updated");
  });

  it("formats exit codes", () => {
    expect(formatExitCode(undefined)).toBe("Running");
    expect(formatExitCode(0)).toBe("Exit 0");
    expect(formatExitCode(17)).toBe("Exit 17");
  });

  it("describes activity types", () => {
    expect(describeActivityType("mcp_tool_call")).toBe("MCP Tool");
    expect(describeActivityType("web_search")).toBe("Web Search");
    expect(describeActivityType("todo_list")).toBe("Todo List");
  });
});
