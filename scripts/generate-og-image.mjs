#!/usr/bin/env node
/**
 * generate-og-image.mjs
 * 生成靜態 brand OG image (1200x630 PNG)：品牌棕底 #8A6038 + App icon + 「Tripline」與副標（#1574）。
 * App icon 圖案取自 scripts/app-icon/app-icon.svg（與 favicon／PWA 同源，見 generate-app-icons.mjs）。
 * 文字用系統字型渲染（macOS：Helvetica Neue／PingFang TC），換機器重產時字型可能略有差異。
 * 使用方式：node scripts/generate-og-image.mjs
 */

import sharp from 'sharp'
import { mkdirSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(__dirname, '../public/og/tripline-default.png')

// 確保目錄存在
mkdirSync(resolve(__dirname, '../public/og'), { recursive: true })

const BROWN = '#8A6038'
const CREAM = '#FFFBF5' // 米白，對 #8A6038 對比約 5.35:1（≥ 4.5）

// App icon 內層圖案（拿掉外層 <svg>，改嵌進 OG 版面；viewBox 1024）
const iconInner = readFileSync(resolve(__dirname, 'app-icon/app-icon.svg'), 'utf-8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<rect[^>]*\/>/, '') // 底色由 OG 版面的圓角底提供

const ICON = 300
const ICON_X = 110
const ICON_Y = (630 - ICON) / 2

const FONT = "'Helvetica Neue', Helvetica, 'PingFang TC', 'Noto Sans TC', Arial, sans-serif"

// SVG 模板（1200x630）
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BROWN}" />

  <!-- App icon：品牌棕圓角底（加一圈淡邊讓圓角可辨）+ 米白定位針與羅盤指針 -->
  <rect x="${ICON_X}" y="${ICON_Y}" width="${ICON}" height="${ICON}" rx="${ICON * 0.22}" fill="${BROWN}" stroke="${CREAM}" stroke-opacity="0.45" stroke-width="4" />
  <svg x="${ICON_X}" y="${ICON_Y}" width="${ICON}" height="${ICON}" viewBox="0 0 1024 1024">${iconInner}</svg>

  <!-- 主標題 -->
  <text x="490" y="330" font-family="${FONT}" font-size="124" font-weight="800" fill="${CREAM}" letter-spacing="-2">Tripline</text>

  <!-- 副標題 -->
  <text x="494" y="410" font-family="${FONT}" font-size="40" font-weight="400" fill="${CREAM}" letter-spacing="0.5">和旅伴一起查看精美行程</text>
</svg>`

sharp(Buffer.from(svg, 'utf-8'))
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
