# 行程規劃網站（trip-planner）

## 專案結構

```
index.html              — HTML 外殼（載入 css/js，含 sidebar + container + info-panel 三欄佈局 + FAB）
edit.html               — AI 修改行程頁面（含漢堡選單 + X 關閉，載入 css/js）
switch.html             — 切換行程獨立頁面
css/
  shared.css            — 共用樣式（variables, reset, base layout, container, sticky-nav, dark mode, buttons）
  menu.css              — 選單/側邊欄樣式（hamburger, drawer, sidebar, backdrop）
  style.css             — Trip 專用樣式（timeline, weather, hotel, nav, cards, FAB, info-panel, print）
  edit.css              — Edit 專用樣式（form, nav title, close button, request history）
  switch.css            — Switch 專用樣式（行程清單佈局）
js/
  shared.js             — 共用函式（escHtml, escUrl, localStorage helpers, dark mode, GitHub constants）
  menu.js               — 選單/側邊欄邏輯（isDesktop, toggleMenu, toggleSidebar, swipe, resize）
  icons.js              — SVG icon 集中管理（icon registry, emoji 對映, helper 函式）
  app.js                — Trip 專用邏輯（載入 JSON、渲染、導航、天氣；依賴 shared.js + menu.js + icons.js）
  edit.js               — Edit 專用邏輯（GitHub Issues API, URL ?trip= 初始化, menu, request submission）
  switch.js             — Switch 專用邏輯（讀取 trips.json、渲染行程清單）
data/
  trips.json            — 行程清單（供切換選單讀取，含 owner 欄位）
  trips/                — 行程參數檔
    okinawa-trip-2026-Ray.json
    okinawa-trip-2026-HuiYun.json
package.json            — npm 依賴（vitest, playwright, jsdom, serve）
vitest.config.js        — Vitest 設定
playwright.config.js    — Playwright 設定
tests/                  — 測試（詳見「測試」章節）
.claude/commands/       — Cowork Skills（已簽入版控）
  add-spot.md           — 將景點/餐廳加入行程
  deploy.md             — Commit + push + 開啟 GitHub Pages
  render-trip.md   — 處理 GitHub Issues 行程修改請求
CLAUDE.md               — 開發規範
```

- GitHub Pages 網址：https://raychiutw.github.io/trip-planner/

## 行程參數檔格式（`data/trips/*.json`）

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
  "transit": { "text": "交通資訊", "type": "car|train|walking" },  // 可選
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

### trips.json 格式

```jsonc
[
  {
    "file": "data/trips/okinawa-trip-2026-Ray.json",
    "name": "Ray 的沖繩之旅",
    "dates": "2026/7/29 ~ 8/2",
    "owner": "Ray"
  }
]
```

- `owner` 欄位用於 edit.html 的行程歸屬檢查

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
- `js/shared.js` 提供共用函式（`escHtml`, `escUrl`, `sanitizeHtml`, `stripInlineHandlers`, `lsSet/lsGet/lsRemove/lsRenewAll`, `toggleDarkShared`, `GH_OWNER`, `GH_REPO`），所有頁面都載入
- `js/menu.js` 提供選單/側邊欄函式（`isDesktop`, `toggleMenu`, `toggleSidebar`, `closeMobileMenuIfOpen`, `updateDarkBtnText`），所有頁面都載入，依賴 shared.js
- `js/icons.js` 提供 SVG icon 集中管理（`ICONS` registry, `EMOJI_ICON_MAP` 對映, `icon`, `iconSpan`, `emojiToIcon`），所有頁面都載入，依賴無
- `js/app.js` 依賴 shared.js + menu.js + icons.js，透過 `fetch()` 載入 `data/trips/*.json` 動態渲染頁面
- `js/edit.js` 依賴 shared.js + menu.js + icons.js，處理 GitHub Issues API 與設定/編輯流程
- `js/switch.js` 依賴 shared.js + menu.js，讀取 trips.json 並渲染行程選擇清單
- CSS class 命名慣例：
  - `.restaurant-choices` / `.restaurant-choice` — 餐廳三選一區塊
  - `.restaurant-meta` — 營業時間與預約資訊
  - `.souvenir-info` — 伴手禮推薦
  - `.reservation-info` — 預約 / 門票資訊
  - `.parking-info` — 停車場資訊
  - `.map-link` / `.map-link-inline` — 地圖連結（Google / Apple / Mapcode）
  - `.day-1` ~ `.day-N` — 各天主題色（天數由 JSON 決定）
  - `.driving-summary` — 全旅程交通統計（航班資訊下方）
  - `.driving-summary-day` — 全旅程交通統計各天明細
  - `.transport-type-group` — 交通類型分組
  - `.transport-type-label` — 交通類型標籤
  - `.transport-type-summary` — 全旅程交通類型摘要
  - `.info-panel` — 桌機右側資訊面板（≥1200px 顯示）
  - `.info-card` — 資訊面板卡片
  - `.countdown-card` — 行程倒數器
  - `.stats-card` — 行程統計卡
  - `.edit-fab` — 右下角 AI 修改行程 FAB 按鈕
  - `.edit-page` / `.edit-main` — 編輯頁面佈局
  - `.edit-nav-title` — 編輯頁面 sticky-nav 標題
  - `.edit-close` — 編輯頁面右上角 X 關閉按鈕
  - `.switch-page` / `.switch-main` — 切換行程頁面佈局
