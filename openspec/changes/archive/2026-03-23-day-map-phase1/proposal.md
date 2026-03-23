## Why

旅伴在 LINE 群組問「今天行程怎麼走」時，目前只能看文字時間軸或跳轉至 Google Maps。沒有內嵌地圖，無法一眼看出動線是否合理、景點之間距離多遠。旅伴需要的是「傳連結 → 打開就看到地圖動線」的體驗。

F001（lat/lng 座標資料補齊）已完成，所有行程的 entries 和 hotels 都有經緯度。現在可以開始實作地圖元件。

## What Changes

- **F002 DayMap 基礎元件**：透過 `@googlemaps/js-api-loader` lazy load Google Maps JS SDK，建立 `DayMap.tsx` 基本地圖渲染元件 + `useGoogleMaps.ts` hook，內嵌於行程頁 DayNav 下方、Timeline 上方，可收合展開（預設展開，localStorage 記住偏好）
- **F003 Markers**：每個 entry 標圓形 pin（32px，accent 色 + 白色編號），飯店用 hotel emoji；點擊 marker 顯示 InfoWindow 輕量卡片（200px 寬，編號+名稱+時間+評分+滾到此處按鈕）；點擊 Timeline entry 則 pan 到對應 marker
- **F004 動線連線**：直線 Polyline 依 sort_order 連接 markers，不使用 Directions API（避免計費）
- **F005 車程資訊**：利用現有 `travel_min` 和 `travel_desc` 在 Polyline 中點顯示 label（例如「15min」）
- **F006 多天總覽**：Trip-level `TripMap.tsx`，每天不同顏色（固定 8 色循環），DayNav 增加「全覽」按鈕切換日/全覽模式，左下角日期圖例 pill 列可高亮單天路線

## Capabilities

### New Capabilities

- `day-map`：每天動線地圖，Google Maps JS SDK lazy load + React.lazy code-split，含 loading skeleton / empty state / error fallback / 部分座標缺失提示條
- `map-markers`：自訂圓形 marker + InfoWindow 輕量卡片，marker 與 Timeline 雙向聯動
- `map-route`：直線 Polyline 動線連線 + 車程耗時 label
- `trip-map`：多天總覽地圖，固定 8 色色盤區分天數，日期圖例互動

### Modified Capabilities

- `day-nav`：DayNav 新增「全覽」pill 按鈕，切換至 TripMap 模式
- `trip-page`：TripPage 整合 DayMap / TripMap 區塊，位於 DayNav 與 Timeline 之間

## Impact

### 新增檔案

- `src/components/trip/DayMap.tsx` — 每天地圖元件（F002-F005）
- `src/components/trip/TripMap.tsx` — 多天總覽元件（F006）
- `src/components/trip/MapMarker.tsx` — 自訂 marker 元件（F003）
- `src/components/trip/MapRoute.tsx` — 動線連線 + 車程資訊元件（F004-F005）
- `src/hooks/useGoogleMaps.ts` — Google Maps JS SDK 動態載入 hook
- `src/hooks/useMapData.ts` — 從 useTrip 提取地圖所需資料
- `css/map.css` — 地圖相關樣式（收合動畫、skeleton、responsive 高度、多天色盤 CSS 變數）

### 修改檔案

- `src/pages/TripPage.tsx` — 整合 DayMap / TripMap 區塊
- `src/components/trip/DayNav.tsx` — 新增「全覽」按鈕
- `css/style.css` — 可能的 layout 調整
- `vite.config.ts` — 確認 map chunk 分離設定
- `tests/unit/` — 新增 map 相關 unit tests
- `tests/e2e/` — 新增 map E2E tests

## Out of Scope

- **F007 動態路線播放**：動畫逐步展示移動軌跡 — Phase 2
- **F008 拖曳排序**：拖曳 pin 重排 + API 回寫 — Phase 2（需 auth + 複雜狀態管理）
- Directions API 路線規劃（使用直線 Polyline 替代）
- 離線地圖快取（離線時顯示 fallback）
- Google Maps dark mode styling（可後續跟進）
