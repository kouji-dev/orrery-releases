# `acme-client-ink`

A person's own client on the Ink library (decision 0093, plan 42 W4.1): the
Orrery Ink TUI plus a Gantt chart for one element, `acme-ink.gantt`. The Ink twin of
[`../acme-client`](../acme-client) (ratatui): the same props and fallback, under
its own id (`acme-client` declares `acme.gantt`), so the two install side by
side. Every other client draws the element's fallback, a table.

```sh
pnpm -C harness/extensions/examples/acme-client-ink install --ignore-workspace
pnpm -C harness/extensions/examples/acme-client-ink run build
orrery install ./harness/extensions/examples/acme-client-ink
orrery --ui acme-ink
```

`--ignore-workspace`: the example is not a member of Orrery's pnpm workspace; it
links the library from this checkout (`link:../../../clients/ink`), so run
`pnpm install` at the repository root first.

| File | What |
|---|---|
| `src/main.tsx` | `createClient({ components: { "acme-ink.gantt": Gantt } }).run()`: the `Gantt` component draws the bars from the props. |
| `orrery.toml` | `[[provides.elements]] acme-ink.gantt` (props schema, fallback `table`, fixture) and `[[provides.clients]] acme-ink` (its `draws`, runtime `node`). |
| `gantt.schema.json` | The props: `title`, and `tasks` of `{name, start, end, status}` in days. |
| `fixtures/acme-ink.gantt.json` | Two cases. `orrery install` checks them against the schema, then hands them to the client in probe mode. |

A sender puts the element in a `custom` node, with the fallback beside it:

```json
{ "type": "custom", "kind": "acme-ink.gantt",
  "props": { "title": "Release 0.25", "tasks": [{ "name": "build", "start": 2, "end": 9, "status": "running" }] },
  "fallback": { "type": "table", "columns": ["task", "days"], "rows": [["build", "2-9"]] } }
```

In `acme-ink` it draws as:

```
Release 0.25
design       █████·······················
build        ····████████████████████····
ship         ···························█
```

**Limits.**

- A rebuild on each Orrery upgrade you take: the library is bundled in.
- The chart draws only in this client; everywhere else it is the table.
- In the full screen its colours and styles are kept: the bars' named colours
  as the theme's (green, yellow, blue), dim as dim; mono drops the colours. It
  is on the first frame; a resize draws the table for one frame, then the chart.
- Inline (no full screen) it is drawn as React.
- Under 21 columns each task is one line of text (`build 2-9d`).
- A sender picks the client by the id: `acme-ink.gantt` draws here, `acme.gantt`
  in `acme-client`; each is the table in the other.