- 地圖連結格式：Google Map + Apple Map + Mapcode 三組

### CSS/JS 拆分規則

| 檔案 | 載入頁面 | 內容 |
|------|---------|------|
| `css/shared.css` | 全部 | variables, reset, body, `.page-layout`, `.container`, `.sticky-nav`, `.trip-btn`, dark mode base |
| `css/menu.css` | 全部 | hamburger icon, menu drawer, sidebar, backdrop, desktop sidebar, dark/print mode |
| `css/style.css` | index only | timeline, weather, hotel, nav, cards, FAB, info-panel, print, trip-specific dark mode |
| `css/edit.css` | edit only | edit page form/nav title/close button/history, edit-specific dark mode |
| `css/switch.css` | switch only | switch page layout, header, list |
| `js/shared.js` | 全部 | `escHtml`, `escUrl`, `sanitizeHtml`, `stripInlineHandlers`, LS helpers, dark mode, `GH_OWNER`/`GH_REPO` |
| `js/menu.js` | 全部 | `isDesktop`, `toggleMenu`, `toggleSidebar`, `closeMobileMenuIfOpen`, swipe gesture, resize handler |
| `js/icons.js` | 全部 | `ICONS` SVG registry, `EMOJI_ICON_MAP` emoji→icon 對映, `icon`, `iconSpan`, `emojiToIcon` |
| `js/app.js` | index only | 所有 render/weather/nav/routing 函式（依賴 shared.js + menu.js + icons.js 的全域函式） |
| `js/edit.js` | edit only | GitHub API, URL ?trip= init, menu, edit form, request history |
| `js/switch.js` | switch only | 讀取 trips.json，渲染行程選擇清單 |

### UI 設計規範

- **無框線設計**：全站不使用 `border` 作為視覺分隔，改用背景色差、間距、圓角、`box-shadow` 區分區塊
  - 地圖連結按鈕：使用 `background` 填色取代 `border`
  - 可收合區塊（`.col-row`）：不使用底線分隔
  - 餐廳選項：不使用虛線分隔
  - 建議卡片、警告卡片：不使用 `border-left` 色條
  - 天氣方塊：不使用邊框，當前時段用 `box-shadow` 標示
  - 行程切換按鈕：使用背景色填充，選中狀態用 `box-shadow`
  - Footer：不使用 `border-top` 分隔線
  - 唯一例外：`.timeline` 的 `border-left` 保留（時間軸視覺線條）
- **字級設定**：
  - `--fs-lg`：桌機 `1.25rem`，手機 `1.35rem`
  - `--fs-md`：桌機 `0.95rem`，手機 `1.05rem`
  - 選單項目（`.menu-item`）使用 `--fs-lg`（最大字級）
