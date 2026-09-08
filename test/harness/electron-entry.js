// Harness run BY Electron, not by node.
//
// It replays, in the main process, every Electron API `main.js` depends on,
// then exits with a status code. This is the net meant to catch regressions
// from the Electron 32 -> 43 upgrade (see issue #14): a binding that has
// disappeared or been renamed fails the test, instead of producing an app
// that launches but no longer works.
//
// Run with `npx electron test/harness/electron-entry.js`.

import assert from 'node:assert/strict';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  app,
  BrowserWindow,
  ipcMain,
  nativeImage,
  screen,
  Tray,
} from 'electron';
import Store from 'electron-store';
import psList from 'ps-list';
import IPC_CHANNELS from '../../ipc-channels.json' with { type: 'json' };
import { trayBadge } from '../../tray-status.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

const checks = [];
function check(label, fn) {
  checks.push({ label, fn });
}

// --- What main.js does on startup -----------------------------------------

check('app.whenReady() resolves', async () => {
  await app.whenReady();
});

check('the tray icon exists and loads', () => {
  const iconPath = path.join(ROOT, 'misc/tray-icon.png');
  assert.ok(existsSync(iconPath), `icon not found: ${iconPath}`);

  let trayIcon = nativeImage.createFromPath(iconPath);
  assert.ok(!trayIcon.isEmpty(), 'nativeImage loaded an empty image');

  // main.js resizes, then marks the image as a template on macOS
  trayIcon = trayIcon.resize({ width: 16, height: 12 });
  assert.ok(!trayIcon.isEmpty(), 'empty image after resize');
  if (process.platform === 'darwin') {
    trayIcon.setTemplateImage(true);
    assert.equal(trayIcon.isTemplateImage(), true);
  }
});

check('a Tray can be constructed and exposes getBounds()', () => {
  const trayIcon = nativeImage
    .createFromPath(path.join(ROOT, 'misc/tray-icon.png'))
    .resize({ width: 16, height: 12 });
  const tray = new Tray(trayIcon);

  // showWindow() depends on getBounds() to position the window
  const bounds = tray.getBounds();
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.equal(typeof bounds[key], 'number', `getBounds().${key}`);
  }
  tray.destroy();
});

check('tray.setTitle() carries the count shown beside the icon', () => {
  // The badge relies on setTitle, which only exists on macOS.
  if (process.platform !== 'darwin') return;

  const trayIcon = nativeImage
    .createFromPath(path.join(ROOT, 'misc/tray-icon.png'))
    .resize({ width: 16, height: 12 });
  const tray = new Tray(trayIcon);

  assert.equal(typeof tray.setTitle, 'function', 'setTitle has disappeared');

  tray.setTitle(trayBadge(3));
  assert.equal(tray.getTitle(), '3', 'the count was not applied');

  // Zero processes watched: the badge must disappear, not show 0.
  tray.setTitle(trayBadge(0));
  assert.equal(tray.getTitle(), '', 'the badge should have been cleared');

  tray.destroy();
});

check('screen.getDisplayNearestPoint() returns usable bounds', () => {
  const display = screen.getDisplayNearestPoint({ x: 0, y: 0 });
  assert.ok(display, 'no display returned');
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.equal(typeof display.bounds[key], 'number', `bounds.${key}`);
  }
});

