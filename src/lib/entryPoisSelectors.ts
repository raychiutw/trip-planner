/**
 * Entry POI selectors — v2.27.0 multi-POI per entry transition helpers
 *
 * Phase 1 (v2.27.0)：backend response 可能 contain：
 *   - 新 shape: `entry.master`, `entry.alternates`
 *   - 舊 shape: `entry.poi`, `entry.poiId`（migration 過渡期保留）
 *
 * 這些 selectors 統一抽象，前端 component 用 `getEntryMaster(entry)` 而不直接讀
 * `entry.master?.poiId` 或 `entry.poi?.id` —— 避免兩處都要寫 fallback。
 *
 * Phase 2 (v2.27.1) DROP `trip_entries.poi_id` + backend stop populating legacy
 * `poi` / `poiId` 後，移除 fallback 分支即可（selector API 不變）。
 */
import type { Entry, EntryPoiInfo, EntryPoiAlternate } from '../types/trip';

/**
 * 取 entry 的 master POI info。優先 new shape (`entry.master`)，fallback legacy
 * (`entry.poi`)。兩者皆無 → return null。
 */
export function getEntryMaster(entry: Entry): EntryPoiInfo | null {
  if (entry.master) return entry.master;
  if (entry.poi) {
    return {
      poiId: entry.poi.id,
      name: entry.poi.name ?? null,
      lat: entry.poi.lat ?? null,
      lng: entry.poi.lng ?? null,
      type: entry.poi.type ?? null,
      category: entry.poi.category ?? null,
    };
  }
  return null;
}

/** Convenience: 取 master POI id；無 master → null。 */
export function getEntryMasterPoiId(entry: Entry): number | null {
  const m = getEntryMaster(entry);
  if (m) return m.poiId;
  return entry.poiId ?? null;
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
