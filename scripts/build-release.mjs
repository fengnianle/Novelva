#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('🚀 开始构建发布包...');

try {
  // Step 1: Run npm run make
  console.log('\n📦 1/2 运行 npm run make...');
  execSync('npm run make', { stdio: 'inherit' });
  
  // Step 2: Run package script
  console.log('\n📦 2/2 创建 ZIP 发布包...');
  execSync('npm run package-release', { stdio: 'inherit' });
  
  console.log('\n✅ 构建完成!');
  console.log('📁 发布包位置: dist/release/');
  console.log('📤 可直接上传到 GitHub Release');
  
} catch (error) {
  console.error('\n❌ 构建失败:', error.message);
  process.exit(1);
}
