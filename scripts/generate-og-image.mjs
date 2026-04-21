#!/usr/bin/env node
/**
 * generate-og-image.mjs
 * 生成靜態 brand OG image (1200x630 PNG)
 * 使用方式：node scripts/generate-og-image.mjs
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(__dirname, '../public/og/tripline-default.png')

// 確保目錄存在
mkdirSync(resolve(__dirname, '../public/og'), { recursive: true })

// SVG 模板（1200x630，Tripline brand OG image）
const svg = `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1200"
  height="630"
  viewBox="0 0 1200 630"
>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0077B6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#023E8A;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- 背景漸層 -->
  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- 裝飾圓圈 -->
  <circle cx="1100" cy="80" r="220" fill="rgba(255,255,255,0.05)" />
  <circle cx="980" cy="580" r="160" fill="rgba(255,255,255,0.04)" />
  <circle cx="50" cy="600" r="180" fill="rgba(255,255,255,0.03)" />

  <!-- 頂部細線（品牌線條） -->
  <rect x="80" y="80" width="60" height="6" rx="3" fill="rgba(255,255,255,0.7)" />

  <!-- 主標題：Tripline -->
  <text
    x="80"
    y="320"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="96"
    font-weight="800"
    fill="#FFFFFF"
    letter-spacing="-2"
  >Tripline</text>

  <!-- 副標題 -->
  <text
    x="80"
    y="400"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="36"
    font-weight="400"
    fill="rgba(255,255,255,0.85)"
    letter-spacing="0.5"
  >和旅伴一起查看精美行程</text>

  <!-- 飛機圖示（右下角裝飾） -->
  <text
    x="1100"
    y="560"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="72"
    text-anchor="middle"
    fill="rgba(255,255,255,0.15)"
  >✈</text>

  <!-- 網址（底部） -->
  <text
    x="80"
    y="570"
    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="22"
    font-weight="400"
    fill="rgba(255,255,255,0.5)"
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
