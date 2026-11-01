/**
 * `acme-client-ink`: everything the built-in Ink TUI draws, plus a Gantt chart
 * for the `acme-ink.gantt` element (decision 0093). Any other client draws the
 * element's fallback, a table. The same chart as `../acme-client`, in Ink.
 */

import { createClient, type ComponentProps } from "@getorrery/client-ink";
import { Box, Text } from "ink";

/** The name column, and the narrowest bar worth drawing. */
const NAME = 12;
const MIN_BAR = 8;

interface Task {
  name?: string;
  start?: number;
  end?: number;
  status?: "done" | "running" | "todo";
}

const COLOUR = { done: "green", running: "yellow", todo: "blue" } as const;

/**
 * `acme-ink.gantt`: `{"title"?, "tasks": [{"name", "start", "end", "status"?}]}`,
 * days from the plan's start; `status` is `done`, `running` or `todo`.
 */
export function Gantt({ props, width }: ComponentProps) {
  const tasks = Array.isArray(props["tasks"]) ? (props["tasks"] as Task[]) : [];
  const title = typeof props["title"] === "string" ? <Text bold>{props["title"]}</Text> : null;
  if (tasks.length === 0) {
    return (
      <Box flexDirection="column">
        {title}
        <Text dimColor>no tasks</Text>
      </Box>
    );
  }
  const day = (n: unknown) => (typeof n === "number" && n > 0 ? Math.floor(n) : 0);
  const span = Math.max(1, ...tasks.map((t) => day(t.end)));
  const bar = Math.max(width - (NAME + 1), 0);
  return (
    <Box flexDirection="column">
      {title}
      {tasks.map((t, i) => {
        const name = (t.name ?? "?").slice(0, NAME);
        const [start, end] = [Math.min(day(t.start), span), Math.min(day(t.end), span)];
        // Too narrow for a bar: one line per task, as text.
        if (bar < MIN_BAR) return <Text key={i}>{`${name} ${start}-${end}d`}</Text>;
        const at = (d: number) => Math.min(Math.ceil((d * bar) / span), bar);
        const a = at(start);
        const b = Math.min(Math.max(at(end), a + 1), bar);
        return (
          <Text key={i}>
            {name.padEnd(NAME)}{" "}
            <Text dimColor>{"·".repeat(a)}</Text>
            <Text color={COLOUR[t.status ?? "todo"] ?? "blue"}>{"█".repeat(b - a)}</Text>
            <Text dimColor>{"·".repeat(bar - b)}</Text>
          </Text>
        );
      })}
    </Box>
  );
}

void createClient({ components: { "acme-ink.gantt": Gantt } }).run();
