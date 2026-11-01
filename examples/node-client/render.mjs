// What the example client draws, as plain text. Pure: no SDK, no I/O, so the
// tests (and `orrery install`'s fixtures) can call it directly.
//
// `render(element, props)` returns the text for one element, or throws when
// this client does not draw it. That throw is the contract: `defineClient`'s
// `draw` is this function, so a claim in `draws` that cannot be drawn fails
// its fixture at install.
//
// Every Tier 1 element is required of a client (plan 36): this draws all of
// them, each in a line or two. A line client has one column, so layout,
// fullscreen and overlay are the screen's shape and draw nothing of their own.

/** Every element this client draws: the same list as `draws` in orrery.toml. */
export const DRAWS = [
  "layout", "banner", "thread", "message", "dock", "input", "footer", "status", "fullscreen", "overlay",
  "consent", "trust", "toast", "retry", "update", "exit", "notify", "mode",
  "example.note",
];

/** One block of a thread or message, as a line. */
function block(b) {
  switch (b.b) {
    case "blank":
      return "";
    case "user":
      return `> ${b.text}`;
    case "prose":
      return b.text;
    case "tool":
      return `* ${b.name}(${b.args ?? ""})${b.dur ? ` ${b.dur}` : ""}`;
    case "res":
      return `  ${b.text}`;
    case "outcome":
      return `[${b.k}] ${b.detail ?? ""}`.trimEnd();
    default:
      // A block kind this client does not know is still shown, not dropped.
      return JSON.stringify(b);
  }
}

const join = (...parts) => parts.filter((p) => p !== undefined && p !== null && p !== "").join(" · ");

const drawers = {
  // The screen's shape, not elements with props: a line client has one column.
  layout: () => "",
  fullscreen: () => "",
  overlay: () => "",

  banner: (p) => join(p.harness, p.version, p.path, p.branch, p.model),
  thread: (p) => (p.blocks ?? []).map(block).join("\n"),
  message: (p) => (p.blocks ?? []).map(block).join("\n"),
  dock: (p) =>
    [join(p.title, p.step), p.prompt, ...(p.items ?? []).map((i, n) => `  ${n + 1}. ${join(i.label, i.detail)}`)]
      .filter(Boolean)
      .join("\n"),
  input: (p) => `> ${p.placeholder ?? ""}`.trimEnd(),
  footer: (p) => join(p.mode, p.model, p.tokens, p.cost),
  status: (p) => join(p.title, p.elapsed, p.detail),

  // Asks, trust and the rest of the chrome that speaks for the host.
  consent: (p) =>
    [
      `? ${join(p.tool, p.command)}`,
      p.detail ? `  ${p.detail}` : "",
      (p.choices ?? []).map((c) => `[${c.key}] ${c.label}`).join("  "),
    ]
      .filter(Boolean)
      .join("\n"),
  trust: (p) =>
    [
      `trust ${p.path}?`,
      p.hooks?.length ? `  hooks: ${p.hooks.join(", ")}` : "",
      p.mcp?.length ? `  mcp: ${p.mcp.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  toast: (p) => (p.toasts ?? []).map((t) => `[${t.kind}] ${t.text}`).join("\n"),
  retry: (p) => join(p.text, p.countdown),
  update: (p) => `update available: ${p.current} -> ${p.latest}`,
  exit: (p) =>
    [
      p.harness,
      ...(p.rows ?? []).map(([k, v]) => `  ${k}: ${v}`),
      p.resume ? `resume: ${p.resume}` : "",
    ]
      .filter((l) => l !== "")
      .join("\n"),
  notify: (p) => join(p.title, p.body),
  mode: (p) => `mode: ${p.mode}`,

  // The element this package provides.
  "example.note": (p) => `note: ${p.title ?? ""}${p.body ? ` - ${p.body}` : ""}`,
};

/**
 * Draw one element.
 * @param {string} element
 * @param {Record<string, any>} props
 * @returns {string}
 */
export function render(element, props) {
  const draw = drawers[element];
  if (!draw) {
    throw new Error(
      `this client does not draw \`${element}\`: implement it here, or leave it out of \`draws\` if it is not a required element`,
    );
  }
  return draw(props ?? {});
}

/**
 * One placed surface (decisions 0086-0088), from `CUSTOM orrery.placed`: a line
 * client has no panes or band, so each placement is a plain section, headed by
 * where it is, its title and its owner. The body is the host's `text` (its text
 * form), which is how this client shows every kind it does not draw - chart,
 * raster, image, custom - and never nothing. `hidden` draws nothing.
 * @param {Record<string, any>} placed
 * @returns {string}
 */
export function renderPlaced(placed) {
  if (placed.placement === "hidden") return "";
  const where = { "pane.left": "left", "pane.right": "right" }[placed.placement] ?? placed.placement;
  const state = placed.state && placed.state !== "live" ? placed.state : "";
  const head = `-- ${join(where, placed.title ?? placed.id, placed.owner, state)} --`;
  const fix = placed.state === "stopped" && placed.owner?.startsWith("ext:") ? `\n  /ext restart ${placed.owner.slice(4)}` : "";
  return `${head}\n${placed.text ?? ""}${fix}`;
}

/**
 * A placement taken away, from `CUSTOM orrery.unplaced`.
 * @param {{id: string, owner: string}} gone
 */
export const renderUnplaced = (gone) => `-- ${join(gone.id, gone.owner)} closed --`;
