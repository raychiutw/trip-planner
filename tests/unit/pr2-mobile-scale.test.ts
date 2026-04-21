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

  it('ocean-hero-title mobile override 已存在（≤760px hero title override）', () => {
    // F003: DESIGN.md 規定 mobile hero title = 24px（原 22px 已更正）
    expect(tokens).toContain('font-size: 24px');
  });

  it('24px hero title 必須在 @media (max-width: 760px) 區塊內的 .ocean-hero-title scope 中', () => {
    // F003: 22px → 24px，符合 DESIGN.md mobile type scale 規範
    let found = false;
    const mediaRe = /@media\s*\(max-width:\s*760px\)/g;
    let m: RegExpExecArray | null;
    while ((m = mediaRe.exec(tokens)) !== null) {
      const slice = tokens.slice(m.index, m.index + 800);
      if (/\.ocean-hero-title[^}]*font-size:\s*24px/.test(slice)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
