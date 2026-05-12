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
    // Migration 0055 (v2.25.5): trip_pois.hours DROPPED, hours 純 pois master。
    // Place Details API weekday_descriptions 已含全週時段 + 公休日。
    hours: poi.hours,
    rating: poi.rating,
    // Migration 0054 (v2.25.4): price 從 trip_pois 移到 pois master。
    // dual-read 保險：pois.price 優先，trip_pois.price 作 fallback（觀察期內舊資料）。
    // Migration 0055 觀察期後 DROP trip_pois.price，這行會簡化成 `poi.price`。
    price: (poi as { price?: unknown }).price ?? tp.price,
    category: poi.category,
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
    reservation: tp.reservation,
    reservation_url: tp.reservation_url,
    must_buy: tp.must_buy,
  };
}

/**
 * v2.27.0 multi-POI per entry：fetch trip_entry_pois rows for given entry IDs，
 * group by entry_id 並 JOIN pois 取 spatial fields。
 *
 * @param db D1 instance
 * @param entryIds 要查的 trip_entries.id list
 * @returns Map<entryId, { master, alternates, version }>。Entry 無 master row → master=null。
 */
export async function fetchEntryPoisByEntries(
  db: D1Database,
  entryIds: number[],
): Promise<Map<number, { master: Record<string, unknown> | null; alternates: Record<string, unknown>[]; version: string }>> {
  const result = new Map<number, { master: Record<string, unknown> | null; alternates: Record<string, unknown>[]; version: string }>();
  if (entryIds.length === 0) return result;

  const placeholders = entryIds.map(() => '?').join(',');

  // round 5 fix: read OCC version from trip_entries.entry_pois_version (dedicated counter,
  // migration 0058). Pre-fix, this function derived version from MAX(trip_entry_pois.updated_at)
  // while the write path validated trip_entries.updated_at — a fresh GET sent back a token
  // that the mutation path rejected as stale. Both paths now read the same integer counter.
  const [poisQuery, versionsQuery] = await Promise.all([
    db
      .prepare(
        `SELECT tep.entry_id, tep.poi_id, tep.sort_order, tep.updated_at,
                p.name, p.lat, p.lng, p.type, p.category
         FROM trip_entry_pois tep
         JOIN pois p ON p.id = tep.poi_id
         WHERE tep.entry_id IN (${placeholders})
         ORDER BY tep.entry_id, tep.sort_order`,
      )
      .bind(...entryIds)
      .all<{
        entry_id: number;
        poi_id: number;
        sort_order: number;
        updated_at: string;
        name: string | null;
        lat: number | null;
        lng: number | null;
        type: string | null;
        category: string | null;
      }>(),
    db
      .prepare(`SELECT id, entry_pois_version FROM trip_entries WHERE id IN (${placeholders})`)
      .bind(...entryIds)
      .all<{ id: number; entry_pois_version: number }>(),
  ]);

  // Seed buckets with versions (so entries with no trip_entry_pois rows still get a version)
  for (const v of versionsQuery.results) {
    result.set(v.id, { master: null, alternates: [], version: String(v.entry_pois_version) });
  }

  for (const r of poisQuery.results) {
    let bucket = result.get(r.entry_id);
    if (!bucket) {
      bucket = { master: null, alternates: [], version: '0' };
      result.set(r.entry_id, bucket);
    }
    const poiInfo = {
      poi_id: r.poi_id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      type: r.type,
      category: r.category,
    };
    if (r.sort_order === 1) {
      bucket.master = poiInfo;
    } else {
      bucket.alternates.push({ ...poiInfo, sort_order: r.sort_order });
    }
  }

  return result;
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
 * @param entryPoisMap - v2.27.0 multi-POI per-entry data (optional; legacy callers
 *   omit → entry.master/alternates fall back to `null`/`[]` and frontend selectors
 *   read legacy `entry.poi` via getEntryMaster fallback chain).
 */
export function assembleDay(
  dayRow: Record<string, unknown>,
  entries: Record<string, unknown>[],
  tripPois: Record<string, unknown>[],
  poiMap: Map<number, Record<string, unknown>>,
  entryPoisMap?: Map<number, { master: Record<string, unknown> | null; alternates: Record<string, unknown>[]; version: string }>,
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
    // v2.23.6：surface distance_m + source。recompute-travel 後 assembleDay 應
    // surface travel object 即使 travel_type 仍 NULL（fallback 'car'），因為使用者要看到 km/min。
    const hasTravelData = e.travel_type || e.travel_min != null || e.travel_distance_m != null;
    const travel = hasTravelData ? {
      type: e.travel_type ?? 'car',
      desc: e.travel_desc,
      min: e.travel_min,
      distance_m: e.travel_distance_m,
      source: e.travel_source,
    } : null;

    // Phase 3: entry.poi_id JOIN pois master（spatial 欄位唯一來源）
    const poiId = e.poi_id as number | null | undefined;
    const poi = (typeof poiId === 'number' && poiId > 0)
      ? (poiMap.get(poiId) ?? null)
      : null;

    // v2.27.0 multi-POI per entry：populate master + alternates from trip_entry_pois。
    // Phase 1 dual-response：保留 legacy `poi` + `poi_id` + 新增 master / alternates / entry_pois_version。
    // entryPoisMap 未提供 (legacy caller) → master/alternates 為 undefined，client selector fallback 走 poi。
    const entryPoiBucket = entryPoisMap?.get(eid);
    const master = entryPoiBucket?.master ?? null;
    const alternates = entryPoiBucket?.alternates ?? [];
    const entry_pois_version = entryPoiBucket?.version ?? null;

    return {
      ...e,
      travel,
      poi,
      master,
      alternates,
      entry_pois_version,
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
    /** Section 4.3 (terracotta-mockup-parity-v2)：surface trip_days.title to client.
     *  Nullable — old rows pre-migration-0042 surface as undefined. */
    title: (dayRow as { title?: unknown }).title ?? null,
    hotel,
    timeline,
  };
}
