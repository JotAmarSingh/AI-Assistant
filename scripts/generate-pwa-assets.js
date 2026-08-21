import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('./public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Master SVG design for the App Icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#111318" />
      <stop offset="50%" stop-color="#1D2026" />
      <stop offset="100%" stop-color="#0c0e14" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#D1E1FF" />
      <stop offset="100%" stop-color="#4B82C8" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8BB2F9" />
      <stop offset="100%" stop-color="#00478D" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background rounded squircle -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />
  <rect width="504" height="504" x="4" y="4" rx="108" fill="none" stroke="#334867" stroke-width="6" opacity="0.6" />

  <!-- Outer Dial Ring -->
  <circle cx="256" cy="256" r="168" fill="none" stroke="#2E3036" stroke-width="14" />
  <circle cx="256" cy="256" r="168" fill="none" stroke="url(#accentGrad)" stroke-width="14" stroke-dasharray="750 350" stroke-linecap="round" filter="url(#glow)" />

  <!-- Hour ticks -->
  <circle cx="256" cy="112" r="6" fill="#D1E1FF" />
  <circle cx="400" cy="256" r="6" fill="#D1E1FF" />
  <circle cx="256" cy="400" r="6" fill="#D1E1FF" />
  <circle cx="112" cy="256" r="6" fill="#D1E1FF" />

  <!-- Central Dynamic Lightning & Focus Symbol -->
  <path d="M276 148 L196 272 L248 272 L236 364 L316 240 L264 240 Z" fill="url(#accentGrad)" filter="url(#glow)" />
</svg>`;

// Maskable full bleed SVG for Android adaptive icons
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#111318" />
      <stop offset="50%" stop-color="#1D2026" />
      <stop offset="100%" stop-color="#0c0e14" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#D1E1FF" />
      <stop offset="100%" stop-color="#4B82C8" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Full bleed square for maskable icon -->
  <rect width="512" height="512" fill="url(#bgGrad)" />

  <!-- Inner safe zone artwork (within 80% circle) -->
  <circle cx="256" cy="256" r="140" fill="none" stroke="#2E3036" stroke-width="12" />
  <circle cx="256" cy="256" r="140" fill="none" stroke="url(#accentGrad)" stroke-width="12" stroke-dasharray="600 300" stroke-linecap="round" filter="url(#glow)" />

  <path d="M272 168 L208 268 L250 268 L240 344 L304 244 L262 244 Z" fill="url(#accentGrad)" filter="url(#glow)" />
</svg>`;

async function buildIcons() {
  const svgBuffer = Buffer.from(svgIcon);
  const maskableBuffer = Buffer.from(maskableSvg);

  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgIcon);

  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192x192.png'));
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512x512.png'));
  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(maskableBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'maskable-icon-512x512.png'));

  console.log('Successfully generated PWA icon assets in /public');
}

buildIcons().catch(console.error);
