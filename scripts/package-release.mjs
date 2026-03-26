#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Read version from package.json
const packagePath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
const version = packageJson.version;

// Paths
const outDir = path.join(projectRoot, 'out2');
const appDir = path.join(outDir, 'Novelva-win32-x64');
const releaseDir = path.join(outDir, 'release');

console.log(`📦 打包 Novelva v${version}...`);

try {
  // Check if app directory exists
  if (!fs.existsSync(appDir)) {
    console.error('❌ 错误: 找不到打包后的应用目录');
    console.log('   请先运行: npm run make');
    process.exit(1);
  }

  // Create release directory
  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }

  // Generate ZIP filename: Novelva-v1.1.0-win32-x64.zip
  const zipName = 'Novelva-v' + version + '-win32-x64.zip';
  const zipPath = path.join(releaseDir, zipName);

  console.log('🗜️  正在创建 ZIP: ' + zipName);

  // Use PowerShell to create ZIP (built-in, no dependencies)
  const psScript = '$sourcePath = \'' + appDir + '\'; $zipPath = \'' + zipPath + '\'; if (Test-Path $zipPath) { Remove-Item $zipPath -Force }; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($sourcePath, $zipPath)';

  execSync('powershell -Command "' + psScript + '"', { stdio: 'inherit' });

  // Verify ZIP was created
  if (fs.existsSync(zipPath)) {
    const stats = fs.statSync(zipPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
    console.log('✅ ZIP 创建成功!');
    console.log('   📁 文件: ' + zipPath);
    console.log('   📏 大小: ' + sizeMB + ' MB');
    console.log('');
    console.log('📤 现在可以将此文件上传到 GitHub Release:');
    console.log('   ' + zipName);
  } else {
    console.error('❌ ZIP 创建失败');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ 打包失败:', error.message);
  process.exit(1);
}
