## Context

Phase 1（F001-F006）已完成：`DayMap.tsx` / `TripMap.tsx` / `MapMarker.tsx` / `MapRoute.tsx` / `useGoogleMaps.ts` / `useMapData.ts` / `css/map.css` 皆已在 codebase 中。Phase 2 在既有架構上疊加動畫播放與拖曳排序兩個進階互動。

技術棧：React 19 + TypeScript strict + Vite，CSS 遵守 Apple HIG 規範，6 主題 × 淺/深模式。

## Goals / Non-Goals

**Goals:**

- F007：播放按鈕觸發動畫，marker 依序亮起 + polyline 逐段繪製；速度 1x/2x/3x；播放完停在末站
- F007：播放控制列完整（播放 / 暫停 / 重播），觸控友好 44px touch target
- F008：Timeline entry 拖曳調整順序，即時反映地圖 marker 編號順序
- F008：PATCH API 回寫 `sort_order`，需 Cloudflare Access 認證，未登入時顯示提示

**Non-Goals:**

- 不使用 Directions API（維持直線 Polyline）
- 不修改 D1 schema 或 API 端點（PATCH entries 已存在）
- 不實作批量重排 / 多選拖曳
- 不實作 TripMap（多天總覽）的拖曳排序
- 不實作動畫錄製 / 匯出

## Decisions

### D1：F007 動畫實作策略 — requestAnimationFrame + Polyline 漸進截斷

**選擇**：使用 `requestAnimationFrame` 驅動動畫幀，每幀按播放速度更新「已播放進度」；Polyline 漸進繪製用「截取前 N 個點」方式（建立新 Polyline 取代舊 Polyline）；marker 在對應的 segment 到達後亮起（`setMap` + CSS class 切換）。

**理由**：
- 不依賴第三方動畫庫（零 bundle 增加）
- `requestAnimationFrame` 原生 60fps，流暢度高
- Polyline 截斷策略比 SVG stroke-dashoffset 更易控制多段路線
- marker 亮起用 CSS class 切換，與既有 MapMarker 選中狀態邏輯一致

**動畫時間計算**：
```
總播放時長 = N 個 segments × 800ms（1x 速度）
每 segment 動畫時長 = 800ms / speedMultiplier
```

### D2：F007 播放控制列 UI 位置

**選擇**：地圖容器底部固定列（`position: absolute; bottom: 0;`），背景 `var(--color-secondary)` + 半透明（`opacity: 0.92`）+ blur backdrop，圓角僅底部（繼承地圖容器 `var(--radius-md)`）。

**控制元素（左 → 右）**：
- 重播按鈕（`replay` icon，44px）
- 播放/暫停按鈕（`play_circle` / `pause_circle` icon，44px，accent 色）
- 速度選擇器（`1x` / `2x` / `3x` pill 切換，單選）
- 進度條（flex-1，高度 4px，accent 色填充，可點擊跳轉）

**理由**：
- 底部列不遮擋地圖主要內容
- 播放中使用者仍可 pan / zoom 地圖
- 進度條讓使用者知道播放到哪段

### D3：F007 MapAnimation.tsx 元件設計

**選擇**：`MapAnimation` 為純 logic 元件（不渲染 DOM），掛載在 `DayMap` 內部，透過 props 接收 `mapInstance`、`markers`（MapMarker ref array）、`polylineRef`（MapRoute ref），控制動畫狀態。

**狀態機**：
```
idle → playing → paused → playing → completed → idle（重播）
```

**Props 介面**：
```typescript
interface MapAnimationProps {
  map: google.maps.Map;
  entries: MapEntry[];          // 來自 useMapData，含 lat/lng + sort_order
  speedMultiplier: 1 | 2 | 3;
  isPlaying: boolean;
  onComplete: () => void;
}
```

**理由**：
- Logic-only 元件讓 DayMap 保持 DOM 結構清晰
- 狀態機明確，避免 playing/paused/completed 狀態混亂
- 透過 ref 操控既有 MapMarker + MapRoute，不重複建立 Google Maps 物件

### D4：F008 拖曳策略 — Timeline 拖曳（不用地圖 marker 拖曳）

**選擇**：拖曳介面在 Timeline（非地圖上的 marker），使用 HTML5 Drag and Drop API（`draggable`、`ondragstart`、`ondragover`、`ondrop`）。拖曳期間以「視覺佔位符」顯示目標位置，放開後更新本地狀態 + 觸發 PATCH API。

**放棄地圖 marker 拖曳的理由**：
- Google Maps marker draggable API 不支援「順序重排」語意（只能改座標位置）
- 地圖 marker 拖曳到哪裡算「插入第幾個位置」判斷複雜（需要 proximity 計算）
- Timeline 列表拖曳是業界標準 pattern，使用者認知成本低
- 地圖會同步更新 marker 編號（反映新 sort_order），達到「地圖感知拖曳結果」效果

