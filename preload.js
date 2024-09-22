// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getProcesses: () => ipcRenderer.invoke('get-processes'),
  getPreferences: () => ipcRenderer.invoke('get-preferences'),
  savePreferences: (preferences) =>
    ipcRenderer.send('save-preferences', preferences),
  updateTrayTooltip: (numProcesses) =>
    ipcRenderer.send('update-tray-tooltip', numProcesses),
  updateMonitoredProcesses: (monitoredProcesses) =>
    ipcRenderer.send('update-monitored-processes', monitoredProcesses),
  windowControl: (action) => ipcRenderer.send('window-control', action),
  quitApp: () => ipcRenderer.send('quit-app'),
});
