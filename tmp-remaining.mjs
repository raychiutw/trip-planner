import https from 'node:https';
import fs from 'node:fs';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://trip-planner-dby.pages.dev${path}`);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method,
      headers: {
        'CF-Access-Client-Id': 'e5902a9d6f5181b8f70e12f1c11ebca3.access',
        'CF-Access-Client-Secret': '9c7d873d558eaf65cdc4160f9ec8f0c06d4f387fc069c7a7e1add0b8196b43a8',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        console.log(`${method} ${path} → ${res.statusCode}`);
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', (e) => { console.error(`${method} ${path} ERROR:`, e.message); reject(e); });
    req.setTimeout(10000, () => { req.destroy(new Error('timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // 1. PATCH entry 374 note (plate jam backup info)
  await request('PATCH', '/api/trips/okinawa-trip-2026-HuiYun/entries/374', {
    note: '迴轉壽司排隊人多，建議先去抽號碼牌再逛美國村。**備案**：plate jam（北谷美式餐廳，18:00~03:00，¥1,000~，⭐3.8）'
  });

  // 2. Reply and close request #31
  const reply = `## 已完成 Day 2 行程調整 ✅

### 修改內容

1. **沖繩旅毛取車** → 已合併到「飯店出發」備註中（旅毛會將車開到飯店交車）
2. **plate jam** → 已移到晚餐備案（美國村晚餐 note 中）
3. **PARCO CITY 購物** → 已調整為 3 小時（12:42~15:42）
4. **浦添大公園** → 已移到中餐之前（10:22~11:22）
5. **タウンプラザかねひで 壺川店** → 已加入 Day 5 餐後（San-A 結束後回壺川採買，再步行回飯店）

### Day 2 新時間軸

| 時間 | 行程 |
|------|------|
| 09:00 | 飯店出發（取車） |
| 09:07-10:07 | 天久琉貿樂市 |
| 10:22-11:22 | 浦添大公園 |
| 11:42-12:42 | 午餐@PARCO CITY |
| 12:42-15:42 | PARCO CITY 購物（3hr） |
| 16:06-17:06 | 晚餐@美國村 |
| 17:06-20:06 | 美國村 |
| 20:11 | BUZZ RESORT Check in |`;

  await request('PATCH', '/api/requests/31', {
    reply,
    status: 'closed',
    processed_by: 'scheduler',
  });

  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
