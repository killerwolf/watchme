// Records misc/WatchMe-demo.gif.
//
// The demo GIF is an artefact; this script is its source. Same reasoning as
// tools/build-notification-sound.mjs for the sound and assets/icon.svg for
// the icon. The previous GIF made the case: nobody could regenerate it, so it
// still showed Electron's placeholder icon long after the app had its own.
//
//   npm run demo:build
//
// It records the REAL packaged app on the real desktop, because the two
// things worth showing - the tray badge and the notification - are both drawn
// outside the app window. Capturing the window from inside Electron
// (webContents.capturePage) is tidier and needs no permissions, but it cannot
// see either of them.
//
// The app is driven over the Chrome DevTools Protocol rather than by
// synthesising clicks: no Accessibility grant, and it exercises the real
// search box and the real checkbox.
//
// What it needs:
//   - a packaged build in dist/ (`npm run pack`)
//   - Screen Recording permission for the terminal, granted BEFORE it was
//     launched - macOS never applies the grant to a running process
//   - ffmpeg on PATH
//
// Two macOS details it works around, both learned the hard way:
//   - `screencapture` refuses to overwrite and fails silently, so the target
//     is removed first.
//   - Menu bar extras render on whichever display owns the menu bar, and
//     showWindow() positions the window under the tray icon. On a multi-screen
//     setup the recording lands on the wrong display unless an app on the
//     intended one is focused first.
//
// ffmpeg's avfoundation screen input is not usable here: on current macOS it
// opens the device and then delivers no frames.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'dist', 'mac-arm64', 'WatchMe.app');
const OUT = path.join(ROOT, 'misc', 'WatchMe-demo.gif');

// The display to record, as `screencapture -D` numbers them, and an app that
// lives on it to focus first.
const DISPLAY = process.env.DEMO_DISPLAY || '1';
const FOCUS_APP = process.env.DEMO_FOCUS_APP || 'iTerm';

const PORT = 9222;
const DURATION = 30; // seconds of raw capture
const BUILD_SECONDS = 20; // the watched build ends ~20s in

const work = mkdtempSync(path.join(tmpdir(), 'watchme-demo-'));
const raw = path.join(work, 'raw.mov');
const frames = path.join(work, 'frames');
mkdirSync(frames);

writeFileSync(
  path.join(work, 'Makefile'),
  `build:\n\t@echo "Building..."\n\t@sleep ${BUILD_SECONDS}\n\t@echo "Build completed."\n`
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });

// --- CDP ------------------------------------------------------------------

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await (
        await fetch(`http://127.0.0.1:${PORT}/json`)
      ).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => {
          ws.addEventListener('open', res, { once: true });
          ws.addEventListener('error', rej, { once: true });
        });
        return ws;
      }
    } catch {
      // the app is still starting
    }
    await sleep(250);
  }
  throw new Error('the app never exposed a CDP target');
}

function evaluator(ws) {
  let id = 0;
  return (expression) =>
    new Promise((resolve, reject) => {
      const mine = ++id;
      const onMsg = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id !== mine) return;
        ws.removeEventListener('message', onMsg);
        if (msg.error) return reject(new Error(msg.error.message));
        if (msg.result.exceptionDetails) {
          return reject(new Error(msg.result.exceptionDetails.text));
        }
        resolve(msg.result.result.value);
      };
      ws.addEventListener('message', onMsg);
      ws.send(
        JSON.stringify({
          id: mine,
          method: 'Runtime.evaluate',
          params: { expression, awaitPromise: true, returnByValue: true },
        })
      );
    });
}

// --- encode ---------------------------------------------------------------

/**
 * Samples the capture densely while something is moving and sparsely through
 * the build, then encodes with per-frame durations. Playback stays true to
 * the app's real latency - the 5s poll included - without paying for those
 * idle seconds in frames.
 */
