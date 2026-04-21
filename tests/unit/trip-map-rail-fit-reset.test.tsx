/**
 * trip-map-rail-fit-reset.test.tsx — F002 TDD test
 *
 * 策略：用 source-code 驗證 TripPage 對 TripMapRail 加了 key={trip.id}。
 * key={trip.id} 是保證 React 在行程切換時重掛 TripMapRail 的機制，
 * 重掛後 fitDoneRef 從 false 開始，下次 map + pins ready 時 fitBounds 再觸發。
 *
 * 這是 structural guarantee test：若有人移除 key prop，測試立刻失敗。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const TRIP_PAGE_SRC = resolve(__dirname, '../../src/pages/TripPage.tsx');
const source = readFileSync(TRIP_PAGE_SRC, 'utf-8');

describe('F002 — TripMapRail fitDoneRef 跨行程 reset（via key prop）', () => {
  it('TripPage 對 TripMapRail 設定 key={trip.id} 確保切換行程時重掛', () => {
    // TripMapRail 需要有 key prop（使用 trip.id）
    expect(source).toMatch(/TripMapRail[^>]*key=\{[^}]*trip\.id[^}]*\}/s);
  });
});
