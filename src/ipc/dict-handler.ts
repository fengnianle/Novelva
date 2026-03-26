import { ipcMain } from 'electron';

export function registerDictHandlers(): void {
  // Proxy dictionary HTTP requests through the main process to avoid CORS issues
  ipcMain.handle(
    'dict:fetch',
    async (_event, url: string): Promise<any | null> => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Novelva/1.0',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    }
  );
}
