# Contributing to WatchMe

Thanks for the interest. This document covers the development environment,
the checks to pass, and the release procedure.

## Environment

### Requirements

- **Node.js ≥ 22.12.0** — the repo pins `lts/jod` in `.nvmrc`
- **npm ≥ 10**
- **Rust stable** and the Tauri 2 prerequisites. A full `build:mac` builds both
  macOS slices, so it needs both targets:
  `rustup target add aarch64-apple-darwin x86_64-apple-darwin`
- **macOS** for a full build: WatchMe only publishes macOS binaries today
  (see *Platforms* below)

### Setup

```bash
git clone https://github.com/killerwolf/watchme.git
cd watchme
npm install
npm start
```

`npm run dev` is an alias for `npm start` (`tauri dev`).

## Layout

```
watchme/
├── src-tauri/            # Tauri 2 application, commands, tray, and Rust tests
├── renderer.js           # UI: process list, filters, notifications
├── index.html            # Single window, strict CSP, no remote resources
├── vite.config.js        # Frontend bundle and packaged static assets
├── monitoring.js         # Watched set + polling loop (DOM-free)
├── tray-status.js        # Tray badge and tooltip (Tauri-free)
├── assets/              # App icons and build resources
├── misc/                # Logo, demo GIF, notification sound, tray icon
├── site/                # Landing page published to h4md1.fr/watchme/
├── tools/               # Asset generation scripts
├── test/                # Portable JavaScript unit tests
├── docs/agents/         # Conventions aimed at agents
└── .github/workflows/   # CI, release and Pages
```

`monitoring.js` and `tray-status.js` deliberately carry no dependency on
Tauri or the DOM. That is what lets them be exercised under `node --test`
without starting the application. Rust core logic is tested with `cargo test`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm start` | Run the application |
| `npm test` | JavaScript unit tests, then Rust core tests |
| `npm run test:unit` | Unit tests alone (`node --test`) |
| `npm run check` | Lint + format (Biome) |
| `npm run check:fix` | Fix whatever is automatically fixable |
| `npm run pack` | Debug Tauri bundle for local verification |
| `npm run build:mac` | Produce the `.app` and `.dmg` for both macOS slices |
| `npm run build:mac:arm` | Apple Silicon slice alone |
| `npm run build:mac:intel` | Intel slice alone |

CI runs `lint`, `format:check`, `test`, and `pack`. Running
`npm run check && npm test && npm run pack` locally covers the essentials.

## Proposing a change

1. Branch from `develop` using a descriptive `feature/*` branch name.
2. Write the change, with a test as soon as the behaviour is testable.
   Behaviour that can be extracted out of the desktop shell deserves its own testable
   module.
3. Pass the checks above.
4. Use a Conventional Commit message, for example
   `feat(monitoring): add process group filters`.
5. Add an entry under `## [Unreleased]` in `CHANGELOG.md` if the change is
   user-visible. Describe what changes **for them**, not which files moved.
6. Open a pull request targeting `develop`, explaining the why as much as the
   what.

Everything in this repository is written in English — comments, tests,
changelog entries and commit messages included.

Issues live in [GitHub Issues](https://github.com/killerwolf/watchme/issues)
and use the labels `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`.

## Platforms

A release builds both macOS slices — `aarch64-apple-darwin` and
`x86_64-apple-darwin` — and publishes a DMG for each. Tauri also carries
Windows (`nsis`) and Linux (`AppImage`, `deb`) targets, but the release
workflow builds neither, so they are **neither built nor tested** as things
stand. A contribution that turns them on has to run them in CI too.

Note that the Tauri bundler spells the Intel slice `x64` in the DMG filename
(`WatchMe_X.Y.Z_x64.dmg`) and the Apple Silicon one `aarch64`. The landing
page matches both spellings, and `x86_64` and `universal` besides, so a change
in bundler naming does not silently break the download buttons.

## The landing page

`site/` is published to <https://h4md1.fr/watchme/> by
`.github/workflows/pages.yml`, on any push to `main` that touches `site/`.
It is plain HTML with no build step: edit and push.

The download buttons resolve the newest release's DMGs through the GitHub API
at page load, falling back to the releases page when that call fails. There
is no version number to update by hand.

## Cutting a release

1. Move the entries under `## [Unreleased]` into a new
   `## [X.Y.Z] - YYYY-MM-DD` section.
2. Align `version` in `package.json` with `X.Y.Z`.
3. Create `release/vX.Y.Z` from `develop`.
4. Stabilize and test the release candidate. Tag each candidate:

   ```bash
   git tag vX.Y.Z-rc.1 && git push origin vX.Y.Z-rc.1
   ```

5. Merge the stabilized release branch into `main`, then tag and push the
   production version:

   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```

6. The workflow creates the GitHub release, pulls its body from the matching
   `CHANGELOG.md` section, builds macOS, and uploads the artifacts to it.

Development tags (`vX.Y.Z-dev.YYYYMMDD` and `vX.Y.Z-alpha.N`) and release
candidate tags (`vX.Y.Z-rc.N`) publish as *pre-releases*. A clean
`vX.Y.Z` tag on `main` publishes as the latest stable release. Tauri's updater
signing and update metadata are not configured yet; releases currently carry
the built installers as GitHub release assets.

## Code of conduct

The project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
