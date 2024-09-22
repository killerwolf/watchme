// renderer.js

const monitoredProcesses = new Map();
let monitoringInterval = null;

function initialize() {
  // Initialize notifications
  if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }

  // Sidebar Navigation Event Listeners
  document.querySelectorAll('.sidebar-item').forEach((item) => {
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
  });

  // Save preferences when the user clicks "Save"
  document.getElementById('savePreferences').addEventListener('click', () => {
    savePreferences();
  });

  // Initialize notifications
  if (Notification.permission !== 'granted') {
    Notification.requestPermission();
  }

  // Window Control Buttons
  /*
  document.getElementById('minimize-button').addEventListener('click', () => {
    window.electronAPI.windowControl('minimize');
  });

  document.getElementById('maximize-button').addEventListener('click', () => {
    window.electronAPI.windowControl('maximize');
  });

  document.getElementById('close-button').addEventListener('click', () => {
    window.electronAPI.windowControl('close');
  });
  */

  document.getElementById('quit-app-button').addEventListener('click', () => {
    window.electronAPI.quitApp();
  });

  // Enable keyboard navigation for the Quit App button
  document.getElementById('quit-app-button').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      window.electronAPI.quitApp();
    }
  });

  // Initial tab
  activateTab('processes');
}

function activateTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach((tab) => {
    tab.classList.remove('active');
    tab.style.display = 'none';
  });

  // Show the selected tab content
  const activeTab = document.getElementById(`${tabName}-tab`);
  activeTab.style.display = 'block';
  setTimeout(() => {
    activeTab.classList.add('active');
  }, 0);

  // Update active sidebar item
  document.querySelectorAll('.sidebar-item').forEach((item) => {
    item.classList.remove('active');
  });
  document.querySelector(`.sidebar-item[data-tab="${tabName}"]`).classList.add('active');

  if (tabName === 'processes') {
    listProcesses();
  } else if (tabName === 'preferences') {
    loadPreferences();
  }
}

function loadPreferences() {
  window.electronAPI.getPreferences().then((preferences) => {
    document.getElementById('autoLaunch').checked = preferences.autoLaunch;
    document.getElementById('prefilterRegex').value = preferences.prefilterRegex || '';
  });
}

function savePreferences() {
  const autoLaunch = document.getElementById('autoLaunch').checked;
  const prefilterRegex = document.getElementById('prefilterRegex').value.trim();
  window.electronAPI.savePreferences({ autoLaunch, prefilterRegex });

  // Reload processes after saving preferences
  if (document.getElementById('processes-tab').style.display === 'block') {
    listProcesses();
  }
}

async function listProcesses() {
  const processes = await window.electronAPI.getProcesses();

  const filterValue = document.getElementById('filter-input').value.toLowerCase();

  // Get the prefilter regex from preferences
  const prefs = await window.electronAPI.getPreferences();
  const { prefilterRegex } = prefs;
  console.log('Prefilter Regex:', prefilterRegex);

  let prefilterPattern = null;

  if (prefilterRegex && prefilterRegex.trim() !== '') {
    try {
      prefilterPattern = new RegExp(prefilterRegex.trim(), 'i'); // 'i' for case-insensitive
      console.log('Prefilter Pattern:', prefilterPattern);
    } catch (e) {
      console.error('Invalid prefilter regex:', e);
      alert('Invalid prefilter regular expression in preferences.');
      return;
    }
  } else {
    console.log('No prefilter regex provided; displaying all processes.');
  }

  // Filter processes based on the prefilter regex and filter input
  const scriptProcesses = processes.filter((proc) => {
    const nameMatchesFilter = filterValue === ''
      || proc.name.toLowerCase().includes(filterValue)
      || proc.cmd.toLowerCase().includes(filterValue);

    if (prefilterPattern) {
      const prefilterMatch = prefilterPattern.test(proc.name) || prefilterPattern.test(proc.cmd);
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
    scriptProcesses.forEach((proc) => {
      const row = document.createElement('tr');

      if (monitoredProcesses.has(proc.pid)) {
        row.classList.add('highlighted-row');
      }

      // Checkbox Cell
      const checkboxCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = proc.pid;
      checkbox.checked = monitoredProcesses.has(proc.pid);

      checkbox.addEventListener('change', (e) => {
        const pid = parseInt(e.target.value);
        const processName = proc.name;
        if (e.target.checked) {
          if (!monitoredProcesses.has(pid)) {
            monitoredProcesses.set(pid, processName);
            console.log(`Added process ${processName} (PID ${pid}) to monitoring.`);
            if (monitoringInterval === null) {
              startMonitoring();
            }
          }
        } else {
          monitoredProcesses.delete(pid);
          console.log(`Removed process (PID ${pid}) from monitoring.`);
          if (monitoredProcesses.size === 0 && monitoringInterval !== null) {
            clearInterval(monitoringInterval);
            monitoringInterval = null;
          }
        }

        // Update monitoring status
        updateMonitoringStatus();
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
    });
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
  }, 300),
);

function startMonitoring() {
  if (monitoringInterval !== null) {
    return;
  }

  monitoringInterval = setInterval(async () => {
    const processes = await window.electronAPI.getProcesses();
    const runningPIDs = processes.map((proc) => proc.pid);

    monitoredProcesses.forEach((processName, pid) => {
      if (!runningPIDs.includes(pid)) {
        // Process has ended
        notifyProcessEnded(pid, processName);
        // Remove from monitoredProcesses
        monitoredProcesses.delete(pid);

        // Update the UI
        const checkbox = document.querySelector(`input[type="checkbox"][value="${pid}"]`);
        if (checkbox) {
          checkbox.checked = false;
          // Remove highlight
          const row = checkbox.closest('tr');
          if (row) {
            row.classList.remove('highlighted-row');
          }
        }

        // Update monitoring status
        updateMonitoringStatus();
      }
    });

    if (monitoredProcesses.size === 0) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
  }, 5000); // Check every 5 seconds
}

function notifyProcessEnded(pid, processName) {
  console.log(`Process "${processName}" (PID ${pid}) has ended.`);

  // Display a desktop notification
  if (Notification.permission === 'granted') {
    new Notification('Process Ended', {
      body: `Process "${processName}" (PID ${pid}) has ended.`,
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification('Process Ended', {
          body: `Process "${processName}" (PID ${pid}) has ended.`,
        });
      } else {
        alert(`Process "${processName}" (PID ${pid}) has ended.`);
      }
    });
  } else {
    // If permission was denied
    alert(`Process "${processName}" (PID ${pid}) has ended.`);
  }

  // Play a sound notification
  playNotificationSound();
}

function playNotificationSound() {
  const audio = new Audio('notification-sound.mp3'); // Ensure you have this file in your project's directory
  audio.play();
}

function updateMonitoringStatus() {
  // Send the number of monitored processes to main process
  window.electronAPI.updateTrayTooltip(monitoredProcesses.size);
  // Also send the monitoredProcesses map
  window.electronAPI.updateMonitoredProcesses(Array.from(monitoredProcesses.entries()));
}

// Initialize the app when the content is loaded
document.addEventListener('DOMContentLoaded', initialize);
