/**
 * destinationTone() — 行程一覽「依目的地三色切換」(v2.54.8)。
 *
 * 行程卡依目的地（countries）上 tone：常見國家錨定（日本=accent 柔褐、台灣=sage、
 * 韓國=pink），其餘國家 deterministic hash 穩定輪替這三色（不固定哪國哪色，但每國
 * 穩定一色、可擴到任何國家）。沿用 coverClass 的 .includes(code) 判定與 JP>KR>TW 優先序。
 */
import { describe, it, expect } from 'vitest';
import { destinationTone } from '../../src/pages/TripsListPage';

describe('destinationTone — 依目的地三色', () => {
  it('錨定常見國家：日本→accent、台灣→sage、韓國→pink', () => {
    expect(destinationTone('JP')).toBe('accent');
    expect(destinationTone('TW')).toBe('sage');
    expect(destinationTone('KR')).toBe('pink');
  });

  it('大小寫不敏感 + 含子字串即判定（對齊 coverClass）', () => {
    expect(destinationTone('jp')).toBe('accent');
    expect(destinationTone(' Jp ')).toBe('accent');
    expect(destinationTone('JPN')).toBe('accent'); // includes 'JP'
  });

  it('多國行程依 JP>KR>TW 優先序（對齊 coverClass）', () => {
    expect(destinationTone('JP,TW')).toBe('accent'); // JP 先中
    expect(destinationTone('KR,TW')).toBe('pink');   // KR 先於 TW
  });

  it('空 / null → accent（柔褐，主色預設）', () => {
    expect(destinationTone('')).toBe('accent');
    expect(destinationTone(null)).toBe('accent');
    expect(destinationTone(undefined)).toBe('accent');
  });

  it('未錨定國家 → 三色之一，且每國穩定（deterministic hash）', () => {
    const tones = new Set(['accent', 'sage', 'pink']);
    for (const c of ['TH', 'FR', 'US', 'VN', 'IT', 'ES', 'AU', 'SG']) {
      const t = destinationTone(c);
      expect(tones.has(t)).toBe(true); // 只會是三色，不落 neutral（b 方案不留灰）
      expect(destinationTone(c)).toBe(t); // 同輸入同輸出（穩定）
    }
  });

  it('hash 有實際分布（不是全部落同一色）', () => {
    const got = new Set(
      ['TH', 'FR', 'US', 'VN', 'IT', 'ES', 'AU', 'SG', 'DE', 'NL', 'CH', 'PT'].map(destinationTone),
    );
    expect(got.size).toBeGreaterThanOrEqual(2); // 至少用到 2 種色（避免退化成單色）
  });
});
