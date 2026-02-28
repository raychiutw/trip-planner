# 2026 沖繩五日自駕遊行程網頁

## 專案結構

```
index.html              — HTML 外殼（載入 CSS / JS）
style.css               — 所有樣式
app.js                  — 所有邏輯（載入 JSON、渲染、導航、天氣）
data/
  trips.json            — 行程清單（供切換選單讀取）
  okinawa-trip-2026-Ray.json    — 行程參數檔
  okinawa-trip-2026-HuiYun.json — 行程參數檔
package.json            — npm 依賴（vitest, playwright, jsdom, serve）
vitest.config.js        — Vitest 設定
playwright.config.js    — Playwright 設定
tests/                  — 測試（詳見「測試」章節）
CLAUDE.md               — 開發規範
```

- GitHub Pages 網址：https://raychiutw.github.io/trip-planner/

## 行程參數檔格式（`data/*.json`）

### 頂層結構

```jsonc
{
  "meta": { "title", "dates", "travelers" },
  "autoScrollDates": { "start", "end" },
  "weather": [WeatherDay],
  "days": [Day],
  "flights": Flights,
  "checklist": CardSection,
  "backup": CardSection,
  "emergency": CardSection,
  "footerHtml": "<HTML>"
}
```

### 共用型別

```jsonc
// Location — 景點 / 地址資訊
{
  "name": "景點名稱",
  "address": "地址（可選）",
  "google": "Google Maps URL",
  "apple": "Apple Maps URL",
  "mapcode": "Mapcode 字串（可選）"
}

// TimelineEvent — 行程時間軸事件
{
  "time": "09:00–10:30",
  "title": "事件標題",
  "location": Location,            // 可選
  "desc": "簡短說明",               // 可選
  "transit": "交通資訊",            // 可選
  "info": [InfoBox],               // 可選，展開後的資訊卡
  "restaurants": [Restaurant]      // 可選，餐廳選項
}

// InfoBox — 資訊卡（展開內容）
{
  "type": "reservation | parking | souvenir | note",
  "content": "<HTML>"
}

// Restaurant — 餐廳三選一
{
  "name": "店名",
  "cuisine": "料理類型",
  "hours": "營業時間",
  "reserve": "預約連結（可選）",
  "location": Location             // 可選
}

// Hotel — 住宿資訊
{
  "name": "飯店名稱",
  "checkin": "15:00",
  "checkout": "11:00",
  "status": "paid | pending",
  "confirm": "訂單編號（可選）",
  "location": Location,
  "notes": "<HTML>（可選）"
}

// Budget — 當日費用
{
  "items": [{ "label": "項目", "amount": 1000 }],
  "currency": "JPY",
  "notes": ["備註 1", "備註 2"]     // 可選
}
```

### Day 結構

```jsonc
{
  "id": "day-1",
  "date": "2026-04-30",
  "label": "Day 1 那霸・國際通",
  "weatherId": "day1",             // 對應 weather[].id
  "hotel": Hotel,                  // 可選
  "timeline": [TimelineEvent],
  "budget": Budget                 // 可選
}
```

### Flights 結構

```jsonc
{
  "title": "航班資訊",
  "airline": "航空公司名稱（可選）",
  "segments": [
    {
      "label": "去程",
      "flight": "BR1234",
      "route": "TPE → OKA",
      "date": "2026-04-30",
      "depart": "08:00",
      "arrive": "11:30",
      "notes": "備註（可選）"
    }
  ]
}
```

### CardSection 結構（checklist / backup / emergency）

```jsonc
{
  "title": "區段標題",
  "cards": [
    {
      "title": "卡片標題",
      "items": ["項目 1", "項目 2"]  // 或 "<HTML>"
    }
  ]
}
```

### WeatherDay 結構

```jsonc
{
  "id": "day1",
  "date": "2026-04-30",
  "label": "Day 1",
  "locations": [{ "lat": 26.21, "lon": 127.68, "name": "那霸", "start": "09:00", "end": "18:00" }]
}
```

- `days` 陣列決定天數與每日內容，增減天數只需修改此陣列
- `weather[].locations` 決定各天的天氣預報地點
- 新增行程檔後，於 `data/trips.json` 登錄即可在選單中顯示
- 舊格式（`days[].content: "<HTML>"`）仍向下相容，app.js 自動偵測渲染模式

## 開發規範

### Git 工作流程

- 每次完成修改後，主動 commit 並 push 到 `origin/master`
- Commit 訊息使用繁體中文，簡述改了什麼
- 格式範例：
  ```
  Day 4 移除殘波岬，新增 AEON Mall 來客夢（寶可夢＋UNIQLO）

  - 細節說明 1
  - 細節說明 2

  Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
  ```

### 程式碼風格

- `index.html` 為精簡外殼，CSS 與 JS 各自獨立檔案
- `app.js` 透過 `fetch()` 載入 `data/*.json` 動態渲染頁面
- CSS class 命名慣例：
  - `.restaurant-choices` / `.restaurant-choice` — 餐廳三選一區塊
  - `.restaurant-meta` — 營業時間與預約資訊
  - `.souvenir-info` — 伴手禮推薦
  - `.reservation-info` — 預約 / 門票資訊
  - `.parking-info` — 停車場資訊
  - `.map-link` / `.map-link-inline` — 地圖連結（Google / Apple / Mapcode）
  - `.day-1` ~ `.day-N` — 各天主題色（天數由 JSON 決定）
- 地圖連結格式：Google Map + Apple Map + Mapcode 三組

### 內容規範

- 所有用餐時段統一 1.5 小時
- 每餐提供三選一（拉麵 + 燒肉 + 其他推薦）
- 每家餐廳標註營業時間，可預約者附預約連結
- 語言：繁體中文台灣用語，日文店名保留原文

## 測試

### 測試架構

```
tests/
├── unit/                    ← 單元測試（Vitest + jsdom）
│   ├── escape.test.js       ← escHtml, escUrl, stripInlineHandlers
│   ├── render.test.js       ← 所有 render 函式
│   ├── validate.test.js     ← validateDay, renderWarnings
│   └── routing.test.js      ← fileToSlug, slugToFile
├── integration/             ← 整合測試（Vitest + 真實 JSON）
│   └── render-pipeline.test.js ← 真實 JSON → render 函式 → HTML 驗證
├── json/                    ← JSON 結構驗證（Vitest）
│   ├── schema.test.js       ← 行程 JSON 結構完整性 + URL 安全性
│   └── registry.test.js     ← trips.json 檔案參照驗證
└── e2e/                     ← E2E 測試（Playwright + Chromium）
    └── trip-page.spec.js    ← 真實瀏覽器互動驗證
```

### 執行方式

```bash
npm test          # 單元 + 整合 + JSON 驗證（Vitest，173 個測試）
npm run test:e2e  # E2E 瀏覽器測試（Playwright，30 個測試）
npm run test:watch # Vitest 監聽模式（開發時用）
```

### 測試規範

- app.js 末尾有條件式 `module.exports`，瀏覽器忽略，Node.js/Vitest 可 require
- `tests/setup.js` 提供全域 stub（localStorage、DOM 元素、meta 標籤）
- E2E 測試 mock Weather API（`page.route`），避免外部網路依賴
- 新增 render 函式時，需同步在 `tests/unit/render.test.js` 和 `app.js` 的 `module.exports` 加上對應測試與匯出
- 修改 JSON 結構時，需確認 `tests/json/schema.test.js` 的驗證規則仍正確
- 新增互動行為時，需在 `tests/e2e/trip-page.spec.js` 加上對應 E2E 測試
