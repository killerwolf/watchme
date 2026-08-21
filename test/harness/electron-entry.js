// Harness execute PAR Electron (et non par node).
//
// Il rejoue, dans le processus principal, chaque API Electron dont depend
// `main.js`, puis sort avec un code de retour. C'est le filet qui doit
// attraper les regressions de la montee Electron 32 -> 43 (cf. issue #14) :
// un binding disparu ou renomme fait echouer le test au lieu de produire
// une app qui se lance mais ne fonctionne plus.
//
// Lance via `npx electron test/harness/electron-entry.js`.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

const checks = [];
function check(label, fn) {
  checks.push({ label, fn });
}

// --- Ce que main.js fait au demarrage -------------------------------------

check('app.whenReady() se resout', async () => {
  await app.whenReady();
});

check("l'icone du tray existe et se charge", () => {
  const iconPath = path.join(ROOT, 'misc/tray-icon.png');
  assert.ok(existsSync(iconPath), `icone introuvable : ${iconPath}`);

  let trayIcon = nativeImage.createFromPath(iconPath);
  assert.ok(!trayIcon.isEmpty(), 'nativeImage a charge une image vide');

  // main.js redimensionne puis marque l'image comme template sur macOS
  trayIcon = trayIcon.resize({ width: 16, height: 12 });
  assert.ok(!trayIcon.isEmpty(), 'image vide apres resize');
  if (process.platform === 'darwin') {
    trayIcon.setTemplateImage(true);
    assert.equal(trayIcon.isTemplateImage(), true);
  }
});

check('un Tray peut etre construit et expose getBounds()', () => {
  const trayIcon = nativeImage
    .createFromPath(path.join(ROOT, 'misc/tray-icon.png'))
    .resize({ width: 16, height: 12 });
  const tray = new Tray(trayIcon);

  // showWindow() depend de getBounds() pour positionner la fenetre
  const bounds = tray.getBounds();
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.equal(typeof bounds[key], 'number', `getBounds().${key}`);
  }
  tray.destroy();
});

check('screen.getDisplayNearestPoint() renvoie des bounds exploitables', () => {
  const display = screen.getDisplayNearestPoint({ x: 0, y: 0 });
  assert.ok(display, 'aucun display retourne');
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.equal(typeof display.bounds[key], 'number', `bounds.${key}`);
  }
});

check(
  'une BrowserWindow avec les webPreferences de main.js charge index.html',
  async () => {
    // Les memes handlers que main.js, pour exercer le pont IPC de bout en bout.
    ipcMain.handle('get-processes', () => psList());
    ipcMain.handle('get-preferences', () => ({
      autoLaunch: false,
      prefilterRegex: '',
    }));

    const win = new BrowserWindow({
      width: 800,
      height: 500,
      show: false,
      frame: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(ROOT, 'preload.js'),
      },
    });

    await win.loadFile(path.join(ROOT, 'index.html'));

    const title = await win.webContents.executeJavaScript('document.title');
    assert.ok(title.length > 0, 'le document ne sest pas charge');

    // Le pont contextBridge doit etre en place cote renderer
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
        `window.electronAPI.${method} absent — le preload na pas ete applique`
      );
    }

    // Aller-retour complet renderer -> preload -> ipcMain -> ps-list
    const processCount = await win.webContents.executeJavaScript(
      'window.electronAPI.getProcesses().then((p) => p.length)'
    );
    assert.ok(
      processCount > 0,
      'le renderer na recu aucun processus a travers le pont IPC'
    );

    win.destroy();
    ipcMain.removeHandler('get-processes');
    ipcMain.removeHandler('get-preferences');
  }
);

check('app.dock est disponible sur macOS', () => {
  if (process.platform !== 'darwin') return;
  assert.ok(app.dock, 'app.dock absent : main.js appelle app.dock.hide()');
  assert.equal(typeof app.dock.hide, 'function');
});

// --- Persistance des preferences ------------------------------------------

check('electron-store fait un round-trip sur la forme des preferences', () => {
  // Nom dedie : on ne touche pas au fichier de preferences reel.
  const store = new Store({ name: 'watchme-test-preferences' });

  const defaults = { autoLaunch: false, prefilterRegex: '' };
  assert.deepEqual(store.get('preferences', defaults), defaults);

  const written = { autoLaunch: true, prefilterRegex: '^node' };
  store.set('preferences', written);
  assert.deepEqual(store.get('preferences'), written);

  // Le chemin est logge : il sert de reference pour la montee
  // electron-store 10 -> 11 (cf. issue #15).
  console.log(`    store path: ${store.path}`);
  assert.ok(store.path.endsWith('.json'), 'le store doit etre un fichier JSON');

  store.clear();
});

check('app.setLoginItemSettings() est appelable', () => {
  // main.js l'entoure deja d'un try/catch : on verifie juste que
  // le binding existe toujours.
  assert.equal(typeof app.setLoginItemSettings, 'function');
  assert.equal(typeof app.getLoginItemSettings, 'function');
});

// --- Execution -------------------------------------------------------------

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

  console.log(`\n${checks.length - failed}/${checks.length} verifications OK`);
  app.exit(failed === 0 ? 0 : 1);
}

run();
