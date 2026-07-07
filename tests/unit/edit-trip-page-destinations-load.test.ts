// @vitest-environment node
/**
 * v2.31.13 fix: EditTripPage destinations 沒從 backend load。
 *
 * Bug found in prod QA：backend GET /api/trips/:id 經 deepCamel 回
 * `destinations: [{destOrder, name, lat, lng, dayQuota, subAreas}]`，但
 * EditTripPage TripDestApi type 寫死 snake_case (dest_order, day_quota) +
 * filter 用 `typeof d.place_id === 'number'`（trip_destinations 表沒此欄位）
 * → 永遠 false → destinations 全 filter 掉 → UI 顯示「尚無目的地」。
 *
 * Fix：TripDestApi 對齊 camelCase + filter 改 name-based。既有 dest 用
 * synthetic place_id 當 React key（backend 不需此欄位）。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/EditTripPage.tsx'),
  'utf8',
);

describe('v2.31.13 EditTripPage destinations load', () => {
  it('TripDestApi 對齊 backend camelCase（destOrder / dayQuota / subAreas）', () => {
    const match = SRC.match(/interface TripDestApi[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    const block = match![0];
    // 新欄位
    expect(block).toContain('destOrder');
    expect(block).toContain('dayQuota');
    expect(block).toContain('subAreas');
    // 舊 snake_case 已拔
    expect(block).not.toMatch(/dest_order\b/);
    expect(block).not.toMatch(/day_quota\b/);
    // place_id 已拔（backend schema 沒此欄位）
    expect(block).not.toMatch(/place_id\?\s*:\s*number/);
  });

  it('filter logic 用 name-based valid check（不再依 place_id）', () => {
    expect(SRC).toMatch(/typeof d\.name === 'string' && d\.name\.trim\(\)\.length > 0/);
    // 舊 broken check 已拔（不含 comment，只看 .filter(... typeof d.place_id ...) call）
    expect(SRC).not.toMatch(/\.filter\([\s\S]{0,200}typeof d\.place_id === 'number'/);
  });

  it('既有 dest map 用 synthetic place_id 當 React key', () => {
    expect(SRC).toMatch(/place_id:\s*`existing-\$\{d\.destOrder/);
    // dayQuota camelCase
    expect(SRC).toMatch(/day_quota:\s*d\.dayQuota/);
  });
});

describe('2026-07-07 欄位順序：行程名稱移到最上（user 要求）', () => {
  it('行程名稱區塊在目的地區塊之前（mockup v2/v3 已同步同順序）', () => {
    const titleIdx = SRC.indexOf('htmlFor="edit-trip-title-input"');
    const destIdx = SRC.indexOf('{/* Destinations */}');
    expect(titleIdx).toBeGreaterThan(-1);
    expect(destIdx).toBeGreaterThan(-1);
    expect(titleIdx).toBeLessThan(destIdx);
  });
});
