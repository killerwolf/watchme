// preload.js
import { contextBridge, ipcRenderer } from 'electron';
import IPC_CHANNELS from './ipc-channels.json' with { type: 'json' };

contextBridge.exposeInMainWorld('electronAPI', {
  getProcesses: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PROCESSES),
  getPreferences: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PREFERENCES),
  savePreferences: (preferences) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_PREFERENCES, preferences),
  updateTrayTooltip: (numProcesses) =>
    ipcRenderer.send(IPC_CHANNELS.UPDATE_TRAY_TOOLTIP, numProcesses),
  quitApp: () => ipcRenderer.send(IPC_CHANNELS.QUIT_APP),
});
