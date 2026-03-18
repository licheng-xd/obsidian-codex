import type {
  MappedActivityEvent,
  MappedCommandEvent,
  MappedFileChangeEvent,
  MappedReasoningEvent,
  MappedSummaryEvent,
  MappedTextEvent
} from "./types";

export type SummarizableAssistantEvent =
  | MappedReasoningEvent
  | MappedCommandEvent
  | MappedFileChangeEvent
  | MappedActivityEvent;

function formatExitCode(code: number | undefined): string {
  return code === undefined ? "Running" : `Exit ${code}`;
}

function describeFileChangeKind(kind: "add" | "delete" | "update"): string {
  switch (kind) {
    case "add":
      return "新增";
    case "delete":
      return "删除";
    case "update":
      return "修改";
  }
}

function normalizeLine(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function estimateMappedEventChars(
  event: MappedTextEvent | SummarizableAssistantEvent
): number {
  switch (event.type) {
    case "text":
    case "reasoning":
      return event.text.length;
    case "command":
      return event.command.length + event.aggregatedOutput.length;
    case "file_change":
      return event.changes.reduce(
        (total, change) => total + change.path.length + change.kind.length,
        0
      );
    case "activity":
      return event.title.length + (event.detail?.length ?? 0);
  }
}

export function summarizeAssistantSystemEvents(
  events: ReadonlyArray<SummarizableAssistantEvent>
): MappedSummaryEvent[] {
  const summaries: MappedSummaryEvent[] = [];

  const reasoningEvents = events.filter((event): event is MappedReasoningEvent => event.type === "reasoning");
  if (reasoningEvents.length > 0) {
    summaries.push({
      type: "summary",
      itemId: "summary:reasoning",
      label: reasoningEvents.length === 1 ? "已思考" : `已思考 ${reasoningEvents.length} 次`,
      preview: reasoningEvents.length === 1 ? normalizeLine(reasoningEvents[0].text) : undefined,
      lines: reasoningEvents
        .map((event) => normalizeLine(event.text))
        .filter(Boolean)
    });
  }

  const commandEvents = events.filter((event): event is MappedCommandEvent => event.type === "command");
  if (commandEvents.length > 0) {
    summaries.push({
      type: "summary",
      itemId: "summary:command",
      label: `已运行 ${commandEvents.length} 个命令`,
      lines: commandEvents.map((event) => `${event.command} (${formatExitCode(event.exitCode)})`)
    });
  }

  const activityGroups: Array<{
    readonly itemId: string;
    readonly label: string;
    readonly events: ReadonlyArray<MappedActivityEvent>;
  }> = [
    {
      itemId: "summary:activity:mcp_tool_call",
      label: "已调用",
      events: events.filter(
        (event): event is MappedActivityEvent =>
          event.type === "activity" && event.activityType === "mcp_tool_call"
      )
    },
    {
      itemId: "summary:activity:web_search",
      label: "已搜索",
      events: events.filter(
        (event): event is MappedActivityEvent =>
          event.type === "activity" && event.activityType === "web_search"
      )
    },
    {
      itemId: "summary:activity:todo_list",
      label: "已更新",
      events: events.filter(
        (event): event is MappedActivityEvent =>
          event.type === "activity" && event.activityType === "todo_list"
      )
    }
  ];

  for (const group of activityGroups) {
    if (group.events.length === 0) {
      continue;
    }

    const suffix = group.itemId.endsWith("todo_list") ? "次任务列表" : group.itemId.endsWith("web_search") ? "次搜索" : "个工具";
    summaries.push({
      type: "summary",
      itemId: group.itemId,
      label: `${group.label} ${group.events.length} ${suffix}`,
      lines: group.events.map((event) => {
        const parts = [event.title, event.detail].filter(
          (value): value is string => Boolean(value)
        );
        return parts.map(normalizeLine).join(" · ");
      })
    });
  }

  const fileChangeEvents = events.filter((event): event is MappedFileChangeEvent => event.type === "file_change");
  if (fileChangeEvents.length > 0) {
    const changeMap = new Map<string, "add" | "delete" | "update">();
    for (const event of fileChangeEvents) {
      for (const change of event.changes) {
        changeMap.set(change.path, change.kind);
      }
    }

    summaries.push({
      type: "summary",
      itemId: "summary:file_change",
      label: `已编辑 ${changeMap.size} 个文件`,
      lines: Array.from(changeMap.entries()).map(([path, kind]) => `${describeFileChangeKind(kind)} ${path}`)
    });
  }

  return summaries;
}