- **防止水平捲動**：`html` 與 `body` 設定 `overflow-x: hidden`，`body` 設定 `max-width: 100vw`
- **選單標題**：顯示 "Trip Planner"（非「選單」）
- **卡片統一風格**：所有 section 以白色圓角卡片呈現（`#tripContent section { background: var(--white); border-radius: 12px; }`），子元素（suggestion-card, ov-card, flight-row 等）不另設底色
- **行程切換**：透過獨立頁面 `switch.html`（非 overlay dialog），由 `switchTripFile()` 導向
- **Icon 設計**：全站使用 inline SVG（Material Symbols Rounded 風格），不使用 emoji
  - 所有 SVG icon 集中在 `js/icons.js`，使用 `viewBox="0 0 24 24"` + `fill="currentColor"`
  - `iconSpan(name)` 產生 `<span class="svg-icon" aria-hidden="true">...</span>` wrapper
  - `emojiToIcon(emoji)` 將 JSON 中的 emoji 字元映射為 SVG icon，未映射者保留原字元
  - `.svg-icon` CSS：`display: inline-flex; width: 1em; height: 1em; vertical-align: -0.125em`
  - 顏色自動繼承 `currentColor`（Light mode 黑色、Dark mode 白色）
  - 新增 icon 時只需在 `js/icons.js` 的 `ICONS` 物件加入 SVG path

### 內容規範

- 所有用餐時段統一 1.5 小時
- 每餐提供三選一（拉麵 + 燒肉 + 其他推薦）
- 每家餐廳標註營業時間，可預約者附預約連結
- 語言：繁體中文台灣用語，日文店名保留原文

### 每日交通統計規範

- `app.js` 的 `calcDrivingStats()` 會自動從 `timeline[].transit` 中篩選 `TRANSPORT_TYPES` 定義的 type key（`car` 開車、`train` 電車、`walking` 步行），解析分鐘數並按類型分組
- 每日統計預設只顯示總計，以 `.col-row` / `.col-detail` 可收合模式展開看明細
- **開車超過 120 分鐘（2 小時）的天數會以警告樣式（黃底＋紅色徽章）顯示**
- 每次新增或修改行程參數檔的 `timeline` 時，transit 必須包含 `type`（`car`/`train`/`walking`）和 `text`（含分鐘數如「約40分鐘」），才能正確計算
- CSS class：`.driving-stats`（正常）、`.driving-stats-warning`（超過 2 小時）
- **位置**：渲染在住宿旅館（hotel）下方、時間軸（timeline）之前

### 全旅程交通統計規範

- `calcTripDrivingStats(days)` 彙總所有天的交通資料，計算全旅程總交通時間，並按類型加總 (`grandByType`)
- `renderTripDrivingStats(tripStats)` 渲染為兩層巢狀可收合區塊，包含：
  - 全旅程總交通時間
  - 按交通類型摘要（🚗 開車 / 🚝 電車 / 🚶 步行）
  - 每日交通明細（可展開，含各類型分段細節）
  - 開車超過 2 小時的天數顯示警告樣式
- **位置**：渲染在航班資訊（flights）區段下方
- 行程參數檔變更後會自動重新統計（渲染時即時計算）

### 桌機資訊面板規範

- `isDesktop()` 使用 User-Agent 偵測：只有手機（iPhone、Android Mobile、iPod、Opera Mini）判為非桌機，平板及桌機均視為桌機
- CSS `@media (min-width: 768px)` 控制 sidebar 顯示，`@media (min-width: 1200px)` 控制 info-panel 三欄佈局
- 三欄佈局：sidebar (260px) + content (flex:1) + info-panel (280px)
- `renderCountdown(autoScrollDates)`：出發前顯示倒數天數、旅行中顯示 Day N、已結束顯示提示
- `renderTripStatsCard(data)`：顯示天數、景點數、交通統計摘要、預估預算
- `renderInfoPanel(data)`：在 `renderTrip()` 最後呼叫，僅在面板可見時渲染

### 行程 JSON 連動更新規範

- **行程 JSON（`days` 內容）有變動時**，必須同步檢查並重新建立以下區段：
  - `checklist`（出發前確認清單）：依最新行程內容更新需準備的項目（如預約、門票、租車、Wi-Fi 等）
  - `backup`（雨天備案）：依最新各天行程地點，提供對應的室內替代方案
  - `suggestions`（行程建議）：依最新行程重新評估高/中/低優先建議事項
  - **每日交通統計**：確認每個 transit 的 text 欄位包含分鐘數，讓 `calcDrivingStats()` 能正確計算；開車超過 2 小時的天數應考慮精簡行程
- 確保以上區段的內容與最新行程一致，避免出現已刪除景點的殘留資訊或遺漏新增景點的相關提醒

### AI 修改行程功能（edit.html）

#### 架構
```
Trip 頁面 → 右下角 FAB → 導向 edit.html?trip={slug}
Edit 頁面 → URL ?trip= 直入（無 setup flow）→ 漢堡選單 + X 關閉 → 輸入修改文字 → POST GitHub Issue (label: trip-edit)
Cowork /render-trip → 讀 Issue → 改 trip JSON → npm test → commit push → close Issue
```

