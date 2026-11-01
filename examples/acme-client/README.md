# `acme-client`

A person's own client (decision 0093, plan 42 W5.2): the Orrery TUI as a
library, plus a Gantt chart for one element, `acme.gantt`. Every other client
draws that element's fallback, a table.

```sh
cargo build --release --manifest-path harness/extensions/examples/acme-client/Cargo.toml
# copy the built acme-client[.exe] (in CARGO_TARGET_DIR, or this folder's target/) beside orrery.toml
orrery install ./harness/extensions/examples/acme-client
orrery --ui acme
```

| File | What |
|---|---|
| `src/main.rs` | `Client::builder().component("acme.gantt", Gantt).run()`: the `Gantt` component draws the bars from the props. |
| `orrery.toml` | `[[provides.elements]] acme.gantt` (props schema, fallback `table`, fixture) and `[[provides.clients]] acme` (its `draws`). |
| `gantt.schema.json` | The props: `title`, and `tasks` of `{name, start, end, status}` in days. |
| `fixtures/acme.gantt.json` | Two cases. `orrery install` checks them against the schema, then hands them to the client in probe mode. |

A sender puts the element in a `custom` node, with the fallback beside it:

```json
{ "type": "custom", "kind": "acme.gantt",
  "props": { "title": "Release 0.25", "tasks": [{ "name": "build", "start": 2, "end": 9, "status": "running" }] },
  "fallback": { "type": "table", "columns": ["task", "days"], "rows": [["build", "2-9"]] } }
```

In `acme` it draws as:

```
Release 0.25
design       █████·······················
build        ····████████████████████····
ship         ···························█
```

**Limits.**

- A rebuild on each Orrery upgrade you take: the library is compiled in.
- The chart draws only in this client; everywhere else it is the table.
- In the full screen its colours are dropped (the theme's text colour), and
  inside a `box` or a `row` it is drawn at the pane's width and wraps.
- Under 21 columns each task is one line of text (`build 2-9d`).
