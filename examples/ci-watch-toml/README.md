# `ci-watch-toml`

CI status in the right pane from one `orrery.toml`, a structure file and a JSON file in the
workspace. No process, no code: `runtime = "none"`. Plan 42 W5.2; decision
[0092](../../../docs/decisions/0092-components-are-structures-bound-to-data.md). The guide is
[Show things: components](../../../../docs-site/extend/components.md).

Its pane is the same component as [`ci-watch`](../ci-watch), the code-mode version. Here a file
feeds it; there a Python process does.

## What it shows

| File | Role |
|---|---|
| `orrery.toml` | the component `ci` (structure, schema), its placement in `pane.right`, two actions |
| `ci.json` | the structure: the workflow and status, `N failed of M`, the jobs as a list, an `Explain` button |
| `.ci/status.json`, in the workspace | the data; `status.example.json` here is a sample |

- Choosing a job (↑ ↓, Enter) runs `rerun`: it sends `Rerun the CI job <name> and tell me whether
  it passes now` to the agent, `<name>` being the item's `value` through `${value}`.
- `Explain` runs `explain`: it sends `Explain why CI failed, from .ci/status.json`.
- Both go to the agent as `ci-watch-toml`'s message, never as the person's.
- F6 focuses the pane, Tab moves between the list and the button, Esc dismisses the pane.

## Install and run

```bash
orrery install ./harness/extensions/examples/ci-watch-toml --yes
mkdir -p .ci && cp ./harness/extensions/examples/ci-watch-toml/status.example.json .ci/status.json
orrery
```

`--yes` grants the `read` of `.ci/**` and `run.send`. Rewrite `.ci/status.json` (a CI job, a
script, a watcher) and the pane follows within about a second.

To remove it: `orrery remove ci-watch-toml`.

## Limits

- **Actions only send or run a command.** A declared extension cannot change its own data: a
  rerun is a message to the agent, which does the work. The code-mode `ci-watch` changes the data
  itself.
- **`command` actions need someone else's tool:** `command = "/ci rerun ${value}"` works only
  when an installed extension registers `/ci rerun`. This example uses `send` for that reason.
- **Polled once a second.** A change shows up to about 1.2 s late.
- **`ci.json` is read once,** at session start: edit it, then start a new session.
- **A bad or missing `.ci/status.json`** (not JSON, not an object, over `limits.dataBytes`) keeps
  the last good data drawn and says why in the status line. With none yet, the pane shows the
  reason and its fix.
- **`${value}` is text:** a job name with spaces goes in as is. It is never run through a shell.
- **Narrow:** when the pane would be too narrow it folds into one band row, `▸ CI`.
- **Every accepted change is logged** in the session, so a file rewritten often grows the log.

## Check

From this folder:

```bash
orrery ui preview ./orrery.toml --name ci --data status.example.json --width 40
```

checks the structure against the catalog, the sample against the schema and the actions against
`[provides.actions]`, then draws it. Through the binary: `orrery-cli`'s `tests/components.rs`
(`run -p --json`, a file change as a `/data` delta) and the ConPTY proof
`tests/conpty/components.py`.
