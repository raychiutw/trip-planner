# 架構參考文件

## CSS/JS 拆分規則

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
| `js/app.js` | index only | 所有 render/weather/nav/routing 函式（依賴 shared.js + menu.js + icons.js） |
| `js/edit.js` | edit only | GitHub API, URL ?trip= init, menu, edit form, request history |
| `js/switch.js` | switch only | 讀取 trips.json，渲染行程選擇清單 |

## 桌機資訊面板

- `isDesktop()` 使用 User-Agent 偵測：只有手機（iPhone、Android Mobile、iPod、Opera Mini）判為非桌機，平板及桌機均視為桌機
- CSS `@media (min-width: 768px)` 控制 sidebar 顯示，`@media (min-width: 1200px)` 控制 info-panel 三欄佈局
- 三欄佈局：sidebar (260px) + content (flex:1) + info-panel (280px)
- `renderCountdown(autoScrollDates)`：出發前顯示倒數天數、旅行中顯示 Day N、已結束顯示提示
- `renderTripStatsCard(data)`：顯示天數、景點數、交通統計摘要、預估預算
- `renderInfoPanel(data)`：在 `renderTrip()` 最後呼叫，僅在面板可見時渲染

## 交通統計

### 每日交通統計

- `calcDrivingStats()` 從 `timeline[].transit` 篩選 `TRANSPORT_TYPES`（`car`/`train`/`walking`），解析分鐘數並按類型分組
- 每日統計預設只顯示總計，以 `.col-row` / `.col-detail` 可收合模式展開看明細
- 開車超過 120 分鐘的天數以警告樣式顯示
- CSS class：`.driving-stats`（正常）、`.driving-stats-warning`（超過 2 小時）
- 渲染位置：住宿旅館（hotel）下方、時間軸（timeline）之前

### 全旅程交通統計

- `calcTripDrivingStats(days)` 彙總所有天交通資料，按類型加總（`grandByType`）
- `renderTripDrivingStats(tripStats)` 渲染為兩層巢狀可收合區塊
- 渲染位置：航班資訊（flights）區段下方

## AI 修改行程功能（edit.html）

### 架構

```
Trip 頁面 → 右下角 FAB → 導向 edit.html?trip={slug}
Edit 頁面 → URL ?trip= 直入（無 setup flow）→ 漢堡選單 + X 關閉 → 輸入修改文字 → POST GitHub Issue (label: trip-edit)
Cowork /render-trip → 讀 Issue → 改 trip JSON → npm test → commit push → close Issue
```

### 安全設計

- **GitHub PAT**：Fine-Grained，僅 `Issues: Read+Write`，無 Contents 權限，寫死在 edit.js（所有旅伴共用）
- **Cowork 白名單**：`git diff --name-only` 只允許 `data/trips/{tripSlug}.json`
- **CSP**：`connect-src` 含 `https://api.github.com`

### Issue 格式

```json
{
  "title": "[trip-edit] {owner}: {text前50字}",
  "body": { "owner": "Ray", "tripSlug": "okinawa-trip-2026-Ray", "text": "...", "timestamp": "..." },
  "labels": ["trip-edit"]
}
```

### Cowork Skill（`/render-trip`）

- 定時執行，讀取 `--label trip-edit --state open` 的 Issue
- 解析 body JSON → 修改對應 trip JSON → `git diff --name-only` 白名單檢查
- 通過 → npm test → commit push → close Issue + comment
- 失敗 → git checkout → close Issue + error comment
- **禁止修改**：js/app.js, js/shared.js, js/menu.js, js/icons.js, js/edit.js, js/switch.js, css/style.css, css/shared.css, css/menu.css, css/edit.css, css/switch.css, index.html, edit.html, switch.html, data/trips.json

## 測試架構

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

### 測試實作細節

- `tests/setup.js` 先載入 `js/shared.js` → `js/menu.js` → `js/icons.js`，再載入全域 stub
- `js/app.js` 和 `js/shared.js` 末尾有條件式 `module.exports`（瀏覽器忽略，Node.js/Vitest 可 require）
- E2E 測試 mock Weather API（`page.route`），避免外部網路依賴
- 新增 render 函式時，需同步在 `tests/unit/render.test.js` 和 `js/app.js` 的 `module.exports` 加上對應測試與匯出
- 共用函式測試從 `js/shared.js` import，app.js 專屬函式從 `js/app.js` import
- 修改 JSON 結構時，需確認 `tests/json/schema.test.js` 的驗證規則仍正確
- 新增互動行為時，需在 `tests/e2e/trip-page.spec.js` 加上對應 E2E 測試
