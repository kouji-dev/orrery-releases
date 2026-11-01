// The client half: a line-oriented text client, in Node, on `orrery-client/1`
// (decision 0038). Started by `orrery --ui example`, it reads a prompt per line
// from the terminal, prints the reply as it streams, answers an ask when the
// host puts one to it, and leaves when input ends and the runs it started are
// done.
//
// What it shows about the contract:
//   - `draws` is the list in orrery.toml: every Tier 1 element, because a client
//     missing one is refused (at install and at attach) with an error naming it.
//   - `draw` is called by `orrery install` for every fixture; render.mjs throws
//     for anything it does not draw, so a false claim cannot install.
//   - It draws `consent` and holds the `consent` grant, so it may answer an ask:
//     the prompt is drawn, and the next line typed is the answer.

import readline from "node:readline";

import { defineClient } from "@getorrery/ext";

import { DRAWS, render, renderPlaced, renderUnplaced } from "./render.mjs";

/** The keys the consent element offers, and what each answers. */
const ANSWERS = { y: "allow-once", a: "allow-always", n: "deny", d: "deny-always" };
const CHOICES = [
  { key: "y", label: "allow once" },
  { key: "a", label: "allow always" },
  { key: "n", label: "deny" },
  { key: "d", label: "deny always" },
];

const out = (text) => process.stdout.write(`${text}\n`);

export default defineClient({
  draws: DRAWS,
  draw: render,

  async run(client) {
    let inFlight = 0;
    let inputClosed = false;
    /** The ask on screen, when there is one: the next line typed answers it. */
    let asking = null;

    const lines = readline.createInterface({ input: process.stdin });
    lines.on("line", (line) => {
      const text = line.trim();
      if (text === "") return;
      if (asking) {
        const prompt = asking;
        asking = null;
        client.consent(prompt, ANSWERS[text.toLowerCase()] ?? "deny").catch((e) => {
          out(render("toast", { toasts: [{ kind: "error", text: e.message }] }));
        });
        return;
      }
      inFlight += 1;
      client.submit(text).catch((e) => {
        inFlight -= 1;
        out(render("toast", { toasts: [{ kind: "error", text: e.message }] }));
      });
    });
    lines.on("close", () => {
      inputClosed = true;
      if (inFlight === 0) client.close();
    });

    for await (const frame of client.frames()) {
      if (frame.type === "TEXT_MESSAGE_CONTENT") process.stdout.write(frame.delta);
      if (frame.type === "CUSTOM" && frame.name === "orrery.consent.request") {
        const prompt = frame.value?.prompt ?? {};
        asking = prompt.id;
        out(`\n${render("consent", { tool: prompt.rule ?? "ask", command: prompt.reason, choices: CHOICES })}`);
      }
      // Placements (panes, band, footer) are sections in a line client.
      if (frame.type === "CUSTOM" && frame.name === "orrery.placed") {
        const text = renderPlaced(frame.value ?? {});
        if (text) out(`\n${text}`);
      }
      if (frame.type === "CUSTOM" && frame.name === "orrery.unplaced") out(`\n${renderUnplaced(frame.value ?? {})}`);
      if (frame.type === "RUN_FINISHED" || frame.type === "RUN_ERROR") {
        process.stdout.write("\n");
        inFlight = Math.max(0, inFlight - 1);
        if (inputClosed && inFlight === 0) return;
      }
    }
  },
});
