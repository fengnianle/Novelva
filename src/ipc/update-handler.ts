import { ipcMain, shell, app } from 'electron';

const GITHUB_REPO = 'fengnianle/Novelva';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

interface ReleaseInfo {
  version: string;
  name: string;
  body: string;
  htmlUrl: string;
  downloadUrl: string | null;
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

      // Find Windows .exe asset
      const exeAsset = data.assets?.find((a: any) =>
        a.name.toLowerCase().endsWith('.exe') ||
        a.name.toLowerCase().endsWith('.zip')
      );

      return {
        version: latestVersion,
        name: data.name || `v${latestVersion}`,
        body: data.body || '',
        htmlUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
        downloadUrl: exeAsset?.browser_download_url || null,
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

  // Open release page in browser for manual download
  ipcMain.handle('update:open-release', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // Open download URL in browser
  ipcMain.handle('update:download', async (_event, url: string) => {
    await shell.openExternal(url);
  });
}
