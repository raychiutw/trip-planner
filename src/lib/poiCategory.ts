/**
 * POI category mapping helpers — Nominatim raw category → Tripline whitelist.
 *
 * 共用來源：white list 對應 functions/api/trips/[id]/days/[num]/entries.ts
 * 的 ALLOWED_POI_TYPES 與 pois.type CHECK constraint
 * (`'hotel','restaurant','shopping','parking','attraction','transport','activity','other'`)。
 *
 * 兩處用：AddStopPage（trip 內加景點）+ ExplorePage（探索儲存到池）。
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

/** zh-TW labels for POI types — used by /favorites + /favorites/:id/add-to-trip */
export const POI_TYPE_LABELS: Record<PoiType, string> = {
  restaurant: '餐廳',
  attraction: '景點',
  shopping: '購物',
  hotel: '飯店',
  parking: '停車',
  transport: '交通',
  activity: '活動',
  other: '其他',
};

const WHITELIST_SET: ReadonlySet<string> = new Set(POI_TYPE_WHITELIST);

/**
 * Google Places `primaryType` (and legacy Nominatim OSM `class`) → Tripline
 * poi_type whitelist。Fallback 'attraction'（最常見）。
 *
 * 三層判斷，先到先贏：
 * 1. 已是 whitelist 值 → 原樣回傳（favorites 存的 poiType / 既有 pois.type）。
 * 2. 關鍵字比對：較具體的場所類別（交通、休閒）排在通用類別之前，避免
 *    `amusement_park` 被 `park` 誤判成 attraction。
 * 3. 都不中 → 'attraction'。
 *
 * Patterns 同時涵蓋 Google `primaryType` enum 與 legacy Nominatim class
 * (tourism / amenity / leisure)。後者對 Google 資料無害（那些 token 不會出現），
 * 保留是為了向後相容既有測試與舊資料。
 */
export function mapGooglePrimaryTypeToPoiType(category: string | null | undefined): PoiType {
  if (!category) return 'attraction';
  const c = category.toLowerCase().trim();
  if (!c) return 'attraction';

  // 1) 已是 whitelist 值 → passthrough
  if (WHITELIST_SET.has(c)) return c as PoiType;

  // 2) 關鍵字比對（順序敏感：具體者優先）。
  //    短歧義 token（inn/zoo/gym/spa/cafe/bar/food/pub/activity）用「underscore
  //    邊界」`(?:^|_)x(?:_|$)` 而非 `\b`：Google primaryType 是 snake_case，'_' 算
  //    \w 字元，`\b` 永遠不會在 token↔底線交界 match（`\bbar\b` 抓不到 wine_bar）；
  //    `(?:^|_)bar(?:_|$)` 能中 wine_bar / bar_and_grill，又不誤中 barber_shop。
  if (/hotel|lodging|hostel|motel|guest_house|resort|tourism|(?:^|_)inn(?:_|$)/.test(c)) return 'hotel';
  if (/parking/.test(c)) return 'parking';
  if (/station|airport|transit|terminal|subway|railway|taxi_stand|bus_stop|transport/.test(c)) return 'transport';
  if (/amusement|theme_park|water_park|aquarium|fitness|night_?club|cinema|movie|theater|theatre|stadium|arena|bowling|karaoke|leisure|(?:^|_)(?:zoo|gym|spa|activity)(?:_|$)/.test(c)) return 'activity';
  // prepared-food *_shop (ice_cream_shop/dessert_shop/donut_shop…) must beat the generic
  // 'shop' → shopping rule below; non-food retail (candy_store/gift_shop/barber_shop) stays shopping.
  if (/restaurant|coffee|bakery|bistro|diner|eatery|izakaya|brunch|amenity|ice_cream|dessert|donut|doughnut|bagel|juice|acai|tea_house|(?:^|_)(?:cafe|bar|food|pub)(?:_|$)/.test(c)) return 'restaurant';
  if (/shop|store|mall|market|supermarket|retail|boutique|grocery/.test(c)) return 'shopping';
  if (/museum|gallery|temple|shrine|church|mosque|synagogue|worship|monument|landmark|tourist|historic|garden|castle|palace|memorial|park|attraction|sightseeing|scenic/.test(c)) return 'attraction';

  return 'attraction';
}

/**
 * POI 分類顯示 label（zh-TW）。DB `pois.category` 存的可能是 Google Places
 * `primaryType`（英文 snake_case，如 tourist_attraction / cafe）**或**已經 curated
 * 的中文 label（拉麵 / 浮潛 / 當地特色 / 沖繩麵，AI/人工塞的）。原則：
 *   - 空 → null（caller 自行 fallback，如 poi.type 的 label）
 *   - 純 CJK curated label（含漢字/假名且無 ASCII 拉丁字母，如 拉麵/浮潛）→ 原樣
 *     回傳。英文 keyword matcher 讀不懂中文，硬過會全歸 attraction → 把「拉麵/浮潛」
 *     誤顯成「景點」(okinawa-trip real data)。
 *   - 其餘（英文 primaryType、混合字串、數字/emoji/全形拉丁）→ 經 whitelist 映射成
 *     8 類中文 label。保證任何 ASCII 英文都不外露（含「拉麵 ramen」這種混合），
 *     非 curated 雜訊也收斂成乾淨 label 而非原樣噴出。
 */
export function poiCategoryLabel(category: string | null | undefined): string | null {
  const c = category?.trim();
  if (!c) return null;
  // ponytail: 只放行「有 CJK/假名 且無 ASCII 拉丁」的 curated label；其餘一律映射（英文不外露）
  // ぀-ヿ = 平假名+片假名, 一-鿿 = CJK 漢字
  if (/[぀-ヿ一-鿿]/.test(c) && !/[a-zA-Z]/.test(c)) return c;
  return POI_TYPE_LABELS[mapGooglePrimaryTypeToPoiType(c)];
}

/**
 * @deprecated 名稱誤導（餵進來的其實是 Google `primaryType`，不是 Nominatim）。
 * 改用 {@link mapGooglePrimaryTypeToPoiType}。保留 alias 讓既有 caller 與測試解析。
 */
export const mapNominatimCategory = mapGooglePrimaryTypeToPoiType;
