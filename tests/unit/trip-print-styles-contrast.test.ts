/**
 * 分享頁／列印頁的靜態樣式對比守衛（#1423）。
 *
 * 這兩處的色值寫死在樣式字串裡（刻意固定淺色，像紙），不走 token，所以 tokens-css 測試與
 * e2e 的 mock 都碰不到：e2e 沒有分享頁的 mock，列印頁的金色星等也只在有評分時才出現。
 * 2026-10 全頁擷圖驗證才量到：白字疊 #A97A4A 3.77、白字疊分享 hero 漸層 #C49A6E 2.4、
 * 金色 #9A7B32 疊白紙 3.99。
 *
 * 直接從樣式字串取色、算對比；漸層取**兩端**，因為文字會落在中間任一位置。
 */
import { describe, it, expect } from 'vitest';
import { PRINT_CSS, SHARE_CHROME_CSS } from '../../src/lib/tripPrintStyles';
import { contrastRatio, cssRule } from './__helpers__/wcag';

const AA = 4.5;
const ratio = contrastRatio;
const rule = cssRule;
const hexes = (decl: string): string[] => [...decl.matchAll(/#[0-9a-fA-F]{3,6}\b/g)].map((m) => m[0]);

describe('分享／列印頁寫死色的對比（WCAG 1.4.3 AA 4.5:1）', () => {
  it('分享 hero：白字疊漸層的兩端都 ≥ 4.5（13px 小字會落在漸層中任一位置）', () => {
    const decl = rule(SHARE_CHROME_CSS, '.tp-share-hero');
    const stops = hexes(decl).filter((h) => h.toLowerCase() !== '#fff');
    expect(stops.length, '漸層應有兩個色標').toBeGreaterThanOrEqual(2);
    for (const s of stops) expect(ratio('#ffffff', s), `白字 / ${s}`).toBeGreaterThanOrEqual(AA);
  });

  it('分享 hero 的 eyebrow 與 meta 不再用 opacity 稀釋對比', () => {
    expect(rule(SHARE_CHROME_CSS, '.tp-share-eyebrow')).not.toMatch(/opacity/);
    expect(rule(SHARE_CHROME_CSS, '.tp-share-meta')).not.toMatch(/opacity/);
  });

  it('分享頁「複製到我的行程」按鈕：白字 / 背景（含 hover）≥ 4.5', () => {
    const base = rule(SHARE_CHROME_CSS, '.tp-share-copy');
    expect(ratio('#ffffff', hexes(base).find((h) => h.toLowerCase() !== '#fff')!)).toBeGreaterThanOrEqual(AA);
    const hover = rule(SHARE_CHROME_CSS, '.tp-share-copy:hover');
    expect(ratio('#ffffff', hexes(hover)[0])).toBeGreaterThanOrEqual(AA);
  });

  it('列印頁主按鈕：白字 / 背景 ≥ 4.5', () => {
    const bg = hexes(rule(PRINT_CSS, '.tp-print-btn-primary')).find((h) => h.toLowerCase() !== '#fff')!;
    expect(ratio('#ffffff', bg)).toBeGreaterThanOrEqual(AA);
  });

  it('列印頁星等金色疊白紙 ≥ 4.5', () => {
    const gold = hexes(rule(PRINT_CSS, '.tp-print-star'))[0];
    expect(ratio(gold, '#ffffff')).toBeGreaterThanOrEqual(AA);
  });
});
