#!/usr/bin/env node
/**
 * generate-app-icons.mjs（#1573）
 * 從 scripts/app-icon/*.svg 重新產生 web 的所有圖示 PNG。
 *
 * 圖案與 App icon 同源：米白（#FFFBF5）定位針外框 + 羅盤指針，底色 #8A6038。
 * app-icon.svg 由 App repo（raychiutw/trip-planner.flutter）iOS 的 1024×1024 圖示逐像素描摹而來，
 * 只換底色（App 票 #548 同步改為 #8A6038）；App 票留下可重產的原檔後，改引用那份。
 *
 *   app-icon.svg           滿版方形 → apple-touch-icon（180）、PWA any（192／512）
 *   app-icon-maskable.svg  內容縮到 84%，落在 maskable 安全圓（80%）內 → PWA maskable（192／512）
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

await Promise.all([
  job(src('app-icon.svg'), 180, 'images/apple-touch-icon.png'),
  job(src('app-icon.svg'), 192, 'public/icons/icon-192.png'),
  job(src('app-icon.svg'), 512, 'public/icons/icon-512.png'),
  job(src('app-icon-maskable.svg'), 192, 'public/icons/icon-192-maskable.png'),
  job(src('app-icon-maskable.svg'), 512, 'public/icons/icon-512-maskable.png'),
  job(readFileSync(resolve(root, 'images/favicon.svg')), 32, 'images/favicon-32x32.png'),
  job(src('favicon-16.svg'), 16, 'images/favicon-16x16.png'),
]);
console.log('app icons regenerated');
