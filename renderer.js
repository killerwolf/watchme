// renderer.js
import { invoke } from '@tauri-apps/api/core';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

import { createProcessMonitor } from './monitoring.js';
import { DEFAULT_PREFERENCES } from './preferences.js';

const watchmeApi = {
  getProcesses: () => invoke('get_processes'),
  getPreferences: () => invoke('get_preferences'),
  savePreferences: (preferences) =>
    invoke('save_preferences', { newPreferences: preferences }),
  updateTrayTooltip: (numProcesses) =>
    invoke('update_tray_tooltip', { numProcesses }),
  quitApp: () => invoke('quit_app'),
};

const processMonitor = createProcessMonitor({
  getProcesses: () => watchmeApi.getProcesses(),
});

processMonitor.onEnded((pid, processName) => {
  notifyProcessEnded(pid, processName);

  const entry = renderedRows.get(pid);
  if (entry) {
    entry.checkbox.checked = false;
    entry.row.classList.remove('is-watched');
  }
});

processMonitor.onChange(() => {
  updateMonitoringStatus();
  renderWatchCount();
});

// The notification settings have to be readable the instant a watched
// process ends, and the store lives in the main process. This cache is kept
// in step by refreshPreferences() at startup, when the Preferences tab is
// opened, and after every save.
//
// Seeded from the shared defaults, so a key the user has never saved reads
// as "on" here too rather than as undefined.
let cachedPreferences = { ...DEFAULT_PREFERENCES };

async function refreshPreferences() {
  const stored = await watchmeApi.getPreferences();
  cachedPreferences = { ...cachedPreferences, ...stored };
  return cachedPreferences;
}

// Simple logging utility - disabled in production
const logger = {
  debug: () => {
    // Disabled to avoid console warnings
  },
  error: (...args) => {
    console.error('[WatchMe Error]', ...args);
  },
};

// Single owner of the "granted / ask / denied" branch. Desktop notifications
// vary by title (WatchMe vs. Process Ended); when they can't be shown, every
// caller falls back to the same in-app banner.
async function showDesktopNotification({ title, message, type = 'info' }) {
  try {
    let permission = await isPermissionGranted();
    if (!permission) {
      permission = (await requestPermission()) === 'granted';
    }
    if (permission) {
      sendNotification({ title, body: message });
      return;
    }
  } catch (error) {
    logger.error('Desktop notification could not be shown:', error);
  }
  showFallbackNotification(message, type);
}

// Enhanced notification system to replace alerts
function showNotification(message, type = 'info') {
  showDesktopNotification({
    title: 'WatchMe',
    message,
    type,
  });
}

// Fallback notification when desktop notifications are not available
let activeToast = null;
let activeToastTimer = null;

function showFallbackNotification(message, type) {
  if (activeToast) {
    activeToast.remove();
    clearTimeout(activeToastTimer);
  }

  // Built through the DOM rather than innerHTML: `message` can carry a
  // process name, so text controlled by any local process.
  const toast = document.createElement('div');
  toast.className = type === 'error' ? 'toast toast--error' : 'toast';
  toast.setAttribute('role', 'status');

  const label = document.createElement('span');
  label.className = 'toast__text';
  label.textContent = message;
  toast.appendChild(label);

  document.body.appendChild(toast);
  activeToast = toast;

  activeToastTimer = setTimeout(() => {
    toast.remove();
    if (activeToast === toast) {
      activeToast = null;
    }
  }, 4000);
}

// renderer.js is loaded as an ES module, so top-level declarations do not
// land on `window` automatically. Keep this function reachable for the
// in-app fallback notification and manual smoke testing.
window.showFallbackNotification = showFallbackNotification;

const el = {};

function cacheElements() {
  el.filterInput = document.getElementById('filter-input');
  el.filterClear = document.getElementById('filter-clear');
  el.tableScroll = document.getElementById('table-scroll');
  el.tableBody = document.getElementById('process-table-body');
  el.empty = document.getElementById('process-empty');
  el.emptyTitle = document.getElementById('process-empty-title');
  el.emptyHint = document.getElementById('process-empty-hint');
  el.status = document.getElementById('status-text');
  el.watchPill = document.getElementById('watch-pill');
  el.watchPillText = document.getElementById('watch-pill-text');
  el.prefsSaved = document.getElementById('prefs-saved');
  el.prefilterRegex = document.getElementById('prefilterRegex');
  el.prefilterError = document.getElementById('prefilterRegex-error');
}

