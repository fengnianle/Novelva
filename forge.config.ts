import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'node:path';
import fs from 'node:fs';

const config: ForgeConfig = {
  outDir: path.resolve(__dirname, 'dist'),
  packagerConfig: {
    asar: true,
    name: 'Novelva',
    executableName: 'Novelva',
    icon: path.resolve(__dirname, 'resources/icon'),
  },
  hooks: {
    postPackage: async (_config, result) => {
      // Copy runtime-required node_modules into resources/modules/node_modules/
      // so createRequire(resources/modules/package.json) can resolve them
      const outputPath = result.outputPaths[0];
      const modulesBase = path.join(outputPath, 'resources', 'modules');
      const nodeModulesDir = path.join(modulesBase, 'node_modules');
      const modulesToCopy = ['sql.js', 'adm-zip', 'pdf-parse', 'node-ensure'];
      for (const mod of modulesToCopy) {
        const src = path.resolve(__dirname, 'node_modules', mod);
        const dest = path.join(nodeModulesDir, mod);
        if (fs.existsSync(src)) {
          fs.cpSync(src, dest, { recursive: true });
          console.log(`  ✔ Copied ${mod} to resources/modules/node_modules/`);
        }
      }
      // Create a minimal package.json so createRequire can resolve from here
      fs.writeFileSync(
        path.join(modulesBase, 'package.json'),
        JSON.stringify({ name: 'novelva-modules', private: true }),
      );
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'Novelva',
      setupExe: 'Novelva-Setup.exe',
      setupIcon: path.resolve(__dirname, 'resources/icon.ico'),
      description: 'AI 多语言阅读学习桌面应用',
      authors: '非菓',
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
