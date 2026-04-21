import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const HEADERS_FILE = readFileSync(
  resolve(__dirname, '../../public/_headers'),
  'utf-8'
)

describe('F004 — public/_headers /og/* Cache-Control', () => {
  it('必須含 /og/* rule', () => {
    expect(HEADERS_FILE).toContain('/og/*')
  })

  it('必須含 Cache-Control: public, max-age=86400', () => {
    expect(HEADERS_FILE).toContain('Cache-Control: public, max-age=86400')
  })

  it('必須含 X-Content-Type-Options: nosniff', () => {
    expect(HEADERS_FILE).toContain('X-Content-Type-Options: nosniff')
  })

  it('/og/* rule 必須在 /* 全域 rule 之前（更具體的規則優先）', () => {
    const ogIndex = HEADERS_FILE.indexOf('/og/*')
    const globalIndex = HEADERS_FILE.indexOf('/*')
    // og/* 比 /* 更具體，Cloudflare Pages 依序匹配
    // 確保 /og/* 在 /* 之前
    expect(ogIndex).toBeLessThan(globalIndex)
  })
})
