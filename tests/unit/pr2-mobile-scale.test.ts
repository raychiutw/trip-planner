/**
 * PR 2 — Mobile type scale override 存在性測試
 * 確認 tokens.css 有 @media (max-width: 760px) 區塊包含 mobile type scale override
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const tokensPath = resolve(__dirname, '../../css/tokens.css');
const tokens = readFileSync(tokensPath, 'utf-8');

describe('tokens.css — mobile type scale override', () => {
  it('包含 mobile 字體縮放區塊', () => {
    // 確認 tokens.css 有 mobile-type-scale 相關 @media override
    expect(tokens).toContain('Mobile type scale');
  });

  it('mobile body font-size override 為 1rem (16px)', () => {
    // body 在 mobile 下改 1rem (16px)
    expect(tokens).toMatch(/@media \(max-width:\s*760px\)[\s\S]*?--mobile-font-size-body:\s*1rem/);
  });

  it('ocean-hero-title mobile 22px 已存在（≤760px hero title override）', () => {
    // 現有 hero title 在 760px 下已改 22px — 確認存在
    expect(tokens).toContain('font-size: 22px');
  });

  it('22px hero title 必須在 @media (max-width: 760px) 區塊內的 .ocean-hero-title scope 中', () => {
    // 更精準：font-size: 22px 必須出現在 760px media query 的 .ocean-hero-title rule 裡
    expect(tokens).toMatch(/@media\s*\(max-width:\s*760px\)[^{]*\{[^}]*\.ocean-hero-title[^}]*font-size:\s*22px/ms);
  });
});
