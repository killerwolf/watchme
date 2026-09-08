# Contributing to WatchMe

Thanks for the interest. This document covers the development environment,
the checks to pass, and the release procedure.

## Environment

### Requirements

- **Node.js ≥ 22.12.0** — the repo pins `lts/jod` in `.nvmrc`
- **npm ≥ 10**
- **macOS** for a full build: WatchMe only publishes macOS binaries today
  (see *Platforms* below)

### Setup

```bash
git clone https://github.com/killerwolf/watchme.git
cd watchme
npm install
npm start
```

`npm run dev` runs the same application with the `--dev` flag.

## Layout

```
watchme/
├── main.js              # Electron main process: window, tray, IPC
├── preload.js           # contextIsolation bridge, channels from ipc-channels.json
├── renderer.js          # UI: process list, filters, notifications
├── index.html           # Single window, strict CSP, no remote resources
├── monitoring.js        # Watched set + polling loop (DOM-free)
├── tray-status.js       # Tray badge and tooltip (Electron-free)
├── ipc-channels.json    # Channel names shared between main and preload
├── assets/              # App icons and build resources
├── misc/                # Logo, demo GIF, notification sound, tray icon
├── site/                # Landing page published to h4md1.fr/watchme/
├── tools/               # Asset generation scripts
├── test/                # Unit tests + Electron harness
├── docs/agents/         # Conventions aimed at agents
└── .github/workflows/   # CI, release and Pages
```

`monitoring.js` and `tray-status.js` deliberately carry no dependency on
Electron or the DOM. That is what lets them be exercised under `node --test`
without starting the application.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm start` | Run the application |
| `npm test` | Unit tests, then the Electron tests |
| `npm run test:unit` | Unit tests alone (`node --test`) |
| `npm run test:electron` | Tests that need an Electron runtime |
| `npm run check` | Lint + format (Biome) |
| `npm run check:fix` | Fix whatever is automatically fixable |
| `npm run pack` | Build without an installer, for verification |
| `npm run verify:pack` | Check the packaged application |
| `npm run build:mac` | Produce the `.dmg` and `.zip` |

CI runs `lint`, `format:check`, `test`, `pack` and `verify:pack`. Running
`npm run check && npm test && npm run pack` locally covers the essentials.

## Proposing a change

1. Branch from `main`.
2. Write the change, with a test as soon as the behaviour is testable.
   Behaviour that can be extracted out of Electron deserves its own testable
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

`electron-builder` carries Windows (`nsis`, `portable`) and Linux
(`AppImage`, `deb`) targets, but the release workflow only builds macOS.
Those targets are therefore **neither built nor tested** as things stand. A
contribution that turns them on has to run them in CI too — window
positioning and the tray badge both have platform-specific branches that have
never run anywhere but macOS.

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

A prerelease tag (`vX.Y.Z-rc.1`) publishes as a *pre-release*:
`electron-updater` ignores those by default, so the prerelease never reaches
existing installs.

The release is created **before** the build, deliberately: electron-builder
starts one publisher per architecture in parallel, and with no pre-existing
release the second gets a `422 already_exists` that fails its uploads.

## Code of conduct

The project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
