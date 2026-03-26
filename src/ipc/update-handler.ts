import { ipcMain, shell, app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const GITHUB_REPO = 'fengnianle/Novelva';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

interface ReleaseInfo {
  version: string;
  name: string;
  body: string;
  htmlUrl: string;
  zipUrl: string | null;
  publishedAt: string;
  isNewer: boolean;
}

function compareVersions(current: string, latest: string): boolean {
  const c = current.replace(/^v/, '').split('.').map(Number);
  const l = latest.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

function sendProgress(stage: string, percent: number, detail?: string) {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) {
    wins[0].webContents.send('update:progress', { stage, percent, detail });
  }
}

export function registerUpdateHandlers(): void {
  // Check for updates from GitHub Releases
  ipcMain.handle('update:check', async (): Promise<ReleaseInfo | null> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(GITHUB_API_URL, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Novelva-Updater',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) return null;
      const data = await response.json();

      const currentVersion = app.getVersion();
      const latestVersion = (data.tag_name || '').replace(/^v/, '');

      // Find .zip asset (preferred for auto-update)
      const zipAsset = data.assets?.find((a: any) =>
        a.name.toLowerCase().endsWith('.zip')
      );

      return {
        version: latestVersion,
        name: data.name || `v${latestVersion}`,
        body: data.body || '',
        htmlUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
        zipUrl: zipAsset?.browser_download_url || null,
        publishedAt: data.published_at || '',
        isNewer: compareVersions(currentVersion, latestVersion),
      };
    } catch (err) {
      console.error('[update:check] error:', (err as Error).message);
      return null;
    }
  });

  // Get current app version
  ipcMain.handle('update:get-version', () => {
    return app.getVersion();
  });

  // Open release page in browser
  ipcMain.handle('update:open-release', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // Auto-download and apply update
  ipcMain.handle('update:download-and-apply', async (_event, zipUrl: string): Promise<{ success: boolean; error?: string }> => {
    const appDir = path.dirname(app.getPath('exe'));
    const tempDir = path.join(app.getPath('temp'), 'novelva-update');
    const zipPath = path.join(tempDir, 'update.zip');
    const extractDir = path.join(tempDir, 'extracted');

    try {
      // Step 1: Prepare temp directory
      sendProgress('preparing', 0, '准备更新...');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(extractDir, { recursive: true });

      // Step 2: Download ZIP with progress
      sendProgress('downloading', 5, '正在下载更新包...');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000); // 5 min timeout
      const response = await fetch(zipUrl, {
        headers: { 'User-Agent': 'Novelva-Updater' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok || !response.body) {
        return { success: false, error: `下载失败 (HTTP ${response.status})` };
      }

      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      const fileStream = fs.createWriteStream(zipPath);

      // Download with progress tracking
      let downloaded = 0;
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fileStream.write(value);
        downloaded += value.length;
        if (contentLength > 0) {
          const pct = Math.round((downloaded / contentLength) * 70) + 5; // 5-75%
          const mb = (downloaded / 1024 / 1024).toFixed(1);
          const totalMb = (contentLength / 1024 / 1024).toFixed(1);
          sendProgress('downloading', pct, `下载中 ${mb}MB / ${totalMb}MB`);
        }
      }
      await new Promise<void>((resolve, reject) => {
        fileStream.end(() => resolve());
        fileStream.on('error', reject);
      });

      sendProgress('downloading', 75, '下载完成');

      // Step 3: Extract ZIP using PowerShell
      sendProgress('extracting', 80, '正在解压...');
      await new Promise<void>((resolve, reject) => {
        const ps = spawn('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-Command',
          `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`
        ]);
        ps.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`解压失败 (code ${code})`));
        });
        ps.on('error', reject);
      });

      // Step 4: Find the actual app root inside extracted folder
      // ZIP may contain a top-level folder like "Novelva-win32-x64/"
      let sourceDir = extractDir;
      const entries = fs.readdirSync(extractDir);
      if (entries.length === 1) {
        const single = path.join(extractDir, entries[0]);
        if (fs.statSync(single).isDirectory()) {
          sourceDir = single;
        }
      }
      // Verify it contains Novelva.exe
      if (!fs.existsSync(path.join(sourceDir, 'Novelva.exe'))) {
        return { success: false, error: '更新包格式错误：未找到 Novelva.exe' };
      }

      sendProgress('applying', 90, '正在应用更新...');

      // Step 5: Create a batch script to replace files after app exits
      const batchPath = path.join(tempDir, 'apply-update.bat');
      const exePath = app.getPath('exe');
      const batchContent = [
        '@echo off',
        'chcp 65001 >nul',
        // Wait for the app to fully exit
        'echo 正在等待 Novelva 退出...',
        ':waitloop',
        `tasklist /FI "PID eq %1" 2>nul | find /I "Novelva" >nul`,
        'if not errorlevel 1 (',
        '  timeout /t 1 /nobreak >nul',
        '  goto waitloop',
        ')',
        'timeout /t 1 /nobreak >nul',
        // Copy new files over old ones
        'echo 正在更新文件...',
        `xcopy /E /Y /I /Q "${sourceDir}\\*" "${appDir}\\"`,
        'if errorlevel 1 (',
        '  echo 更新失败！',
        '  pause',
        '  exit /b 1',
        ')',
        // Restart the app
        'echo 更新完成，正在重启...',
        `start "" "${exePath}"`,
        // Clean up temp files
        `rmdir /S /Q "${tempDir}" 2>nul`,
      ].join('\r\n');

      fs.writeFileSync(batchPath, batchContent, 'utf-8');

      // Step 6: Launch the batch script (detached) passing current PID, then quit
      sendProgress('restarting', 95, '即将重启应用...');
      const child = spawn('cmd.exe', ['/c', batchPath, String(process.pid)], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();

      // Give the batch script a moment to start
      await new Promise(r => setTimeout(r, 500));

      // Quit the app so the batch script can replace files
      app.quit();

      return { success: true };
    } catch (err) {
      console.error('[update:download-and-apply] error:', (err as Error).message);
      // Clean up on failure
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      return { success: false, error: (err as Error).message };
    }
  });
}