function initialize() {
  cacheElements();
  refreshPreferences().then(() => listProcesses());

  for (const item of document.querySelectorAll('.segment')) {
    item.addEventListener('click', () => {
      activateTab(item.getAttribute('data-tab'));
    });
  }

  document.getElementById('savePreferences').addEventListener('click', () => {
    savePreferences();
  });

  document.getElementById('quit-app-button').addEventListener('click', () => {
    watchmeApi.quitApp();
  });

  el.filterInput.addEventListener(
    'input',
    debounce(() => {
      el.filterClear.hidden = el.filterInput.value === '';
      listProcesses();
    }, 200)
  );

  // Escape clears the filter: the window has no chrome to click away to.
  el.filterInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && el.filterInput.value !== '') {
      event.stopPropagation();
      clearFilter();
    }
  });

  el.filterClear.addEventListener('click', clearFilter);

  el.prefilterRegex.addEventListener('input', () => {
    validatePrefilter(el.prefilterRegex.value.trim());
  });

  // Initial tab
  activateTab('processes');
}

function clearFilter() {
  el.filterInput.value = '';
  el.filterClear.hidden = true;
  el.filterInput.focus();
  listProcesses();
}

let activeTabName = 'processes';

function activateTab(tabName) {
  activeTabName = tabName;

  for (const panel of document.querySelectorAll('.tab-panel')) {
    panel.classList.toggle('is-active', panel.id === `${tabName}-tab`);
  }

  for (const item of document.querySelectorAll('.segment')) {
    const isActive = item.getAttribute('data-tab') === tabName;
    item.classList.toggle('is-active', isActive);
    item.setAttribute('aria-selected', String(isActive));
  }

  if (tabName === 'processes') {
    listProcesses();
  } else if (tabName === 'preferences') {
    loadPreferences();
  }
}

function loadPreferences() {
  refreshPreferences().then((preferences) => {
    document.getElementById('autoLaunch').checked = preferences.autoLaunch;
    el.prefilterRegex.value = preferences.prefilterRegex || '';
    document.getElementById('desktopNotifications').checked =
      preferences.desktopNotifications;
    document.getElementById('notificationSound').checked =
      preferences.notificationSound;
    validatePrefilter(el.prefilterRegex.value.trim());
  });
}

// Returns the compiled pattern, `null` for "no filter", or `false` when the
// pattern is invalid. Also drives the inline error under the field.
function validatePrefilter(source) {
  if (!source) {
    el.prefilterError.hidden = true;
    el.prefilterRegex.removeAttribute('aria-invalid');
    return null;
  }
  try {
    const pattern = new RegExp(source, 'i');
    el.prefilterError.hidden = true;
    el.prefilterRegex.removeAttribute('aria-invalid');
    return pattern;
  } catch (error) {
    el.prefilterError.textContent = `Not a valid expression: ${error.message}`;
    el.prefilterError.hidden = false;
    el.prefilterRegex.setAttribute('aria-invalid', 'true');
    return false;
  }
}

async function savePreferences() {
  const autoLaunch = document.getElementById('autoLaunch').checked;
  const prefilterRegex = el.prefilterRegex.value.trim();
  const desktopNotifications = document.getElementById(
    'desktopNotifications'
  ).checked;
  const notificationSound =
    document.getElementById('notificationSound').checked;

  if (validatePrefilter(prefilterRegex) === false) {
    el.prefilterRegex.focus();
    return;
  }

  try {
    const { loginItemSuccess } = await watchmeApi.savePreferences({
      autoLaunch,
      prefilterRegex,
      desktopNotifications,
      notificationSound,
    });
    // The whole set, not just the notification keys: listProcesses() reads
    // prefilterRegex from this cache rather than crossing to the native side
    // on every refresh.
    cachedPreferences = {
      ...cachedPreferences,
      autoLaunch,
      prefilterRegex,
      desktopNotifications,
      notificationSound,
    };

    if (loginItemSuccess) {
      flashSaved();
    } else {
      showNotification(
        'Preferences saved, but the login item could not be set. You may need to grant permission in System Settings.',
        'warning'
      );
    }
  } catch (error) {
    logger.error('Failed to save preferences:', error);
    showNotification('Failed to save preferences.', 'error');
  }

  listProcesses();
}

