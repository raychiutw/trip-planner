import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const INDEX_HTML = readFileSync(
  resolve(__dirname, '../../index.html'),
  'utf-8'
)

describe('F002 — index.html OG + Twitter card meta', () => {
  it('必須含 og:image meta tag', () => {
    expect(INDEX_HTML).toContain('property="og:image"')
  })

  it('og:image 必須指向 tripline-default.png', () => {
    expect(INDEX_HTML).toContain('tripline-default.png')
  })

  it('必須含 og:image:width = 1200', () => {
    expect(INDEX_HTML).toContain('property="og:image:width" content="1200"')
  })

  it('必須含 og:image:height = 630', () => {
    expect(INDEX_HTML).toContain('property="og:image:height" content="630"')
  })

  it('必須含 twitter:card = summary_large_image', () => {
    expect(INDEX_HTML).toContain('name="twitter:card"')
    expect(INDEX_HTML).toContain('summary_large_image')
  })

  it('必須含 twitter:title', () => {
    expect(INDEX_HTML).toContain('name="twitter:title"')
  })

  it('必須含 twitter:description', () => {
    expect(INDEX_HTML).toContain('name="twitter:description"')
  })

  it('必須含 twitter:image', () => {
    expect(INDEX_HTML).toContain('name="twitter:image"')
  })

  it('og:title 只能出現一次（不重複）', () => {
    const matches = INDEX_HTML.match(/property="og:title"/g) ?? []
    expect(matches.length).toBe(1)
  })

  it('og:description 只能出現一次（不重複）', () => {
    const matches = INDEX_HTML.match(/property="og:description"/g) ?? []
    expect(matches.length).toBe(1)
  })
})
