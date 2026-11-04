/**
 * OG 分享圖為品牌棕底 + App icon（#1574，對應 App 票 trip-planner.flutter#548、父 spec #554）。
 * 守門：1200×630、底色 #8A6038 純色（不是舊的藍色漸層）、有 icon 與文字的米白像素、
 * 米白對底色對比 ≥ 4.5、沒有藍色像素（舊漸層／飛機剪影殘留）、og:image 與 twitter:image 指向它且全站無第二張舊圖。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { PNG } from 'pngjs'
import sharp from 'sharp'
import { contrastRatio } from './__helpers__/wcag'
import { coverage, diffStats } from './__helpers__/coverage'

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

  it('icon 區的圖案與 app-icon.svg 渲染結果逐像素相符（換成別的圖形會紅）', async () => {
    const SIZE = 300
    const { data, info } = await sharp(join(ROOT, 'scripts/app-icon/app-icon.svg'), { density: 72 })
      .resize(SIZE, SIZE).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const want = coverage(data, info.channels, 0x8a)
    const got = new Float32Array(SIZE * SIZE)
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) got[y * SIZE + x] = coverage(Uint8Array.of(px(110 + x, 165 + y)[0]), 1, 0x8a)[0]
    // 圓角與外框屬於 OG 版面、不屬於圖案：只比內縮 30px 的方形內部
    const inner = (a: Float32Array) => {
      const o: number[] = []
      for (let y = 30; y < SIZE - 30; y++) for (let x = 30; x < SIZE - 30; x++) o.push(a[y * SIZE + x])
      return Float32Array.from(o)
    }
    const st = diffStats(inner(want), inner(got))
    expect(st.mean).toBeLessThan(0.01)
    expect(st.badRatio).toBeLessThan(0.01)
  })

  it('標題「Tripline」與副標的字形幾何特徵（欄位分段數、橫向與縱向範圍）', () => {
    const cream = (x: number, y: number) => px(x, y)[0] > 200 && px(x, y)[2] > 200
    const runs = (y0: number, y1: number) => {
      const r: Array<[number, number]> = []
      let s = -1
      for (let x = 480; x <= 1200; x++) {
        let on = false
        for (let y = y0; y < y1 && !on; y++) on = x < 1200 && cream(x, y)
        if (on && s < 0) s = x
        if (!on && s >= 0) { r.push([s, x - 1]); s = -1 }
      }
      return r
    }
    const rows = (y0: number, y1: number) => {
      const r: number[] = []
      for (let y = y0; y < y1; y++) for (let x = 480; x < 1200; x++) if (cream(x, y)) { r.push(y); break }
      return [r[0], r[r.length - 1]]
    }
    const near = (v: number, t: number, tol = 8) => Math.abs(v - t) <= tol
    const t = runs(210, 345)
    expect(t.length, '標題欄位分段').toBe(7)
    expect(near(t[0][0], 492) && near(t[t.length - 1][1], 900), '標題橫向範圍').toBe(true)
    expect(near(rows(210, 345)[0], 242) && near(rows(210, 345)[1], 344), '標題縱向範圍').toBe(true)
    const s = runs(370, 420)
    expect(s.length, '副標欄位分段').toBeGreaterThanOrEqual(12)
    expect(near(s[0][0], 496) && near(s[s.length - 1][1], 936), '副標橫向範圍').toBe(true)
    expect(near(rows(370, 420)[0], 377) && near(rows(370, 420)[1], 413), '副標縱向範圍').toBe(true)
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
