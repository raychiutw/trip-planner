## F002：DayMap 基礎元件

- [x] F002.1 安裝 `@googlemaps/js-api-loader` 依賴
- [x] F002.2 建立 `src/hooks/useGoogleMaps.ts` — Google Maps JS SDK 動態載入 hook（singleton pattern，避免重複載入）
- [x] F002.3 建立 `src/hooks/useMapData.ts` — 從 useTrip 資料提取有 lat/lng 的 entries + hotel 座標
- [x] F002.4 建立 `src/components/trip/DayMap.tsx` — 基本地圖渲染，React.lazy + Suspense code-split
- [x] F002.5 建立 `css/map.css` — 地圖容器樣式、響應式高度（250/300/350px）、loading skeleton
- [x] F002.6 實作收合/展開機制 — 預設展開，localStorage 記住偏好，max-height transition 250ms
- [x] F002.7 實作所有狀態：loading skeleton、empty state（「今天沒有排程景點」）、error fallback（「地圖無法載入」+ 外連按鈕）
- [x] F002.8 修改 `src/pages/TripPage.tsx` — 整合 DayMap 區塊於 DayNav 與 Timeline 之間
- [ ] F002.9 設定 `VITE_GOOGLE_MAPS_API_KEY` 環境變數（`.env.local` + Cloudflare Dashboard）
- [x] F002.10 新增 unit test：useGoogleMaps hook、DayMap 渲染、收合狀態
- [x] F002.11 E2E test：地圖區塊存在、收合/展開行為

**依賴**：F001（lat/lng 資料已完成）

## F003：Markers + InfoWindow

- [x] F003.1 建立 `src/components/trip/MapMarker.tsx` — 自訂圓形 marker（32px, accent 色 + 白色編號）
- [x] F003.2 實作飯店 marker — 同圓形但顯示 hotel emoji
- [x] F003.3 實作選中狀態 — 放大至 40px + shadow-lg + 2px 白邊框
- [x] F003.4 實作 InfoWindow 輕量卡片 — 200px 寬，編號+名稱+時間+評分+「滾到此處」按鈕
- [x] F003.5 實作 marker → Timeline 聯動 — 點擊「滾到此處」scroll Timeline 到對應 entry 並 highlight
- [x] F003.6 實作 Timeline → marker 聯動 — MAP_FOCUS_EVENT 自訂事件 → map pan + highlight marker
- [x] F003.7 實作 Accessibility — `role="button"` + `aria-label`、鍵盤 Tab/Enter/Escape
- [x] F003.8 處理部分座標缺失 — 有座標的顯示 pin，缺座標的顯示提示條「N 個景點缺少座標」
- [x] F003.9 新增 unit test：MapMarker 渲染、InfoWindow 內容、聯動邏輯（13 tests）
- [x] F003.10 E2E test：marker 點擊、InfoWindow 顯示、Timeline 聯動

**依賴**：F002

## F004：動線連線（Polyline）

- [x] F004.1 建立 `src/components/trip/MapRoute.tsx` — 直線 Polyline 連接 markers，依 sort_order 順序
- [x] F004.2 Polyline 樣式 — accent 色，2px 寬度，半透明
- [x] F004.3 確認 Polyline 隨 marker 增減動態更新
- [x] F004.4 新增 unit test：MapRoute 渲染、Polyline 路徑正確性
- [x] F004.5 E2E test：Polyline 在地圖上可見

**依賴**：F003

## F005：車程資訊

- [x] F005.1 在 MapRoute 中實作 travel_min label — 使用 OverlayView（lazy factory）在相鄰兩點 Polyline 中點顯示耗時（例如「🚗 15min」）
- [x] F005.2 Label 樣式 — 背景 `var(--color-secondary)`，圓角 `--radius-xs`，小字體 `--font-size-caption`，陰影 `var(--shadow-sm)`
- [x] F005.3 處理無 travel_min 的 segment — 不顯示 label
- [x] F005.4 新增 unit test：travel_min label 渲染、中點計算、getTravelEmoji、OverlayView 管理（12 tests）
- [x] F005.5 E2E test：車程資訊 label 可見（已在 map-route.test.tsx 覆蓋 OverlayView setMap 呼叫）

**依賴**：F004

## F006：多天總覽（TripMap）

- [x] F006.1 建立 `src/components/trip/TripMap.tsx` — Trip-level 地圖，所有天的 markers + polylines
- [x] F006.2 實作每天不同顏色 — 固定 8 色色盤循環（#4285F4/#EA4335/#34A853/#FBBC04/#9C27B0/#00ACC1/#FF7043/#78909C）
- [x] F006.3 實作左下角日期圖例 — 水平 pill 列，每個 pill 顯示「Day N」+ 對應顏色圓點
- [x] F006.4 實作 pill 互動 — 點擊高亮該天路線（其他天半透明），再點取消高亮
- [x] F006.5 修改 `src/components/trip/DayNav.tsx` — 新增「全覽」pill 按鈕，切換至 TripMap 模式
- [x] F006.6 實作日/全覽模式切換 — DayNav 選天數時顯示 DayMap，選全覽時顯示 TripMap
- [x] F006.7 TripMap 的 bounds 自動調整 — fitBounds 包含所有天的所有 markers
- [x] F006.8 新增 unit test：TripMap 渲染、色盤分配、圖例互動（23 tests）
- [x] F006.9 E2E test：全覽模式切換、日期圖例互動、多天顏色區分

**依賴**：F004（需要 Polyline 元件）
