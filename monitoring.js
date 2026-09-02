// monitoring.js
//
// Owns the set of monitored processes: which PIDs are being watched, the
// interval that checks whether they're still running, and the notification
// of callers when a watched process ends or the monitored set changes.
// DOM-free by design — callers subscribe via onEnded/onChange and render
// however they need to.

export function createProcessMonitor({
  getProcesses,
  intervalMs = 5000,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
}) {
  const monitored = new Map();
  const endedListeners = [];
  const changeListeners = [];
  let intervalId = null;

  function notifyChange() {
    for (const listener of changeListeners) {
      listener(monitored.size);
    }
  }

  function start() {
    if (intervalId !== null) {
      return;
    }
    intervalId = setIntervalFn(pollForEndedProcesses, intervalMs);
  }

  function stop() {
    if (intervalId === null) {
      return;
    }
    clearIntervalFn(intervalId);
    intervalId = null;
  }

  async function pollForEndedProcesses() {
    const processes = await getProcesses();
    const runningPIDs = new Set(processes.map((proc) => proc.pid));

    let changed = false;
    for (const [pid, name] of monitored) {
      if (!runningPIDs.has(pid)) {
        monitored.delete(pid);
        changed = true;
        for (const listener of endedListeners) {
          listener(pid, name);
        }
      }
    }

    if (monitored.size === 0) {
      stop();
    }

    if (changed) {
      notifyChange();
    }
  }

  function add(pid, name) {
    if (monitored.has(pid)) {
      return;
    }
    monitored.set(pid, name);
    start();
    notifyChange();
  }

  function remove(pid) {
    if (!monitored.has(pid)) {
      return;
    }
    monitored.delete(pid);
    if (monitored.size === 0) {
      stop();
    }
    notifyChange();
  }

  function has(pid) {
    return monitored.has(pid);
  }

  function list() {
    return Array.from(monitored, ([pid, name]) => ({ pid, name }));
  }

  function onEnded(listener) {
    endedListeners.push(listener);
  }

  function onChange(listener) {
    changeListeners.push(listener);
  }

  return {
    add,
    remove,
    has,
    list,
    onEnded,
    onChange,
    get size() {
      return monitored.size;
    },
  };
}
