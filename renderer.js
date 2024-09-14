// renderer.js
const { ipcRenderer } = require('electron');

let monitoredProcesses = new Map();
let monitoringInterval = null;

function initialize() {
  document.getElementById('tab-processes').addEventListener('click', (e) => {
    e.preventDefault();
    activateTab('processes');
  });

  document.getElementById('tab-preferences').addEventListener('click', (e) => {
    e.preventDefault();
    activateTab('preferences');
  });

  // Save preferences when the user clicks "Save"
  document.getElementById('savePreferences').addEventListener('click', () => {
    savePreferences();
  });

  // Initialize notifications
  if (Notification.permission !== 'granted') {
    Notification.requestPermission();
  }

  // Initial tab
  activateTab('processes');
}

function activateTab(tabName) {
  const processesTabLink = document.getElementById('tab-processes');
  const preferencesTabLink = document.getElementById('tab-preferences');
  const processesTabContent = document.getElementById('processes-tab');
  const preferencesTabContent = document.getElementById('preferences-tab');

  if (tabName === 'processes') {
    processesTabLink.classList.add('active');
    preferencesTabLink.classList.remove('active');
    processesTabContent.style.display = 'block';
    preferencesTabContent.style.display = 'none';
    listProcesses();
  } else if (tabName === 'preferences') {
    preferencesTabLink.classList.add('active');
    processesTabLink.classList.remove('active');
    preferencesTabContent.style.display = 'block';
    processesTabContent.style.display = 'none';
    loadPreferences();
  }
}

function loadPreferences() {
  ipcRenderer.invoke('get-preferences').then((preferences) => {
    document.getElementById('autoLaunch').checked = preferences.autoLaunch;
    document.getElementById('prefilterRegex').value = preferences.prefilterRegex || '';
  });
}

function savePreferences() {
  const autoLaunch = document.getElementById('autoLaunch').checked;
  const prefilterRegex = document.getElementById('prefilterRegex').value.trim();
  ipcRenderer.send('save-preferences', { autoLaunch, prefilterRegex });

  // Reload processes after saving preferences
  if (document.getElementById('processes-tab').style.display === 'block') {
    listProcesses();
  }
}

async function listProcesses() {
  const processes = await ipcRenderer.invoke('get-processes');

  const filterValue = document.getElementById('filter-input').value.toLowerCase();

  // Get the prefilter regex from preferences
  const prefs = await ipcRenderer.invoke('get-preferences');
  const prefilterRegex = prefs.prefilterRegex;
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
    const nameMatchesFilter =
      filterValue === '' ||
      proc.name.toLowerCase().includes(filterValue) ||
      proc.cmd.toLowerCase().includes(filterValue);

    if (prefilterPattern) {
      const prefilterMatch =
        prefilterPattern.test(proc.name) || prefilterPattern.test(proc.cmd);
      return prefilterMatch && nameMatchesFilter;
    } else {
      return nameMatchesFilter;
    }
  });

  const processTableBody = document.querySelector('#process-table tbody');
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
        row.classList.add('table-warning');
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
  }, 300)
);

function startMonitoring() {
  if (monitoringInterval !== null) {
    return;
  }

  monitoringInterval = setInterval(async () => {
    const processes = await ipcRenderer.invoke('get-processes');
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
            row.classList.remove('table-warning');
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
  // Display a notification
  if (Notification.permission === 'granted') {
    new Notification('Process Ended', {
      body: `Process "${processName}" (PID ${pid}) has ended.`,
    });
  } else {
    alert(`Process "${processName}" (PID ${pid}) has ended.`);
  }

  // Play a sound (optional)
  // playNotificationSound();
}

function updateMonitoringStatus() {
  // Send the number of monitored processes to main process
  ipcRenderer.send('update-tray-tooltip', monitoredProcesses.size);
  // Also send the monitoredProcesses map
  ipcRenderer.send('update-monitored-processes', Array.from(monitoredProcesses.entries()));
}

// Initialize the app when the content is loaded
document.addEventListener('DOMContentLoaded', initialize);
