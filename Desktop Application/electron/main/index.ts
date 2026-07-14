import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  Notification,
  session,
} from 'electron';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';

const isDev = !app.isPackaged;

/** Google blocks Electron's default UA — present as Chrome. */
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function isOAuthPopupUrl(url: string): boolean {
  if (!url || url === 'about:blank') return true;
  return (
    url.includes('accounts.google.com') ||
    url.includes('google.com/o/oauth') ||
    url.includes('firebaseapp.com') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('__/auth/')
  );
}

let mainWindow: BrowserWindow | null = null;
let printPreviewWindow: BrowserWindow | null = null;
let printTempFile: string | null = null;

function createWindow(): void {
  const iconPath = isDev
    ? join(__dirname, '../../resources/icon.ico')
    : join(process.resourcesPath, 'resources', 'icon.ico');

  mainWindow = new BrowserWindow({
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
      nativeWindowOpen: true,
    },
  });

  mainWindow.webContents.setUserAgent(CHROME_UA);

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (printPreviewWindow && !printPreviewWindow.isDestroyed()) {
      printPreviewWindow.close();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isOAuthPopupUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          parent: mainWindow ?? undefined,
          modal: false,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            nativeWindowOpen: true,
          },
        },
      };
    }

    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-create-window', (childWindow) => {
    childWindow.setMenuBarVisibility(false);
    childWindow.webContents.setUserAgent(CHROME_UA);

    childWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (isOAuthPopupUrl(url)) {
        return { action: 'allow' };
      }
      if (url.startsWith('https://') || url.startsWith('http://')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'bottom' });
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function wrapPrintPreviewHtml(bodyHtml: string): string {
  const toolbar = `
<style>
  #ms-print-toolbar {
    position: sticky;
    top: 0;
    z-index: 9999;
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: flex-end;
    padding: 12px 16px;
    background: #0f172a;
    color: #fff;
    font-family: system-ui, sans-serif;
    box-shadow: 0 4px 20px rgba(0,0,0,.25);
  }
  #ms-print-toolbar button {
    border: 0;
    border-radius: 10px;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  #ms-print-toolbar .print { background: #0077c8; color: #fff; }
  #ms-print-toolbar .close { background: #334155; color: #fff; }
  @media print {
    #ms-print-toolbar { display: none !important; }
  }
</style>
<div id="ms-print-toolbar">
  <span style="margin-right:auto;font-size:13px;opacity:.85">Print preview</span>
  <button class="close" type="button" onclick="window.close()">Close</button>
  <button class="print" type="button" onclick="window.print()">Print</button>
</div>`;

  if (/<\/body>/i.test(bodyHtml)) {
    return bodyHtml.replace(/<\/body>/i, `${toolbar}</body>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Print Preview</title></head><body>${toolbar}${bodyHtml}</body></html>`;
}

function cleanupPrintTemp() {
  if (!printTempFile) return;
  try {
    unlinkSync(printTempFile);
  } catch {
    /* ignore */
  }
  printTempFile = null;
}

function openPrintPreview(html: string): boolean {
  try {
    cleanupPrintTemp();
    printTempFile = join(tmpdir(), `ms-coatings-print-${Date.now()}.html`);
    writeFileSync(printTempFile, wrapPrintPreviewHtml(html), 'utf8');
    const fileUrl = `file:///${printTempFile.replace(/\\/g, '/')}`;

    if (printPreviewWindow && !printPreviewWindow.isDestroyed()) {
      printPreviewWindow.focus();
      void printPreviewWindow.loadURL(fileUrl);
      return true;
    }

    printPreviewWindow = new BrowserWindow({
      width: 960,
      height: 900,
      minWidth: 720,
      minHeight: 560,
      parent: mainWindow ?? undefined,
      modal: false,
      show: true,
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
      title: 'Print Preview — MS Coatings',
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    printPreviewWindow.setMenuBarVisibility(false);

    printPreviewWindow.on('closed', () => {
      printPreviewWindow = null;
      cleanupPrintTemp();
    });

    printPreviewWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'Escape') {
        printPreviewWindow?.close();
        event.preventDefault();
      }
    });

    void printPreviewWindow.loadURL(fileUrl);
    return true;
  } catch (error) {
    console.error('Print preview failed:', error);
    cleanupPrintTemp();
    return false;
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.mscoatings.admin');

  session.defaultSession.setUserAgent(CHROME_UA);
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    if (headers['User-Agent']) {
      headers['User-Agent'] = CHROME_UA;
    }
    callback({ requestHeaders: headers });
  });

  // Desktop renderer (localhost / file://) calls the production API cross-origin.
  // Inject CORS allow headers so Bearer API calls are not blocked by Chromium.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...(details.responseHeaders ?? {}) };
    const url = details.url ?? '';
    if (url.includes('/api/')) {
      responseHeaders['Access-Control-Allow-Origin'] = ['*'];
      responseHeaders['Access-Control-Allow-Headers'] = [
        'Authorization, Content-Type',
      ];
      responseHeaders['Access-Control-Allow-Methods'] = [
        'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      ];
    }
    callback({ responseHeaders });
  });

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

  ipcMain.handle('app:printPreview', (_event, html: string) => {
    if (typeof html !== 'string' || !html.trim()) return false;
    return openPrintPreview(html);
  });

  /**
   * Proxy API requests through the main process so renderer CORS never blocks
   * live calls to VITE_APP_URL (localhost → production).
   */
  ipcMain.handle(
    'app:apiFetch',
    async (
      _event,
      payload: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string | null;
      }
    ) => {
      if (!payload?.url || typeof payload.url !== 'string') {
        return { ok: false, status: 400, body: '{"error":"Missing URL"}' };
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12_000);
        const response = await fetch(payload.url, {
          method: payload.method ?? 'GET',
          headers: payload.headers,
          body: payload.body ?? undefined,
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));
        const body = await response.text();
        return {
          ok: response.ok,
          status: response.status,
          body,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Network request failed';
        return {
          ok: false,
          status: 0,
          body: JSON.stringify({ error: message }),
        };
      }
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
