import { app, BrowserWindow, shell, ipcMain, Notification } from 'electron';
import { join } from 'path';

const isDev = !app.isPackaged;

function createWindow(): void {
  const iconPath = isDev
    ? join(__dirname, '../../resources/icon.ico')
    : join(process.resourcesPath, 'resources', 'icon.ico');

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.mscoatings.admin');

  ipcMain.handle('app:getVersion', () => app.getVersion());

  ipcMain.handle(
    'app:showNotification',
    (_event, payload: { title: string; body: string }) => {
      if (!Notification.isSupported()) return false;
      const notification = new Notification({
        title: payload.title,
        body: payload.body,
        silent: false,
      });
      notification.show();
      return true;
    }
  );

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
