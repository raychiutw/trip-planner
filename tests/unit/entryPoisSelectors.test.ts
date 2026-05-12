import { describe, it, expect } from 'vitest';
import {
  getEntryMaster,
  getEntryMasterPoiId,
  getEntryAlternates,
  getEntryAlternatesCount,
  hasAlternates,
} from '../../src/lib/entryPoisSelectors';
import type { Entry, EntryPoiInfo, Poi } from '../../src/types/trip';

function baseEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    sortOrder: 1,
    title: 'Test entry',
    restaurants: [],
    shopping: [],
    ...overrides,
  };
}

describe('getEntryMaster', () => {
  it('回 entry.master 當 new shape 已 populate', () => {
    const master: EntryPoiInfo = { poiId: 100, name: '首里城', lat: 26.2, lng: 127.7, type: 'attraction', category: null };
    const entry = baseEntry({ master });
    expect(getEntryMaster(entry)).toEqual(master);
  });

  it('fallback 到 entry.poi 當 master 未 populate (Phase 1 legacy shape)', () => {
    const poi: Poi = { id: 200, type: 'attraction', name: '識名園', lat: 26.21, lng: 127.71, category: null };
    const entry = baseEntry({ poi });
    const result = getEntryMaster(entry);
    expect(result?.poiId).toBe(200);
    expect(result?.name).toBe('識名園');
    expect(result?.lat).toBe(26.21);
  });

  it('優先 entry.master 即使 entry.poi 也有（dual response）', () => {
    const master: EntryPoiInfo = { poiId: 300, name: 'New master', lat: null, lng: null, type: null, category: null };
    const poi: Poi = { id: 999, type: 'attraction', name: 'Legacy poi' };
    const entry = baseEntry({ master, poi });
    expect(getEntryMaster(entry)?.poiId).toBe(300);
  });

  it('master + poi 皆無 → null', () => {
    expect(getEntryMaster(baseEntry())).toBeNull();
  });
});

describe('getEntryMasterPoiId', () => {
  it('回 master.poiId 當 master populated', () => {
    expect(getEntryMasterPoiId(baseEntry({ master: { poiId: 5 } }))).toBe(5);
  });
  it('fallback 到 entry.poi.id', () => {
    const poi: Poi = { id: 7, type: 'attraction', name: 'X' };
    expect(getEntryMasterPoiId(baseEntry({ poi }))).toBe(7);
  });
  it('最後 fallback 到 entry.poiId', () => {
    expect(getEntryMasterPoiId(baseEntry({ poiId: 9 }))).toBe(9);
  });
  it('全空 → null', () => {
    expect(getEntryMasterPoiId(baseEntry())).toBeNull();
  });
});

describe('getEntryAlternates / count / hasAlternates', () => {
  it('alternates undefined → []', () => {
    expect(getEntryAlternates(baseEntry())).toEqual([]);
    expect(getEntryAlternatesCount(baseEntry())).toBe(0);
    expect(hasAlternates(baseEntry())).toBe(false);
  });

  it('alternates 空 array → []', () => {
    expect(getEntryAlternates(baseEntry({ alternates: [] }))).toEqual([]);
    expect(hasAlternates(baseEntry({ alternates: [] }))).toBe(false);
  });

  it('alternates 有 2 個 → count=2, hasAlternates=true', () => {
    const alts = [
      { poiId: 101, sortOrder: 2 },
      { poiId: 102, sortOrder: 3 },
    ];
    expect(getEntryAlternates(baseEntry({ alternates: alts }))).toEqual(alts);
    expect(getEntryAlternatesCount(baseEntry({ alternates: alts }))).toBe(2);
    expect(hasAlternates(baseEntry({ alternates: alts }))).toBe(true);
  });
});
