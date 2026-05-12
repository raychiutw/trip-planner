/**
 * geo helper unit test — v2.28.1
 *
 * haversineMeters 是 cross-region 警告 (EditEntryPage swap confirm) +
 * stale-travel detection (TimelineRail TravelPill) 的共用基礎。誤差 < 0.5%
 * 對 trip-planner 距離尺度（同城 ~ 跨日本）綽綽有餘。
 *
 * Reference coords:
 *   - Naha (那覇空港): 26.2124, 127.6792
 *   - Nago (名護):     26.5917, 127.9775  (~50 km from Naha)
 *   - Tokyo Tower:    35.6586, 139.7454  (~1556 km from Naha)
 *   - 美國村:          26.3158, 127.7591
 */
import { describe, it, expect } from 'vitest';
import { haversineMeters } from '../../src/lib/geo';

describe('haversineMeters', () => {
  it('same point → 0', () => {
    const a = { lat: 25, lng: 121 };
    expect(haversineMeters(a, a)).toBe(0);
  });

  it('Naha → Nago ~ 50 km', () => {
    const m = haversineMeters(
      { lat: 26.2124, lng: 127.6792 },
      { lat: 26.5917, lng: 127.9775 },
    );
    // 真實大圓距離 ~50 km
    expect(m).toBeGreaterThan(45_000);
    expect(m).toBeLessThan(55_000);
  });

  it('Naha → Tokyo ~ 1550 km（跨區）', () => {
    const m = haversineMeters(
      { lat: 26.2124, lng: 127.6792 },
      { lat: 35.6586, lng: 139.7454 },
    );
    expect(m).toBeGreaterThan(1_500_000);
    expect(m).toBeLessThan(1_600_000);
  });

  it('Naha → 美國村 ~ 12 km（同區）', () => {
    const m = haversineMeters(
      { lat: 26.2124, lng: 127.6792 },
      { lat: 26.3158, lng: 127.7591 },
    );
    expect(m).toBeGreaterThan(10_000);
    expect(m).toBeLessThan(15_000);
  });

  it('commutative — a→b 與 b→a 同值', () => {
    const a = { lat: 26.2, lng: 127.6 };
    const b = { lat: 35.6, lng: 139.7 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 0);
  });

  // 以下是從原 tests/unit/haversine.test.ts merge 過來的 case
  // （那個檔案 v2.28.1 被 src/server/maps/haversine.ts → src/lib/geo.ts 搬家後 delete）

  it('那霸機場 → 美國村（沖繩中部，約 17km）', () => {
    const naha = { lat: 26.196, lng: 127.6458 };
    const mihama = { lat: 26.3175, lng: 127.7539 };
    const d = haversineMeters(naha, mihama);
    expect(d).toBeGreaterThan(15_000);
    expect(d).toBeLessThan(20_000);
  });

  it('1km gate 邊界（recompute-travel walk vs drive 判斷）', () => {
    const center = { lat: 35.6762, lng: 139.6503 }; // 東京站
    // 0.009 lat ≈ 1km；boundaries 須一邊 <1km 一邊 >1km
    const justUnder = { lat: 35.6762 + 0.0089, lng: 139.6503 };
    const justOver = { lat: 35.6762 + 0.0091, lng: 139.6503 };
    expect(haversineMeters(center, justUnder)).toBeLessThan(1000);
    expect(haversineMeters(center, justOver)).toBeGreaterThan(1000);
  });

  it('500m 區內景點（短程同景區內）', () => {
    const a = { lat: 26.3175, lng: 127.7539 };
    const b = { lat: 26.3175, lng: 127.7589 }; // ~500m east
    const d = haversineMeters(a, b);
    expect(d).toBeGreaterThan(400);
    expect(d).toBeLessThan(600);
  });
});