#### 安全設計
- **GitHub PAT**：Fine-Grained，僅 `Issues: Read+Write`，無 Contents 權限，寫死在 edit.js（所有旅伴共用）
- **Cowork 白名單**：`git diff --name-only` 只允許 `data/trips/{tripSlug}.json`
- **CSP**：`connect-src` 含 `https://api.github.com`

#### Issue 格式
```json
{
  "title": "[trip-edit] {owner}: {text前50字}",
  "body": { "owner": "Ray", "tripSlug": "okinawa-trip-2026-Ray", "text": "...", "timestamp": "..." },
  "labels": ["trip-edit"]
}
```

#### Cowork Skill（`/render-trip`）
- 定時執行，讀取 `--label trip-edit --state open` 的 Issue
- 解析 body JSON → 修改對應 trip JSON → `git diff --name-only` 白名單檢查
- 通過 → npm test → commit push → close Issue + comment
- 失敗 → git checkout → close Issue + error comment
- **禁止修改**：js/app.js, js/shared.js, js/menu.js, js/icons.js, js/edit.js, js/switch.js, css/style.css, css/shared.css, css/menu.css, css/edit.css, css/switch.css, index.html, edit.html, switch.html, data/trips.json

## 測試

### 測試架構

```
tests/
├── unit/                    ← 單元測試（Vitest + jsdom）
│   ├── escape.test.js       ← escHtml, escUrl, stripInlineHandlers（from shared.js）
│   ├── render.test.js       ← 所有 render 函式
│   ├── validate.test.js     ← validateTripData, validateDay, renderWarnings
│   └── routing.test.js      ← fileToSlug, slugToFile
├── integration/             ← 整合測試（Vitest + 真實 JSON）
│   └── render-pipeline.test.js ← 真實 JSON → render 函式 → HTML 驗證
├── json/                    ← JSON 結構驗證（Vitest）
│   ├── schema.test.js       ← validateTripData 驗證 + 額外品質檢查
│   └── registry.test.js     ← trips.json 檔案參照驗證
└── e2e/                     ← E2E 測試（Playwright + Chromium）
    ├── trip-page.spec.js    ← Trip 頁面真實瀏覽器互動驗證
    └── edit-page.spec.js   ← Edit 頁面漢堡選單/X 關閉/深色模式驗證
```

### 執行方式

```bash
npm test          # 單元 + 整合 + JSON 驗證（Vitest）
npm run test:e2e  # E2E 瀏覽器測試（Playwright）
npm run test:watch # Vitest 監聯模式（開發時用）
```

### 測試規範

- **只有變更到程式碼（含 `data/trips/*.json`）時才需要跑測試**；僅修改 `CLAUDE.md`、`README.md` 等文件不需跑測試
- **⚠️ 必須遵守：commit 前一定要跑測試並全數通過，不得跳過**
  - 修改 `data/trips/*.json`：至少跑 `npm test`
  - 修改 `js/app.js` / `js/shared.js` / `js/icons.js` / `css/style.css` / `css/shared.css` / `index.html`：**必須同時跑 `npm test` 和 `npm run test:e2e`**
  - 修改 `js/edit.js` / `css/edit.css` / `edit.html` / `js/menu.js` / `css/menu.css`：跑 `npm test`（確保共用函式未被破壞）
  - 修改 `switch.html` / `js/switch.js` / `css/switch.css`：跑 `npm test`
  - 測試失敗時必須修復後重跑，不得帶著失敗 commit
- `tests/setup.js` 先載入 `js/shared.js`，再載入 `js/menu.js`，再載入 `js/icons.js`（提供 escHtml、isDesktop、iconSpan 等全域函式），再載入全域 stub
- `js/app.js` 和 `js/shared.js` 末尾有條件式 `module.exports`，瀏覽器忽略，Node.js/Vitest 可 require
- E2E 測試 mock Weather API（`page.route`），避免外部網路依賴
- 新增 render 函式時，需同步在 `tests/unit/render.test.js` 和 `js/app.js` 的 `module.exports` 加上對應測試與匯出
- 共用函式（escHtml 等）的測試從 `js/shared.js` import，app.js 專屬函式的測試從 `js/app.js` import
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
