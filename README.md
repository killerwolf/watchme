<p align="center">
  <img width="300px" src="https://raw.githubusercontent.com/killerwolf/watchme/main/misc/WatchMe-logo.png" alt="WatchMe"/>
</p>

<p align="center">
  A macOS menu bar app that watches running processes and tells you the moment one exits.
</p>

<p align="center">
  <a href="https://github.com/killerwolf/watchme/releases/latest"><img alt="latest release" src="https://img.shields.io/github/v/release/killerwolf/watchme"></a>
  <a href="https://github.com/killerwolf/watchme/actions/workflows/release.yml"><img alt="build status" src="https://github.com/killerwolf/watchme/actions/workflows/release.yml/badge.svg?branch=main"></a>
  <img alt="macOS 13+" src="https://img.shields.io/badge/macOS-13%2B-black?logo=apple">
  <a href="https://github.com/killerwolf/watchme/blob/main/LICENSE"><img alt="licence" src="https://img.shields.io/badge/licence-MIT%20%2B%20attribution-blue"></a>
</p>

<p align="center">
  <a href="https://github.com/killerwolf/watchme/releases/latest"><b>⬇ Download for macOS</b></a>
  &nbsp;·&nbsp;
  <a href="https://h4md1.fr/watchme/">Website</a>
  &nbsp;·&nbsp;
  <a href="#is-this-the-right-tool">Is this for me?</a>
  &nbsp;·&nbsp;
  <a href="CHANGELOG.md">Changelog</a>
  &nbsp;·&nbsp;
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

You start a long build, a test suite, a migration, a big download — then spend the next
twenty minutes checking back to see whether it finished. WatchMe sits in the menu bar,
watches the processes you tick, and sends a notification the second one of them ends.

![WatchMe in action](https://raw.githubusercontent.com/killerwolf/watchme/main/misc/WatchMe-demo.gif)

## Is this the right tool?

**Yes, if** you run long jobs and want to be told when they finish, without leaving a
terminal window in view or writing `&& osascript -e 'display notification'` on the end
of every command.

**No, if** you want resource metrics — CPU, memory, per-process I/O — or the ability to
kill things. WatchMe answers one question, *is it still running?*, and nothing else.
Activity Monitor and `htop` are built for the rest.

**No, if** you're on Windows or Linux. The build config carries targets for both, but
the release workflow only produces macOS binaries today. See
[Platforms](CONTRIBUTING.md#platforms).

## Features

- **Notification and sound when a watched process ends** — the process list is polled
  every 5 seconds, and everything you ticked is checked on each pass.
- **Live count in the menu bar** — the number of processes you're watching sits next to
  the tray icon, capping at `99+` so it can't stretch the bar. The tooltip reports the
  real figure.
- **Two ways to cut down the list** — a search box for right now, and a *prefilter
  regex* in preferences that applies every time, for when you only ever care about
  `node` or `ffmpeg`.
- **Launch at login**, optional.
- **No network access whatsoever.** The window runs under a
  `default-src 'none'` Content Security Policy; the icons and the notification sound are
  bundled. Nothing about your processes leaves the machine, because nothing can leave it.
- **A small native core** — Tauri 2 and Rust read the process table, persist
  preferences, own the tray, and manage launch-at-login. The HTML/CSS/JS
  frontend remains deliberately small and offline.

## Install

1. Download the latest `.dmg` from [h4md1.fr/watchme](https://h4md1.fr/watchme/) or
   the [Releases page](https://github.com/killerwolf/watchme/releases/latest) — `arm64`
   for Apple Silicon, `x64` for Intel.
2. Open it and drag **WatchMe** to Applications.
3. Launch it. It appears in the menu bar, not the Dock.

Requires **macOS 13 (Ventura) or later**.

### First launch: macOS will complain

WatchMe is not code-signed with a paid Apple Developer certificate, so Gatekeeper
blocks it on first launch. This is the absence of a $99/year subscription, not a
verdict on the app.

- If macOS says the developer **cannot be verified**: right-click the app in
  Applications → **Open** → **Open**. Once only.
- If macOS says the app is **damaged and can't be opened**, clear the quarantine flag:

  ```bash
  xattr -cr /Applications/WatchMe.app
  ```

Prefer not to do either? [Build it yourself](#development) — the source is here and the
build is one command.

## Usage

1. Click the menu bar icon to open the window.
2. Type in the search box to narrow the process list.
3. Tick the processes you want to watch.
4. Get on with something else. WatchMe notifies you as each one ends.

The window hides when it loses focus — click the icon again to bring it back.

## Preferences

| Preference | What it does |
| --- | --- |
| **Auto Launch** | Starts WatchMe when you log in. |
| **Prefilter Regex** | A case-insensitive pattern applied to the process list on every load, before the search box. `node\|ffmpeg` shows only those two. |

## Development

```bash
git clone https://github.com/killerwolf/watchme.git
cd watchme
npm install
npm start
```

Needs Node.js ≥ 22.12.0 (`.nvmrc` pins `lts/jod`) and the stable Rust toolchain
required by Tauri 2.

```bash
npm test          # JavaScript unit tests, then Rust core tests
npm run check     # lint and format, via Biome
npm run build:mac # produces a macOS app and .dmg in src-tauri/target/
```

`monitoring.js` (the watched set and its polling loop) and `tray-status.js` (badge and
tooltip) deliberately carry no Tauri or DOM dependency, so both run under plain
`node --test` without starting the app. The process list, tray, persistence, and
launch-at-login commands live in `src-tauri/src/lib.rs`.

[CONTRIBUTING.md](CONTRIBUTING.md) covers the project layout, the checks CI runs, and
the release procedure.

## Roadmap

- **Windows and Linux releases.** Tauri carries NSIS, AppImage, and deb targets, but
  the release workflow currently builds macOS only. These targets are not built or
  tested yet.
- **Automatic updates.** Tauri updater signing and update metadata are not configured
  yet; releases currently use the native installers.
- Custom notification rules, process grouping, and remote monitoring — ideas, not
  commitments.

## Licence

MIT, with one addition: any derivative work, documentation or user interface must
visibly credit [@killerwolf](https://github.com/killerwolf). See [LICENSE](LICENSE).

## Support

Something broken, or an idea? [Open an issue](https://github.com/killerwolf/watchme/issues).

## Acknowledgements

Built with [Tauri](https://tauri.app/) and Rust. Icons are
[Font Awesome Free](https://fontawesome.com/license/free) 6.7.2 (CC BY 4.0), inlined as
SVG so the app stays offline.