**拖曳手把（drag handle）**：
- 每個 Timeline entry 左側顯示 `drag_indicator` icon（20px）
- 手把僅在認證使用者看到（未登入隱藏）
- 手把 `cursor: grab`，拖曳中 `cursor: grabbing`

### D5：F008 API 回寫策略 — 樂觀更新 + 錯誤回滾

**選擇**：
1. 拖曳放開後，**立即**更新本地 `sort_order`（樂觀更新），地圖同步重繪 marker 編號
2. 背景發送 PATCH API 請求
3. API 失敗 → 顯示 Toast 錯誤通知 + 回滾到拖曳前順序

**PATCH 請求格式**：批量更新，一次請求更新所有受影響 entries 的 `sort_order`（避免多次請求）：
```
PATCH /api/trips/:id/entries/:eid
Body: { "sort_order": N }
```
逐一請求（一個 entry 一次），以現有 API 端點為準。

**理由**：
- 樂觀更新讓 UI 即時響應，不需等待 API
- 錯誤回滾 + Toast 告知使用者失敗原因
- 使用現有 PATCH 端點，不需新增 API

### D6：F008 認證判斷策略

**選擇**：前端從 `GET /api/trips/:id`（或現有 `useTrip` hook）回傳的資料判斷當前使用者是否有寫入權限。若 API 回傳 403 → 認定為未認證，隱藏拖曳手把並顯示「登入後可調整順序」提示。

**理由**：
- 不需要新增 `/api/me` 端點（避免多餘的 API 呼叫）
- 以 PATCH 403 作為未認證的信號，與現有 API 行為一致
- 使用者體驗：拖曳手把只對有權限的人顯示，避免困惑

## Architecture

### 元件結構

```
src/components/trip/
  DayMap.tsx              ← 整合 MapAnimation + MapDragSort（Phase 1 基礎，Phase 2 擴充）
  MapAnimation.tsx        ← F007：動畫邏輯元件（新增）
  MapDragSort.tsx         ← F008：拖曳排序邏輯 + API 回寫（新增）
  MapMarker.tsx           ← 擴充：動畫「亮起」狀態 + 拖曳時高亮（Phase 1 基礎，Phase 2 擴充）
  MapRoute.tsx            ← 擴充：支援 partialIndex（漸進繪製，F007）（Phase 1 基礎，Phase 2 擴充）
```

### 資料流

```
F007（動畫播放）：
  DayMap
    ├→ useMapData — entries（已有 lat/lng + sort_order）
    ├→ MapAnimation（新增）
    │    ├→ 讀 entries → 計算動畫 segment 序列
    │    ├→ requestAnimationFrame → 更新 partialIndex
    │    ├→ MapMarker.setHighlight(true/false) — via ref
    │    └→ MapRoute.setPartialIndex(N) — via ref
    └→ AnimationControls UI（在 DayMap DOM 內，absolute bottom）

F008（拖曳排序）：
  DayMap / TripPage
    ├→ useTrip — 現有 entries（含 sort_order）
    ├→ MapDragSort（新增）
    │    ├→ 監聽 Timeline drag events（HTML5 DnD API）
    │    ├→ 本地樂觀更新 sort_order
    │    ├→ PATCH /api/trips/:id/entries/:eid — 逐一回寫
    │    └→ 失敗 → 回滾 + Toast
    └→ Timeline（DayMap 下方的 TimelineEvent 列表）
         └→ drag handle icon（認證使用者才顯示）
```

### CSS 架構（新增至 css/map.css）

```css
/* F007 播放控制列 */
.map-animation-controls {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  display: flex; align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-secondary);
  opacity: 0.92;
  backdrop-filter: blur(8px);
  border-radius: 0 0 var(--radius-md) var(--radius-md);
}

.map-animation-btn {
  width: 44px; height: 44px;
  border-radius: var(--radius-sm);
  color: var(--color-accent);
}

.map-animation-speed {
  display: flex; gap: var(--spacing-xxs);
}

.map-animation-speed-pill {
  padding: var(--spacing-xxs) var(--spacing-xs);
  border-radius: var(--radius-full);
  font-size: var(--fs-caption1);
  background: var(--color-tertiary);
}

.map-animation-speed-pill--active {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}

.map-animation-progress {
  flex: 1; height: 4px;
  background: var(--color-tertiary);
  border-radius: var(--radius-full);
  cursor: pointer;
}

.map-animation-progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  transition: width var(--duration-fast) linear;
}

/* F007 Marker 亮起狀態 */
.map-marker--animated-active {
  transform: scale(1.25);
  box-shadow: var(--shadow-lg);
}

.map-marker--animated-inactive {
  opacity: 0.35;
}

/* F008 拖曳手把 */
.timeline-drag-handle {
  width: 20px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-muted);
  cursor: grab;
  touch-action: none;
}

.timeline-drag-handle:active { cursor: grabbing; }

/* F008 拖曳中佔位符 */
.timeline-entry--drag-over {
  outline: 2px dashed var(--color-accent);
  outline-offset: -2px;
  background: var(--color-accent-subtle);
}

.timeline-entry--dragging {
  opacity: 0.5;
}
```

