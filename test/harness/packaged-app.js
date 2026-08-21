// Verifie l'application REELLEMENT PACKAGEE, a lancer apres `npm run pack`.
//
// Raison d'etre : `main.js` resout l'icone du tray avec
// path.join(__dirname, 'misc/tray-icon.png'). Une fois packagee, __dirname
// pointe DANS app.asar. Si `misc/` sort de l'asar — c'est exactement ce que
// faisait la clef `extraResources` — le chemin ne resout plus, nativeImage
// renvoie une image 0x0, et le tray devient invisible.
//
// Le piege est vicieux : en developpement (`npm start`) __dirname est la
// racine du depot, ou misc/ existe. Le bug n'apparait donc que dans le
// binaire livre. D'ou cette verification sur l'artefact packagé.

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
    console.error(
      'FAIL aucune app packagee dans dist/ — lancer `npm run pack`'
    );
    app.exit(1);
    return;
  }

  const asar = path.join(appPath, 'Contents', 'Resources', 'app.asar');
  const failures = [];

  // Le chemin exact que main.js construit une fois packagé
  const trayIcon = nativeImage.createFromPath(
    path.join(asar, 'misc/tray-icon.png')
  );
  if (trayIcon.isEmpty()) {
    failures.push(
      'icone du tray introuvable dans app.asar : le tray sera invisible. ' +
        "Verifier que misc/ n'est pas sorti de l'asar (extraResources)."
    );
  }

  // Le renderer reference la meme icone pour les notifications
  if (!existsSync(path.join(asar, 'index.html'))) {
    failures.push("index.html absent de l'asar");
  }

  // Le son de notification doit atteindre l'asar : le renderer le charge
  // par un chemin relatif a index.html (cf. issue #17). Une exclusion trop
  // large dans `files` le ferait disparaitre en silence.
  if (!existsSync(path.join(asar, 'misc/notification-sound.wav'))) {
    failures.push(
      "son de notification absent de l'asar : l'alerte sera muette"
    );
  }

  // Icone de l'application (cf. issue #31). Sans `mac.icon`, electron-builder
  // ne previent que par un avertissement facile a manquer dans les logs de
  // build, et livre electron.icns : l'app porte alors l'icone generique
  // d'Electron dans le Finder et le Dock.
  const resources = path.join(appPath, 'Contents', 'Resources');
  if (existsSync(path.join(resources, 'electron.icns'))) {
    failures.push(
      "l'app porte electron.icns : icone generique d'Electron, `mac.icon` est absent"
    );
  }
  if (!existsSync(path.join(resources, 'icon.icns'))) {
    failures.push('icon.icns absent des ressources de l app');
  }

  for (const failure of failures) console.error(`FAIL ${failure}`);
  if (failures.length === 0) {
    console.log(`ok   app packagee verifiee (${path.basename(appPath)})`);
    console.log(`     icone du tray : ${JSON.stringify(trayIcon.getSize())}`);
  }
  app.exit(failures.length === 0 ? 0 : 1);
});
