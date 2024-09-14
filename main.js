import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import psList from 'ps-list';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For simplicity; consider enabling context isolation for security
    },
  });

  mainWindow.loadFile('index.html');

  // Open DevTools if needed
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

// Quit when all windows are closed (macOS behavior)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Re-create window when dock icon is clicked (macOS behavior)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Handle IPC events from renderer process
ipcMain.handle('get-processes', async () => {
  const processes = await psList();
  return processes;
});
