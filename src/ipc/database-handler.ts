import { ipcMain } from 'electron';
import { queryAll, runSql } from '../database/index';

export function registerDatabaseHandlers(): void {
  ipcMain.handle('db:query', (_event, sql: string, params?: any[]) => {
    return queryAll(sql, params);
  });

  ipcMain.handle('db:run', (_event, sql: string, params?: any[]) => {
    runSql(sql, params);
  });

  ipcMain.handle('db:get-settings', () => {
    const rows = queryAll('SELECT key, value FROM settings');
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  });

  ipcMain.handle('db:save-setting', (_event, key: string, value: string) => {
    runSql(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value]
    );
  });
}
