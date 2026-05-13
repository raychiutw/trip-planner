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

  it('沒有 canonical master 時不讀 entry.poi', () => {
    const poi: Poi = { id: 200, type: 'attraction', name: '識名園', lat: 26.21, lng: 127.71, category: null };
    const entry = { ...baseEntry(), poi } as unknown as Entry;
    expect(getEntryMaster(entry)).toBeNull();
  });

  it('回 entry.master 即使 entry.poi 也有', () => {
    const master: EntryPoiInfo = { poiId: 300, name: 'New master', lat: null, lng: null, type: null, category: null };
    const poi: Poi = { id: 999, type: 'attraction', name: 'Legacy poi' };
    const entry = { ...baseEntry({ master }), poi } as unknown as Entry;
    expect(getEntryMaster(entry)?.poiId).toBe(300);
  });

  it('master 無 → null', () => {
    expect(getEntryMaster(baseEntry())).toBeNull();
  });
});

describe('getEntryMasterPoiId', () => {
  it('回 master.poiId 當 master populated', () => {
    expect(getEntryMasterPoiId(baseEntry({ master: { poiId: 5 } }))).toBe(5);
  });
  it('不讀 entry.poi.id', () => {
    const poi: Poi = { id: 7, type: 'attraction', name: 'X' };
    const entry = { ...baseEntry(), poi } as unknown as Entry;
    expect(getEntryMasterPoiId(entry)).toBeNull();
  });
  it('不讀 entry.poiId', () => {
    const entry = { ...baseEntry(), poiId: 9 } as unknown as Entry;
    expect(getEntryMasterPoiId(entry)).toBeNull();
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
