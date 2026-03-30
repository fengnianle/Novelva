import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { queryAll, runSql, getDatabase, saveDatabase, initDatabase } from '../database/index';

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

  // Export database to a user-chosen location
  ipcMain.handle('db:export', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: 'No window' };

    const result = await dialog.showSaveDialog(win, {
      title: '导出数据库',
      defaultPath: path.join(app.getPath('desktop'), 'Novelva-backup.db'),
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });

    if (result.canceled || !result.filePath) return { success: false, error: 'cancelled' };

    try {
      // Ensure latest data is saved
      saveDatabase();
      const dbPath = path.join(app.getPath('userData'), 'reading-app.db');
      fs.copyFileSync(dbPath, result.filePath);
      return { success: true, path: result.filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Import database from a user-chosen file
  ipcMain.handle('db:import', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: 'No window' };

    const result = await dialog.showOpenDialog(win, {
      title: '导入数据库',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'cancelled' };

    try {
      const importPath = result.filePaths[0];
      const dbPath = path.join(app.getPath('userData'), 'reading-app.db');
      // Backup current db first
      const backupPath = dbPath + '.bak';
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
      }
      fs.copyFileSync(importPath, dbPath);
      // Reinitialize database from the imported file
      await initDatabase(true);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
