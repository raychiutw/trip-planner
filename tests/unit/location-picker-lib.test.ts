/**
 * locationPicker lib pure-function tests — v2.31.94 custom-stop-location-picker.
 *
 * Tests the pure helpers (no React, no Google Maps JS) that back
 * <LocationPickerMap>. Imperative DOM/map wiring is verified via E2E.
 */
import { describe, it, expect } from 'vitest';
import {
  isValidCoord,
  computeArrowKeyStepPixels,
  selectDefaultCenter,
  type Coord,
} from '../../src/lib/locationPicker';

describe('isValidCoord', () => {
  it('valid pair passes', () => {
    expect(isValidCoord({ lat: 22.6, lng: 120.3 })).toBe(true);
  });
  it('boundary values pass', () => {
    expect(isValidCoord({ lat: 90, lng: 180 })).toBe(true);
    expect(isValidCoord({ lat: -90, lng: -180 })).toBe(true);
    expect(isValidCoord({ lat: 0, lng: 0 })).toBe(true);
  });
  it('NaN fails', () => {
    expect(isValidCoord({ lat: NaN, lng: 120 })).toBe(false);
    expect(isValidCoord({ lat: 22, lng: NaN })).toBe(false);
  });
  it('out of range fails', () => {
    expect(isValidCoord({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidCoord({ lat: -90.1, lng: 0 })).toBe(false);
    expect(isValidCoord({ lat: 0, lng: 180.1 })).toBe(false);
    expect(isValidCoord({ lat: 0, lng: -181 })).toBe(false);
  });
  it('non-number fails', () => {
    expect(isValidCoord({ lat: '22' as unknown as number, lng: 120 })).toBe(false);
  });
});

describe('computeArrowKeyStepPixels', () => {
  // Formula: target ≈ 10 meters per keypress per design doc Open Q #3.
  // At zoom 14, mid-latitude (~25° N like Okinawa/Taiwan), mppx ≈ 9.5 →
  // step ≈ 1px. At zoom 17, mppx ≈ 1.2 → step ≈ 8px. Zoom 11 mppx ≈ 76 →
  // step ≈ 0.13px (rounded up to minimum 1).
  it('zoom 14 mid-latitude → about 1-2 px', () => {
    const step = computeArrowKeyStepPixels(14, 25);
    expect(step).toBeGreaterThanOrEqual(1);
    expect(step).toBeLessThanOrEqual(3);
  });
  it('zoom 17 → step is larger (zoomed in, fewer meters per pixel)', () => {
    const stepLo = computeArrowKeyStepPixels(14, 25);
    const stepHi = computeArrowKeyStepPixels(17, 25);
    expect(stepHi).toBeGreaterThan(stepLo);
  });
  it('higher latitude → cos(lat) shrinks meters per pixel → larger step', () => {
    const stepEquator = computeArrowKeyStepPixels(14, 0);
    const stepHighLat = computeArrowKeyStepPixels(14, 60);
    expect(stepHighLat).toBeGreaterThan(stepEquator);
  });
  it('minimum 1 px (never zero / fractional)', () => {
    const step = computeArrowKeyStepPixels(8, 0);
    expect(step).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(step)).toBe(true);
  });
  it('returns 1 for invalid inputs (defensive)', () => {
    expect(computeArrowKeyStepPixels(NaN, 0)).toBe(1);
    expect(computeArrowKeyStepPixels(14, NaN)).toBe(1);
  });
});

describe('selectDefaultCenter — fallback chain', () => {
  const TOKYO: Coord = { lat: 35.6812, lng: 139.7671 };

  it('uses prevEntry when present + valid', () => {
    const center = selectDefaultCenter({
      prevEntry: { lat: 26.2, lng: 127.6 },
      tripDestinations: [{ lat: 35, lng: 139 }],
    });
    expect(center).toEqual({ lat: 26.2, lng: 127.6 });
  });

  it('falls through prev-entry invalid → trip.destinations[0]', () => {
    const center = selectDefaultCenter({
      prevEntry: { lat: NaN, lng: 127.6 },
      tripDestinations: [{ lat: 35, lng: 139 }],
    });
    expect(center).toEqual({ lat: 35, lng: 139 });
  });

  it('falls through prev-entry null → trip.destinations[0]', () => {
    const center = selectDefaultCenter({
      prevEntry: null,
      tripDestinations: [{ lat: 26.2, lng: 127.6 }, { lat: 35, lng: 139 }],
    });
    expect(center).toEqual({ lat: 26.2, lng: 127.6 });
  });

  it('falls through empty destinations → tripCenter', () => {
    const center = selectDefaultCenter({
      prevEntry: null,
      tripDestinations: [],
      tripCenter: { lat: 23, lng: 121 },
    });
    expect(center).toEqual({ lat: 23, lng: 121 });
  });

  it('falls through everything → Tokyo Station hard fallback', () => {
    const center = selectDefaultCenter({
      prevEntry: null,
      tripDestinations: [],
    });
    expect(center).toEqual(TOKYO);
  });

  it('invalid destinations[0] skipped → use destinations[1]', () => {
    const center = selectDefaultCenter({
      prevEntry: null,
      tripDestinations: [
        { lat: NaN, lng: 139 },
        { lat: 26.2, lng: 127.6 },
      ],
    });
    expect(center).toEqual({ lat: 26.2, lng: 127.6 });
  });
});
