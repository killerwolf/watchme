// Contrat de `ps-list`.
//
// `renderer.js` consomme exactement trois champs du retour de psList() :
//   - proc.pid  : cle de la Map de surveillance, et valeur des checkbox
//   - proc.name : colonne Name, filtre texte, prefilter regex
//   - proc.cmd  : colonne Command, filtre texte, prefilter regex
//
// Ces tests verrouillent ce contrat. Ils sont la pour echouer bruyamment
// le jour ou l'on tentera la montee ps-list 8 -> 9 (cf. issue #16).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import psList from 'ps-list';

test('psList() retourne une liste non vide de processus', async () => {
  const processes = await psList();
  assert.ok(Array.isArray(processes), 'le retour doit etre un tableau');
  assert.ok(
    processes.length > 0,
    'la machine execute forcement au moins un processus'
  );
});

test('chaque processus expose pid, name et cmd avec les bons types', async () => {
  const processes = await psList();

  for (const proc of processes) {
    assert.equal(
      typeof proc.pid,
      'number',
      `pid doit etre un number, recu ${typeof proc.pid}`
    );
    assert.ok(Number.isInteger(proc.pid) && proc.pid > 0, 'pid entier positif');

    // renderer.js appelle proc.name.toLowerCase() sans garde
    assert.equal(typeof proc.name, 'string', 'name doit etre un string');
    assert.ok(proc.name.length > 0, 'name ne doit pas etre vide');

    // renderer.js appelle proc.cmd.toLowerCase() sans garde : un cmd
    // absent ou non-string ferait planter le filtrage.
    assert.equal(typeof proc.cmd, 'string', 'cmd doit etre un string');
  }
});

test('le processus node courant est present et retrouvable', async () => {
  const processes = await psList();
  const self = processes.find((proc) => proc.pid === process.pid);

  assert.ok(self, 'le processus de test doit apparaitre dans la liste');
  assert.match(
    self.name.toLowerCase(),
    /node/,
    `name attendu contenant "node", recu "${self.name}"`
  );
});

test('les PID sont uniques', async () => {
  const processes = await psList();
  const pids = processes.map((proc) => proc.pid);
  assert.equal(
    new Set(pids).size,
    pids.length,
    'la Map de surveillance est indexee par PID : les doublons casseraient le suivi'
  );
});
