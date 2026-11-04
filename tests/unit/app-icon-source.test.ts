/**
 * web 圖示與 App icon 同源的可驗證證據（#1573、App 票 trip-planner.flutter#548）。
 * scripts/app-icon/source/flutter-app-icon-1024.png 是 App repo iOS 的 1024 母圖原檔（來自 flutter commit a2151728、尚未合入 master，
 * 已由 #548 重新上色為 #8A6038）。web 用的 app-icon.svg 必須與它的圖案逐像素吻合（容許抗鋸齒），
 * 底色也必須相符——換成別的圖形或底色就會紅。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { coverage, diffStats } from './__helpers__/coverage'

const root = path.resolve(__dirname, '../..')
const raw = async (input: Buffer) => {
  const { data, info } = await sharp(input, { density: 72 }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, ch: info.channels, w: info.width }
}

describe('web App icon 與 App 母圖同源', () => {
  it('母圖是 1024×1024、底色為 #8A6038', async () => {
    const m = await raw(readFileSync(path.join(root, 'scripts/app-icon/source/flutter-app-icon-1024.png')))
    expect(m.w).toBe(1024)
    expect([...m.data.slice(0, 3)]).toEqual([0x8a, 0x60, 0x38])
  })

  it('app-icon.svg 的圖案與母圖逐像素相符（平均差 < 0.5%、嚴重差異像素 < 0.5%）', async () => {
    const m = await raw(readFileSync(path.join(root, 'scripts/app-icon/source/flutter-app-icon-1024.png')))
    const s = await raw(readFileSync(path.join(root, 'scripts/app-icon/app-icon.svg')))
    const st = diffStats(coverage(m.data, m.ch, 0x8a), coverage(s.data, s.ch, 0x8a))
    expect(st.mean).toBeLessThan(0.005)
    expect(st.badRatio).toBeLessThan(0.005)
  })
})
