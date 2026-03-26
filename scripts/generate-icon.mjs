import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'node:fs';
import path from 'node:path';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="48" fill="url(#bg)"/>
  <!-- Book shape -->
  <g transform="translate(128,118)" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M0,-50 C-20,-50 -60,-48 -70,-40 L-70,40 C-60,32 -20,34 0,42 C20,34 60,32 70,40 L70,-40 C60,-48 20,-50 0,-50Z"/>
    <line x1="0" y1="-50" x2="0" y2="42"/>
    <!-- Text lines on left page -->
    <line x1="-52" y1="-28" x2="-18" y2="-28" stroke-width="4" opacity="0.7"/>
    <line x1="-52" y1="-14" x2="-22" y2="-14" stroke-width="4" opacity="0.5"/>
    <line x1="-52" y1="0" x2="-26" y2="0" stroke-width="4" opacity="0.7"/>
    <line x1="-52" y1="14" x2="-20" y2="14" stroke-width="4" opacity="0.5"/>
    <!-- AI sparkle on right page -->
    <g transform="translate(35, -8)" fill="white" stroke="none" opacity="0.9">
      <polygon points="0,-18 4,-6 16,-6 6,2 10,14 0,6 -10,14 -6,2 -16,-6 -4,-6"/>
    </g>
  </g>
  <!-- "N" letter -->
  <text x="128" y="220" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="bold" fill="white" opacity="0.9">Novelva</text>
</svg>`;

const outDir = path.resolve(import.meta.dirname, '..', 'resources');
fs.mkdirSync(outDir, { recursive: true });

// Generate PNGs at multiple sizes
const sizes = [16, 32, 48, 64, 128, 256];
const pngBuffers = [];

for (const size of sizes) {
  const buf = await sharp(Buffer.from(SVG)).resize(size, size).png().toBuffer();
  pngBuffers.push(buf);
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), buf);
}

// Save 256px as the main icon.png
fs.writeFileSync(path.join(outDir, 'icon.png'), pngBuffers[pngBuffers.length - 1]);

// Generate ICO from the 256px PNG
const icoBuffer = await pngToIco(pngBuffers);
fs.writeFileSync(path.join(outDir, 'icon.ico'), icoBuffer);

console.log('Icons generated in resources/');
