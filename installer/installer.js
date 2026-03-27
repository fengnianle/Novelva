#!/usr/bin/env node

/**
 * Novelva Installer
 * Downloads the latest release from GitHub and installs to a user-chosen directory.
 * Compiled to EXE via pkg.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');
const os = require('os');

const GITHUB_REPO = 'fengnianle/Novelva';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const APP_NAME = 'Novelva';
const DEFAULT_INSTALL_DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), APP_NAME);

// ─── Helpers ───────────────────────────────────────────────────────

function log(msg) {
  console.log(`  ${msg}`);
}

function logTitle(msg) {
  console.log(`\n  ${'='.repeat(50)}`);
  console.log(`  ${msg}`);
  console.log(`  ${'='.repeat(50)}\n`);
}

function rl() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(question) {
  return new Promise((resolve) => {
    const r = rl();
    r.question(`  ${question}`, (answer) => {
      r.close();
      resolve(answer.trim());
    });
  });
}

// Use PowerShell folder browser dialog
function browseFolder(defaultPath) {
  try {
    const ps = `
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = '请选择 Novelva 安装目录'
$f.SelectedPath = '${defaultPath.replace(/'/g, "''")}'
$f.ShowNewFolderButton = $true
if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath } else { '' }
`;
    const result = execSync(`powershell -NoProfile -Command "${ps.replace(/\n/g, ' ')}"`, {
      encoding: 'utf-8',
      windowsHide: true,
    }).trim();
    return result || '';
  } catch {
    return '';
  }
}

// HTTPS GET with redirect following
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'User-Agent': 'Novelva-Installer/1.0',
      ...headers,
    };
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    client.get(url, { headers: defaultHeaders }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location, headers).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      resolve(res);
    }).on('error', reject);
  });
}

// Download file with progress
function downloadFile(url, destPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await httpsGet(url);
      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      const file = fs.createWriteStream(destPath);

      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        file.write(chunk);
        if (totalBytes > 0) {
          const pct = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
          const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
          process.stdout.write(`\r  下载进度: ${pct}% (${mb}/${totalMb} MB)    `);
        }
      });

      res.on('end', () => {
        file.end();
        console.log('');
        resolve();
      });

      res.on('error', (err) => {
        file.end();
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Extract ZIP using PowerShell
function extractZip(zipPath, destDir) {
  log('正在解压文件...');
  try {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`,
      { windowsHide: true, stdio: 'pipe' }
    );
    return true;
  } catch (err) {
    console.error(`  解压失败: ${err.message}`);
    return false;
  }
}

// Create desktop shortcut
function createShortcut(exePath, shortcutName, iconPath) {
  try {
    const desktopDir = path.join(os.homedir(), 'Desktop');
    const shortcutPath = path.join(desktopDir, `${shortcutName}.lnk`);
    const ps = `
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$sc.TargetPath = '${exePath.replace(/'/g, "''")}'
$sc.WorkingDirectory = '${path.dirname(exePath).replace(/'/g, "''")}'
$sc.IconLocation = '${(iconPath || exePath).replace(/'/g, "''")}'
$sc.Description = 'Novelva - AI 多语言阅读学习'
$sc.Save()
`;
    execSync(`powershell -NoProfile -Command "${ps.replace(/\n/g, ' ')}"`, {
      windowsHide: true,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

// Create Start Menu shortcut
function createStartMenuShortcut(exePath, appName, iconPath) {
  try {
    const startMenuDir = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    const shortcutPath = path.join(startMenuDir, `${appName}.lnk`);
    const ps = `
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$sc.TargetPath = '${exePath.replace(/'/g, "''")}'
$sc.WorkingDirectory = '${path.dirname(exePath).replace(/'/g, "''")}'
$sc.IconLocation = '${(iconPath || exePath).replace(/'/g, "''")}'
$sc.Description = 'Novelva - AI 多语言阅读学习'
$sc.Save()
`;
    execSync(`powershell -NoProfile -Command "${ps.replace(/\n/g, ' ')}"`, {
      windowsHide: true,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  logTitle(`${APP_NAME} 安装程序`);

  // Step 1: Fetch latest release info
  log('正在获取最新版本信息...');
  let releaseInfo;
  try {
    const res = await httpsGet(GITHUB_API);
    const chunks = [];
    for await (const chunk of res) chunks.push(chunk);
    releaseInfo = JSON.parse(Buffer.concat(chunks).toString());
  } catch (err) {
    log(`❌ 无法获取版本信息: ${err.message}`);
    log('请检查网络连接后重试。');
    await ask('按回车键退出...');
    process.exit(1);
  }

  const version = releaseInfo.tag_name || releaseInfo.name || 'unknown';
  const assets = releaseInfo.assets || [];
  const zipAsset = assets.find((a) => a.name.endsWith('.zip') && a.name.includes('win32'));

  if (!zipAsset) {
    log(`❌ 未找到 Windows 安装包。`);
    log(`   Release: ${version}`);
    log(`   可用文件: ${assets.map((a) => a.name).join(', ') || '无'}`);
    await ask('按回车键退出...');
    process.exit(1);
  }

  log(`✓ 最新版本: ${version}`);
  log(`  安装包: ${zipAsset.name} (${(zipAsset.size / 1024 / 1024).toFixed(1)} MB)`);

  // Step 2: Choose install directory
  console.log('');
  log(`默认安装目录: ${DEFAULT_INSTALL_DIR}`);
  console.log('');

  const choice = await ask('请选择操作: [1] 使用默认目录  [2] 浏览选择目录  [3] 手动输入路径  [Q] 退出\n  > ');

  let installDir = DEFAULT_INSTALL_DIR;

  if (choice === '1' || choice === '') {
    installDir = DEFAULT_INSTALL_DIR;
  } else if (choice === '2') {
    const browsed = browseFolder(DEFAULT_INSTALL_DIR);
    if (!browsed) {
      log('未选择目录，使用默认目录。');
    } else {
      installDir = path.join(browsed, APP_NAME);
    }
  } else if (choice === '3') {
    const custom = await ask('请输入安装路径: ');
    if (custom) {
      installDir = custom;
    }
  } else if (choice.toLowerCase() === 'q') {
    log('安装已取消。');
    process.exit(0);
  }

  console.log('');
  log(`安装目录: ${installDir}`);
  const confirm = await ask('确认安装？ [Y/n] ');
  if (confirm.toLowerCase() === 'n') {
    log('安装已取消。');
    process.exit(0);
  }

  // Step 3: Create install directory
  try {
    fs.mkdirSync(installDir, { recursive: true });
  } catch (err) {
    log(`❌ 无法创建目录: ${err.message}`);
    await ask('按回车键退出...');
    process.exit(1);
  }

  // Step 4: Download
  const tempDir = path.join(os.tmpdir(), 'novelva-installer');
  fs.mkdirSync(tempDir, { recursive: true });
  const zipPath = path.join(tempDir, zipAsset.name);

  console.log('');
  log(`正在下载 ${zipAsset.name}...`);
  try {
    await downloadFile(zipAsset.browser_download_url, zipPath);
    log('✓ 下载完成');
  } catch (err) {
    log(`❌ 下载失败: ${err.message}`);
    await ask('按回车键退出...');
    process.exit(1);
  }

  // Step 5: Extract
  console.log('');
  const extractTempDir = path.join(tempDir, 'extracted');
  if (fs.existsSync(extractTempDir)) {
    fs.rmSync(extractTempDir, { recursive: true, force: true });
  }

  if (!extractZip(zipPath, extractTempDir)) {
    await ask('按回车键退出...');
    process.exit(1);
  }

  // Find the actual app directory inside the extracted ZIP
  // The ZIP typically contains a top-level folder like "Novelva-win32-x64"
  const extractedItems = fs.readdirSync(extractTempDir);
  let sourceDir = extractTempDir;
  if (extractedItems.length === 1) {
    const singleDir = path.join(extractTempDir, extractedItems[0]);
    if (fs.statSync(singleDir).isDirectory()) {
      sourceDir = singleDir;
    }
  }

  // Step 6: Copy files to install directory
  log('正在安装文件...');
  try {
    fs.cpSync(sourceDir, installDir, { recursive: true, force: true });
    log('✓ 文件安装完成');
  } catch (err) {
    log(`❌ 文件复制失败: ${err.message}`);
    await ask('按回车键退出...');
    process.exit(1);
  }

  // Step 7: Create shortcuts
  console.log('');
  const exePath = path.join(installDir, `${APP_NAME}.exe`);
  const iconPath = path.join(installDir, 'resources', 'icon.ico');

  if (fs.existsSync(exePath)) {
    const deskOk = createShortcut(exePath, APP_NAME, fs.existsSync(iconPath) ? iconPath : exePath);
    if (deskOk) log('✓ 已创建桌面快捷方式');

    const startOk = createStartMenuShortcut(exePath, APP_NAME, fs.existsSync(iconPath) ? iconPath : exePath);
    if (startOk) log('✓ 已创建开始菜单快捷方式');
  }

  // Step 8: Cleanup
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  // Done
  logTitle('安装完成！');
  log(`${APP_NAME} ${version} 已安装到:`);
  log(installDir);
  console.log('');

  const launchChoice = await ask('是否立即启动 Novelva？ [Y/n] ');
  if (launchChoice.toLowerCase() !== 'n') {
    if (fs.existsSync(exePath)) {
      log('正在启动...');
      spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref();
    }
  }

  log('感谢使用 Novelva！');
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n  ❌ 发生错误: ${err.message}`);
  const r = rl();
  r.question('  按回车键退出...', () => {
    r.close();
    process.exit(1);
  });
});
