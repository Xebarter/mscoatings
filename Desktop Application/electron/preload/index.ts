import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  showNotification: (payload: {
    title: string;
    body: string;
  }): Promise<boolean> => ipcRenderer.invoke('app:showNotification', payload),
  platform: process.platform,
});
