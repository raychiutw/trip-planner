# 行程規劃網站（trip-planner）

## 專案結構

```
index.html          edit.html           switch.html
css/                shared.css  menu.css  style.css  edit.css  switch.css
js/                 shared.js   menu.js   icons.js   app.js   edit.js   switch.js
data/               trips.json  trips/
tests/              unit/  integration/  json/  e2e/
.claude/commands/   add-spot.md  deploy.md  render-trip.md
```

- GitHub Pages：https://raychiutw.github.io/trip-planner/
- JSON 格式參考：[docs/trip-json-schema.md](docs/trip-json-schema.md)
- 架構參考：[docs/architecture.md](docs/architecture.md)

## 開發規則

### Git

- 完成修改後主動 commit + push 到 `origin/master`
- Commit 訊息繁體中文，格式：
  ```
  簡述改了什麼

  - 細節說明

  Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
  ```

### 測試

- 僅程式碼 / JSON 變更才跑測試；文件變更不需跑
- **commit 前必須測試全過，不得跳過**
- 觸發規則：
  - `data/trips/*.json` → `npm test`
  - `js/app.js` / `js/shared.js` / `js/icons.js` / `css/style.css` / `css/shared.css` / `index.html` → `npm test` + `npm run test:e2e`
  - `js/edit.js` / `css/edit.css` / `edit.html` / `js/menu.js` / `css/menu.css` → `npm test`
  - `switch.html` / `js/switch.js` / `css/switch.css` → `npm test`

### UI 規則

- **無框線設計**：不用 `border` 分隔，改用背景色差、間距、圓角、`box-shadow`；唯一例外 `.timeline` 的 `border-left`
- **卡片統一**：section 白色圓角卡片，子元素不另設底色
- **全站 inline SVG**（Material Symbols Rounded），不用 emoji；新增 icon 加到 `js/icons.js` 的 `ICONS`
- **行程切換**用獨立頁面 `switch.html`（非 overlay dialog）

### 內容規則

- 繁體中文台灣用語，日文店名保留原文
- `days[].label` 行程名稱不超過 8 個字
- 用餐時段 1.5 小時，每餐三選一，標註營業時間，可預約者附連結
- `transit` 必須含 `type`（`car`/`train`/`walking`）+ `text`（含分鐘數如「約40分鐘」）

### JSON 連動

- `days` 變動 → 同步重建 `checklist`、`backup`、`suggestions`
- 確認 transit text 含分鐘數（供 `calcDrivingStats()` 計算）
- 確保無已刪除景點殘留、無遺漏新增景點提醒

### /render-trip 白名單

- 只允許修改 `data/trips/*.json`
- 禁止修改：所有 js/css/html 檔案、data/trips.json

### Agent Teams

- Teammates 用 **sonnet** 模型
- 適合場景：多檔搜尋、多餐廳查詢、平行編輯、測試與修改平行
- 獨立且不需等待結果的 agent 使用 `run_in_background: true` 背景執行，主線程繼續處理其他工作
