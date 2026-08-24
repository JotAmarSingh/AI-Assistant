import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SVG_SOURCE = path.resolve('public/icon.svg');

if (!fs.existsSync(SVG_SOURCE)) {
  console.error('❌ Source SVG not found at:', SVG_SOURCE);
  process.exit(1);
}

const svgBuffer = fs.readFileSync(SVG_SOURCE);

console.log('🎨 Generating DayTrace PNG assets from source SVG...');

// 1. Web & PWA Icons
const webIcons = [
  { path: 'public/pwa-192x192.png', size: 192 },
  { path: 'public/pwa-512x512.png', size: 512 },
  { path: 'public/maskable-icon-512x512.png', size: 512 },
  { path: 'public/apple-touch-icon.png', size: 180 },
];

// 2. Android App Launcher Mipmaps
const androidMipmaps = [
  { dir: 'android/app/src/main/res/mipmap-mdpi', size: 48 },
  { dir: 'android/app/src/main/res/mipmap-hdpi', size: 72 },
  { dir: 'android/app/src/main/res/mipmap-xhdpi', size: 96 },
  { dir: 'android/app/src/main/res/mipmap-xxhdpi', size: 144 },
  { dir: 'android/app/src/main/res/mipmap-xxxhdpi', size: 192 },
];

// 3. Android Splash Drawables
const androidSplashDrawables = [
  { path: 'android/app/src/main/res/drawable/splash.png', width: 480, height: 800 },
  { path: 'android/app/src/main/res/drawable-port-mdpi/splash.png', width: 320, height: 480 },
  { path: 'android/app/src/main/res/drawable-port-hdpi/splash.png', width: 480, height: 800 },
  { path: 'android/app/src/main/res/drawable-port-xhdpi/splash.png', width: 720, height: 1280 },
  { path: 'android/app/src/main/res/drawable-port-xxhdpi/splash.png', width: 960, height: 1600 },
  { path: 'android/app/src/main/res/drawable-port-xxxhdpi/splash.png', width: 1280, height: 1920 },
  { path: 'android/app/src/main/res/drawable-land-mdpi/splash.png', width: 480, height: 320 },
  { path: 'android/app/src/main/res/drawable-land-hdpi/splash.png', width: 800, height: 480 },
  { path: 'android/app/src/main/res/drawable-land-xhdpi/splash.png', width: 1280, height: 720 },
  { path: 'android/app/src/main/res/drawable-land-xxhdpi/splash.png', width: 1600, height: 960 },
];

async function generateAll() {
  // Sync daytrace-ai.webp to public/assets/ if placed in root assets/
  const rootAsset = path.resolve('assets/daytrace-ai.webp');
  const publicAsset = path.resolve('public/assets/daytrace-ai.webp');
  if (fs.existsSync(rootAsset)) {
    fs.mkdirSync(path.dirname(publicAsset), { recursive: true });
    fs.copyFileSync(rootAsset, publicAsset);
    console.log('   ✓ Synced assets/daytrace-ai.webp -> public/assets/daytrace-ai.webp');
  }

  // Generate Android Mipmaps
  for (const m of androidMipmaps) {
    const dir = path.resolve(m.dir);
    fs.mkdirSync(dir, { recursive: true });

    // ic_launcher.png
    await sharp(svgBuffer)
      .resize(m.size, m.size)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // ic_launcher_round.png
    await sharp(svgBuffer)
      .resize(m.size, m.size)
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png
    await sharp(svgBuffer)
      .resize(Math.round(m.size * 1.5), Math.round(m.size * 1.5))
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`   ✓ Generated mipmap in ${m.dir} (${m.size}px)`);
  }

  // Generate Android Splash Drawables
  for (const splash of androidSplashDrawables) {
    const dest = path.resolve(splash.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    // Splash: Dark background #111318 with centered logo
    const iconSize = Math.min(splash.width, splash.height) * 0.4;
    const resizedIcon = await sharp(svgBuffer)
      .resize(Math.round(iconSize), Math.round(iconSize))
      .toBuffer();

    await sharp({
      create: {
        width: splash.width,
        height: splash.height,
        channels: 4,
        background: { r: 17, g: 19, b: 24, alpha: 1 },
      },
    })
      .composite([{ input: resizedIcon, gravity: 'centre' }])
      .png()
      .toFile(dest);

    console.log(`   ✓ Generated splash drawable: ${splash.path}`);
  }

  console.log('✅ All PNG assets successfully compiled from vector SVG!');
}

generateAll().catch((err) => {
  console.error('❌ Failed to generate assets:', err);
  process.exit(1);
});
