/**
 * trip-url.ts — parseSheetParam / setSheetParam / closeSheet tests
 *
 * URL query param driver for per-trip right sheet (`?sheet=itinerary|ideas|map|chat`).
 * Invalid values degrade to null so URL injection can't crash the page.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  parseSheetParam,
  setSheetParam,
  closeSheet,
  SHEET_TABS,
  type SheetTab,
} from '../../src/lib/trip-url';

describe('parseSheetParam', () => {
  it('returns tab when valid', () => {
    expect(parseSheetParam('?sheet=ideas')).toBe('ideas');
    expect(parseSheetParam('?sheet=map')).toBe('map');
    expect(parseSheetParam('?sheet=itinerary')).toBe('itinerary');
    expect(parseSheetParam('?sheet=chat')).toBe('chat');
  });

  it('returns null when param absent', () => {
    expect(parseSheetParam('')).toBeNull();
    expect(parseSheetParam('?foo=bar')).toBeNull();
  });

  it('returns null for invalid value (degrade, not throw)', () => {
    expect(parseSheetParam('?sheet=haxxor')).toBeNull();
    expect(parseSheetParam('?sheet=')).toBeNull();
    expect(parseSheetParam('?sheet=undefined')).toBeNull();
  });

  it('accepts URLSearchParams instance', () => {
    const p = new URLSearchParams('sheet=ideas');
    expect(parseSheetParam(p)).toBe('ideas');
  });
});

describe('setSheetParam', () => {
  it('calls navigate with ?sheet=tab replace:true', () => {
    const navigate = vi.fn();
    setSheetParam(navigate, '/trip/abc', '', 'ideas');
    expect(navigate).toHaveBeenCalledWith('/trip/abc?sheet=ideas', { replace: true });
  });

  it('preserves existing unrelated query params', () => {
    const navigate = vi.fn();
    setSheetParam(navigate, '/trip/abc', '?day=3', 'map');
    expect(navigate).toHaveBeenCalledWith('/trip/abc?day=3&sheet=map', { replace: true });
  });

  it('replaces existing sheet param', () => {
    const navigate = vi.fn();
    setSheetParam(navigate, '/trip/abc', '?sheet=ideas&day=2', 'map');
    expect(navigate).toHaveBeenCalledWith(
      '/trip/abc?sheet=map&day=2',
      { replace: true },
    );
  });
});

describe('closeSheet', () => {
  it('removes sheet param via replace', () => {
    const navigate = vi.fn();
    closeSheet(navigate, '/trip/abc', '?sheet=ideas');
    expect(navigate).toHaveBeenCalledWith('/trip/abc', { replace: true });
  });

  it('preserves other params when removing sheet', () => {
    const navigate = vi.fn();
    closeSheet(navigate, '/trip/abc', '?sheet=ideas&day=2');
    expect(navigate).toHaveBeenCalledWith('/trip/abc?day=2', { replace: true });
  });

  it('noop navigate when sheet param not present', () => {
    const navigate = vi.fn();
    closeSheet(navigate, '/trip/abc', '?day=2');
    expect(navigate).toHaveBeenCalledWith('/trip/abc?day=2', { replace: true });
  });
});

describe('SHEET_TABS constant', () => {
  it('has exactly 4 tabs in expected order', () => {
    expect(SHEET_TABS).toEqual(['itinerary', 'ideas', 'map', 'chat']);
  });

  it('SheetTab type matches tab values', () => {
    const tab: SheetTab = 'itinerary';
    expect(SHEET_TABS).toContain(tab);
  });
});
