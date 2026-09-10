# Contributing to WatchMe

Thanks for the interest. This document covers the development environment,
the checks to pass, and the release procedure.

## Environment

### Requirements

- **Node.js ≥ 22.12.0** — the repo pins `lts/jod` in `.nvmrc`
- **npm ≥ 10**
- **Rust stable** and the Tauri 2 prerequisites
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
| `npm run build:mac` | Produce the macOS `.app` and `.dmg` |

CI runs `lint`, `format:check`, `test`, and `pack`. Running
`npm run check && npm test && npm run pack` locally covers the essentials.

## Proposing a change

1. Branch from `main`.
2. Write the change, with a test as soon as the behaviour is testable.
   Behaviour that can be extracted out of the desktop shell deserves its own testable
   module.
3. Pass the checks above.
4. Add an entry under `## [Unreleased]` in `CHANGELOG.md` if the change is
   user-visible. Describe what changes **for them**, not which files moved.
5. Open a pull request explaining the why as much as the what.

Everything in this repository is written in English — comments, tests,
changelog entries and commit messages included.

Issues live in [GitHub Issues](https://github.com/killerwolf/watchme/issues)
and use the labels `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`.

## Platforms

Tauri carries Windows (`nsis`) and Linux (`AppImage`, `deb`) targets, but the
release workflow only builds macOS. Those targets are therefore **neither
built nor tested** as things stand. A contribution that turns them on has to
run them in CI too.

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
3. Commit, merge to `main`.
4. Tag and push:

   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```

5. The workflow creates the release, pulls its body from the matching
   `CHANGELOG.md` section, builds macOS and uploads the artefacts to it.

A prerelease tag (`vX.Y.Z-rc.1`) publishes as a *pre-release*. Tauri's updater
signing and update metadata are not configured yet; releases currently carry
the built installers as GitHub release assets.

## Code of conduct

The project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
