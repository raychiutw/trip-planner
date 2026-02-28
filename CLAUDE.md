# 2026 沖繩五日自駕遊行程網頁

## 專案結構

```
index.html          — HTML 外殼（載入 CSS / JS）
style.css           — 所有樣式
app.js              — 所有邏輯（載入 JSON、渲染、導航、天氣）
data/
  trips.json        — 行程清單（供切換選單讀取）
  okinawa-trip-2026-Ray.json — 行程參數檔（天數、地點、航程、雨備等）
CLAUDE.md           — 開發規範
```

- GitHub Pages 網址：https://raychiutw.github.io/okinawa-trip-2026/

## 行程參數檔格式（`data/*.json`）

```jsonc
{
  "meta": { "title", "dates", "travelers" },
  "autoScrollDates": { "start", "end" },
  "weather": [{ "id", "date", "label", "locations": [{ "lat", "lon", "name", "start", "end" }] }],
  "days": [{ "id", "date", "label", "content": "<HTML>" }],
  "flights": { "title", "content": "<HTML>" },
  "checklist": { "title", "content": "<HTML>" },
  "backup": { "title", "content": "<HTML>" },
  "emergency": { "title", "content": "<HTML>" },
  "footer": "<HTML>",
  "footerHtml": "<HTML>"
}
```

- `days` 陣列決定天數與每日內容，增減天數只需修改此陣列
- `weather[].locations` 決定各天的天氣預報地點
- 新增行程檔後，於 `data/trips.json` 登錄即可在選單中顯示

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
