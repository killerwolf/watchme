import path from 'node:path';
// Define __dirname in ES modules
import { fileURLToPath } from 'node:url'; // Adjusted import
// main.js
import {
  app,
  BrowserWindow,
  ipcMain,
  nativeImage,
  screen,
  Tray,
} from 'electron';
import Store from 'electron-store';
import psList from 'ps-list';
import IPC_CHANNELS from './ipc-channels.json' with { type: 'json' };
import { trayBadge, trayTooltip } from './tray-status.js';

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
    width: 800, // Half the width
    height: 500,
    minWidth: 400,
    minHeight: 300,
    show: false, // Start hidden
    frame: false, // Frameless window
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false, // Set to false for better performance
    webPreferences: {
      nodeIntegration: false, // Disable nodeIntegration for security
      contextIsolation: true, // Enable context isolation
      // contextIsolation is what actually walls the loaded page off from
      // Node/Electron; sandbox additionally restricts the preload script
      // itself, which blocks its require() to a small allowlist (no local
      // files, not even node:fs). Disabled so preload.js can require the
      // shared ipc-channels.json instead of hardcoding channel strings.
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'), // Use a preload script
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

  mainWindow.on('blur', () => {
    if (!mainWindow.webContents.isDevToolsOpened()) {
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
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });

  const windowBounds = mainWindow.getBounds();

  // Calculate the x and y coordinates
  let x = Math.round(
    trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2
  );
  let y;

  if (process.platform === 'darwin') {
    // For macOS, position the window below the tray icon
    y = Math.round(display.bounds.y + trayBounds.height + 4);
  } else {
    // For Windows/Linux, position the window above the tray icon
    y = Math.round(trayBounds.y - windowBounds.height);
  }

  // Ensure the window is within the bounds of the display
  x = Math.max(
    display.bounds.x,
    Math.min(x, display.bounds.x + display.bounds.width - windowBounds.width)
  );
  y = Math.max(
    display.bounds.y,
    Math.min(y, display.bounds.y + display.bounds.height - windowBounds.height)
  );

  mainWindow.setPosition(x, y, false);

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const iconPath = path.join(__dirname, 'misc/tray-icon.png'); // Provide your icon path
  let trayIcon = nativeImage.createFromPath(iconPath);

  // Resize the icon to 16x16 pixels
  trayIcon = trayIcon.resize({ width: 16, height: 12 });

  if (process.platform === 'darwin') {
    trayIcon.setTemplateImage(true);
  }

  tray = new Tray(trayIcon);

  tray.on('click', () => {
    toggleWindow();
  });
}

// IPC handlers
ipcMain.handle(IPC_CHANNELS.GET_PROCESSES, async () => {
  const processes = await psList();
  return processes;
});

ipcMain.handle(IPC_CHANNELS.GET_PREFERENCES, () => preferences);

ipcMain.handle(IPC_CHANNELS.SAVE_PREFERENCES, (_event, newPreferences) => {
  preferences = { ...preferences, ...newPreferences };
  store.set('preferences', preferences); // Save to store

  // Apply settings with error handling
  let loginItemSuccess = true;
  try {
    app.setLoginItemSettings({
      openAtLogin: preferences.autoLaunch,
    });
  } catch (error) {
    console.error('Failed to set login item settings:', error);
    loginItemSuccess = false;
    // Continue execution - this is not critical for app functionality
  }

  return { loginItemSuccess };
});

ipcMain.on(IPC_CHANNELS.UPDATE_TRAY_TOOLTIP, (_event, numProcesses) => {
  tray.setToolTip(trayTooltip(numProcesses));

  // The count beside the icon is macOS-specific: it is the native way to
  // show a count in the menu bar. setTitle does not exist anywhere else,
  // hence the guard.
  if (process.platform === 'darwin') {
    tray.setTitle(trayBadge(numProcesses));
  }
});

ipcMain.on(IPC_CHANNELS.QUIT_APP, () => {
  app.isQuitting = true;
  app.quit();
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

// Deliberately empty listener: its mere presence neutralises Electron's
// default behaviour, which is to quit the app once every window is closed.
//
// In practice it is rarely reached: the `close` handler above hides the
// window instead of closing it while app.isQuitting is false. It is kept
// because there is no proof that no path closes the window without meaning
// to quit. Do not remove it without checking that first.
app.on('window-all-closed', () => {});

app.on('activate', () => {
  if (mainWindow) {
    showWindow();
  } else {
    createWindow();
  }
});
