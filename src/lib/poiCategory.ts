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
 * v2.55.73: Google Places `primaryType` → zh-TW 細類 label（「直用原始分類」）。
 *
 * 8 大類 `poiCategoryLabel` 太粗（大量壓成「景點」）。此表把常見旅遊 primaryType
 * 直翻中文細類，讓 Explore 篩選 chip 與全站顯示 label 顯示「拉麵/神社/百貨」而非
 * 「餐廳/景點/購物」。收錄涵蓋常見 generic（tourist_attraction / lodging …）以免其
 * 落入英文 fallback。**未收錄者刻意顯示英文（事後補救）** — 見 poiCategoryLabel。
 * key 一律小寫（lookup 前 toLowerCase）。
 */
const GOOGLE_PRIMARY_TYPE_LABELS: Record<string, string> = {
  // 餐飲（吃 → 粉）
  ramen_restaurant: '拉麵', sushi_restaurant: '壽司', japanese_restaurant: '日式料理',
  chinese_restaurant: '中式料理', korean_restaurant: '韓式料理', italian_restaurant: '義式料理',
  french_restaurant: '法式料理', thai_restaurant: '泰式料理', indian_restaurant: '印度料理',
  vietnamese_restaurant: '越南料理', mexican_restaurant: '墨西哥料理', spanish_restaurant: '西班牙料理',
  american_restaurant: '美式料理', greek_restaurant: '希臘料理', turkish_restaurant: '土耳其料理',
  middle_eastern_restaurant: '中東料理', indonesian_restaurant: '印尼料理', asian_restaurant: '亞洲料理',
  seafood_restaurant: '海鮮料理', steak_house: '牛排館', barbecue_restaurant: '燒烤',
  hamburger_restaurant: '漢堡', pizza_restaurant: '披薩', fast_food_restaurant: '速食',
  vegetarian_restaurant: '蔬食', vegan_restaurant: '純素', sandwich_shop: '三明治',
  breakfast_restaurant: '早餐', brunch_restaurant: '早午餐', diner: '小餐館', buffet_restaurant: '自助餐',
  cafe: '咖啡廳', coffee_shop: '咖啡廳', cafeteria: '自助餐廳', bakery: '烘焙坊', tea_house: '茶館',
  bar: '酒吧', pub: '酒館', wine_bar: '酒吧', bar_and_grill: '餐酒館',
  ice_cream_shop: '冰淇淋', dessert_shop: '甜點', dessert_restaurant: '甜點', donut_shop: '甜甜圈',
  bagel_shop: '貝果', juice_shop: '果汁', confectionery: '甜點店', candy_store: '糖果店',
  chocolate_shop: '巧克力', food_court: '美食街', deli: '熟食', meal_takeaway: '外帶', meal_delivery: '外送',
  food: '餐廳',
  // 景點・文化（看 → 柔褐）
  tourist_attraction: '景點', aquarium: '水族館', art_gallery: '美術館', museum: '博物館',
  amusement_park: '遊樂園', zoo: '動物園', water_park: '水上樂園', wildlife_park: '野生動物園',
  wildlife_refuge: '野生動物保護區', shinto_shrine: '神社', buddhist_temple: '寺廟', hindu_temple: '印度廟',
  church: '教堂', mosque: '清真寺', synagogue: '猶太會堂', place_of_worship: '宗教場所',
  historical_landmark: '歷史地標', historical_place: '史蹟', monument: '紀念碑', observation_deck: '觀景台',
  cultural_landmark: '文化地標', cultural_center: '文化中心', national_park: '國家公園', state_park: '州立公園',
  park: '公園', garden: '花園', botanical_garden: '植物園', beach: '海灘', hiking_area: '健行步道',
  plaza: '廣場', tourist_information_center: '遊客中心', planetarium: '天文館', ferris_wheel: '摩天輪',
  point_of_interest: '景點', landmark: '地標',
  // 購物（買 → 柔褐）
  shopping_mall: '購物中心', shopping_center: '購物中心', department_store: '百貨公司', supermarket: '超市',
  convenience_store: '便利商店', grocery_store: '雜貨店', market: '市場', clothing_store: '服飾店',
  shoe_store: '鞋店', jewelry_store: '珠寶店', book_store: '書店', electronics_store: '電子產品',
  gift_shop: '禮品店', furniture_store: '家具店', home_goods_store: '家居用品', hardware_store: '五金行',
  liquor_store: '酒品店', pharmacy: '藥局', drugstore: '藥妝店', pet_store: '寵物店', florist: '花店',
  cosmetics_store: '美妝店', sporting_goods_store: '運動用品', discount_store: '折扣店', store: '商店',
  wholesaler: '批發',
  // 住宿（住 → sage）
  lodging: '飯店', motel: '汽車旅館', hostel: '青年旅館', guest_house: '民宿', bed_and_breakfast: '民宿',
  resort_hotel: '度假飯店', campground: '露營地', rv_park: '露營車場', cottage: '小屋', inn: '旅館',
  extended_stay_hotel: '長租旅館',
  // 交通（移動 → sage）
  airport: '機場', international_airport: '國際機場', train_station: '火車站', subway_station: '地鐵站',
  bus_station: '巴士站', transit_station: '轉運站', light_rail_station: '輕軌站', ferry_terminal: '渡輪碼頭',
  taxi_stand: '計程車站', bus_stop: '公車站', gas_station: '加油站', ev_charging_station: '充電站',
  rest_stop: '休息站', car_rental: '租車',
  // 活動・娛樂（玩 → 柔褐）
  movie_theater: '電影院', night_club: '夜店', casino: '賭場', bowling_alley: '保齡球館', spa: 'SPA',
  gym: '健身房', fitness_center: '健身中心', stadium: '體育場', arena: '競技場', concert_hall: '音樂廳',
  performing_arts_theater: '劇場', karaoke: 'KTV', sports_complex: '運動中心', swimming_pool: '游泳池',
  ski_resort: '滑雪場', golf_course: '高爾夫球場', marina: '碼頭', amusement_center: '遊樂中心',
  community_center: '社區中心', event_venue: '活動場地', banquet_hall: '宴會廳',
};

