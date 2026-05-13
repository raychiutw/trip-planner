/** Entry POI selectors — canonical trip_entry_pois helpers. */
import type { Entry, EntryPoiInfo, EntryPoiAlternate } from '../types/trip';

/** 取 entry 的 master POI info。無 canonical master → return null。 */
export function getEntryMaster(entry: Entry): EntryPoiInfo | null {
  return entry.master ?? null;
}

/** Convenience: 取 master POI id；無 master → null。 */
export function getEntryMasterPoiId(entry: Entry): number | null {
  const m = getEntryMaster(entry);
  return m?.poiId ?? null;
}

/**
 * 取 entry 的 alternates 列表（不含 master）。Backend 未 populate → return []。
 * 永遠回 array（never undefined）讓 callsite 不必 nullish check。
 */
export function getEntryAlternates(entry: Entry): EntryPoiAlternate[] {
  return entry.alternates ?? [];
}

/** Convenience: alternates count。 */
export function getEntryAlternatesCount(entry: Entry): number {
  return getEntryAlternates(entry).length;
}

/** 判斷此 entry 是否含 alternates（有就顯 section，無就 hide）。 */
export function hasAlternates(entry: Entry): boolean {
  return getEntryAlternatesCount(entry) > 0;
}
