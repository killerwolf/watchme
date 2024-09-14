// main.js
import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import psList from 'ps-list';
import { fileURLToPath } from 'url';

// Define __dirname manually in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let tray = null;
app.isQuitting = false; // Initialize isQuitting

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // Start hidden
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  // Hide the window instead of quitting when the close button is clicked
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide(); // Hide window instead of quitting
    }
  });
}

function createTray() {
  // Define the tray icon path and create a tray icon
  const iconPath = path.join(__dirname, 'tray-icon.png');
  let trayIcon = nativeImage.createFromPath(iconPath);

  // Adjust icon for macOS light/dark mode
  if (process.platform === 'darwin') {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
    trayIcon.setTemplateImage(true);
  }

  tray = new Tray(trayIcon);

  // Define tray context menu with options to show the app or quit
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow.show();
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true; // Set quitting flag
        app.quit(); // Quit the app
      },
    },
  ]);

  tray.setToolTip('Script Watcher');
  tray.setContextMenu(contextMenu);

  // Show the window when the tray icon is clicked
  tray.on('click', () => {
    mainWindow.show();
  });
}

// Handle IPC events from the renderer process
ipcMain.handle('get-processes', async () => {
  const processes = await psList();
  return processes;
});

app.whenReady().then(() => {
  createTray(); // Create the tray icon
  createWindow(); // Create the main window

  // Hide the app's dock icon on macOS
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
});

// Prevent the app from quitting when all windows are closed
app.on('window-all-closed', (event) => {
  event.preventDefault(); // Override default quitting behavior
});

// Re-create or show the window when the app is activated (macOS behavior)
app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show(); // Show the window if it exists
  } else {
    createWindow(); // Create a new window if it doesn't exist
  }
});
