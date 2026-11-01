// The extension half of the package: two tools. `node index.mjs` is all the
// host does to start it (the client half, client.mjs, starts only when
// `--ui example` picks it).

import { defineExtension } from "@getorrery/ext";

import { tools } from "./tools.mjs";

export default defineExtension({ tools });
