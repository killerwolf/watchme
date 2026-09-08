// The `ps-list` contract.
//
// `renderer.js` consumes exactly three fields from what psList() returns:
//   - proc.pid  : key of the monitoring Map, and the checkbox value
//   - proc.name : Name column, text filter, prefilter regex
//   - proc.cmd  : Command column, text filter, prefilter regex
//
// These tests lock that contract down. They are here to fail loudly the day
// somebody attempts the ps-list 8 -> 9 upgrade (see issue #16).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import psList from 'ps-list';

test('psList() returns a non-empty list of processes', async () => {
  const processes = await psList();
  assert.ok(Array.isArray(processes), 'the return value must be an array');
  assert.ok(
    processes.length > 0,
    'the machine is necessarily running at least one process'
  );
});

test('every process exposes pid, name and cmd with the right types', async () => {
  const processes = await psList();

  for (const proc of processes) {
    assert.equal(
      typeof proc.pid,
      'number',
      `pid must be a number, got ${typeof proc.pid}`
    );
    assert.ok(
      Number.isInteger(proc.pid) && proc.pid > 0,
      'positive integer pid'
    );

    // renderer.js calls proc.name.toLowerCase() with no guard
    assert.equal(typeof proc.name, 'string', 'name must be a string');
    assert.ok(proc.name.length > 0, 'name must not be empty');

    // renderer.js calls proc.cmd.toLowerCase() with no guard: a missing or
    // non-string cmd would crash the filtering.
    assert.equal(typeof proc.cmd, 'string', 'cmd must be a string');
  }
});

test('the current node process is present and findable', async () => {
  const processes = await psList();
  const self = processes.find((proc) => proc.pid === process.pid);

  assert.ok(self, 'the test process must appear in the list');
  assert.match(
    self.name.toLowerCase(),
    /node/,
    `expected name to contain "node", got "${self.name}"`
  );
});

test('PIDs are unique', async () => {
  const processes = await psList();
  const pids = processes.map((proc) => proc.pid);
  assert.equal(
    new Set(pids).size,
    pids.length,
    'the monitoring Map is keyed by PID: duplicates would break tracking'
  );
});
