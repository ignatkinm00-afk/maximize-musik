import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { app, BrowserWindow, shell } = require('electron');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = Boolean(process.env.MM_DEV_URL);
const apiUrl = process.env.MM_API_URL ?? '';

if (process.platform === 'win32') app.setAppUserModelId('com.maximize.musik');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#06060a',
    show: false,
    title: 'Maximize Musik',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#08080d',
      symbolColor: '#f5f4fb',
      height: 38,
    },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      additionalArguments: [`--mm-api-url=${apiUrl}`],
    },
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  if (isDev) {
    void mainWindow.loadURL(process.env.MM_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL() ?? '';
    if (url.split('#')[0] !== current.split('#')[0] && /^https?:/i.test(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