### 互動狀態表（Phase 2 新增）

| 元件 | Idle | Playing | Paused | Completed | Error |
|------|------|---------|--------|-----------|-------|
| MapAnimation 控制列 | Play 按鈕（accent）| Pause 按鈕 + 進度條動畫 | Play 按鈕 + 進度條凍結 | Replay 按鈕（accent）| N/A |
| MapMarker（動畫中）| 正常顯示 | 已到 marker：亮起（1.25x）；未到：半透明 | 凍結當前狀態 | 全部亮起 | N/A |
| MapRoute（動畫中）| 完整 polyline | 已繪製段：完整色；未繪製：隱藏 | 凍結當前段 | 完整 polyline | N/A |
| MapDragSort（drag）| 手把可見（認證）/ 隱藏（未認證）| N/A | N/A | N/A | Toast + 回滾 |
| Timeline entry（drag）| 正常顯示 | N/A | N/A | N/A | 回滾至拖曳前 |

### Accessibility

**F007 播放控制**：
- 播放按鈕：`aria-label="播放動線動畫"` / `"暫停動線動畫"` + `aria-pressed`
- 重播按鈕：`aria-label="重播動線動畫"`
- 速度 pill：`role="radiogroup"` + `aria-label="播放速度"` + 每個 `role="radio"` + `aria-checked`
- 進度條：`role="progressbar"` + `aria-valuenow` + `aria-valuemin="0"` + `aria-valuemax="100"`

**F008 拖曳排序**：
- 拖曳手把：`aria-label="拖曳以重新排序 景點名稱"` + `role="button"` + `tabIndex={0}`
- 鍵盤替代：手把 focus 時 Up/Down 箭頭鍵調整順序（`onKeyDown`）
- 拖曳佔位符：`aria-dropeffect="move"`
- 回應：排序成功後 `aria-live="polite"` 通知「景點順序已更新」

### Bundle 影響

- `MapAnimation.tsx`：預計 ~3KB（純邏輯，無第三方依賴）
- `MapDragSort.tsx`：預計 ~2KB（HTML5 DnD API，無第三方依賴）
- 兩者皆歸入現有 `DayMap` chunk（DayMap-xxx.js），Phase 1 DayMap chunk 約 10.46KB，Phase 2 後預計 ≤ 15KB（維持 budget）

## Risks / Trade-offs

- **F007 requestAnimationFrame 精度**：低效能裝置可能掉幀，動畫速度感不一致 → 用 `performance.now()` 計算實際經過時間，而非幀計數
- **F008 HTML5 DnD 在 iOS Safari 的支援**：iOS Safari 對 `draggable` 元素有歷史 bug → 測試時需驗證 iOS，必要時改用 Pointer Events API 作為降級
- **F008 並發 PATCH 競態**：快速連續拖曳多次 → 每次拖曳 debounce 500ms 後才發送 PATCH，避免 API 競態
- **F008 sort_order 不連續**：多次刪除後 sort_order 可能有 gap（1, 3, 5）→ PATCH 前在前端重新正規化為連續整數（1, 2, 3）

## Migration Plan

1. 擴充 `MapRoute.tsx`：新增 `partialIndex` prop，支援漸進繪製（F007 前置）
2. 擴充 `MapMarker.tsx`：新增 `animationState: 'idle' | 'active' | 'inactive'` prop（F007 前置）
3. 建立 `MapAnimation.tsx`：動畫邏輯 + requestAnimationFrame loop
4. 修改 `DayMap.tsx`：整合播放控制列 UI + MapAnimation 元件
5. 新增 `css/map.css` 播放控制樣式
6. 建立 `MapDragSort.tsx`：HTML5 DnD + PATCH API + 樂觀更新
7. 修改 Timeline 的 `TimelineEvent.tsx`：新增拖曳手把（認證判斷）
8. 新增 unit tests + E2E tests

**回滾策略**：`MapAnimation.tsx` / `MapDragSort.tsx` 可直接刪除；DayMap / MapMarker / MapRoute 的 Phase 2 擴充欄位設為 optional props，預設值維持 Phase 1 行為，不影響現有功能。
