// The example's own tests: no host, no SDK, no model. `node --test test/example.test.mjs`.
//
// The host-side proof (install runs the fixtures, refuses a missing element,
// the client reaches the kernel) is `orrery-cli/tests/example_client.rs`.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { DRAWS, render, renderPlaced, renderUnplaced } from "../render.mjs";
import { tools } from "../tools.mjs";

const here = new URL("../", import.meta.url);
const manifest = readFileSync(new URL("orrery.toml", here), "utf8");

/** Every Tier 1 element: what a client must draw (plan 36). */
const TIER_1 = [
  "layout", "banner", "thread", "message", "dock", "input", "footer", "status", "fullscreen", "overlay",
  "consent", "trust", "toast", "retry", "update", "exit", "notify", "mode",
];

/** The `draws = [ ... ]` list of the manifest. */
function manifestDraws() {
  const start = manifest.indexOf("draws = [") + "draws = [".length;
  return manifest
    .slice(start, manifest.indexOf("]", start))
    .split(",")
    .map((s) => s.trim().replaceAll('"', ""))
    .filter(Boolean);
}

test("DRAWS is exactly what the manifest declares", () => {
  assert.deepEqual([...DRAWS].sort(), manifestDraws().sort());
});

test("it draws every Tier 1 element, and the one it provides", () => {
  for (const id of [...TIER_1, "example.note"]) assert.ok(DRAWS.includes(id), `${id} is required`);
});

test("every Tier 1 element with props ships a fixture that draws", () => {
  const dir = new URL("fixtures/", here);
  for (const id of TIER_1.filter((e) => !["layout", "fullscreen", "overlay"].includes(e))) {
    assert.ok(existsSync(new URL(`${id}.json`, dir)), `fixtures/${id}.json`);
  }
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const element = file.replace(/\.json$/, "");
    const doc = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
    assert.doesNotThrow(() => render(element, doc.base ?? doc.props), element);
  }
});

test("what it does not draw throws, naming the element and the way out", () => {
  assert.throws(
    () => render("markdown", {}),
    (e) => e.message.includes("markdown") && e.message.includes("draws"),
  );
});

test("a consent prompt shows the keys", () => {
  const text = render("consent", { tool: "write", command: "write notes.md", choices: [{ key: "y", label: "allow once" }] });
  assert.match(text, /write notes\.md/);
  assert.match(text, /\[y\] allow once/);
});

test("a toast is the kind and the text", () => {
  assert.equal(render("toast", { toasts: [{ kind: "warning", text: "hello" }] }), "[warning] hello");
});

test("the provided element draws its title", () => {
  assert.equal(render("example.note", { title: "Release notes", body: "x" }), "note: Release notes - x");
});

const ctx = { ui: { text: (s) => s } };

test("word_count counts words", async () => {
  assert.equal(await tools.word_count.run({ text: "  one two   three " }, ctx), "3 words");
  assert.equal(await tools.word_count.run({ text: "one" }, ctx), "1 word");
  assert.equal(await tools.word_count.run({ text: "" }, ctx), "0 words");
});

test("slug makes a slug", async () => {
  assert.equal(await tools.slug.run({ title: "Hello, World! It's 2026" }, ctx), "hello-world-it-s-2026");
});

/** The `CUSTOM` frames named `name` in one of the harness's conformance fixtures. */
function customs(fixture, name) {
  const text = readFileSync(new URL(`../../../clients/conformance/${fixture}.jsonl`, here), "utf8");
  return text
    .split("\n")
    .filter((l) => l.startsWith('{"ev"'))
    .map((l) => JSON.parse(l).ev)
    .filter((e) => e.type === "CUSTOM" && e.name === name)
    .map((e) => e.value);
}

test("each placement is a plain section, hidden is nothing", () => {
  const drawn = customs("ui-placements", "orrery.placed").map(renderPlaced);
  assert.equal(drawn[0], "-- left · Flaky tests · agent --\n7 flaky · test_retry, test_sync");
  assert.equal(drawn[1], "-- right · CI · main · ext:ci-watch --\nlint ✓  test ●  build ○");
  assert.equal(drawn[2], "-- band · r1 · ext:ci-watch --\ndeploy staging ✓");
  assert.equal(drawn[6], "-- footer · branch · ext:git --\n⎇ main");
  assert.equal(drawn[7], "", "hidden draws nothing");
  const [gone] = customs("ui-placements", "orrery.unplaced");
  assert.equal(renderUnplaced(gone), "-- r3 · ext:ci-watch closed --");
});

test("a kind it does not draw shows its text form, in the fallback order", () => {
  const bodies = customs("fallback-order", "orrery.placed").map((p) => renderPlaced(p).split("\n").slice(1).join("\n"));
  assert.deepEqual(bodies, ["lint → test → build", "3 runs · 1 red", "red 1\nruns 3\nstate failing"]);
  const chart = { id: "lat", placement: "band", owner: "agent", text: "p50: w1 120ms, w2 110ms" };
  assert.equal(renderPlaced(chart), "-- band · lat · agent --\np50: w1 120ms, w2 110ms");
});

test("loading and stopped say so, stopped with the fix", () => {
  const [loading, , stopped] = customs("ui-placed-states", "orrery.placed").map(renderPlaced);
  assert.equal(loading, "-- right · CI · ext:ci-watch · loading --\nCI · loading");
  assert.equal(stopped, "-- right · CI · ext:ci-watch · stopped --\nlint ✓  test ✓  build ●\n  /ext restart ci-watch");
});
