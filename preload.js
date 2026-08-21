// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getProcesses: () => ipcRenderer.invoke('get-processes'),
  getPreferences: () => ipcRenderer.invoke('get-preferences'),
  savePreferences: (preferences) =>
    ipcRenderer.send('save-preferences', preferences),
  onPreferencesSaved: (callback) =>
    ipcRenderer.on('preferences-saved', callback),
  updateTrayTooltip: (numProcesses) =>
    ipcRenderer.send('update-tray-tooltip', numProcesses),
  quitApp: () => ipcRenderer.send('quit-app'),
});
