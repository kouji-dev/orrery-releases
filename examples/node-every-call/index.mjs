// Every plan 40 call from Node, in one extension (W3.5; proven end to end by
// W4.5 in `run -p --json` and in the TUI, with the fixture provider).
//
// - `recap`  reads the session, asks the model for a one-line recap (streamed),
//            appends it as an `ext.message`, and keeps it in state — which the
//            `recap` context section shows the model every pass, with no call.
// - `nudge`  sets a timer; when it fires, `onTimer` sends input to the run.
// - `ship`   asks the person to confirm, then says so on the status line.
// - `no-force-push` gates `builtin.bash`: `git push --force` is denied.

import { defineExtension } from "@getorrery/ext";

const prose = (message) =>
  message.content.filter((b) => b.t === "text").map((b) => b.text).join(" ");

export default defineExtension({
  state: { recap: { initial: "", visibility: "private" } },

  contextSections: [{ name: "recap", fromState: "recap" }],

  interceptors: {
    "tool.before": {
      name: "no-force-push",
      mode: "gate",
      tools: ["builtin.bash"],
      run: ({ input }) =>
        /git\s+push\s+.*(--force|-f\b)/.test(input?.command ?? "") ? { deny: "no force-push: push a new branch instead" } : null,
    },
  },

  tools: {
    recap: {
      description: "Recap the session so far in one line, and keep it in view.",
      input: { type: "object", properties: {} },
      async run(_input, ctx) {
        const { messages } = await ctx.session.read({ limit: 50 });
        const transcript = messages.map((m) => `${m.role}: ${prose(m)}`).join("\n");
        let streamed = "";
        const reply = await ctx.model.complete(
          {
            system: "Recap this conversation in one short line.",
            prompt: transcript || "(nothing yet)",
            maxOutputTokens: 120,
          },
          { onEvent: (e) => e.t === "text-delta" && (streamed += e.text) },
        );
        const recap = (reply.text || streamed).trim();
        await ctx.session.append(`Recap so far: ${recap}`);
        await ctx.state.set("recap", `Recap so far: ${recap}`);
        return ctx.ui.text(`${recap} (${reply.model})`);
      },
    },

    nudge: {
      description: "In a few seconds, remind the run to wrap up.",
      input: { type: "object", properties: { seconds: { type: "number" } } },
      async run({ seconds = 2 }, ctx) {
        const id = await ctx.timer.set(seconds * 1000, "wrap-up");
        return `timer ${id} set for ${seconds}s`;
      },
    },

    ship: {
      description: "Ask the person whether to ship, and show the answer on the status line.",
      input: { type: "object", properties: { what: { type: "string" } } },
      async run({ what = "this change" }, ctx) {
        const yes = await ctx.person.ask(`Ship ${what}?`, { kind: "confirm", detail: "It goes to main." });
        const shipped = yes === true || yes === "yes" || yes === "true";
        await ctx.ui.status("ship", shipped ? "shipping" : "held");
        await ctx.ui.notify(shipped ? `shipping ${what}` : `holding ${what}`, shipped ? "info" : "warn");
        return { shipped };
      },
    },
  },

  async onTimer(tag, host) {
    if (tag !== "wrap-up") return;
    await host.run.send("Time to wrap up: summarise what is left.", { target: "queue", shown: { lead: "every-call: wrap-up" } });
  },
});
