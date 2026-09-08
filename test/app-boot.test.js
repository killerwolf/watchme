// Boots the REAL application (main.js), rather than a harness replaying its
// logic. This is the only test that runs main.js.
//
// Exact scope: it checks the app starts and does not die on its own in the
// first few seconds (a crash loading the ES modules, a Tray construction
// error, an uncaught exception, and so on).
//
// What it does NOT cover: the `window-all-closed` listener in main.js.
// Verified empirically - removing it does not fail this test, because at
// startup the window is hidden (show: false) rather than closed, so the
// event never fires during the test.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOOT_GRACE_MS = 8000;

test('the application starts and stays alive', async () => {
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
    `the app quit on its own (code ${outcome.code}).\n` +
      "If the 'window-all-closed' listener in main.js was removed, that is " +
      `the cause: Electron then quits as soon as the window hides.\n${stderr}`
  );

  // A clean startup must not crash while loading the ES modules
  assert.ok(
    !stderr.includes('ERR_MODULE_NOT_FOUND'),
    `module not found at startup:\n${stderr}`
  );
});
