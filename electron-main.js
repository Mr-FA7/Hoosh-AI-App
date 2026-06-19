const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

function startCompanion() {
  console.log('Starting FA7 OS Companion (Internal)...');
  try {
    process.env.FA7_ELECTRON_MODE = '1';

    if (app.isPackaged) {
      const userDataPath = app.getPath('userData');
      process.env.FA7_PROJECT_ROOT = path.join(userDataPath, 'sandbox');
    }

    require('./companion.js');
  } catch (err) {
    console.error('Failed to start companion internally:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Hoosh',
    icon: path.join(__dirname, 'assets', 'icon.icns'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const useViteDev = process.env.NODE_ENV === 'development';

  if (useViteDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  return { canceled: false, path: result.filePaths[0] };
});

app.on('ready', () => {
  startCompanion();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
