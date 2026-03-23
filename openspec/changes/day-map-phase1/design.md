## Context

行程規劃網站目前為純文字時間軸，旅伴需跳轉至外部 Google Maps 才能理解動線。F001 已完成所有行程的 lat/lng 座標補齊（entries + hotels 的 `location_json` 含 lat/lng），前置資料就緒。本次 Phase 1 實作 F002-F006，在行程頁內嵌互動地圖。

技術棧：React 19 + TypeScript strict + Vite，CSS 遵守 Apple HIG 規範，6 主題 × 淺/深模式。

## Goals / Non-Goals

**Goals:**

- 在行程頁 DayNav 下方、Timeline 上方嵌入互動地圖，旅伴一眼看出當天動線
- Marker 與 Timeline 雙向聯動（點 marker → scroll Timeline，點 Timeline → pan 地圖）
- 直線 Polyline 連接景點，搭配現有 `travel_min` 顯示車程耗時
- 多天總覽地圖，每天不同顏色，一眼看出全行程地理分布
- 所有狀態完整處理：loading skeleton、empty state、error fallback、部分座標缺失提示條
- 手機觸控友好，收合/展開記住偏好

**Non-Goals:**

- 不使用 Directions API（成本不可控，直線 Polyline 已足夠）
- 不實作動態路線播放動畫（F007，Phase 2）
- 不實作拖曳排序（F008，Phase 2）
- 不實作離線地圖快取（離線顯示 fallback 即可）
- 不修改 API 端點或 D1 schema（資料已就緒）

## Decisions

### D1：Google Maps JS SDK lazy load via @googlemaps/js-api-loader + React.lazy

**選擇**：`@googlemaps/js-api-loader`（~3KB）動態載入 Google Maps JS SDK（~150KB，Google CDN 快取），DayMap 元件用 `React.lazy()` + `Suspense` code-split。

**理由**：
- 地圖不影響首屏 LCP — 只在展開時載入 SDK
- Google CDN 快取使重複載入極快
- React.lazy 確保 map chunk 獨立，不膨脹主 bundle

**效能預算**：map chunk <= 15KB（不含 Google SDK CDN）

### D2：Marker 設計 — accent 圓形 32px + 白色編號

**選擇**：圓形（非 Google 預設水滴），直徑 32px，`var(--color-accent)` 填充 + `var(--color-accent-foreground)` 白色編號文字。選中狀態放大至 40px + `var(--shadow-lg)` + 2px 白邊框。飯店 marker 同圓形但顯示 hotel emoji。

**理由**：
- 圓形 + 編號比水滴 pin 更適合表達順序
- 使用 CSS 變數自動適配 6 主題
- 選中放大 + 陰影提供清晰的視覺回饋

### D3：InfoWindow — 輕量卡片 200px

**選擇**：固定寬度 200px，背景 `var(--color-secondary)`，圓角 `var(--radius-sm)`，陰影 `var(--shadow-md)`。內容：編號 + 名稱（`--fs-headline`，semibold）+ 時間 + 評分（`--fs-footnote`，muted）+ 「滾到此處」accent 色按鈕（44px touch target）。

**理由**：
- 輕量設計不遮擋地圖
- 「滾到此處」實現 marker → Timeline 聯動
- 44px touch target 符合 HIG 觸控規範

### D4：直線 Polyline（不用 Directions API）

**選擇**：使用 Google Maps Polyline 沿 sort_order 直線連接所有 markers。

**理由**：
- Directions API 每次請求計費，7 行程 x 5 天 x ~8 段 = ~280 次/載入，成本不可控
- 直線 Polyline 已足夠表達動線順序
- 現有 `travel_min` 已有車程時間，不需 Directions API 重新計算

### D5：車程資訊 — Polyline 中點 label

**選擇**：使用 DB 現有的 `travel_min`（分鐘）和 `travel_desc`（描述），在相鄰兩點 Polyline 中點位置顯示 label（例如「15min」）。使用 Google Maps OverlayView 自訂 label 元件。

**理由**：
- 不需額外 API 呼叫
- 中點位置在直線上視覺最平衡
- OverlayView 可完全自訂樣式

