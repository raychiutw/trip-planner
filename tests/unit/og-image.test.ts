import { describe, it, expect } from 'vitest'
import { existsSync, statSync } from 'fs'
import { resolve } from 'path'

const OG_IMAGE_PATH = resolve(__dirname, '../../public/og/tripline-default.png')
const ogStats = existsSync(OG_IMAGE_PATH) ? statSync(OG_IMAGE_PATH) : null

describe('F001 — 靜態 brand OG image', () => {
  it('public/og/tripline-default.png 必須存在', () => {
    expect(existsSync(OG_IMAGE_PATH)).toBe(true)
  })

  it('檔案大小必須大於 10 KB（確保不是空檔）', () => {
    expect(ogStats?.size).toBeGreaterThan(10 * 1024)
  })

  it('檔案大小必須小於 500 KB（確保合理壓縮）', () => {
    expect(ogStats?.size).toBeLessThan(500 * 1024)
  })
})
