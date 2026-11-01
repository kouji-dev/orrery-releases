# `ci-watch`

A resident extension that shows CI status in the TUI, written in Python with raw JSON-RPC
and no SDK. It shows that any language that speaks the wire can place surfaces and feed a
catalog component. Plan 41 W4.2 and plan 42 W5.2; decisions
[0088](../../../docs/decisions/0088-one-call-places-a-surface.md),
[0089](../../../docs/decisions/0089-extensions-that-show-ui-stay-resident.md) and
[0092](../../../docs/decisions/0092-components-are-structures-bound-to-data.md).

Its `CI` pane is the same component as [`ci-watch-toml`](../ci-watch-toml), the declared
version with no process. Here code feeds it; there a file does.

## What it shows

| Where | What | Drawn as |
|---|---|---|
| Right pane, `CI` | The workflow, `1 failed of 3`, the jobs, an `Explain` button | the component `ci` (`ci.json`), fed with `ui/data` |
| Band, `Deploy` | Deploy progress, `deploy web 7/10` | a `progress` surface |
| Status line | `ci ✓ 2` (jobs passing) | one `ui/status` segment, key `ci` |

- At load it shows the pane from the schema's defaults (`ui/show {component: "ci", data: {}}`),
  then sends the results (`ui/data {id: "ci", set}`). It redraws every 30 seconds.
- `/ci refresh`, or F5, redraws it now. The tool is `refresh`, and the agent can call it too.
- F6 focuses the pane; ↑ ↓ choose a job, Enter reruns it, Tab moves to `Explain`, Esc
  dismisses the pane.

## The component, in code

| Step | Wire |
|---|---|
| Declare it | `[[provides.components]] name = "ci"`, `file = "ci.json"`, `schema` in `orrery.toml` |
| Place it | `ui/show {"id": "ci", "placement": "pane.right", "component": "ci", "data": {}}` |
| Feed it | `ui/data {"id": "ci", "set": {"workflow": "build", "failed": 1, "jobs": [...]}}`; the host diffs it into the smallest change |
| Hear it | the host's notification `ui/event {"id": "ci", "action": "rerun", "value": "test"}` |

- `rerun` (a chosen job, its name as `value`) marks the job `rerunning` and sends the new data.
  A real rerun would start the job in `event_messages`.
- `explain` sends `Explain why CI failed` to the agent with `run/send`, as the extension's own
  message.

## Install and run

```bash
orrery install ./harness/extensions/examples/ci-watch --yes
```

`--yes` grants the `ui` and `run.send` requests. Without it, they are denied and the ledger
records the install as `degraded`. Then open `orrery`. The pane is on the right of the thread
and the band sits above the input. Check the install with `orrery ext list`.

To remove it: `orrery remove ci-watch`.

## Limits

- **Resident:** it keeps one Python process for the whole session, about 7.4 MB
  ([decision 0089](../../../docs/decisions/0089-extensions-that-show-ui-stay-resident.md)).
  The pane's actions need it alive: if it is gone, a press is refused with `/ext restart ci-watch`.
- **Fake data:** `fetch_ci` in `main.py` returns fixed jobs. No network is touched, and a rerun
  only changes what is drawn. Real CI polling belongs in that function, on the timer, never
  inside a draw.
- **A refresh forgets reruns:** the jobs are re-read from `fetch_ci`, so a `rerunning` mark lasts
  until the next refresh.
- **Python on PATH:** the runtime starts `python main.py` and probes `python --version`.
  A system with only `python3` on PATH does not start it. Python 3.8 or newer.
- **Clients:** the pane draws where the client draws the catalog (ratatui today); elsewhere its
  text form. A client that draws no placements shows nothing for them (decision 0087).
- **Narrow:** when the pane would be too narrow it folds into one band row, `▸ CI`.
- **The agent can refresh:** `refresh` is a tool, so the model may call it. Its call stays
  in the history.
- **Every data update is logged** in the session, so the 30-second refresh grows the log a little.
- **Stopped, not gone:** if the process crashes, the pane shows `stopped`, with `/ext restart ci-watch`.
- **No config:** the refresh interval and the key are constants and the manifest. Override
  the key with `[keys]` in `config.toml`.

## Check

From this folder:

```bash
python -m unittest discover -s test
```

Checks that the frames read back, that the `ui/show`, `ui/data` and `ui/status` calls carry their
required fields, that a rerun changes the data, and that the manifest's component, placements,
key and tool match the code. The manifest checks need Python 3.11+.

Through the binary: `orrery-cli`'s `tests/components.rs` (serve and attach) and the ConPTY proof
`tests/conpty/components.py`.
