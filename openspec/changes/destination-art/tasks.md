# 目的地視覺藝術 — 任務清單

## F-1：DayNav 半透明背景（目的地封面 SVG）

### 設計
- [x] F1.1 定義 7 個行程的 SVG 主題
  - okinawa: 海灘 + 風獅爺 + 珊瑚 + 熱帶魚
  - busan: 廣安大橋 + 海鷗 + 釜山塔
  - kyoto: 鳥居 + 楓葉 + 竹林 + 寺廟
  - banqiao: 林家花園 + 夜市燈籠 + 老街屋簷

### 實作
- [x] F1.2 建立 DestinationArt.tsx（獨立元件）
- [x] F1.3 每個行程一張 SVG（viewBox 480×48 配合 sticky-nav）
- [x] F1.4 CSS：sticky-nav 背景用 SVG + position:absolute z-index:0
- [x] F1.5 從 tripId prefix 決定顯示哪張 SVG（resolveDestination）
- [x] F1.6 light/dark mode 各一版（light opacity 0.12~0.20, dark 0.06~0.12）

### 驗證
- [x] F1.7 tsc + npm test（440 passed）
- [ ] F1.8 6 主題 × light/dark × 4 目的地 截圖驗證（QC 負責）

## F-2：Day Header 文化圖案（取代 ThemeArt，動態生成）

- [x] F2.1 定義景點關鍵字 → SVG 元素映射表（src/lib/dayArtMapping.ts）
- [x] F2.2 建立 DayArt 生成邏輯（src/components/trip/DayArt.tsx）
- [x] F2.3 取代 DayHeaderArt（TripPage.tsx DaySection 改用 DayArt）
- [ ] F2.4 /tp-create 和 /tp-edit 時觸發生成（無需額外工作：DayArt 是 runtime 動態生成）
- [x] F2.5 light/dark mode（每個 SVG 元素根據 dark prop 切換色彩+opacity）
- [ ] F2.6 截圖驗證全行程（QC 負責）
