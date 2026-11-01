// The package's two tools, as plain objects so a test can call them without a
// host. index.mjs hands them to defineExtension.

export const tools = {
  word_count: {
    description: "Count the words in a piece of text.",
    input: {
      type: "object",
      properties: { text: { type: "string", description: "The text to count." } },
      required: ["text"],
    },
    async run({ text }, ctx) {
      const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
      return ctx.ui.text(`${words} word${words === 1 ? "" : "s"}`);
    },
  },

  slug: {
    description: "Turn a title into a lower-case, dash-separated slug.",
    input: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    },
    async run({ title }, ctx) {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return ctx.ui.text(slug);
    },
  },
};
