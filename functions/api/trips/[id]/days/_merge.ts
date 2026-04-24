/**
 * 共用的 POI merge 與 Day 組裝邏輯（單天 GET 與 batch GET 共用）
 */

/**
 * 從任一帶 `poi_id` 欄位的 row set 取得所有關聯的 pois，建 poi_id → pois row 查找表。
 * 同時支援 trip_pois（context 關聯）與 trip_entries（Phase 2 entry.poi_id）。
 * 使用 `IN (...)` 批次查詢避免 N+1；null poi_id 直接過濾。
 */
export async function fetchPoiMap(
  db: D1Database,
  ...rowLists: Record<string, unknown>[][]
): Promise<Map<number, Record<string, unknown>>> {
  const allIds = new Set<number>();
  for (const rows of rowLists) {
    for (const r of rows) {
      const pid = r.poi_id;
      if (typeof pid === 'number' && pid > 0) allIds.add(pid);
    }
  }
  const poiMap = new Map<number, Record<string, unknown>>();
  if (allIds.size === 0) return poiMap;

  const poiIds = [...allIds];
  const placeholders = poiIds.map(() => '?').join(',');
  const { results } = await db.prepare(
    `SELECT * FROM pois WHERE id IN (${placeholders})`,
  ).bind(...poiIds).all();
  for (const p of results as Record<string, unknown>[]) {
    poiMap.set(p.id as number, p);
  }
  return poiMap;
}

/**
 * 合併 pois master row + trip_pois override row。
 * **COALESCE convention**：trip_pois 欄位非 null 時覆蓋 pois 欄位（`tp.x ?? poi.x`）。
 * 讓 user 可覆寫個別 POI 資料而不影響 master。
 */
function mergePoi(poi: Record<string, unknown>, tp: Record<string, unknown>): Record<string, unknown> {
  return {
    // POI master fields
    poi_id: poi.id,
    type: poi.type,
    name: poi.name,
    description: tp.description ?? poi.description,
    note: tp.note ?? poi.note,
    address: poi.address,
    phone: poi.phone,
    email: poi.email,
    website: poi.website,
    hours: tp.hours ?? poi.hours,
    google_rating: poi.google_rating,
    category: poi.category,
    maps: poi.maps,
    mapcode: poi.mapcode,
    lat: poi.lat,
    lng: poi.lng,
    source: poi.source,
    // trip_pois fields
    trip_poi_id: tp.id,
    context: tp.context,
    day_id: tp.day_id,
    entry_id: tp.entry_id,
    sort_order: tp.sort_order,
    // Type-specific (flattened in trip_pois)
    checkout: tp.checkout,
    breakfast_included: tp.breakfast_included,
    breakfast_note: tp.breakfast_note,
    price: tp.price,
    reservation: tp.reservation,
    reservation_url: tp.reservation_url,
    must_buy: tp.must_buy,
  };
}

/**
 * 組裝單天完整資料：hotel + timeline + POI 歸類。
 *
 * **前置條件**：`entries` 必須已依 `sort_order ASC` 排序（caller 負責）。
 * 本函式不排序，直接依輸入順序組裝 timeline。
 *
 * @param dayRow - trip_days row
 * @param entries - 該天的 trip_entries（已排序）
 * @param tripPois - 該天的 trip_pois
 * @param poiMap - poi_id → pois row 的查找表
 */
export function assembleDay(
  dayRow: Record<string, unknown>,
  entries: Record<string, unknown>[],
  tripPois: Record<string, unknown>[],
  poiMap: Map<number, Record<string, unknown>>,
): Record<string, unknown> {
  let hotel: Record<string, unknown> | null = null;
  const parkingList: Record<string, unknown>[] = [];
  const restByEntry = new Map<number, unknown[]>();
  const shopByEntry = new Map<number, unknown[]>();

  for (const tp of tripPois) {
    const poi = poiMap.get(tp.poi_id as number);
    if (!poi) continue;
    const merged = mergePoi(poi, tp);
    const poiType = poi.type as string;
    const context = tp.context as string;

    if (context === 'hotel' && poiType === 'hotel' && !hotel) {
      hotel = merged;
    } else if (context === 'hotel' && poiType === 'parking') {
      parkingList.push(merged);
    } else if (context === 'timeline') {
      const eid = tp.entry_id as number;
      if (!restByEntry.has(eid)) restByEntry.set(eid, []);
      restByEntry.get(eid)!.push(merged);
    } else if (context === 'shopping') {
      const eid = tp.entry_id as number;
      if (eid) {
        if (!shopByEntry.has(eid)) shopByEntry.set(eid, []);
        shopByEntry.get(eid)!.push(merged);
      }
    }
  }

  if (hotel) {
    hotel.parking = parkingList;
  }

  const timeline = entries.map(e => {
    const eid = e.id as number;
    const travel = e.travel_type ? {
      type: e.travel_type,
      desc: e.travel_desc,
      min: e.travel_min,
    } : null;

    // Phase 3: entry.poi_id JOIN pois master（spatial 欄位唯一來源）
    const poiId = e.poi_id as number | null | undefined;
    const poi = (typeof poiId === 'number' && poiId > 0)
      ? (poiMap.get(poiId) ?? null)
      : null;

    return {
      ...e,
      travel,
      poi,
      restaurants: restByEntry.get(eid) ?? [],
      shopping: shopByEntry.get(eid) ?? [],
    };
  });

  return {
    id: dayRow.id,
    day_num: dayRow.day_num,
    date: dayRow.date,
    day_of_week: dayRow.day_of_week,
    label: dayRow.label,
    hotel,
    timeline,
  };
}
