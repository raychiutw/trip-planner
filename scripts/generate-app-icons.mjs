#!/usr/bin/env node
/**
 * generate-app-icons.mjs（#1573）
 * 從 scripts/app-icon/*.svg 重新產生 web 的所有圖示 PNG。
 *
 * 圖案與 App icon 同源：apple-touch-icon、PWA any／maskable 直接由 App 的 1024×1024 母圖縮出
 * （scripts/app-icon/source/flutter-app-icon-1024.png，來自 App repo raychiutw/trip-planner.flutter
 * commit a2151728，底色 #8A6038；App 票 #548 重新上色的產物）。母圖更新時整份覆蓋再重跑本腳本。
 * app-icon.svg 是同圖案的向量版，只供 OG 圖等需要向量的地方，並由測試與母圖比對守住一致。
 *
 *   母圖 PNG               滿版方形 → apple-touch-icon（180）、PWA any（192／512）
 *   母圖 PNG 縮到 84%      置中放在 #8A6038 底上，落在 maskable 安全圓（80%）內 → PWA maskable（192／512）
 *   favicon-16.svg         16 px 專用簡化版：加粗外框、縮小單一指針（原指針在 16 px 會糊成一團）
 *   images/favicon.svg     圓角版，直接作為 SVG favicon，並產生 32 px PNG
 *
 * 使用方式：node scripts/generate-app-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (name) => readFileSync(resolve(root, 'scripts/app-icon', name));
const job = (svg, size, out) =>
  sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(resolve(root, out));

const mother = resolve(root, 'scripts/app-icon/source/flutter-app-icon-1024.png');
const BRAND = '#8A6038';
const fromMother = (size, out) =>
  sharp(mother).resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(resolve(root, out));
const maskableFromMother = async (size, out) => {
  const inner = Math.round(size * 0.84);
  const pad = Math.floor((size - inner) / 2);
  const icon = await sharp(mother).resize(inner, inner, { kernel: 'lanczos3' }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: BRAND } })
    .composite([{ input: icon, left: pad, top: pad }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(root, out));
};

await Promise.all([
  fromMother(180, 'images/apple-touch-icon.png'),
  fromMother(192, 'public/icons/icon-192.png'),
  fromMother(512, 'public/icons/icon-512.png'),
  maskableFromMother(192, 'public/icons/icon-192-maskable.png'),
  maskableFromMother(512, 'public/icons/icon-512-maskable.png'),
  job(readFileSync(resolve(root, 'images/favicon.svg')), 32, 'images/favicon-32x32.png'),
  job(src('favicon-16.svg'), 16, 'images/favicon-16x16.png'),
]);
console.log('app icons regenerated');