let savedFlashTimer = null;

function flashSaved() {
  el.prefsSaved.hidden = false;
  clearTimeout(savedFlashTimer);
  savedFlashTimer = setTimeout(() => {
    el.prefsSaved.hidden = true;
  }, 1800);
}

// Rows are reused across refreshes, keyed by PID. Rebuilding the table every
// two seconds threw away scroll position and could drop a click that landed
// mid-refresh.
const renderedRows = new Map();

function createRow(proc) {
  const row = document.createElement('tr');

  const checkboxCell = document.createElement('td');
  checkboxCell.className = 'cell-check';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.value = proc.pid;
  checkbox.setAttribute('aria-label', `Watch ${proc.name}`);

  checkbox.addEventListener('change', (e) => {
    const pid = Number.parseInt(e.target.value, 10);
    if (e.target.checked) {
      processMonitor.add(pid, proc.name);
    } else {
      processMonitor.remove(pid);
    }
    row.classList.toggle('is-watched', e.target.checked);
    // Re-sort now rather than on the next poll: a row that moves two seconds
    // after the click reads as a glitch.
    listProcesses();
  });

  checkboxCell.appendChild(checkbox);
  row.appendChild(checkboxCell);

  const pidCell = document.createElement('td');
  pidCell.className = 'cell-pid';
  row.appendChild(pidCell);

  const nameCell = document.createElement('td');
  nameCell.className = 'cell-name';
  row.appendChild(nameCell);

  // The command is truncated at the head rather than the tail, so the span
  // carries the text and the cell owns the ellipsis. See styles.css.
  const cmdCell = document.createElement('td');
  cmdCell.className = 'cell-cmd';
  const cmdText = document.createElement('span');
  cmdCell.appendChild(cmdText);
  row.appendChild(cmdCell);

  return { row, checkbox, pidCell, nameCell, cmdCell, cmdText, proc };
}

function renderRows(processes) {
  const seen = new Set();
  let previous = null;
  // insertBefore() on a subtree containing the active element blurs it, so
  // keyboard toggling would lose its place on every reorder.
  const focused = document.activeElement;
  let restoreFocus = false;

  for (const proc of processes) {
    seen.add(proc.pid);
    let entry = renderedRows.get(proc.pid);

    if (!entry) {
      entry = createRow(proc);
      renderedRows.set(proc.pid, entry);
    }

    entry.proc = proc;

    if (entry.pidCell.textContent !== String(proc.pid)) {
      entry.pidCell.textContent = proc.pid;
    }
    if (entry.nameCell.textContent !== proc.name) {
      entry.nameCell.textContent = proc.name;
      entry.nameCell.title = proc.name;
    }
    if (entry.cmdText.textContent !== proc.cmd) {
      entry.cmdText.textContent = proc.cmd;
      entry.cmdCell.title = proc.cmd;
    }

    const watched = processMonitor.has(proc.pid);
    entry.row.classList.toggle('is-watched', watched);
    // Never fight the user for the control they are currently toggling.
    if (entry.checkbox.checked !== watched) {
      entry.checkbox.checked = watched;
    }

    // Move into place only when the order actually changed, so rows the user
    // is hovering or clicking are left alone.
    const expected = previous ? previous.nextSibling : el.tableBody.firstChild;
    if (expected !== entry.row) {
      if (entry.row.contains(focused)) {
        restoreFocus = true;
      }
      el.tableBody.insertBefore(entry.row, expected);
    }
    previous = entry.row;
  }

  if (restoreFocus && document.activeElement !== focused) {
    focused.focus();
  }

  for (const [pid, entry] of renderedRows) {
    if (!seen.has(pid)) {
      entry.row.remove();
      renderedRows.delete(pid);
    }
  }
}

