import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('file:open'),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read-text', filePath),
  readPdf: (filePath: string) => ipcRenderer.invoke('file:read-pdf', filePath),
  readEpub: (filePath: string) => ipcRenderer.invoke('file:read-epub', filePath),
  dbQuery: (sql: string, params?: any[]) => ipcRenderer.invoke('db:query', sql, params),
  dbRun: (sql: string, params?: any[]) => ipcRenderer.invoke('db:run', sql, params),
  callAI: (prompt: string, apiKey: string, systemPrompt?: string) => ipcRenderer.invoke('ai:call', prompt, apiKey, systemPrompt),
  getSettings: () => ipcRenderer.invoke('db:get-settings'),
  saveSetting: (key: string, value: string) => ipcRenderer.invoke('db:save-setting', key, value),
});
