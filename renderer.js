const { ipcRenderer } = require('electron');

let monitoredProcesses = new Map();
let monitoringInterval = null;

async function listProcesses() {
  const processes = await ipcRenderer.invoke('get-processes');

  const filterValue = document.getElementById('filter-input').value.toLowerCase();

  // Filter scripts based on interpreters and filter input
  const scriptProcesses = processes.filter(
    (proc) =>
      //['node', 'python', 'bash', 'sh', 'perl', 'ruby'].includes(proc.name) &&
      (proc.name.toLowerCase().includes(filterValue) || proc.cmd.toLowerCase().includes(filterValue))
  );

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
            if (monitoringInterval === null) {
              startMonitoring();
            }
          }
        } else {
          monitoredProcesses.delete(pid);
          if (monitoredProcesses.size === 0 && monitoringInterval !== null) {
            clearInterval(monitoringInterval);
            monitoringInterval = null;
          }
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
    });
  }
}

// Auto-refresh the process list every 2 seconds
setInterval(listProcesses, 2000);

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
      }
    });

    if (monitoredProcesses.size === 0) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
  }, 5000); // Check every 5 seconds
}

function notifyProcessEnded(pid, processName) {
  // Display a notification
  if ('Notification' in window) {
    new Notification('Process Ended', {
      body: `Process "${processName}" (PID ${pid}) has ended.`,
    });
  } else {
    alert(`Process "${processName}" (PID ${pid}) has ended.`);
  }

  // Play a sound (optional)
  playNotificationSound();
}

function playNotificationSound() {
  const audio = new Audio('notification_sound.mp3');
  audio.play();
}

// Initial list load
listProcesses();
