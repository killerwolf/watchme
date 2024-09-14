// main.js
import { app, BrowserWindow, ipcMain, Tray, nativeImage, screen } from 'electron';
import path from 'path';
import psList from 'ps-list';
import { fileURLToPath } from 'url';
import Store from 'electron-store';

// Define __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let tray = null;
app.isQuitting = false; // Initialize isQuitting

// Initialize electron-store for preference persistence
const store = new Store();

// Load preferences from store or set default values
let preferences = store.get('preferences', {
  autoLaunch: false,
  prefilterRegex: '', // Default preferences
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400, // Half the width
    height: 500,
    show: false, // Start hidden
    frame: false, // Frameless window
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true, // Optional: Make window transparent
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  // Hide the window instead of closing when the close button is clicked
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function toggleWindow() {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

function showWindow() {
  // Get the position of the tray icon
  const trayBounds = tray.getBounds();

  // Get the display nearest to the tray icon
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });

  const windowBounds = mainWindow.getBounds();

  // Calculate the x and y coordinates
  let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
  let y;

  if (process.platform === 'darwin') {
    // For macOS, position the window below the tray icon
    y = Math.round(display.bounds.y + trayBounds.height + 4);
  } else {
    // For Windows/Linux, position the window above the tray icon
    y = Math.round(trayBounds.y - windowBounds.height);
  }

  // Ensure the window is within the bounds of the display
  x = Math.max(display.bounds.x, Math.min(x, display.bounds.x + display.bounds.width - windowBounds.width));
  y = Math.max(display.bounds.y, Math.min(y, display.bounds.y + display.bounds.height - windowBounds.height));

  mainWindow.setPosition(x, y, false);
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const iconPath = path.join(__dirname, 'tray-icon.png'); // Provide your icon path
  let trayIcon = nativeImage.createFromPath(iconPath);

  // Resize the icon to 16x16 pixels
  trayIcon = trayIcon.resize({ width: 16, height: 16 });

  if (process.platform === 'darwin') {
    trayIcon.setTemplateImage(true);
  }

  tray = new Tray(trayIcon);

  tray.on('click', () => {
    toggleWindow();
  });
}

// IPC handlers
ipcMain.handle('get-processes', async () => {
  const processes = await psList();
  return processes;
});

ipcMain.handle('get-preferences', () => {
  return preferences;
});

ipcMain.on('save-preferences', (event, newPreferences) => {
  preferences = { ...preferences, ...newPreferences };
  store.set('preferences', preferences); // Save to store

  // Apply settings
  app.setLoginItemSettings({
    openAtLogin: preferences.autoLaunch,
  });
});

ipcMain.on('update-tray-tooltip', (event, numProcesses) => {
  const tooltip = `Script Watcher - Monitoring ${numProcesses} process${numProcesses === 1 ? '' : 'es'}`;
  tray.setToolTip(tooltip);
});

ipcMain.on('update-monitored-processes', (event, monitoredPIDs) => {
  // You can handle monitored processes here if needed
});

app.whenReady().then(() => {
  createTray();
  createWindow();

  // On macOS, hide the dock icon
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', (event) => {
  event.preventDefault(); // Prevent default behavior of quitting
});

app.on('activate', () => {
  if (mainWindow) {
    showWindow();
  } else {
    createWindow();
  }
});
