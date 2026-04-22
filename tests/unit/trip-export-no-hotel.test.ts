/**
 * trip-export-no-hotel.test.ts — R19 TDD red test
 *
 * 驗證 tripExport.ts 的 Markdown 與 CSV 匯出不再獨立輸出「住宿」段落與「退房時間」，
 * 住宿資訊由 timeline 首 entry（R19 check-out entry）承載，無需重複匯出。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const exportPath = join(process.cwd(), 'src', 'lib', 'tripExport.ts');
const src = readFileSync(exportPath, 'utf-8');

describe('tripExport — 移除獨立住宿區塊 (R19)', () => {
  it('Markdown 匯出不含「🏨 住宿：」段落 header', () => {
    const match = src.match(/🏨\s*住宿[：:]/);
    expect(match).toBeNull();
  });

  it('Markdown 匯出不含「🛍 住宿附近購物」區塊 header', () => {
    const match = src.match(/🛍\s*住宿附近購物/);
    expect(match).toBeNull();
  });

  it('Markdown 匯出不含「退房：」段落', () => {
    const match = src.match(/退房[：:]\s*\$\{/);
    expect(match).toBeNull();
  });

  it('CSV header 不含「住宿名」欄', () => {
    // Match quoted '住宿名' appearing in a headers array
    const match = src.match(/['"]住宿名['"]/);
    expect(match).toBeNull();
  });

  it('CSV header 不含「退房時間」欄', () => {
    const match = src.match(/['"]退房時間['"]/);
    expect(match).toBeNull();
  });

  it('不含「住宿」row 產生邏輯（hotel row in CSV）', () => {
    // 現行有 rows.push([..., '住宿', csvCell(hotel.name), ...])
    const match = src.match(/['"]住宿['"]\s*,\s*csvCell/);
    expect(match).toBeNull();
  });

  it('不含孤兒 RawHotel 型別宣告', () => {
    // R19: RawHotel 與 RawDay.hotel 已拿掉，避免死型別誤導未來讀者
    const typeDecl = src.match(/type\s+RawHotel\s*=/);
    expect(typeDecl).toBeNull();
    const fieldDecl = src.match(/hotel\?:\s*RawHotel/);
    expect(fieldDecl).toBeNull();
  });
});
