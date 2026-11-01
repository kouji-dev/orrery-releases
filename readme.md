# Orrery — Releases

  Distribution channel for **Orrery**, a multi-agent orchestrator desktop app
  (Tauri + Angular). This repository hosts the published installers and
  auto-updater manifests. The application source lives in
  [`kouji-dev/orrery`](https://github.com/kouji-dev/orrery).

  ## Download

  Grab the latest installer from the [**Releases**](https://github.com/kouji-dev/orrery-releases/releases/latest) page.

  | Platform | File |
  |----------|------|
  | Windows  | `Orrery_<version>_x64-setup.exe` (or the `.msi`) |

  > First launch may show a Windows SmartScreen notice because the builds are not
  > yet code-signed — choose **More info → Run anyway**.

  ## Auto-updates

  Orrery checks this repository for new versions on launch. When an update is
  available it downloads and installs it automatically, then relaunches into the
  new version — no manual download needed after the first install. Update
  integrity is verified against a bundled signing key.

  ## Releases

  Releases are published automatically by CI from the
  [`orrery`](https://github.com/kouji-dev/orrery) repository. Each release
  includes the installers plus a `latest.json` manifest consumed by the updater.

  Once that's committed (creating the main branch) and you've pasted me the public key from Step 2, I'll wire up tauri.conf.json and run
  the final review.

## List an extension

`extensions.json` is Orrery's extension list. The gallery reads it, and
`orrery install <id>` looks names up in it, from
`https://raw.githubusercontent.com/kouji-dev/orrery-releases/main/extensions.json`.

To list yours:

1. Publish it where `orrery install` can fetch it: npm, crates.io, or a git
   repository, with `orrery.toml` at the package root. Check it with
   `orrery ext test .` and `orrery install <your source>`.
2. Fork this repository, add one entry to the `extensions` array, and open a
   pull request into `main`:

   ```json
   {
     "id": "buildgraph",
     "name": "Buildgraph",
     "description": "Answers which targets a change rebuilds, from the build graph.",
     "author": "your-github-login",
     "source": "npm:orrery-ext-buildgraph",
     "repository": "https://github.com/you/buildgraph",
     "version": "1.2.0",
     "keywords": ["build"],
     "capabilities": ["read", "spawn"]
   }
   ```

   `id` is the bare name (`orrery install buildgraph`), lowercase letters,
   digits and `-`, unique. `source` is `npm:<pkg>`, `crate:<name>` or a git URL.
   Everything else is required except these optional fields:

   | Field | What |
   |---|---|
   | `keywords`, `capabilities` | Arrays of strings, for the gallery. |
   | `kinds` | An array of `client`, `provider`, `session-store`, `tools`, `commands`, `ui`, `agents`. Any other value fails the check. |
   | `npm` | The npm package name, when `source` is a release zip and npm carries the same package. |
   | `added`, `updated` | `YYYY-MM-DD`: when the entry was first listed, and when its version last changed. Only the shape is checked. |
   | `builtin` | `true` only for Orrery's own extensions. Orrery's release writes it; leave it out. |

3. The `extensions` check validates the file (`python3 scripts/check_extensions.py`):
   valid JSON, the fields above, a unique `id`, and the `kinds` and dates it
   names. A maintainer merges.

A new version is a pull request that changes `version`; delisting is one that
removes the entry. Report a listed extension with an issue here.

**Limits:** the list is not signed and not a code review; it is trusted because
only maintainers push to `main`, and it is read over HTTPS. A bare name installs
the entry's source unpinned, with the grant prompt. The list is read as one file,
so one bad entry fails every bare-name install until it is fixed or removed. Raw
files are cached for a few minutes after a merge.
