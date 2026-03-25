const { ipcRenderer } = window as any;

export interface IpcApi {
  openFile: () => Promise<{ filePath: string; content: string; fileName: string } | null>;
  readPdf: (filePath: string) => Promise<string>;
  readEpub: (filePath: string) => Promise<string>;
  dbQuery: (sql: string, params?: any[]) => Promise<any[]>;
  dbRun: (sql: string, params?: any[]) => Promise<void>;
  callAI: (prompt: string, apiKey: string) => Promise<string>;
  getSettings: () => Promise<Record<string, string>>;
  saveSetting: (key: string, value: string) => Promise<void>;
}

export function getApi(): IpcApi {
  return (window as any).electronAPI as IpcApi;
}