check(
  'a BrowserWindow with the webPreferences from main.js loads index.html',
  async () => {
    // The same handlers as main.js, to exercise the IPC bridge end to end.
    ipcMain.handle(IPC_CHANNELS.GET_PROCESSES, () => psList());
    ipcMain.handle(IPC_CHANNELS.GET_PREFERENCES, () => ({
      autoLaunch: false,
      prefilterRegex: '',
    }));
    ipcMain.handle(IPC_CHANNELS.SAVE_PREFERENCES, () => ({
      loginItemSuccess: true,
    }));

    const win = new BrowserWindow({
      width: 800,
      height: 500,
      show: false,
      frame: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // see main.js for the rationale
        preload: path.join(ROOT, 'preload.js'),
      },
    });

    await win.loadFile(path.join(ROOT, 'index.html'));

    const title = await win.webContents.executeJavaScript('document.title');
    assert.ok(title.length > 0, 'the document did not load');

    // The contextBridge bridge must be in place on the renderer side
    const bridge = await win.webContents.executeJavaScript(
      'Object.keys(window.electronAPI || {}).sort()'
    );
    for (const method of [
      'getPreferences',
      'getProcesses',
      'savePreferences',
    ]) {
      assert.ok(
        bridge.includes(method),
        `window.electronAPI.${method} missing - the preload was not applied`
      );
    }

    // Full round trip renderer -> preload -> ipcMain -> ps-list
    const processCount = await win.webContents.executeJavaScript(
      'window.electronAPI.getProcesses().then((p) => p.length)'
    );
    assert.ok(
      processCount > 0,
      'the renderer received no processes through the IPC bridge'
    );

    // save-preferences is an invoke/handle round trip (like get-processes),
    // not a fire-and-forget send/on: the renderer must receive the result
    // returned by the handler.
    const saveResult = await win.webContents.executeJavaScript(
      "window.electronAPI.savePreferences({ autoLaunch: true, prefilterRegex: '' })"
    );
    assert.deepEqual(
      saveResult,
      { loginItemSuccess: true },
      'save-preferences must return the handler result through invoke'
    );

    // XSS non-regression (see issue #6): a process name travels all the way
    // to the fallback notification. It has to stay text.
    const payload = '<img src=x onerror="window.__pwned = true">';
    const xss = await win.webContents.executeJavaScript(`
      (() => {
        showFallbackNotification(${JSON.stringify(payload)}, 'info');
        const node = document.querySelector('.notification.info');
        return {
          injectedImages: node.querySelectorAll('img').length,
          renderedText: node.textContent,
          pwned: window.__pwned === true,
        };
      })()
    `);
    assert.equal(xss.injectedImages, 0, 'the injected markup was interpreted');
    assert.equal(xss.pwned, false, 'the onerror handler ran');
    assert.ok(
      xss.renderedText.includes(payload),
      'the message must render as literal text'
    );

    // Offline and CSP (see issue #7): no remote resources, and the icons
    // must have real dimensions once rendered.
    const offline = await win.webContents.executeJavaScript(`
      (() => {
        const remote = [...document.querySelectorAll('link[href], script[src], img[src]')]
          .map((el) => el.getAttribute('href') || el.getAttribute('src'))
          .filter((url) => /^https?:/.test(url));
        const icons = [...document.querySelectorAll('svg.icon, svg.search-icon')];
        return {
          remote,
          iconCount: icons.length,
          unsized: icons.filter((el) => el.getBoundingClientRect().width === 0).length,
          csp: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
        };
      })()
    `);
    assert.deepEqual(offline.remote, [], 'remote resources referenced');
    assert.equal(offline.csp, true, 'no CSP meta tag');
    assert.equal(offline.iconCount, 4, 'the 4 inline icons must be present');
    assert.equal(offline.unsized, 0, 'an icon has zero width');

    // The notification sound has to load INSIDE the renderer (see #17):
    // the path must resolve and the CSP must allow media-src.
    const sound = await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const audio = new Audio('misc/notification-sound.wav');
        audio.addEventListener('loadedmetadata', () =>
          resolve({ ok: true, duration: audio.duration })
        );
        audio.addEventListener('error', () =>
          resolve({ ok: false, code: audio.error && audio.error.code })
        );
        setTimeout(() => resolve({ ok: false, code: 'timeout' }), 4000);
      })
    `);
    assert.equal(
      sound.ok,
      true,
      `the notification sound does not load (code ${sound.code})`
    );
    assert.ok(sound.duration > 0.5, 'unexpected sound duration');

    win.destroy();
    ipcMain.removeHandler(IPC_CHANNELS.GET_PROCESSES);
    ipcMain.removeHandler(IPC_CHANNELS.GET_PREFERENCES);
    ipcMain.removeHandler(IPC_CHANNELS.SAVE_PREFERENCES);
  }
);

check('app.dock is available on macOS', () => {
  if (process.platform !== 'darwin') return;
  assert.ok(app.dock, 'app.dock missing: main.js calls app.dock.hide()');
  assert.equal(typeof app.dock.hide, 'function');
});

// --- Preference persistence -----------------------------------------------

check('electron-store round-trips the preferences shape', () => {
  // Dedicated name: the real preferences file is left alone.
  const store = new Store({ name: 'watchme-test-preferences' });

  const defaults = { autoLaunch: false, prefilterRegex: '' };
  assert.deepEqual(store.get('preferences', defaults), defaults);

  const written = { autoLaunch: true, prefilterRegex: '^node' };
  store.set('preferences', written);
  assert.deepEqual(store.get('preferences'), written);

  // The path is logged: it is the reference point for the
  // electron-store 10 -> 11 upgrade (see issue #15).
  console.log(`    store path: ${store.path}`);
  assert.ok(store.path.endsWith('.json'), 'the store must be a JSON file');

  store.clear();
});

check('electron-store reads back a pre-existing config file', () => {
  // Migration guard (see issue #15). An existing user's preferences must
  // never be lost to an electron-store version bump. Write a file by hand,
  // in the historical format, then check a fresh Store reads it as is.
  const name = 'watchme-migration-probe';
  const file = path.join(app.getPath('userData'), `${name}.json`);
  const existing = {
    preferences: { autoLaunch: true, prefilterRegex: '^node' },
  };

  writeFileSync(file, `${JSON.stringify(existing, null, '\t')}\n`);

  const store = new Store({ name });
  assert.deepEqual(
    store.get('preferences'),
    existing.preferences,
    'an existing user preferences are not read back'
  );
  assert.equal(
    store.path,
    file,
    'the config file path changed: users would lose their settings'
  );

  rmSync(file, { force: true });
});

check('app.setLoginItemSettings() is callable', () => {
  // main.js already wraps it in a try/catch: this only checks the binding
  // still exists.
  assert.equal(typeof app.setLoginItemSettings, 'function');
  assert.equal(typeof app.getLoginItemSettings, 'function');
});

// --- Run -------------------------------------------------------------------

async function run() {
  let failed = 0;

  for (const { label, fn } of checks) {
    try {
      await fn();
      console.log(`ok   ${label}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${label}`);
      console.error(`     ${error.message}`);
    }
  }

  console.log(`\n${checks.length - failed}/${checks.length} checks OK`);
  app.exit(failed === 0 ? 0 : 1);
}

run();
