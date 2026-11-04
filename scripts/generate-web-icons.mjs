#!/usr/bin/env node
/**
 * generate-web-icons.mjs
 * 產生 Trip-Planner 全部的 web 圖示，圖案與 App icon 同源（flutter#548 拍板的
 * 米白定位針外框 + 羅盤指針，底色 #8A6038）。
 *
 * 幾何資料來源：從 raychiutw/trip-planner.flutter iOS 1024 App icon 量測
 * （pin: 頭部圓心約 (512, 435) r≈342，尖端 (512, 933)；羅盤為朝右上 45° 的菱形）。
 *
 * 用法：node scripts/generate-web-icons.mjs
 * 產出：
 *   images/favicon.svg
 *   images/favicon-16x16.png   （16px 簡化版：只留 pin 輪廓 + 圓點，羅盤 16px 會糊）
 *   images/favicon-32x32.png
 *   images/apple-touch-icon.png（180）
 *   images/icon-192.png / images/icon-512.png（PWA any，與 App icon 同構）
 *   public/icons/icon-192.png / icon-512.png（PWA any）
 *   public/icons/icon-192-maskable.png / icon-512-maskable.png（safe-zone 縮放）
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const BRAND = '#8A6038'    // web --color-accent-fill / flutter#548 single tint
const CREAM = '#FFFBF5'    // web --color-background / App icon 米白

/** Full-bleed App icon SVG (pin + compass). vw=1024 viewBox. */
function pinSvg({ scale = 1, cx = 512, cy = 450, simplified = false } = {}) {
  // Pin outline: head circle center (512,435) r=342 + tail to tip (512,933).
  // Scaled/translated via transform group.
  const pinPath =
    'M512 94 C710 94 854 238 854 435 C854 660 620 880 520 930 C514 933 510 933 512 930 ' +
    'C404 880 170 660 170 435 C170 238 314 94 512 94 Z'
  const diamond = simplified
    ? '' // simplified 16px: no compass, replaced by dot below
    : `<path d="M512 205 L622 330 L512 455 L402 330 Z" fill="${CREAM}"/>`
  const dot = simplified
    ? `<circle cx="512" cy="330" r="46" fill="${CREAM}"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="${BRAND}"/>
  <g transform="translate(${cx - 512} ${cy - 512}) scale(${scale})">
    <path d="${pinPath}" fill="none" stroke="${CREAM}" stroke-width="76" stroke-linejoin="round" stroke-linecap="round"/>
    ${diamond}
    ${dot}
  </g>
</svg>`
}

/** Maskable-safe icon: motif occupies ~66% of canvas (safe zone ~80% circle). */
function maskableSvg() {
  // Whole-app-icon on full canvas, but content shrunk to safe zone:
  // scale pin so its height (~840/1024) maps to 0.62 * canvas and center it.
  const s = 0.62
  // pin native spans y 94..933 (center 513.5, height 839). After scale -> 520.
  const scaledH = 839 * s
  const cy = (1024 + scaledH) / 2 + 0  // vertically center the pin
  const cx = 512
  return pinSvg({ scale: s, cx, cy })
}

const outputs = [
  // full-bleed app-icon style (PWA any, apple-touch, favicon large)
  ['images/favicon.svg', pinSvg(), 'svg'],
  ['images/favicon-32x32.png', pinSvg(), 'png32'],
  ['images/apple-touch-icon.png', pinSvg(), 'png180'],
  // PWA icons live in public/icons ONLY (manifest references /icons/*) — images/icon-* removed as duplicates (#1573)
  ['public/icons/icon-192.png', pinSvg(), 'png192'],
  ['public/icons/icon-512.png', pinSvg(), 'png512'],
  // maskable safe-zone variants
  ['public/icons/icon-192-maskable.png', maskableSvg(), 'png192'],
  ['public/icons/icon-512-maskable.png', maskableSvg(), 'png512'],
  // simplified 16px (pin + dot; compass needle unreadable at 16px)
  ['images/favicon-16x16.png', pinSvg({ simplified: true }), 'png16'],
]

async function render() {
  for (const [rel, svg, kind] of outputs) {
    const out = join(ROOT, rel)
    mkdirSync(dirname(out), { recursive: true })
    if (kind === 'svg') {
      await sharp(Buffer.from(svg)).png().toFile('/dev/null') // syntax smoke test
      const fs = await import('fs/promises')
      await fs.writeFile(out, svg)
      console.log(`✓ ${rel} (svg)`)
      continue
    }
    const size = parseInt(kind.replace('png', ''), 10)
    await sharp(Buffer.from(svg)).resize(size, size, { fit: 'fill' }).png({ compressionLevel: 9 }).toFile(out)
    console.log(`✓ ${rel} (${size}x${size})`)
  }
}

render().catch((e) => { console.error(e); process.exit(1) })