/**
 * v2.55.73: 未收錄的英文 primaryType → 人性化英文（底線轉空格、每字首大寫）。
 * 使用者要求「沒對應到中文的就顯示英文，事後補救」— 讓缺漏的 mapping 直接可見。
 * 例：`hindu_temple_annex` → `Hindu Temple Annex`。
 */
function humanizePrimaryType(raw: string): string {
  return raw
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

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
  if (/hotel|lodging|hostel|motel|guest_house|bed_and_breakfast|resort|tourism|(?:^|_)inn(?:_|$)/.test(c)) return 'hotel';
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
  // 1) 純 CJK/假名 curated label（拉麵/浮潛）→ 原樣（英文 matcher 讀不懂中文）。
  //    ぀-ヿ = 平假名+片假名, 一-鿿 = CJK 漢字
  if (/[぀-ヿ一-鿿]/.test(c) && !/[a-zA-Z]/.test(c)) return c;
  const key = c.toLowerCase();
  // 2) v2.55.73 細類表命中 → 中文細類（拉麵/神社/百貨…）。
  const fine = GOOGLE_PRIMARY_TYPE_LABELS[key];
  if (fine) return fine;
  // 3) 8 大類 whitelist 值（restaurant/other…）→ 對應中文 label。
  if (WHITELIST_SET.has(key)) return POI_TYPE_LABELS[key as PoiType];
  // 4) v2.55.73 純 snake_case 英文（真實 primaryType 但未收錄）→ 顯示英文（事後補救，
  //    讓缺漏 mapping 直接可見）。
  if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/i.test(c)) return humanizePrimaryType(c);
  // 5) 其餘（混合中英 / 數字 / emoji / 全形雜訊）→ 乾淨粗類 label，不原樣噴垃圾。
  return POI_TYPE_LABELS[mapGooglePrimaryTypeToPoiType(c)];
}

/**
 * @deprecated 名稱誤導（餵進來的其實是 Google `primaryType`，不是 Nominatim）。
 * 改用 {@link mapGooglePrimaryTypeToPoiType}。保留 alias 讓既有 caller 與測試解析。
 */
export const mapNominatimCategory = mapGooglePrimaryTypeToPoiType;
