// Checks the ACTUALLY PACKAGED application; run it after `npm run pack`.
//
// Why it exists: `main.js` resolves the tray icon with
// path.join(__dirname, 'misc/tray-icon.png'). Once packaged, __dirname
// points INSIDE app.asar. If `misc/` is moved out of the asar - which is
// exactly what the `extraResources` key used to do - the path no longer
// resolves, nativeImage returns a 0x0 image, and the tray goes invisible.
//
// The trap is a nasty one: in development (`npm start`) __dirname is the
// repo root, where misc/ does exist. The bug therefore only shows up in the
// shipped binary. Hence this check against the packaged artefact.

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, nativeImage } from 'electron';

const ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const DIST = path.join(ROOT, 'dist');

function findPackagedApp() {
  if (!existsSync(DIST)) return null;
  for (const entry of readdirSync(DIST)) {
    const candidate = path.join(DIST, entry, 'WatchMe.app');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

app.whenReady().then(() => {
  const appPath = findPackagedApp();
  if (!appPath) {
    console.error('FAIL no packaged app in dist/ - run `npm run pack`');
    app.exit(1);
    return;
  }

  const asar = path.join(appPath, 'Contents', 'Resources', 'app.asar');
  const failures = [];

  // The exact path main.js builds once packaged
  const trayIcon = nativeImage.createFromPath(
    path.join(asar, 'misc/tray-icon.png')
  );
  if (trayIcon.isEmpty()) {
    failures.push(
      'tray icon not found in app.asar: the tray will be invisible. ' +
        'Check that misc/ has not been moved out of the asar (extraResources).'
    );
  }

  // The renderer references the same icon for notifications
  if (!existsSync(path.join(asar, 'index.html'))) {
    failures.push('index.html missing from the asar');
  }

  // The notification sound has to reach the asar: the renderer loads it
  // through a path relative to index.html (see issue #17). An over-broad
  // exclusion in `files` would make it disappear silently.
  if (!existsSync(path.join(asar, 'misc/notification-sound.wav'))) {
    failures.push(
      'notification sound missing from the asar: the alert will be silent'
    );
  }

  // Application icon (see issue #31). Without `mac.icon`, electron-builder
  // only warns through a line that is easy to miss in the build logs, and
  // ships electron.icns: the app then carries Electron's generic icon in
  // the Finder and the Dock.
  const resources = path.join(appPath, 'Contents', 'Resources');
  if (existsSync(path.join(resources, 'electron.icns'))) {
    failures.push(
      "the app carries electron.icns: Electron's generic icon, `mac.icon` is missing"
    );
  }
  if (!existsSync(path.join(resources, 'icon.icns'))) {
    failures.push('icon.icns missing from the app resources');
  }

  for (const failure of failures) console.error(`FAIL ${failure}`);
  if (failures.length === 0) {
    console.log(`ok   packaged app verified (${path.basename(appPath)})`);
    console.log(`     tray icon: ${JSON.stringify(trayIcon.getSize())}`);
  }
  app.exit(failures.length === 0 ? 0 : 1);
});
