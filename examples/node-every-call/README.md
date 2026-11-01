# `node-every-call`

Plan 40's proof for `@getorrery/ext`: one extension using every new call.

| Tool / hook | Calls |
|---|---|
| `recap` | `ctx.session.read`, `ctx.model.complete` (streamed), `ctx.session.append`, `ctx.state.set` |
| `recap` context section | `fromState: "recap"`: read each pass, no call |
| `nudge` | `ctx.timer.set`; `onTimer` → `host.run.send` |
| `ship` | `ctx.person.ask` (`confirm`), `ctx.ui.status`, `ctx.ui.notify` |
| `no-force-push` | a `tool.before` gate on `builtin.bash` |

Run it with the fixture provider, never a paid model:

```
orrery ext test harness/extensions/examples/node-every-call
```

Proven end to end (plan 40 W4.5) in `run -p --json` and under `serve` by
`harness/core/crates/orrery-cli/tests/ext_every_call.rs`, and in the TUI by
`tests/conpty/ext_every_call.py` there.
