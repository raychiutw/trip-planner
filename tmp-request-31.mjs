const BASE = 'https://trip-planner-dby.pages.dev';
const TRIP = 'okinawa-trip-2026-HuiYun';
const HEADERS = {
  'CF-Access-Client-Id': 'e5902a9d6f5181b8f70e12f1c11ebca3.access',
  'CF-Access-Client-Secret': '9c7d873d558eaf65cdc4160f9ec8f0c06d4f387fc069c7a7e1add0b8196b43a8',
  'Content-Type': 'application/json',
};

async function api(method, path, body) {
  const url = `${BASE}${path}`;
  const opts = { method, headers: HEADERS };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  console.log(`${method} ${path} → ${res.status}`);
  if (res.status >= 400) console.log('  ERROR:', JSON.stringify(data));
  return data;
}

async function main() {
  console.log('=== Day 2 修改 ===\n');

  // 1. DELETE 取車 entry (id:367)
  await api('DELETE', `/api/trips/${TRIP}/entries/367`);

  // 2. PATCH 飯店出發 (id:368): merge 取車 info, sort_order=0
  await api('PATCH', `/api/trips/${TRIP}/entries/368`, {
    sort_order: 0,
    body: '退房後在飯店取車出發｜7座車 Toyota Alphard｜4大3小（14、15、10歲）',
    note: '沖繩旅毛會將車開到飯店交車，取車時攜帶護照與台灣駕照日文譯本，確認車況並拍照存證',
  });

  // 3. PATCH 天久琉貿樂市 (id:369): sort_order=1, time
  await api('PATCH', `/api/trips/${TRIP}/entries/369`, {
    sort_order: 1,
    time: '09:07-10:07',
  });

  // 4. PATCH 浦添大公園 (id:373): move before lunch, sort_order=2
  await api('PATCH', `/api/trips/${TRIP}/entries/373`, {
    sort_order: 2,
    time: '10:22-11:22',
    travel_type: 'car',
    travel_desc: '約15分鐘',
    travel_min: 15,
  });

  // 5. PATCH 午餐@PARCO (id:371): sort_order=3
  await api('PATCH', `/api/trips/${TRIP}/entries/371`, {
    sort_order: 3,
    time: '11:42-12:42',
    travel_type: 'car',
    travel_desc: '約20分鐘',
    travel_min: 20,
  });

  // 6. PATCH PARCO購物 (id:372): sort_order=4, 3 hours
  await api('PATCH', `/api/trips/${TRIP}/entries/372`, {
    sort_order: 4,
    time: '12:42-15:42',
  });

  // 7. PATCH 晚餐@美國村 (id:374): sort_order=5
  await api('PATCH', `/api/trips/${TRIP}/entries/374`, {
    sort_order: 5,
    time: '16:06-17:06',
    travel_type: 'car',
    travel_desc: '約24分鐘',
    travel_min: 24,
  });

  // 8. PATCH 美國村 (id:375): sort_order=6
  await api('PATCH', `/api/trips/${TRIP}/entries/375`, {
    sort_order: 6,
    time: '17:06-20:06',
    travel_type: 'walk',
    travel_desc: '同商圈',
    travel_min: 0,
  });

  // 9. DELETE plate jam (id:376) — will become a restaurant backup
  await api('DELETE', `/api/trips/${TRIP}/entries/376`);

  // 10. PATCH Check in (id:377): sort_order=7
  await api('PATCH', `/api/trips/${TRIP}/entries/377`, {
    sort_order: 7,
    time: '20:11',
    travel_type: 'car',
    travel_desc: '約5分鐘',
    travel_min: 5,
  });

  // 11. POST plate jam as restaurant backup under 晚餐 (entry 374)
  await api('POST', `/api/trips/${TRIP}/entries/374/restaurants`, {
    name: 'plate jam',
    category: '美式料理',
    hours: '18:00~03:00',
    price: '¥1,000~',
    reservation: '{"available":"no","recommended":false}',
    description: 'plate jam — 北谷美式餐廳，漢堡薯條與啤酒，深夜營業適合宵夜或備案晚餐',
    note: '備案選項，位於北谷',
    rating: 3.8,
    maps: 'plate jam 北谷',
    mapcode: '33 587 527*50',
    source: 'user',
  });

  console.log('\n=== Day 5 修改 ===\n');

  // 12. PATCH Check in (id:491): add タウンプラザかねひで info
  await api('PATCH', `/api/trips/${TRIP}/entries/491`, {
    time: '20:21',
    body: '先到**タウンプラザかねひで 壺川店**採買（飯店旁步行3分鐘，09:00~23:00），再回飯店整理行李',
    note: '在地超市價格實惠，可買沖繩縣產豬肉生鮮、島豆腐、沖繩泡盛',
    travel_type: 'car',
    travel_desc: '約10分鐘',
    travel_min: 10,
  });

  console.log('\n=== 完成所有修改 ===');
}

main().catch(e => { console.error(e); process.exit(1); });