async function listProcesses() {
  let processes;
  try {
    processes = await watchmeApi.getProcesses();
  } catch (error) {
    logger.error('Failed to read the process list:', error);
    return;
  }

  const filterValue = el.filterInput.value.trim().toLowerCase();
  const prefilterPattern = compilePrefilter();

  const scriptProcesses = processes.filter((proc) => {
    const nameMatchesFilter =
      filterValue === '' ||
      proc.name.toLowerCase().includes(filterValue) ||
      proc.cmd.toLowerCase().includes(filterValue);

    if (prefilterPattern) {
      const prefilterMatch =
        prefilterPattern.test(proc.name) || prefilterPattern.test(proc.cmd);
      return prefilterMatch && nameMatchesFilter;
    }
    return nameMatchesFilter;
  });

  // Watched processes float to the top: they are the reason the panel is
  // open, and they must not scroll out of reach in a list of hundreds.
  scriptProcesses.sort((a, b) => {
    const watchedDelta =
      Number(processMonitor.has(b.pid)) - Number(processMonitor.has(a.pid));
    if (watchedDelta !== 0) {
      return watchedDelta;
    }
    return a.name.localeCompare(b.name) || a.pid - b.pid;
  });

  renderRows(scriptProcesses);
  renderEmptyState(scriptProcesses.length, processes.length, filterValue);
  renderStatus(scriptProcesses.length, processes.length);
  renderWatchCount();
}

function compilePrefilter() {
  const source = (cachedPreferences.prefilterRegex || '').trim();
  if (!source) {
    return null;
  }
  try {
    return new RegExp(source, 'i');
  } catch (error) {
    logger.error('Invalid prefilter regex:', error);
    return null;
  }
}

function renderEmptyState(shownCount, totalCount, filterValue) {
  const isEmpty = shownCount === 0;
  el.empty.hidden = !isEmpty;
  el.tableScroll.hidden = isEmpty;

  if (!isEmpty) {
    return;
  }

  if (filterValue !== '') {
    el.emptyTitle.textContent = 'No matching processes';
    el.emptyHint.textContent = `Nothing in ${totalCount} running processes matches “${filterValue}”.`;
  } else if (cachedPreferences.prefilterRegex) {
    el.emptyTitle.textContent = 'Everything is filtered out';
    el.emptyHint.textContent =
      'The expression in Preferences excludes every running process.';
  } else {
    el.emptyTitle.textContent = 'No processes found';
    el.emptyHint.textContent = 'Nothing is running that WatchMe can see.';
  }
}

function renderStatus(shownCount, totalCount) {
  const watched = processMonitor.size;
  const parts = [
    shownCount === totalCount
      ? `${totalCount} ${plural(totalCount, 'process', 'processes')}`
      : `${shownCount} of ${totalCount} processes`,
  ];
  if (watched > 0) {
    parts.push(`${watched} watched`);
  }
  el.status.textContent = parts.join('  ·  ');
}

function renderWatchCount() {
  const watched = processMonitor.size;
  el.watchPill.hidden = watched === 0;
  el.watchPillText.textContent = `${watched} watched`;
}

function plural(count, one, many) {
  return count === 1 ? one : many;
}

// Auto-refresh the process list. The window hides when it loses focus, so
// there is no point polling the native side while nobody is looking.
setInterval(() => {
  if (activeTabName === 'processes' && !document.hidden) {
    listProcesses();
  }
}, 2000);

// Debounce function to limit the rate of function calls
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function notifyProcessEnded(pid, processName) {
  logger.debug(`Process "${processName}" (PID ${pid}) has ended.`);

  if (cachedPreferences.desktopNotifications) {
    showDesktopNotification({
      title: 'Process Ended',
      message: `Process "${processName}" (PID ${pid}) has ended.`,
    });
  }

  if (cachedPreferences.notificationSound) {
    playNotificationSound();
  }
}

function playNotificationSound() {
  // Generated by tools/build-notification-sound.mjs (`npm run sound:build`).
  // WAV rather than MP3: played natively by Chromium, with no codec and no
  // encoder needed at build time.
  const audio = new Audio('misc/notification-sound.wav');
  audio.play().catch((error) => {
    // Playback can be refused when the user has not interacted with the
    // window yet. That is not a fatal error.
    logger.error('Notification sound could not be played:', error);
  });
}

function updateMonitoringStatus() {
  // Send the number of monitored processes to main process
  watchmeApi.updateTrayTooltip(processMonitor.size);
}

// Initialize the app when the content is loaded
document.addEventListener('DOMContentLoaded', initialize);
