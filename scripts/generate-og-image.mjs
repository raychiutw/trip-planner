#!/usr/bin/env node
/**
 * generate-og-image.mjs
 * 生成靜態 brand OG image (1200x630 PNG) — 2026-11：品牌棕 #8A6038 + App icon。
 * 使用方式：node scripts/generate-og-image.mjs
 *
 * 滿足 raychiutw/trip-planner#1574：品牌棕底、App icon、Tripline 字樣與副標，
 * 1200x630；白字疊 #8A6038 = 5.51:1（tokens.css 已驗證的 AA 對比）。
 * 不再使用藍色漸層與飛機元素。
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(__dirname, '../public/og/tripline-default.png')

// 確保目錄存在
mkdirSync(resolve(__dirname, '../public/og'), { recursive: true })

const BRAND = '#8A6038'   // brand brown (web --color-accent-fill / flutter#548)
const CREAM = '#FFFBF5'   // 米白 (web --color-background)

// App icon 同源幾何（與 scripts/generate-web-icons.mjs 共用 pin + 羅盤指針）
const pinPath =
  'M60 0 C22 0 0 22 0 60 C0 127 51 177 56 181 C58 183 62 183 64 181 C69 177 120 127 120 60 C120 22 98 0 60 0 Z'

function appIconMark(size) {
  return `<g transform="translate(${60 - size / 2} ${60 - size / 2}) scale(${size / 120})">
    <path d="${pinPath}" fill="none" stroke="${CREAM}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M60 26 L73 41 L60 56 L47 41 Z" fill="${CREAM}"/>
  </g>`
}

// SVG 模板（1200x630，Tripline brand OG image）
const svg = `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1200"
  height="630"
  viewBox="0 0 1200 630"
>
  <!-- 品牌棕純色底 -->
  <rect width="1200" height="630" fill="${BRAND}" />

  <!-- 裝飾圓圈（低對比，保持版面呼吸感） -->
  <circle cx="1080" cy="70" r="220" fill="rgba(255,251,245,0.05)" />
  <circle cx="960" cy="600" r="180" fill="rgba(255,251,245,0.04)" />
  <circle cx="70" cy="580" r="150" fill="rgba(255,251,245,0.03)" />

  <!-- App icon 圖案（右上） -->
  <g transform="translate(930 215)">${appIconMark(200)}</g>

  <!-- 主標題：Tripline -->
  <text
    x="90"
    y="300"
    font-family="'WenQuanYi Zen Hei', 'Noto Sans TC', 'PingFang TC', 'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="96"
    font-weight="800"
    fill="${CREAM}"
    letter-spacing="-2"
  >Tripline</text>

  <!-- 副標題 -->
  <text
    x="90"
    y="382"
    font-family="'WenQuanYi Zen Hei', 'Noto Sans TC', 'PingFang TC', 'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="36"
    font-weight="400"
    fill="${CREAM}"
    opacity="0.92"
    letter-spacing="0.5"
  >和旅伴一起查看精美行程</text>

  <!-- 網址（底部） -->
  <text
    x="90"
    y="560"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="22"
    font-weight="400"
    fill="${CREAM}"
    opacity="0.7"
    letter-spacing="0.5"
  >trip-planner-dby.pages.dev</text>
</svg>`

// 轉換 SVG → PNG
const svgBuffer = Buffer.from(svg, 'utf-8')

sharp(svgBuffer)
  .png({ compressionLevel: 9 })
  .toFile(OUTPUT_PATH)
  .then((info) => {
    const sizeKB = (info.size / 1024).toFixed(1)
    console.log(`✓ OG image 生成成功：${OUTPUT_PATH}`)
    console.log(`  尺寸：${info.width}x${info.height}，大小：${sizeKB} KB`)
  })
  .catch((err) => {
    console.error('OG image 生成失敗：', err)
    process.exit(1)
  })
