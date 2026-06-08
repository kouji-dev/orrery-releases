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
