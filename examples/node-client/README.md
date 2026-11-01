# `node-client`

The worked example for a **client extension** (plan 36): one package with a
client, two tools and an element, all in Node. It is a plain-text line client -
type a prompt, read the reply, answer an ask with a key - small enough to read
in a sitting.

```
orrery install ./harness/extensions/examples/node-client
orrery --ui example
orrery ext show example-client
```

| File | What |
|---|---|
| `orrery.toml` | The manifest: `[[provides.clients]]`, `[[provides.elements]]`, `[provides] tools`, `[grants] client`. |
| `client.mjs` | `defineClient({ draws, draw, run })`: streams the reply, draws an ask and answers it. |
| `render.mjs` | What it draws, as pure functions; throws for anything it does not draw. |
| `tools.mjs`, `index.mjs` | `word_count` and `slug`, served like any node extension. |
| `fixtures/` | One `<element>.json` per claim that has props. `orrery install` hands each to the client (`draw`); one that fails is an error. |

**Every Tier 1 element is required** (decision 0042). `draws` lists all
seventeen (`layout`, `banner`, `thread`, `message`, `input`, `footer`,
`status`, `overlay`, `dock`, `consent`, `trust`, `toast`, `retry`, `update`,
`exit`, `notify`, `mode`), the screen's `fullscreen` mode, and `example.note`,
the element this package provides. A client that leaves one out is refused, at install and at attach,
with an error naming it and saying to implement it. Try it: delete `"mode"`
from `draws` in a copy and install it.

```
client "example-client" does not draw mode — implement it (see extensions/README.md, "Writing a client")
```

It draws `consent` and holds the `consent` grant, so an ask is put to it: the
prompt is drawn with its keys (`y` allow once, `a` always, `n` deny, `d` deny
always) and the next line typed answers it.

Placements (decisions 0086-0088) arrive as `CUSTOM orrery.placed` / `orrery.unplaced`.
A line client has no panes or band, so each is a plain section headed
`-- <where> · <title> · <owner> --` (with `loading` or `stopped` and its
`/ext restart` fix when not live), its body the host's `text`: the text form,
which is how a chart, raster, image or custom kind shows here. `hidden` prints
nothing.

```
node --test test/example.test.mjs        # the pure half, no host
```

**Limits.** Sections are printed as they arrive, in the scroll: a replaced
placement prints again rather than updating in place, and a move prints its new
section with no note of the old one. Charts, rasters and images inline in a turn
are not shown (this client prints only streamed text).

The host half - install passes its fixtures, refuses a missing element or a
claim that fails its fixture, the client draws a turn and answers an ask - is
`orrery-cli/tests/example_client.rs`, on the real binary with the fixture
provider (no paid API).

The walk-through, and the rules behind it, are in
[`../../README.md`](../../README.md) ("Writing a client").
