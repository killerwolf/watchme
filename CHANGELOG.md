# Changelog

Every notable change to WatchMe is recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [semantic versioning](https://semver.org/).

## [Unreleased]

### Changed

- **The window was rebuilt as a menu-bar panel rather than a desktop app.**
  It is undecorated, always on top, and hides the moment it loses focus, but
  it was laid out like a document window: an 80 px icon rail down the side,
  64 px table rows, and 20 px of padding around everything. Six processes fit
  on screen at once. The rail is now a segmented control in a 40 px title
  bar, rows are 28 px, and thirteen processes fit in the same window.
- **The interface follows the system appearance.** It was hardcoded to one
  dark grey (`#313335`) regardless of what macOS was set to. Light and dark
  palettes are now defined as custom properties and swapped through
  `prefers-color-scheme`, using the system accent blue.
- **Preferences reads as a settings pane.** Bare checkboxes in a stack became
  three labelled groups of switches, each setting carrying a line explaining
  what it does.
- The styles moved out of a `<style>` block in `index.html` and into
  `styles.css`.

### Fixed

- **The process table no longer scrolls sideways.** Command lines are long
  enough to push the table past the width of the window, so reading the
  Command column meant scrolling horizontally and losing sight of the name it
  belonged to. The table is `table-layout: fixed`, and a command that does not
  fit is truncated at the *head* — the informative end of a command line is
  the tail, so `…/node_modules/.bin/vite --port 1420` is what survives, not
  `/opt/homebrew/bin/node /Volumes/…`. The full string is on the row's
  tooltip.
- **Watched rows are visible again.** `listProcesses()` tagged them with a
  `highlighted-row` class that no CSS had ever defined, so the only sign a
  process was being watched was the checkbox itself. Watched rows now carry an
  accent bar and a tint, sort to the top of the list, and are counted in the
  toolbar and the status bar.
- **The list no longer flickers or drops clicks.** The refresh every two
  seconds rebuilt the whole table body from scratch, which discarded the
  scroll position and could swallow a click that landed mid-rebuild. Rows are
  now reused and keyed by PID, and keyboard focus survives a reorder.
- **An invalid filter expression explains itself.** Preferences accepted any
  string; the failure surfaced later, as a desktop notification from the
  process list, with the process list left empty. The field now validates as
  you type, and saving is blocked until the expression compiles.
- **The window can be moved.** Removing the title bar left no drag handle
  anywhere in the interface, so the panel could not be repositioned. The new
  title bar is a drag region.
- The process list stops polling the native side while the window is hidden,
  and reads the filter expression from the preference cache instead of
  crossing the IPC boundary on every refresh.

### Added

- **Notifications and sound can each be turned off**, from the Preferences
  tab. Both default to on, including for anyone upgrading: `preferences.js`
  completes whatever is on disk with the defaults, so a key the user has
  never saved reads as "on" rather than as `undefined`. That direction is
  the one thing here worth a test, and it has four.

### Changed

- **The desktop runtime is now Tauri 2 + Rust.** The native core owns the
  process listing, tray icon, preference file, launch-at-login setting, and
  quit action. The existing offline frontend keeps the same process polling,
  filtering, notifications, sound, and hide-on-blur behavior.
- **The README now says what the app does, and who it is for.** An "Is this
  the right tool?" section names outright what WatchMe does *not* do — no
  metrics, no killing processes — and the activity monitor that does. The
  download link and the first-launch Gatekeeper warning move to the top of
  the page: an unsigned application reports "damaged and can't be opened",
  which most people read as malware rather than as the absence of a $99/year
  subscription.
- The package description and the README no longer mention Windows or Linux,
  which the release does not produce.
- **The demo GIF was re-recorded.** The old one dated from before 0.11.0:
  it showed a placeholder icon and carried a username and hostname in the
  terminal title bar. The new one shows the tray badge, which did not exist
  when the old one was made, and is 255 kB against 1.4 MB.
- **Everything in the repository is now written in English** — this file,
  the contributing guide, the code of conduct, and every code comment and
  test name. The README was already English; the rest was French, which made
  the project readable to a smaller set of people than it deserves.

### Added

- `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`.
- A social preview card (`.github/assets/social-preview.png`). Until now,
  every link to the repository pasted into Slack or anywhere else rendered as
  grey text.
- **A landing page at <https://h4md1.fr/watchme/>**, published from `site/` by
  `.github/workflows/pages.yml`. Its download buttons resolve the newest
  release's DMGs through the GitHub API, so there is no version number to
  update by hand, and it carries its own Open Graph metadata — the repository
  social preview does not cover a link to the site.

### Removed

- Documentation no longer ships inside the packaged application. `README.md`,
  `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CLAUDE.md`,
  `docs/` and `.npmcheckrc` were all embedded in the `asar`, where they serve
  no purpose at runtime. Same reasoning as the demo GIF in 0.11.0. (#12)

### Fixed

- **The product name in the interface.** The window title and the tray
  tooltip still announced "Script Watcher", the previous name. Two surfaces
  seen on every launch, carrying a name that exists nowhere else. (#18)

## [0.11.1] - 2026-08-21

A plumbing release: **the binary is functionally identical to v0.11.0**. It
records the publishing rework and serves as the first release down the new
path.

### Changed

- The release is now published by **electron-builder** itself, rather than by
  a separate job that re-downloaded the artefacts to re-upload them. One job
  fewer, and — more importantly — the `latest-mac.yml` and `.blockmap` files
  that `electron-updater` will need the day automatic updates are wanted.
  Brings WatchMe in line with the QuickToss workflow. (#49)
- The release body is fed from this file, falling back to GitHub's generated
  notes when there is no matching section.
- A prerelease tag (`v0.11.1-rc.1`) now publishes as a *pre-release*, which
  `electron-updater` ignores by default.
- `rimraf` moves to 6.x, the GitHub actions to v7.

### Fixed

- **Race to create the release.** electron-builder starts one publisher per
  architecture, in parallel: both were trying to create the release at the
  same time, and the loser got a `422 already_exists` that failed every one
  of its uploads. Seen on `v0.11.1-rc.1` — 1 file published out of 8. The
  release is now created before the build, so there is no race left to lose.

## [0.11.0] - 2026-08-21

### Added

- **The notification sound finally exists.** `renderer.js` referenced a
  `notification-sound.mp3` that was not in the repository: the feature the
  README advertised had never made a sound. Replaced with a short
  Super Nintendo-style completion fanfare, generated by
  `tools/build-notification-sound.mjs` (`npm run sound:build`) and shipped as
  WAV — played natively by Chromium, with no codec dependency. (#17)
- **The application has its own icon.** It carried Electron's default one,
  `mac.icon` not being declared — and `assets/icon.png` held an unrelated
  generic icon rather than the WatchMe logo. New icon drawn in SVG from the
  eye in the logo, in the interface's palette. `assets/icon.svg` is the
  source, `npm run icon:build` produces the PNG. (#31)

### Changed

- `verify:pack` now covers the application icon and the presence of the sound
  in the asar, on top of the tray icon.

## [0.10.0] - 2026-08-21

This batch is a maintenance pass after eleven months without a commit. It was
carried out under an explicit constraint: **change no existing behaviour**.
Two deliberate exceptions, both bug fixes detailed below — the tray icon and
offline operation.

### Security

- Fixed a DOM injection: a process name, controllable by any local process,
  was interpolated into `innerHTML` in the fallback notifications. Replaced
  with DOM construction. (#6)
- Removed `@electron/remote`, enabled on the window but used nowhere. The
  module punched through context isolation for nothing in return. (#5)
- Removed the dependency on the cdnjs CDN and added a
  `Content-Security-Policy`. (#7)

### Fixed

- **The tray icon was invisible in the packaged application.** The
  `extraResources` key moved `misc/` out of the `app.asar`, while `main.js`
  looks for it inside via `__dirname`; `nativeImage` returned a 0×0 image.
  The bug did not show up in development, where `__dirname` is the repo root.
  With the dock hidden, the tray is the app's only entry point. (#12)
- **The application was broken offline**: the icons came from a CDN. They are
  now inline SVGs. (#7)
- Double release publication: on a tag push, `electron-builder` switched to
  the `onTag` policy on its own and published the artefacts, duplicating the
  `release` job. Fixed with `--publish never` on the build. (#9)

### Added

- A non-regression test net, where the CI job was called "Test and Lint"
  without a single test existing: the `ps-list` contract, an Electron harness
  replaying the APIs `main.js` uses, a boot of the real application, and a
  check of the packaged artefact. (#4, #12)
- Dependabot, weekly on npm and monthly on GitHub Actions. Majors of
  `ps-list` and `electron-store` are excluded: they touch process display and
  preference persistence respectively, and deserve a manual review. (#13)
- This file.

### Changed

- Migrated from ESLint + Prettier to Biome 2.5.9, finishing the abandoned
  `feature/maj` branch. (#8)
- Cleaned up the release workflow: Linux steps that never ran, artefact globs
  with no purpose, `secrets.GH_TOKEN` replaced by the built-in
  `GITHUB_TOKEN`, PR filter fixed. (#9)
- The shipped application no longer embeds development files (`test/`,
  `.psd`, configuration), nor the 1.4 MB demo GIF that only serves the
  README. (#12)
- `package.json` metadata: `version` aligned with the latest tag, licence
  declared in a valid SPDX form. (#11)

### Removed

- Dead window controls (commented-out HTML, CSS, listeners, preload API and
  IPC handler), the phantom `update-monitored-processes` IPC, and a duplicate
  notification permission request. (#10)

### Known, not addressed

- The tray and the window title still show "Script Watcher". (#18)
- `ps-list` stays on 8.x: the major fixes no vulnerability and would touch
  process display. (#16)
