const { ipcRenderer } = require('electron');

let selectedPIDs = [];
let monitoringInterval = null;

async function listProcesses() {
  const processes = await ipcRenderer.invoke('get-processes');

  const filterValue = document.getElementById('filter-input').value.toLowerCase();

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

      if (selectedPIDs.includes(proc.pid)) {
        row.classList.add('table-warning');
      }

      const checkboxCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = proc.pid;
      checkbox.checked = selectedPIDs.includes(proc.pid);

      checkbox.addEventListener('change', (e) => {
        const pid = parseInt(e.target.value);
        if (e.target.checked) {
          if (!selectedPIDs.includes(pid)) {
            selectedPIDs.push(pid);
          }
        } else {
          selectedPIDs = selectedPIDs.filter((id) => id !== pid);
        }
      });

      checkboxCell.appendChild(checkbox);
      row.appendChild(checkboxCell);

      const pidCell = document.createElement('td');
      pidCell.textContent = proc.pid;
      row.appendChild(pidCell);

      const nameCell = document.createElement('td');
      nameCell.textContent = proc.name;
      row.appendChild(nameCell);

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

function monitorProcesses() {
  if (selectedPIDs.length === 0) {
    alert('Please select at least one process to monitor.');
    return;
  }

  if (monitoringInterval !== null) {
    clearInterval(monitoringInterval);
  }

  monitoringInterval = setInterval(async () => {
    const processes = await ipcRenderer.invoke('get-processes');
    const runningPIDs = processes.map((proc) => proc.pid);

    selectedPIDs.forEach((pid) => {
      if (!runningPIDs.includes(pid)) {
        // Process has ended
        notifyProcessEnded(pid);
        // Remove from selectedPIDs
        selectedPIDs = selectedPIDs.filter((id) => id !== pid);
      }
    });

    if (selectedPIDs.length === 0) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
  }, 5000); // Check every 5 seconds
}

function notifyProcessEnded(pid) {
  // Display a notification
  if ('Notification' in window) {
    new Notification('Process Ended', {
      body: `Process with PID ${pid} has ended.`,
    });
  } else {
    alert(`Process with PID ${pid} has ended.`);
  }

  // Play a sound (optional)
  playNotificationSound();
}

function playNotificationSound() {
  const audio = new Audio('notification_sound.mp3');
  audio.play();
}

document.getElementById('start-monitoring').addEventListener('click', monitorProcesses);

// Initial list load
listProcesses();
