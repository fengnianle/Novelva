import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('file:open'),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read-text', filePath),
  fileExists: (filePath: string) => ipcRenderer.invoke('file:exists', filePath),
  readPdf: (filePath: string) => ipcRenderer.invoke('file:read-pdf', filePath),
  readEpub: (filePath: string) => ipcRenderer.invoke('file:read-epub', filePath),
  dbQuery: (sql: string, params?: any[]) => ipcRenderer.invoke('db:query', sql, params),
  dbRun: (sql: string, params?: any[]) => ipcRenderer.invoke('db:run', sql, params),
  callAI: (prompt: string, apiKey: string, systemPrompt?: string, providerBaseUrl?: string, model?: string) =>
    ipcRenderer.invoke('ai:call', prompt, apiKey, systemPrompt, providerBaseUrl, model),
  callAIStream: (prompt: string, apiKey: string, systemPrompt?: string, providerBaseUrl?: string, model?: string, streamId?: string) =>
    ipcRenderer.invoke('ai:call-stream', prompt, apiKey, systemPrompt, providerBaseUrl, model, streamId),
  onStreamChunk: (streamId: string, cb: (chunk: string) => void) => {
    const handler = (_event: any, chunk: string) => cb(chunk);
    ipcRenderer.on(`ai:stream-chunk:${streamId}`, handler);
    return () => ipcRenderer.removeListener(`ai:stream-chunk:${streamId}`, handler);
  },
  onStreamDone: (streamId: string, cb: (full: string) => void) => {
    const handler = (_event: any, full: string) => cb(full);
    ipcRenderer.on(`ai:stream-done:${streamId}`, handler);
    return () => ipcRenderer.removeListener(`ai:stream-done:${streamId}`, handler);
  },
  onStreamError: (streamId: string, cb: (err: string) => void) => {
    const handler = (_event: any, err: string) => cb(err);
    ipcRenderer.on(`ai:stream-error:${streamId}`, handler);
    return () => ipcRenderer.removeListener(`ai:stream-error:${streamId}`, handler);
  },
  abortStream: (streamId: string) => ipcRenderer.invoke('ai:abort-stream', streamId),
  getAIProviders: () => ipcRenderer.invoke('ai:get-providers'),
  dictFetch: (url: string) => ipcRenderer.invoke('dict:fetch', url),
  getSettings: () => ipcRenderer.invoke('db:get-settings'),
  saveSetting: (key: string, value: string) => ipcRenderer.invoke('db:save-setting', key, value),
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  dbExport: () => ipcRenderer.invoke('db:export'),
  dbImport: () => ipcRenderer.invoke('db:import'),
  getAppVersion: () => ipcRenderer.invoke('update:get-version'),
  openReleasePage: (url: string) => ipcRenderer.invoke('update:open-release', url),
  downloadAndApply: (zipUrl: string) => ipcRenderer.invoke('update:download-and-apply', zipUrl),
  onUpdateProgress: (cb: (data: { stage: string; percent: number; detail?: string }) => void) => {
    const handler = (_event: any, data: any) => cb(data);
    ipcRenderer.on('update:progress', handler);
    return () => ipcRenderer.removeListener('update:progress', handler);
  },
});
