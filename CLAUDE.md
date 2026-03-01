# 行程規劃網站（trip-planner）

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

### 每日車程統計規範

- `app.js` 的 `calcDrivingStats()` 會自動從 `timeline[].transit` 中篩選 emoji 為 🚗 的項目，解析分鐘數並加總
- **超過 120 分鐘（2 小時）的天數會以警告樣式（黃底＋紅色徽章）顯示**
- 每次新增或修改行程參數檔的 `timeline` 時，transit 的 text 必須包含分鐘數（如「約40分鐘」），才能正確計算車程
- CSS class：`.driving-stats`（正常）、`.driving-stats-warning`（超過 2 小時）
- 位置：渲染在 timeline 之後、budget 之前

### 行程 JSON 連動更新規範

- **行程 JSON（`days` 內容）有變動時**，必須同步檢查並重新建立以下區段：
  - `checklist`（出發前確認清單）：依最新行程內容更新需準備的項目（如預約、門票、租車、Wi-Fi 等）
  - `backup`（雨天備案）：依最新各天行程地點，提供對應的室內替代方案
  - `suggestions`（行程建議）：依最新行程重新評估高/中/低優先建議事項
  - **每日車程統計**：確認每個 transit 的 text 欄位包含分鐘數，讓 `calcDrivingStats()` 能正確計算；超過 2 小時的天數應考慮精簡行程
- 確保以上區段的內容與最新行程一致，避免出現已刪除景點的殘留資訊或遺漏新增景點的相關提醒

## 測試

### 測試架構

```
tests/
├── unit/                    ← 單元測試（Vitest + jsdom）
│   ├── escape.test.js       ← escHtml, escUrl, stripInlineHandlers
│   ├── render.test.js       ← 所有 render 函式
│   ├── validate.test.js     ← validateTripData, validateDay, renderWarnings
│   └── routing.test.js      ← fileToSlug, slugToFile
├── integration/             ← 整合測試（Vitest + 真實 JSON）
│   └── render-pipeline.test.js ← 真實 JSON → render 函式 → HTML 驗證
├── json/                    ← JSON 結構驗證（Vitest）
│   ├── schema.test.js       ← validateTripData 驗證 + 額外品質檢查
│   └── registry.test.js     ← trips.json 檔案參照驗證
└── e2e/                     ← E2E 測試（Playwright + Chromium）
    └── trip-page.spec.js    ← 真實瀏覽器互動驗證
```

### 執行方式

```bash
npm test          # 單元 + 整合 + JSON 驗證（Vitest）
npm run test:e2e  # E2E 瀏覽器測試（Playwright）
npm run test:watch # Vitest 監聽模式（開發時用）
```

### 測試規範

- **只有變更到程式碼（含 `data/*.json`）時才需要跑測試**；僅修改 `CLAUDE.md`、`README.md` 等文件不需跑測試
- **⚠️ 必須遵守：commit 前一定要跑測試並全數通過，不得跳過**
  - 修改 `data/*.json`：至少跑 `npm test`
  - 修改 `app.js` / `style.css` / `index.html`：**必須同時跑 `npm test` 和 `npm run test:e2e`**
  - 測試失敗時必須修復後重跑，不得帶著失敗 commit
- app.js 末尾有條件式 `module.exports`，瀏覽器忽略，Node.js/Vitest 可 require
- `tests/setup.js` 提供全域 stub（localStorage、DOM 元素、meta 標籤）
- E2E 測試 mock Weather API（`page.route`），避免外部網路依賴
- 新增 render 函式時，需同步在 `tests/unit/render.test.js` 和 `app.js` 的 `module.exports` 加上對應測試與匯出
- 修改 JSON 結構時，需確認 `tests/json/schema.test.js` 的驗證規則仍正確
- 新增互動行為時，需在 `tests/e2e/trip-page.spec.js` 加上對應 E2E 測試

## Agent Teams 使用規範

- 執行複雜任務時，盡量使用 agent teams 並行處理（如多檔搜尋、多餐廳查詢、多檔編輯等）
- Agent teammates 統一使用 **sonnet** 模型（`model: "sonnet"`），以平衡效能與成本
- 適合使用 agent teams 的場景：
  - 多個餐廳 / 景點的網誌搜尋
  - 多個 JSON 檔案的平行編輯
  - 獨立的程式碼搜尋與研究任務
  - 測試執行與程式碼修改的平行作業
- 主要 agent（team lead）仍使用預設模型，僅 teammates 指定 sonnet
