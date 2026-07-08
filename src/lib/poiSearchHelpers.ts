/**
 * POI search helpers shared by AddStopPage + ChangePoiPage.
 *
 * v2.33.34 (simplify PR-7): 兩個 page 之前 100% 複製 REGION_OPTIONS /
 * CATEGORY_TABS / matchCategory / poiTone / poiMeta / normalizeSearchResults
 * — 已造成 drift (ChangePoi 的 normalizeSearchResults 不做 type 檢查，
 * AddStop 的版本檢查嚴格)。本檔取嚴格版作 canonical，兩個 page 共用。
 *
 * 完整 component extraction（<PoiSearchTab> / <PoiFavoritesTab>）留 future
 * PR — 涉及 React component restructure，本 PR 只做 pure function 收斂。
 */
import type { PoiSearchResult } from '../types/poi';
// v2.33.38 round 3: 引 POI_TYPE_LABELS 避免 poiMeta '景點' fallback 硬寫字串
// (PR-1 統一後若 attraction label 改名，這裡會 drift)。
import { POI_TYPE_LABELS, poiCategoryLabel } from './poiCategory';

export type PoiCardTone = 'warm' | 'cool' | 'blue' | 'amber';

/** Add-stop / change-poi page tabs（search 預設、收藏池、自訂 POI）。 */
export type PoiSearchTab = 'search' | 'favorites' | 'custom';

/** Category subtab key (CATEGORY_TABS[].key)。 */
export type PoiSearchCategory = 'all' | 'attraction' | 'food' | 'hotel' | 'shopping';

export const REGION_OPTIONS = ['全部地區', '沖繩', '東京', '京都', '首爾', '台南'] as const;
export type RegionOption = typeof REGION_OPTIONS[number];

export const CATEGORY_TABS: ReadonlyArray<{ key: PoiSearchCategory; label: string }> = [
  { key: 'all', label: '為你推薦' },
  { key: 'attraction', label: '景點' },
  { key: 'food', label: '美食' },
  { key: 'hotel', label: '住宿' },
  { key: 'shopping', label: '購物' },
];

export function matchCategory(category: string | null | undefined, target: PoiSearchCategory): boolean {
  if (target === 'all') return true;
  const cat = (category ?? '').toLowerCase();
  if (target === 'food') return /restaurant|cafe|food|bar|bakery|餐|食/.test(cat);
  if (target === 'hotel') return /hotel|hostel|guest|inn|住宿|飯店/.test(cat);
  if (target === 'shopping') return /shop|mall|market|購物/.test(cat);
  if (target === 'attraction') return /attract|museum|park|temple|景點|公園/.test(cat);
  return false;
}

export function poiTone(category: string | null | undefined, index: number): PoiCardTone {
  const cat = (category ?? '').toLowerCase();
  if (/restaurant|cafe|food|bar|bakery|餐|食/.test(cat)) return 'warm';
  if (/shop|mall|market|購物/.test(cat)) return 'amber';
  if (/hotel|hostel|guest|inn|住宿|飯店/.test(cat)) return 'cool';
  const tones: readonly PoiCardTone[] = ['blue', 'cool', 'amber', 'warm'];
  return tones[index % tones.length] ?? 'blue';
}

export function poiMeta(address: string | null | undefined, category: string | null | undefined): string {
  const primary = (address ?? '').split(',')[0]?.trim();
  // category 是 Google primaryType（英文）— 映射成中文再顯示，address 缺省時不露英文。
  return primary || poiCategoryLabel(category) || POI_TYPE_LABELS.attraction;
}

/**
 * Strict normalize: data 可能是 array 或 { results: [...] }；row 必須有 place_id +
 * name 才保留。比 ChangePoi 之前的 cast-only 版本嚴格（曾因型別漂移失效）。
 */
export function normalizeSearchResults(data: unknown): PoiSearchResult[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    const id = typeof item.place_id === 'string' ? item.place_id : '';
    const name = typeof item.name === 'string' ? item.name : '';
    if (!id || !name.trim()) return [];
    const rating = typeof item.rating === 'number' ? item.rating : undefined;
    return [{
      place_id: id,
      name,
      address: typeof item.address === 'string' ? item.address : '',
      lat: Number(item.lat) || 0,
      lng: Number(item.lng) || 0,
      category: typeof item.category === 'string' ? item.category : 'poi',
      rating,
    }];
  });
}
