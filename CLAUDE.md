# 2026 沖繩五日自駕遊行程網頁

## 專案結構

- `index.html` — 單一檔案網頁（HTML + CSS + JS），包含五日完整行程表
- GitHub Pages 網址：https://raychiutw.github.io/okinawa-trip-2026/

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

- 單一 `index.html` 架構，CSS 與 JS 內嵌
- CSS class 命名慣例：
  - `.restaurant-choices` / `.restaurant-choice` — 餐廳三選一區塊
  - `.restaurant-meta` — 營業時間與預約資訊
  - `.souvenir-info` — 伴手禮推薦
  - `.reservation-info` — 預約 / 門票資訊
  - `.parking-info` — 停車場資訊
  - `.map-link` / `.map-link-inline` — 地圖連結（Google / Apple / Mapcode）
  - `.day-1` ~ `.day-5` — 各天主題色
- 地圖連結格式：Google Map + Apple Map + Mapcode 三組

### 內容規範

- 所有用餐時段統一 1.5 小時
- 每餐提供三選一（拉麵 + 燒肉 + 其他推薦）
- 每家餐廳標註營業時間，可預約者附預約連結
- 語言：繁體中文台灣用語，日文店名保留原文
