import { describe, it, expect } from 'vitest';
import { haversineMeters } from '../../src/server/maps/haversine';

describe('haversineMeters', () => {
  it('same point → 0', () => {
    const p = { lat: 26.32, lng: 127.75 };
    expect(haversineMeters(p, p)).toBeCloseTo(0, 1);
  });

  it('symmetry: ab === ba', () => {
    const a = { lat: 35.6762, lng: 139.6503 };
    const b = { lat: 26.3175, lng: 127.7539 };
    const ab = haversineMeters(a, b);
    const ba = haversineMeters(b, a);
    expect(ab).toBeCloseTo(ba, 5);
  });

  it('那霸機場 → 美國村（沖繩中部，約 17km）', () => {
    const naha = { lat: 26.196, lng: 127.6458 };
    const mihama = { lat: 26.3175, lng: 127.7539 };
    const d = haversineMeters(naha, mihama);
    expect(d).toBeGreaterThan(15_000);
    expect(d).toBeLessThan(20_000);
  });

  it('1km gate 邊界（用於 recompute-travel walk vs drive 判斷）', () => {
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