### D6：多天色盤 — 固定 8 色

**選擇**：固定 8 色不隨主題變化：
- Day 1: #4285F4（藍）
- Day 2: #EA4335（紅）
- Day 3: #34A853（綠）
- Day 4: #FBBC04（金）
- Day 5: #9C27B0（紫）
- Day 6: #00ACC1（青）
- Day 7: #FF7043（橘）
- Day 8+: #78909C（灰，循環）

**理由**：
- 固定色確保所有主題下清晰可讀
- 8 色覆蓋大多數行程天數
- 超過 8 天從第 1 色循環

### D7：收合機制 — 預設展開，localStorage 記住

**選擇**：預設展開，收合按鈕在地圖右上角（44px touch target，Material Symbols expand_less/expand_more），狀態存 localStorage。收合動畫 `max-height` transition + `var(--duration-normal)` 250ms + `var(--transition-timing-function-apple)`。

**理由**：
- 預設展開讓旅伴第一次看到地圖
- localStorage 記住偏好避免每次手動操作
- max-height transition 效能好且相容性高

### D8：觸控與手勢

**選擇**：地圖容器設定 `touch-action: none`，讓 Google Maps 完全接管觸控事件（pinch zoom、pan、rotate）。

**理由**：防止瀏覽器預設手勢（pull-to-refresh、back swipe）與地圖手勢衝突。

## Architecture

### 元件結構

```
src/components/trip/
  DayMap.tsx          ← 每天地圖（F002-F005），React.lazy 載入
  TripMap.tsx         ← 多天總覽（F006）
  MapMarker.tsx       ← 自訂圓形 marker + InfoWindow（F003）
  MapRoute.tsx        ← Polyline 連線 + 車程 label（F004-F005）

src/hooks/
  useGoogleMaps.ts    ← Google Maps JS SDK 動態載入 hook（singleton）
  useMapData.ts       ← 從 useTrip 提取 map 需要的資料（entries with lat/lng, hotel）
```

### 資料流

```
useTrip (existing)
  └→ useMapData (new) — 過濾有 lat/lng 的 entries，提取 hotel 座標
       ├→ DayMap
       │    ├→ useGoogleMaps — 載入 SDK，回傳 google.maps 實例
       │    ├→ MapMarker × N — 每個 entry 一個 marker
       │    └→ MapRoute — Polyline + travel_min labels
       └→ TripMap
            ├→ useGoogleMaps — 共用同一個 SDK 實例
            └→ 多天 MapMarker + MapRoute（各天不同顏色）
```

### CSS 架構

```css
/* css/map.css — 新增檔案 */

/* 地圖容器 */
.day-map-container { position: relative; touch-action: none; }
.day-map-container--collapsed { max-height: 0; overflow: hidden; }
.day-map-container--expanded {
  transition: max-height var(--duration-normal) var(--transition-timing-function-apple);
}

/* 響應式高度 */
.day-map { height: 250px; }
@media (min-width: 768px) { .day-map { height: 300px; } }
@media (min-width: 1024px) { .day-map { height: 350px; } }

/* 收合按鈕 */
.day-map-toggle {
  position: absolute; top: var(--spacing-sm); right: var(--spacing-sm);
  width: 44px; height: 44px;
  background: var(--color-secondary); border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}

/* Loading skeleton */
.day-map-skeleton {
  background: var(--color-tertiary);
  animation: pulse 1.5s ease-in-out infinite;
}

/* 多天色盤 CSS 變數 */
:root {
  --map-day-1: #4285F4;
  --map-day-2: #EA4335;
  --map-day-3: #34A853;
  --map-day-4: #FBBC04;
  --map-day-5: #9C27B0;
  --map-day-6: #00ACC1;
  --map-day-7: #FF7043;
  --map-day-8: #78909C;
}

/* 部分座標缺失提示條 */
.day-map-warning {
  background: var(--color-accent-subtle);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--fs-footnote);
  color: var(--color-muted);
}

/* 日期圖例 */
.trip-map-legend { display: flex; gap: var(--spacing-xs); padding: var(--spacing-xs); }
.trip-map-legend-pill {
  padding: var(--spacing-xxs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: var(--fs-caption1);
}
```

