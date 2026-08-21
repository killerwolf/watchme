// Demarrage de la VRAIE application (main.js), et non d'un harness qui
// rejouerait sa logique. C'est le seul test qui execute main.js.
//
// Portee exacte : il verifie que l'app demarre et ne meurt pas d'elle-meme
// dans les premieres secondes (crash au chargement des modules ES, erreur
// de construction du Tray, exception non rattrapee...).
//
// Ce qu'il ne couvre PAS : le listener `window-all-closed` de main.js.
// Verifie empiriquement — le supprimer ne fait pas echouer ce test, parce
// qu'au demarrage la fenetre est masquee (show: false) et non fermee :
// l'evenement ne se declenche donc jamais pendant le test.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOOT_GRACE_MS = 8000;

test("l'application demarre et reste vivante", async () => {
  const child = spawn(electron, [ROOT], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const outcome = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ alive: true }), BOOT_GRACE_MS);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve({ alive: false, code });
    });
  });

  if (outcome.alive) {
    child.kill('SIGTERM');
  }

  assert.ok(
    outcome.alive,
    `l'app a quitte d'elle-meme (code ${outcome.code}).\n` +
      "Si le listener 'window-all-closed' de main.js a ete supprime, c'est " +
      `la cause : Electron quitte alors des que la fenetre se cache.\n${stderr}`
  );

  // Un demarrage propre ne doit pas cracher au chargement des modules ES
  assert.ok(
    !stderr.includes('ERR_MODULE_NOT_FOUND'),
    `module introuvable au demarrage :\n${stderr}`
  );
});
