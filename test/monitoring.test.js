import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProcessMonitor } from '../monitoring.js';

// Fake clock: setIntervalFn/clearIntervalFn are injected instead of the
// real timers, so a tick is driven by hand and no test needs to wait.
function fakeClock() {
  let nextId = 1;
  const callbacks = new Map();
  return {
    setIntervalFn: (fn) => {
      const id = nextId++;
      callbacks.set(id, fn);
      return id;
    },
    clearIntervalFn: (id) => {
      callbacks.delete(id);
    },
    tick: async () => {
      for (const fn of callbacks.values()) {
        await fn();
      }
    },
    activeCount: () => callbacks.size,
  };
}

test('add() marks a pid as monitored', () => {
  const clock = fakeClock();
  const monitor = createProcessMonitor({
    getProcesses: async () => [],
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
  });
  monitor.add(1, 'node');
  assert.equal(monitor.has(1), true);
  assert.deepEqual(monitor.list(), [{ pid: 1, name: 'node' }]);
});

test('remove() unmarks a pid', () => {
  const clock = fakeClock();
  const monitor = createProcessMonitor({
    getProcesses: async () => [],
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
  });
  monitor.add(1, 'node');
  monitor.remove(1);
  assert.equal(monitor.has(1), false);
  assert.deepEqual(monitor.list(), []);
});

test('add() starts the interval only on the first pid', () => {
  const clock = fakeClock();
  const monitor = createProcessMonitor({
    getProcesses: async () => [],
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
  });

  monitor.add(1, 'node');
  assert.equal(clock.activeCount(), 1);

  monitor.add(2, 'python');
  assert.equal(
    clock.activeCount(),
    1,
    'a second add must not start a second interval'
  );
});

test('remove() stops the interval once the last pid is gone', () => {
  const clock = fakeClock();
  const monitor = createProcessMonitor({
    getProcesses: async () => [],
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
  });

  monitor.add(1, 'node');
  monitor.add(2, 'python');
  monitor.remove(1);
  assert.equal(clock.activeCount(), 1, 'still one pid monitored');

  monitor.remove(2);
  assert.equal(clock.activeCount(), 0);
});

test('onChange fires with the current size on add and remove', () => {
  const clock = fakeClock();
  const monitor = createProcessMonitor({
    getProcesses: async () => [],
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
  });
  const sizes = [];
  monitor.onChange((size) => sizes.push(size));

  monitor.add(1, 'node');
  monitor.add(2, 'python');
  monitor.remove(1);

  assert.deepEqual(sizes, [1, 2, 1]);
});

test('a tick reports and removes pids missing from getProcesses()', async () => {
  const clock = fakeClock();
  const monitor = createProcessMonitor({
    getProcesses: async () => [{ pid: 2, name: 'python' }],
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
  });

  const ended = [];
  monitor.onEnded((pid, name) => ended.push({ pid, name }));

  monitor.add(1, 'node');
  monitor.add(2, 'python');

  await clock.tick();

  assert.deepEqual(ended, [{ pid: 1, name: 'node' }]);
  assert.equal(monitor.has(1), false);
  assert.equal(monitor.has(2), true);
});

test('the interval stops itself once every monitored process has ended', async () => {
  const clock = fakeClock();
  const monitor = createProcessMonitor({
    getProcesses: async () => [],
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
  });

  monitor.add(1, 'node');
  await clock.tick();

  assert.equal(monitor.has(1), false);
  assert.equal(clock.activeCount(), 0);
});

test('onChange fires after a tick removes an ended process', async () => {
  const clock = fakeClock();
  const monitor = createProcessMonitor({
    getProcesses: async () => [],
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
  });

  const sizes = [];
  monitor.onChange((size) => sizes.push(size));

  monitor.add(1, 'node');
  await clock.tick();

  assert.deepEqual(sizes, [1, 0]);
});