### API Key 管理

- Key 存在 Vite 環境變數 `VITE_GOOGLE_MAPS_API_KEY`，build 時注入
- Google Cloud Console 設定 HTTP referrer 限制（`trip-planner-dby.pages.dev/*` + `localhost:*`）
- API quota cap 每日 1000 次
- 只啟用 Maps JavaScript API

### 互動狀態表

| 元件 | Loading | Empty | Error | Success | Partial |
|------|---------|-------|-------|---------|---------|
| Google Maps SDK | 灰色骨架 + 脈衝動畫，高度固定 250/300/350px | N/A | fallback 卡片 + 外連 Google Maps 按鈕 + 「地圖無法載入」| 地圖渲染 | N/A |
| DayMap markers | SDK 載入後 spinner | 「今天沒有排程景點」accent-subtle 底 | geocode_status=failed 的 entry 文字列表 | pins + polyline 完成 | 有座標的 pin + 提示條「N 個景點缺少座標」|
| InfoWindow | 輕量 skeleton | N/A | 「無法載入詳情」| 完整卡片 | N/A |
| TripMap 多天總覽 | 同 DayMap loading | 「尚無地點資料」| 同 SDK error | 多色 pin + 日期圖例 | 僅部分天有座標 |

### Accessibility

- Marker：`role="button"` + `aria-label="第 N 站：景點名稱"`
- 收合按鈕：`aria-expanded="true/false"` + `aria-controls="day-map"`
- 鍵盤：Tab 切換 marker → Enter 開啟 InfoWindow → Escape 關閉
- 「滾到此處」：`aria-label="在時間軸中查看 景點名稱"`
- 地圖區域：`role="region"` + `aria-label="第 N 天動線地圖"`

### 離線降級

- 地圖依賴網路，離線時顯示 fallback：「離線模式 — 地圖不可用，請連網後重試」
- SDK 載入失敗（ad blocker、防火牆、quota 超限）→ 同樣顯示 fallback + Google Maps 外連按鈕

### Bundle 策略

- `@googlemaps/js-api-loader`（~3KB）打入 map chunk
- DayMap / TripMap 用 `React.lazy()` code-split
- Google Maps JS SDK（~150KB）由 Google CDN 載入，不計入 bundle
- 效能預算：map chunk <= 15KB

## Risks / Trade-offs

- **Google Maps API Key 暴露**：client-side 必須暴露 key → 用 HTTP referrer 限制 + quota cap 防護
- **Google Maps JS SDK 載入失敗**：ad blocker / 防火牆 / 中國大陸限制 → error fallback + 外連 Google Maps 按鈕
- **部分 entries 缺少座標**：`geocode_status` 非 ok 的 entries → partial state：有座標的顯示 pin，缺座標的顯示提示條
- **touch-action: none 副作用**：地圖區域內無法執行頁面捲動 → 使用者需在地圖外捲動，收合功能提供替代方案
- **iOS Safari background-attachment: fixed 限制**：不影響地圖功能，僅可能影響未來背景效果

## Migration Plan

1. 新增 `@googlemaps/js-api-loader` 依賴
2. 建立 `useGoogleMaps.ts` hook + `useMapData.ts` hook
3. 建立 `DayMap.tsx` 基礎元件 + `css/map.css`
4. 建立 `MapMarker.tsx` + InfoWindow
5. 建立 `MapRoute.tsx`（Polyline + travel_min labels）
6. 建立 `TripMap.tsx` + 多天色盤
7. 修改 `TripPage.tsx` 整合地圖區塊
8. 修改 `DayNav.tsx` 新增「全覽」按鈕
9. 新增環境變數 `VITE_GOOGLE_MAPS_API_KEY`
10. 新增 unit tests + E2E tests
11. 確認 build + CI 通過

**回滾策略**：所有地圖相關檔案可直接刪除，TripPage / DayNav 改動可 git revert，不影響既有功能。
