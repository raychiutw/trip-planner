/**
 * OG 分享圖為品牌棕底 + App icon（#1574，對應 App 票 trip-planner.flutter#548、父 spec #554）。
 * 守門：1200×630、底色 #8A6038 純色（不是舊的藍色漸層）、有 icon 與文字的米白像素、
 * 米白對底色對比 ≥ 4.5、沒有藍色像素（舊漸層／飛機剪影殘留）、og:image 與 twitter:image 指向它且全站無第二張舊圖。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { PNG } from 'pngjs'
import { contrastRatio } from './__helpers__/wcag'

const ROOT = resolve(__dirname, '../..')
const img = PNG.sync.read(readFileSync(join(ROOT, 'public/og/tripline-default.png')))
const px = (x: number, y: number) => {
  const i = (img.width * y + x) * 4
  return [img.data[i], img.data[i + 1], img.data[i + 2]]
}
const hex = (c: number[]) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()

describe('OG 分享圖', () => {
  it('尺寸 1200×630', () => {
    expect([img.width, img.height]).toEqual([1200, 630])
  })

  it('底色是 #8A6038 純色：四角與中央空白處一致（沒有漸層）', () => {
    for (const [x, y] of [[2, 2], [1197, 2], [2, 627], [1197, 627], [1000, 100], [700, 560], [30, 315]]) {
      expect(hex(px(x, y)), `(${x},${y})`).toBe('#8A6038')
    }
  })

  it('米白（#FFFBF5）像素同時出現在 icon 區與文字區', () => {
    const cream = (x0: number, x1: number) => {
      let n = 0
      for (let y = 0; y < img.height; y++)
        for (let x = x0; x < x1; x++) if (hex(px(x, y)) === '#FFFBF5') n++
      return n
    }
    expect(cream(110, 410), 'icon 區').toBeGreaterThan(5000)
    expect(cream(480, 1000), '文字區').toBeGreaterThan(5000)
  })

  it('文字（米白）對底色 ≥ 4.5:1', () => {
    expect(contrastRatio('#FFFBF5', '#8A6038')).toBeGreaterThanOrEqual(4.5)
  })

  it('沒有藍色像素（舊藍色漸層與飛機元素不可殘留）', () => {
    let blue = 0
    for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 2] > img.data[i] + 20) blue++
    expect(blue).toBe(0)
  })

  it('生成腳本不含舊的藍色漸層與飛機符號', () => {
    const s = readFileSync(join(ROOT, 'scripts/generate-og-image.mjs'), 'utf-8')
    expect(s).not.toMatch(/0077B6|023E8A|linearGradient|✈/)
  })
})

describe('og:image／twitter:image 引用', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf-8')
  const url = 'https://trip-planner-dby.pages.dev/og/tripline-default.png'

  it('og:image 與 twitter:image 都指向新圖，尺寸 meta 是 1200×630', () => {
    expect(html).toContain(`property="og:image" content="${url}"`)
    expect(html).toContain(`name="twitter:image" content="${url}"`)
    expect(html).toContain('property="og:image:width" content="1200"')
    expect(html).toContain('property="og:image:height" content="630"')
  })

  it('public/og 只有這一張圖，沒有其他 OG 圖引用（functions／src／index.html）', () => {
    expect(readdirSync(join(ROOT, 'public/og'))).toEqual(['tripline-default.png'])
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        const p = join(d, n)
        return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|html)$/.test(n) ? [p] : []
      })
    const files = [join(ROOT, 'index.html'), ...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'functions'))]
    const pngRefs = files.flatMap((f) => [...readFileSync(f, 'utf-8').matchAll(/og\/[\w-]+\.(?:png|jpg|webp)/g)].map((m) => m[0]))
    expect([...new Set(pngRefs)]).toEqual(['og/tripline-default.png'])
  })
})
