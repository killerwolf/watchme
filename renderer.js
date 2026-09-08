// renderer.js

import { createProcessMonitor } from './monitoring.js';

const processMonitor = createProcessMonitor({
  getProcesses: () => window.electronAPI.getProcesses(),
});

processMonitor.onEnded((pid, processName) => {
  notifyProcessEnded(pid, processName);

  const checkbox = document.querySelector(
    `input[type="checkbox"][value="${pid}"]`
  );
  if (checkbox) {
    checkbox.checked = false;
    const row = checkbox.closest('tr');
    if (row) {
      row.classList.remove('highlighted-row');
    }
  }
});

processMonitor.onChange(() => updateMonitoringStatus());

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
// vary by title and icon (WatchMe vs. Process Ended); when they can't be
// shown, every caller falls back to the same in-app banner.
function showDesktopNotification({ title, message, type = 'info', icon }) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body: message, icon });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(title, { body: message, icon });
      } else {
        showFallbackNotification(message, type);
      }
    });
  } else {
    showFallbackNotification(message, type);
  }
}

// Enhanced notification system to replace alerts
function showNotification(message, type = 'info') {
  showDesktopNotification({
    title: 'WatchMe',
    message,
    type,
    icon: 'misc/tray-icon.png',
  });
}

// Fallback notification when desktop notifications are not available
function showFallbackNotification(message, type) {
  // Create a custom notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;

  // Built through the DOM rather than innerHTML: `message` can carry a
  // process name, so text controlled by any local process.
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; align-items: center; gap: 10px;';

  const icon = document.createElement('span');
  icon.style.cssText = 'font-size: 18px;';
  icon.textContent = type === 'error' ? '⚠️' : 'ℹ️';

  const label = document.createElement('span');
  label.textContent = message;

  row.append(icon, label);
  notification.appendChild(row);

  // Style the notification
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? '#ff4444' : '#0098ff'};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.4;
  `;

  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

// renderer.js is now loaded as an ES module, so top-level declarations no
// longer land on `window` automatically. The Electron test harness
// (test/harness/electron-entry.js) drives this function directly via
// executeJavaScript for the XSS regression test (issue #6) — keep it
// reachable there.
window.showFallbackNotification = showFallbackNotification;

function initialize() {
  // Initialize notifications
  if (
    Notification.permission !== 'granted' &&
    Notification.permission !== 'denied'
  ) {
    Notification.requestPermission();
  }

  // Sidebar Navigation Event Listeners
  for (const item of document.querySelectorAll('.sidebar-item')) {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-tab');
      activateTab(tabName);
    });

    // Enable keyboard navigation
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const tabName = item.getAttribute('data-tab');
        activateTab(tabName);
      }
    });
  }

  // Save preferences when the user clicks "Save"
  document.getElementById('savePreferences').addEventListener('click', () => {
    savePreferences();
  });

  document.getElementById('quit-app-button').addEventListener('click', () => {
    window.electronAPI.quitApp();
  });

  // Enable keyboard navigation for the Quit App button
  document
    .getElementById('quit-app-button')
    .addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        window.electronAPI.quitApp();
      }
    });

  // Initial tab
  activateTab('processes');
}

function activateTab(tabName) {
  // Hide all tab contents
  for (const tab of document.querySelectorAll('.tab-content')) {
    tab.classList.remove('active');
    tab.style.display = 'none';
  }

  // Show the selected tab content
  const activeTab = document.getElementById(`${tabName}-tab`);
  activeTab.style.display = 'block';
  setTimeout(() => {
    activeTab.classList.add('active');
  }, 0);

  // Update active sidebar item
  for (const item of document.querySelectorAll('.sidebar-item')) {
    item.classList.remove('active');
  }
  document
    .querySelector(`.sidebar-item[data-tab="${tabName}"]`)
    .classList.add('active');

  if (tabName === 'processes') {
    listProcesses();
  } else if (tabName === 'preferences') {
    loadPreferences();
  }
}

function loadPreferences() {
  window.electronAPI.getPreferences().then((preferences) => {
    document.getElementById('autoLaunch').checked = preferences.autoLaunch;
    document.getElementById('prefilterRegex').value =
      preferences.prefilterRegex || '';
  });
}

async function savePreferences() {
  const autoLaunch = document.getElementById('autoLaunch').checked;
  const prefilterRegex = document.getElementById('prefilterRegex').value.trim();

  try {
    const { loginItemSuccess } = await window.electronAPI.savePreferences({
      autoLaunch,
      prefilterRegex,
    });
    showNotification(
      loginItemSuccess
        ? 'Preferences saved successfully!'
        : 'Preferences saved, but login item setting failed. You may need to grant permission in System Preferences.',
      loginItemSuccess ? 'info' : 'warning'
    );
  } catch (error) {
    logger.error('Failed to save preferences:', error);
    showNotification('Failed to save preferences.', 'error');
  }

  // Reload processes after saving preferences
  if (document.getElementById('processes-tab').style.display === 'block') {
    listProcesses();
  }
}

async function listProcesses() {
  const processes = await window.electronAPI.getProcesses();

  const filterValue = document
    .getElementById('filter-input')
    .value.toLowerCase();

  // Get the prefilter regex from preferences
  const prefs = await window.electronAPI.getPreferences();
  const { prefilterRegex } = prefs;
  logger.debug('Prefilter Regex:', prefilterRegex);

  let prefilterPattern = null;

  if (prefilterRegex && prefilterRegex.trim() !== '') {
    try {
      prefilterPattern = new RegExp(prefilterRegex.trim(), 'i'); // 'i' for case-insensitive
      logger.debug('Prefilter Pattern:', prefilterPattern);
    } catch (e) {
      logger.error('Invalid prefilter regex:', e);
      showNotification(
        'Invalid prefilter regular expression in preferences.',
        'error'
      );
      return;
    }
  } else {
    logger.debug('No prefilter regex provided; displaying all processes.');
  }

  // Filter processes based on the prefilter regex and filter input
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

  const processTableBody = document.querySelector('#process-table-body');
  processTableBody.innerHTML = '';

  if (scriptProcesses.length === 0) {
    const noDataRow = document.createElement('tr');
    const noDataCell = document.createElement('td');
    noDataCell.colSpan = 4;
    noDataCell.classList.add('text-center');
    noDataCell.textContent = 'No scripts found.';
    noDataRow.appendChild(noDataCell);
    processTableBody.appendChild(noDataRow);
  } else {
    for (const proc of scriptProcesses) {
      const row = document.createElement('tr');

      if (processMonitor.has(proc.pid)) {
        row.classList.add('highlighted-row');
      }

      // Checkbox Cell
      const checkboxCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = proc.pid;
      checkbox.checked = processMonitor.has(proc.pid);

      checkbox.addEventListener('change', (e) => {
        const pid = Number.parseInt(e.target.value, 10);
        const processName = proc.name;
        if (e.target.checked) {
          processMonitor.add(pid, processName);
          logger.debug(
            `Added process ${processName} (PID ${pid}) to monitoring.`
          );
        } else {
          processMonitor.remove(pid);
          logger.debug(`Removed process (PID ${pid}) from monitoring.`);
        }
      });

      checkboxCell.appendChild(checkbox);
      row.appendChild(checkboxCell);

      // PID Cell
      const pidCell = document.createElement('td');
      pidCell.textContent = proc.pid;
      row.appendChild(pidCell);

      // Name Cell
      const nameCell = document.createElement('td');
      nameCell.textContent = proc.name;
      row.appendChild(nameCell);

      // Command Cell
      const cmdCell = document.createElement('td');
      cmdCell.textContent = proc.cmd;
      row.appendChild(cmdCell);

      processTableBody.appendChild(row);
    }
  }
}

// Auto-refresh the process list every 2 seconds
setInterval(() => {
  if (document.getElementById('processes-tab').style.display === 'block') {
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

const filterInput = document.getElementById('filter-input');

filterInput.addEventListener(
  'input',
  debounce(() => {
    if (filterInput.value.length >= 2 || filterInput.value.length === 0) {
      listProcesses();
    }
  }, 300)
);

function notifyProcessEnded(pid, processName) {
  logger.debug(`Process "${processName}" (PID ${pid}) has ended.`);

  showDesktopNotification({
    title: 'Process Ended',
    message: `Process "${processName}" (PID ${pid}) has ended.`,
  });

  // Play a sound notification
  playNotificationSound();
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
  window.electronAPI.updateTrayTooltip(processMonitor.size);
}

// Initialize the app when the content is loaded
document.addEventListener('DOMContentLoaded', initialize);