function encode(crop) {
  const spans = [
    [2.0, 9.5, 0.12], // the window opens, the search is typed, the row ticked
    [9.5, 20.6, 0.7], // the build runs and nothing moves
    [20.6, 24.2, 0.15], // the process ends, the row and the badge clear
  ];

  const times = [];
  for (const [from, to, step] of spans) {
    for (let t = from; t < to; t += step) times.push(Number(t.toFixed(3)));
  }

  const filter = `${crop},scale=iw/2:ih/2:flags=lanczos`;
  times.forEach((t, i) => {
    const frame = path.join(frames, `f_${String(i).padStart(4, '0')}.png`);
    sh('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-ss',
      String(t),
      '-i',
      raw,
      '-frames:v',
      '1',
      '-vf',
      filter,
      frame,
    ]);
  });

  const lines = ['ffconcat version 1.0'];
  times.forEach((t, i) => {
    const next = times[i + 1] ?? t + 0.15;
    lines.push(
      `file 'f_${String(i).padStart(4, '0')}.png'`,
      `duration ${(next - t).toFixed(3)}`
    );
  });
  // The concat demuxer ignores the last entry's duration unless the file is
  // repeated.
  lines.push(`file 'f_${String(times.length - 1).padStart(4, '0')}.png'`);

  const list = path.join(frames, 'list.ffconcat');
  writeFileSync(list, `${lines.join('\n')}\n`);

  const palette = path.join(frames, 'palette.png');
  const ff = (args) =>
    sh('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-i', list, ...args]);
  ff(['-vf', 'palettegen=max_colors=128:stats_mode=diff', palette]);
  ff(['-i', palette, '-lavfi', 'paletteuse=dither=bayer:bayer_scale=3', OUT]);

  return times.length;
}

// --- run ------------------------------------------------------------------

async function main() {
  sh('pkill', ['-f', 'WatchMe.app/Contents/MacOS/WatchMe']);
  sh('pkill', ['-f', 'make build']);
  await sleep(1000);

  // Puts the menu bar - and with it the tray icon - on the intended display.
  // Minimised straight after: the focus is what was wanted, not the window,
  // which would otherwise sit in the recording.
  sh('open', ['-a', FOCUS_APP]);
  await sleep(1500);
  sh('osascript', [
    '-e',
    `tell application "${FOCUS_APP}" to tell current window to set miniaturized to true`,
  ]);
  await sleep(1200);

  const app = spawn(
    `${APP}/Contents/MacOS/WatchMe`,
    [`--remote-debugging-port=${PORT}`],
    { stdio: 'ignore', detached: true }
  );
  app.unref();

  const ws = await connect();
  const evaluate = evaluator(ws);

  const build = spawn('make', ['build'], {
    cwd: work,
    stdio: 'ignore',
    detached: true,
  });
  build.unref();
  await sleep(1200);

  rmSync(raw, { force: true });
  console.log(
    `recording display ${DISPLAY} for ${DURATION}s - do not touch the machine`
  );
  spawn(
    'screencapture',
    ['-v', '-V', String(DURATION), '-D', DISPLAY, '-x', raw],
    { stdio: 'ignore', detached: true }
  );

  const started = Date.now();
  const at = (s) => sleep(Math.max(0, started + s * 1000 - Date.now()));

  // Shown only once the recorder is live. The window hides on blur, so
  // nothing may take focus from here on.
  await at(1.5);
  sh('open', [APP]);
  await at(3.2);

  const bounds = JSON.parse(
    await evaluate(`JSON.stringify({
    x: window.screenX, y: window.screenY,
    w: window.outerWidth, h: window.outerHeight,
    dpr: window.devicePixelRatio, vis: document.visibilityState
  })`)
  );
  if (bounds.vis !== 'visible')
    throw new Error('the window did not come forward');

  // Typed a character at a time: the filter is debounced at 300ms, and a
  // value set in one go reads as a paste rather than a search.
  for (const [i, ch] of [...'make'].entries()) {
    await at(3.8 + i * 0.22);
    await evaluate(`(() => {
      const el = document.getElementById('filter-input');
      el.focus(); el.value += ${JSON.stringify(ch)};
      el.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
  }

  await at(6.4);
  const pid = await evaluate(`(() => {
    const row = [...document.querySelectorAll('tr')]
      .find((r) => /\\bmake build\\b/.test(r.textContent));
    if (!row) return null;
    const box = row.querySelector('input[type="checkbox"]');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    return box.value;
  })()`);
  if (!pid) throw new Error('the `make build` row was not found in the list');
  console.log(`watching PID ${pid}`);

  await at(DURATION + 2);
  ws.close();
  sh('pkill', ['-f', 'WatchMe.app/Contents/MacOS/WatchMe']);
  sh('pkill', ['-f', 'make build']);

  // The crop follows the window rather than the screen: from its left edge to
  // the right of the display, and from the menu bar down to its bottom. That
  // keeps the tray badge and the notification corner in frame and everything
  // else - other windows, desktop widgets - out of it.
  const width = Number(
    sh('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width',
      '-of',
      'default=nw=1:nk=1',
      raw,
    ]).stdout.trim()
  );
  const left = Math.round(bounds.x * bounds.dpr);
  const height = Math.round((bounds.y + bounds.h) * bounds.dpr);
  const crop = `crop=${width - left}:${height}:${left}:0`;

  const count = encode(crop);
  console.log(`${count} frames -> ${path.relative(process.cwd(), OUT)}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => rmSync(work, { recursive: true, force: true }));
