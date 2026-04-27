/**
 * POI category mapping helpers — Nominatim raw category → Tripline whitelist.
 *
 * 共用來源：white list 對應 functions/api/trips/[id]/days/[num]/entries.ts
 * 的 ALLOWED_POI_TYPES 與 pois.type CHECK constraint
 * (`'hotel','restaurant','shopping','parking','attraction','transport','activity','other'`)。
 *
 * 兩處用：InlineAddPoi（trip 內加景點）+ ExplorePage（探索儲存到池）。
 * 不映射就直接送 raw category（例如 'tourism'/'amenity'）給 backend，會在
 * pois CHECK constraint 失敗 → 500/503，user 看到「目前繁忙碌中」 toast。
 */

const POI_TYPE_WHITELIST = [
  'hotel',
  'restaurant',
  'shopping',
  'parking',
  'attraction',
  'transport',
  'activity',
  'other',
] as const;

export type PoiType = (typeof POI_TYPE_WHITELIST)[number];

/**
 * Nominatim category（OSM `class`）→ Tripline poi_type whitelist。
 * Fallback 'attraction'（最常見）— 已知 raw values 對應到 hotel/restaurant
 * 等才映射，其它一律 attraction。
 */
export function mapNominatimCategory(category: string | null | undefined): PoiType {
  if (!category) return 'attraction';
  const c = category.toLowerCase();
  if (c.includes('hotel') || c.includes('lodging') || c.includes('tourism')) return 'hotel';
  if (c.includes('restaurant') || c.includes('food') || c.includes('amenity')) return 'restaurant';
  if (c.includes('shop') || c.includes('mall') || c.includes('retail')) return 'shopping';
  if (c.includes('parking')) return 'parking';
  if (c.includes('transport') || c.includes('railway') || c.includes('airport')) return 'transport';
  if (c.includes('activity') || c.includes('leisure')) return 'activity';
  return 'attraction';
}
