/**
 * trip-map-rail-fit-reset.test.tsx — F002 TDD test
 *
 * 策略：用 source-code 驗證 TripSheet 對 TripMapRail 加了 key={tripId}。
 * key={tripId} 是保證 React 在行程切換時重掛 TripMapRail 的機制，
 * 重掛後 fitDoneRef 從 false 開始，下次 map + pins ready 時 fitBounds 再觸發。
 *
 * B-P3 後 TripMapRail 從 TripPage 搬到 TripSheet（sheet slot 的 map tab）。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const TRIP_SHEET_SRC = resolve(__dirname, '../../src/components/trip/TripSheet.tsx');
const source = readFileSync(TRIP_SHEET_SRC, 'utf-8');

describe('F002 — TripMapRail fitDoneRef 跨行程 reset（via key prop）', () => {
  it('TripSheet 對 TripMapRail 設定 key={tripId} 確保切換行程時重掛', () => {
    expect(source).toMatch(/TripMapRail[\s\S]*?key=\{tripId\}/);
  });
});
