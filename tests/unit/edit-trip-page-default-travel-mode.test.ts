// @vitest-environment node
/**
 * v2.31.15 fix: EditTripPage default_travel_mode camelCase read。
 *
 * Bug found in prod QA：backend GET /api/trips/:id 經 deepCamel 回
 * `defaultTravelMode: 'driving'` (camel)，但 EditTripPage 讀
 * `data.default_travel_mode` (snake) → 永遠 undefined → fallback 'driving'。
 * UI 永遠顯示「自駕」即使 trip 真實是 walking/transit。
 *
 * Fix：type + read 用 camelCase，write 維持 snake_case（backend
 * WRITABLE_FIELDS allow-list 是 snake_case）。同 #573 / #574 bug 家族。
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

describe('v2.31.15 EditTripPage default_travel_mode camelCase', () => {
  it('TripApi type 用 camelCase defaultTravelMode / dataSource', () => {
    const match = SRC.match(/interface TripApi[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    const block = match![0];
    expect(block).toMatch(/defaultTravelMode\?:\s*TravelMode \| null/);
    expect(block).toMatch(/dataSource\?:\s*string \| null/);
    // 舊 snake_case 已拔
    expect(block).not.toMatch(/default_travel_mode\?\s*:/);
    expect(block).not.toMatch(/data_source\?\s*:/);
  });

  it('Read path 用 data.defaultTravelMode (對齊 backend response)', () => {
    expect(SRC).toMatch(/setTravelMode\(\(data\.defaultTravelMode as TravelMode\)/);
    expect(SRC).toMatch(/original\.defaultTravelMode as TravelMode/);
    // 舊 broken read 已拔
    expect(SRC).not.toMatch(/data\.default_travel_mode as TravelMode/);
    expect(SRC).not.toMatch(/original\.default_travel_mode as TravelMode/);
  });

  it('Write path 維持 snake_case body.default_travel_mode (backend allow-list)', () => {
    // PATCH body 寫 snake — backend WRITABLE_FIELDS contains 'default_travel_mode'
    expect(SRC).toMatch(/body\.default_travel_mode = travelMode/);
  });
});
