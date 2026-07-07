/**
 * buildPoiNote — 加 Google 景點時把 Place Details 營業時間 + 價位組成備註（2026-07-08）。
 */
import { describe, it, expect } from 'vitest';
import { buildPoiNote, priceLevelSymbol } from '../../src/lib/poiNote';
import { detectGarbledText } from '../../functions/api/_validate';

describe('priceLevelSymbol', () => {
  it('映射 Google 價位 enum → ￥ 符號', () => {
    expect(priceLevelSymbol('PRICE_LEVEL_INEXPENSIVE')).toBe('￥');
    expect(priceLevelSymbol('PRICE_LEVEL_MODERATE')).toBe('￥￥');
    expect(priceLevelSymbol('PRICE_LEVEL_EXPENSIVE')).toBe('￥￥￥');
    expect(priceLevelSymbol('PRICE_LEVEL_VERY_EXPENSIVE')).toBe('￥￥￥￥');
    expect(priceLevelSymbol('PRICE_LEVEL_FREE')).toBe('免費');
  });
  it('未知 / 空 → 空字串', () => {
    expect(priceLevelSymbol('PRICE_LEVEL_UNSPECIFIED')).toBe('');
    expect(priceLevelSymbol(null)).toBe('');
    expect(priceLevelSymbol(undefined)).toBe('');
  });
});

describe('buildPoiNote', () => {
  it('營業時間 + 價位 + 地址，各佔一行', () => {
    // Google Place Details (zh-TW) weekday_descriptions 格式為「星期一: …」
    const note = buildPoiNote({
      hoursRaw: '星期一: 11:00 – 21:00\n星期二: 11:00 – 21:00\n星期三: 11:00 – 21:00\n星期四: 11:00 – 21:00\n星期五: 11:00 – 21:00\n星期六: 11:00 – 21:00\n星期日: 11:00 – 21:00',
      priceLevel: 'PRICE_LEVEL_MODERATE',
      address: '沖繩縣那霸市',
    });
    // 全週一致 → condenseHours 壓成單一 range
    expect(note).toBe('營業 11:00 – 21:00\n消費 ￥￥\n沖繩縣那霸市');
  });

  it('只有價位 → 只出價位（+ 地址）', () => {
    expect(buildPoiNote({ priceLevel: 'PRICE_LEVEL_INEXPENSIVE', address: 'A 地址' }))
      .toBe('消費 ￥\nA 地址');
  });

  it('都沒有 detail → 只剩地址（沿用原行為）', () => {
    expect(buildPoiNote({ address: '只有地址' })).toBe('只有地址');
  });

  it('全空 → undefined（呼叫端不帶 note）', () => {
    expect(buildPoiNote({})).toBeUndefined();
    expect(buildPoiNote({ hoursRaw: '', priceLevel: null, address: '  ' })).toBeUndefined();
  });

  it('營業時間但無價位無地址 → 只出營業', () => {
    expect(buildPoiNote({ hoursRaw: '24 時間' })).toBe('營業 24 小時');
  });
});

describe('buildPoiNote — 價位符號不觸發後端 garbled guard（回歸）', () => {
  // 半形 ¥(U+00A5)×3+ 會踩 detectGarbledText 規則二 [U+0080-U+00FF]{3,}，導致
  // EXPENSIVE / VERY_EXPENSIVE 景點 entry POST 400（code review 抓到）。改用全形
  // ￥(U+FFE5) 後全 tier 不觸發 — 這裡用真的 detectGarbledText 鎖住。
  const TIERS = [
    'PRICE_LEVEL_FREE',
    'PRICE_LEVEL_INEXPENSIVE',
    'PRICE_LEVEL_MODERATE',
    'PRICE_LEVEL_EXPENSIVE',
    'PRICE_LEVEL_VERY_EXPENSIVE',
  ];
  it.each(TIERS)('%s 的備註不被判亂碼', (tier) => {
    const note = buildPoiNote({ priceLevel: tier, address: '沖繩縣那霸市' });
    expect(note).toBeTruthy();
    expect(detectGarbledText(note as string)).toBe(false);
  });
});
