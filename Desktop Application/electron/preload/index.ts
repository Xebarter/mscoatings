import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  showNotification: (payload: {
    title: string;
    body: string;
  }): Promise<boolean> => ipcRenderer.invoke('app:showNotification', payload),
  printPreview: (html: string): Promise<boolean> =>
    ipcRenderer.invoke('app:printPreview', html),
  apiFetch: (payload: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string | null;
  }): Promise<{ ok: boolean; status: number; body: string }> =>
    ipcRenderer.invoke('app:apiFetch', payload),
  platform: process.platform,
});
