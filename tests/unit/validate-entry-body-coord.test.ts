/**
 * validateEntryBody lat/lng range check — v2.31.94 custom-stop-location-picker
 *
 * 當 entry POST body 帶 lat/lng（custom stop with map pin），backend 第二道
 * validate：XOR 拒絕（只一個值無法用）、NaN 拒、out-of-range 拒、valid pass。
 *
 * 既有純 title 路徑（search tab / favorite tab 無 lat/lng）不受影響 — 保留 backward-compat。
 */
import { describe, it, expect } from 'vitest';
import { validateEntryBody } from '../../functions/api/_validate';

describe('validateEntryBody — lat/lng range check (v2.31.94)', () => {
  it('valid lat/lng pair passes', () => {
    const result = validateEntryBody({
      title: '外婆家',
      lat: 22.6724,
      lng: 120.2932,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it('boundary values (lat ±90, lng ±180) pass', () => {
    expect(validateEntryBody({ title: 'a', lat: 90, lng: 180 }).ok).toBe(true);
    expect(validateEntryBody({ title: 'a', lat: -90, lng: -180 }).ok).toBe(true);
    expect(validateEntryBody({ title: 'a', lat: 0, lng: 0 }).ok).toBe(true);
  });

  it('no lat/lng (search/favorite tab path) passes', () => {
    const result = validateEntryBody({ title: '美麗海水族館' });
    expect(result.ok).toBe(true);
  });

  it('XOR: only lat present → fails with clear message', () => {
    const result = validateEntryBody({ title: 'a', lat: 22.6 });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('座標');
  });

  it('XOR: only lng present → fails', () => {
    const result = validateEntryBody({ title: 'a', lng: 120.0 });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('座標');
  });

  it('lat NaN → fails', () => {
    const result = validateEntryBody({ title: 'a', lat: NaN, lng: 120 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('座標');
  });

  it('lng Infinity → fails', () => {
    const result = validateEntryBody({ title: 'a', lat: 22, lng: Infinity });
    expect(result.ok).toBe(false);
  });

  it('lat out of range (>90) → fails', () => {
    const result = validateEntryBody({ title: 'a', lat: 91, lng: 120 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('座標');
  });

  it('lat out of range (<-90) → fails', () => {
    const result = validateEntryBody({ title: 'a', lat: -90.1, lng: 120 });
    expect(result.ok).toBe(false);
  });

  it('lng out of range (>180) → fails', () => {
    const result = validateEntryBody({ title: 'a', lat: 22, lng: 180.5 });
    expect(result.ok).toBe(false);
  });

  it('lng out of range (<-180) → fails', () => {
    const result = validateEntryBody({ title: 'a', lat: 22, lng: -181 });
    expect(result.ok).toBe(false);
  });

  it('lat/lng as string ("22.6") → fails (must be number)', () => {
    const result = validateEntryBody({
      title: 'a',
      lat: '22.6' as unknown as number,
      lng: 120,
    });
    expect(result.ok).toBe(false);
  });

  it('title missing still has priority (matches existing contract)', () => {
    const result = validateEntryBody({ lat: 22, lng: 120 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('title');
  });

  it('lat=null / lng=null treated as not-present (no XOR fail)', () => {
    const result = validateEntryBody({
      title: 'a',
      lat: null as unknown as number,
      lng: null as unknown as number,
    });
    expect(result.ok).toBe(true);
  });
});
