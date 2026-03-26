import { ipcMain, shell, app, BrowserWindow, net } from 'electron';
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
  error?: string;
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
  // Parse GitHub API response JSON into ReleaseInfo
  function parseApiResponse(data: any): ReleaseInfo {
    const currentVersion = app.getVersion();
    const latestVersion = (data.tag_name || '').replace(/^v/, '');
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
  }

  // Try GitHub API via Electron net.fetch (respects system proxy)
  async function checkViaNetFetch(): Promise<ReleaseInfo | null> {
    const response = await net.fetch(GITHUB_API_URL, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Novelva-Updater',
      },
    });

    if (response.status === 404) {
      const currentVersion = app.getVersion();
      return {
        version: currentVersion, name: `v${currentVersion}`, body: '',
        htmlUrl: `https://github.com/${GITHUB_REPO}/releases`,
        zipUrl: null, publishedAt: '', isNewer: false,
        error: '暂无已发布的版本',
      };
    }
    if (response.status === 403) return null; // rate limited
    if (!response.ok) return null;

    const data = await response.json();
    return parseApiResponse(data);
  }

  // Try GitHub API via Node.js https (different connection, may bypass rate limit)
  async function checkViaNodeHttps(): Promise<ReleaseInfo | null> {
    const res = await httpsGet(GITHUB_API_URL, false, { 'Accept': 'application/vnd.github.v3+json' });
    if (res.statusCode === 404) {
      const currentVersion = app.getVersion();
      return {
        version: currentVersion, name: `v${currentVersion}`, body: '',
        htmlUrl: `https://github.com/${GITHUB_REPO}/releases`,
        zipUrl: null, publishedAt: '', isNewer: false,
        error: '暂无已发布的版本',
      };
    }
    if (res.statusCode !== 200) return null;
    const data = JSON.parse(res.body);
    return parseApiResponse(data);
  }

  // Node.js https helper with optional custom headers and redirect control
  function httpsGet(url: string, followRedirect: boolean, extraHeaders?: Record<string, string>): Promise<{ statusCode: number; headers: any; body: string }> {
    const https = require('node:https');
    const reqHeaders = { 'User-Agent': 'Novelva-Updater', ...extraHeaders };
    return new Promise((resolve, reject) => {
      const req = https.get(url, { headers: reqHeaders, timeout: 15000 }, (res: any) => {
        if (!followRedirect && res.statusCode >= 300 && res.statusCode < 400) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: '' });
          res.resume();
          return;
        }
        if (followRedirect && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(httpsGet(res.headers.location, true, extraHeaders));
          res.resume();
          return;
        }
        let body = '';
        res.on('data', (chunk: string) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
  }

  async function checkViaHtml(): Promise<ReleaseInfo | null> {
    try {
      const pageUrl = `https://github.com/${GITHUB_REPO}/releases/latest`;

      // Step 1: Don't follow redirect, just get Location header to extract tag
      const redirectRes = await httpsGet(pageUrl, false);
      const location = redirectRes.headers?.location || '';

      const tagMatch = location.match(/\/releases\/tag\/([^/?#]+)/);
      if (!tagMatch) {
        return null;
      }

      const tag = tagMatch[1];
      const latestVersion = tag.replace(/^v/, '');
      const currentVersion = app.getVersion();

      // Step 2: Fetch the release page to find .zip download link
      const tagPageUrl = `https://github.com/${GITHUB_REPO}/releases/tag/${tag}`;
      const pageRes = await httpsGet(tagPageUrl, true);

      let zipUrl: string | null = null;
      if (pageRes.statusCode === 200) {
        const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const zipPattern = new RegExp(`/${GITHUB_REPO}/releases/download/${escapedTag}/[^"]*\\.zip`, 'i');
        const zipMatch = pageRes.body.match(zipPattern);
        zipUrl = zipMatch ? `https://github.com${zipMatch[0]}` : null;
      }

      return {
        version: latestVersion,
        name: `v${latestVersion}`,
        body: '',
        htmlUrl: tagPageUrl,
        zipUrl,
        publishedAt: '',
        isNewer: compareVersions(currentVersion, latestVersion),
      };
    } catch (err) {
      console.error('[update:check:html] error:', (err as Error).message);
      return null;
    }
  }

  // Check for updates: try multiple methods for maximum reliability
  ipcMain.handle('update:check', async (): Promise<ReleaseInfo | null> => {
    try {
      // Method 1: Electron net.fetch (respects system proxy)
      try {
        const result = await checkViaNetFetch();
        if (result) return result;
      } catch (e) {
        console.log('[update:check] net.fetch failed:', (e as Error).message);
      }

      // Method 2: Node.js https (different network stack)
      try {
        const result = await checkViaNodeHttps();
        if (result) return result;
      } catch (e) {
        console.log('[update:check] node https failed:', (e as Error).message);
      }

      // Method 3: HTML redirect fallback (no API needed)
      try {
        const result = await checkViaHtml();
        if (result) return result;
      } catch (e) {
        console.log('[update:check] html fallback failed:', (e as Error).message);
      }

      return {
        version: '', name: '', body: '',
        htmlUrl: `https://github.com/${GITHUB_REPO}/releases/latest`,
        zipUrl: null, publishedAt: '', isNewer: false,
        error: '无法获取更新信息，请检查网络连接后重试',
      };
    } catch (err) {
      const msg = (err as Error).message || String(err);
      console.error('[update:check] error:', msg);
      return {
        version: '', name: '', body: '',
        htmlUrl: `https://github.com/${GITHUB_REPO}/releases/latest`,
        zipUrl: null, publishedAt: '', isNewer: false,
        error: `网络连接失败: ${msg}`,
      };
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
      const exeName = path.basename(exePath);
      const batchContent = [
        '@echo off',
        'chcp 65001 >nul',
        // Wait for ALL Novelva processes to exit (not just one PID)
        'set RETRIES=0',
        ':waitloop',
        `tasklist /FI "IMAGENAME eq ${exeName}" 2>nul | find /I "${exeName}" >nul`,
        'if not errorlevel 1 (',
        '  set /a RETRIES+=1',
        '  if %RETRIES% GEQ 30 (',
        '    echo Timeout waiting for app to exit.',
        '    exit /b 1',
        '  )',
        '  timeout /t 1 /nobreak >nul',
        '  goto waitloop',
        ')',
        'timeout /t 1 /nobreak >nul',
        // Copy new files over old ones
        `xcopy /E /Y /I /Q "${sourceDir}\\*" "${appDir}\\" >nul 2>&1`,
        'if errorlevel 1 (',
        '  exit /b 1',
        ')',
        // Restart the app
        `start "" "${exePath}"`,
        // Clean up temp files
        `rmdir /S /Q "${tempDir}" 2>nul`,
      ].join('\r\n');

      fs.writeFileSync(batchPath, batchContent, 'utf-8');

      // Step 6: Create a VBS wrapper to launch the batch script completely hidden
      const vbsPath = path.join(tempDir, 'apply-update.vbs');
      const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\r\nWshShell.Run chr(34) & "${batchPath}" & chr(34), 0, False`;
      fs.writeFileSync(vbsPath, vbsContent, 'utf-8');

      sendProgress('restarting', 95, '即将重启应用...');
      const child = spawn('wscript.exe', [vbsPath], {
        detached: true,
        stdio: 'ignore',
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
