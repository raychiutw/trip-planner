## Why

Phase 1（F001-F006）已完成並合併：所有行程備有 lat/lng 座標、每天互動地圖、Marker + InfoWindow、直線 Polyline 動線連線、車程耗時 label、多天總覽 TripMap。旅伴可以「傳連結 → 打開就看到地圖動線」。

Phase 2 在此基礎上加入兩個進階互動：

- **F007 動態路線播放**：逐步動畫展示移動軌跡，讓旅伴一步步感受當天動線節奏，比靜態地圖更有臨場感。
- **F008 拖曳排序**：直接在地圖上或時間軸上拖曳調整景點順序，並即時回寫 API，讓旅程規劃更直覺。

## What Changes

- **F007 動態路線播放**：新增 `MapAnimation.tsx` 元件，在 DayMap 中提供播放/暫停/重播控制介面；動畫沿 Polyline 逐步展開（marker 依序亮起 + polyline 漸進繪製）；播放速度可調（1x / 2x / 3x）；播放完成後停在最後一站。
- **F008 拖曳排序**：新增 `MapDragSort.tsx` 元件，支援在 Timeline 的 entry 列上拖曳調整順序；變更後 PATCH `/api/trips/:id/entries/:eid`（`sort_order` 欄位）；需要 Cloudflare Access 認證（寫入操作）。

## Capabilities

### New Capabilities

- `map-animation`：路線播放動畫，播放/暫停/重播/速度控制；marker 依序亮起 + polyline 漸進繪製；播放完畢停在末站
- `map-drag-sort`：Timeline entry 拖曳排序；即時更新地圖 marker 順序；PATCH API 回寫 `sort_order`；僅認證使用者可操作（Access 保護）

### Modified Capabilities

- `day-map`：整合 MapAnimation 播放控制介面（F007），整合 MapDragSort 可拖曳狀態（F008）
- `timeline-event`：支援拖曳手把（drag handle）顯示與互動（F008）

## Impact

### 新增檔案

- `src/components/trip/MapAnimation.tsx` — 路線播放動畫控制器（F007）
- `src/components/trip/MapDragSort.tsx` — 拖曳排序邏輯與 API 回寫（F008）

### 修改檔案

- `src/components/trip/DayMap.tsx` — 整合 MapAnimation + MapDragSort
- `src/components/trip/MapMarker.tsx` — 支援動畫「亮起」狀態（F007）+ 拖曳時高亮（F008）
- `src/components/trip/MapRoute.tsx` — 支援漸進繪製（partial polyline，F007）
- `src/pages/TripPage.tsx` — 傳遞認證狀態給 MapDragSort（F008）
- `css/map.css` — 播放控制列樣式、拖曳手把樣式、動畫 keyframes
- `tests/unit/` — 新增 map-animation + map-drag-sort unit tests
- `tests/e2e/` — 新增動畫播放 + 拖曳排序 E2E tests

### 不修改

- D1 schema / API 端點（PATCH entries API 已存在）
- `useGoogleMaps.ts` / `useMapData.ts`（Phase 1 hook 不變）
- `TripMap.tsx`（多天總覽，Phase 2 不涉及）

## Dependencies on Phase 1

| Phase 1 元件 | Phase 2 用途 |
|-------------|-------------|
| `DayMap.tsx` | 掛載 MapAnimation + MapDragSort |
| `MapMarker.tsx` | 擴充動畫「亮起」狀態 + 拖曳高亮 |
| `MapRoute.tsx` | 擴充漸進繪製（partial polyline）|
| `useMapData.ts` | 提供 entry 座標 + sort_order 資料 |
| `css/map.css` | 新增動畫 + 拖曳 CSS 至同一檔案 |

## Out of Scope

- Directions API 路線規劃（維持直線 Polyline）
- 離線地圖快取
- 地圖截圖 / 分享功能
- 批量重排（一次拖多個景點）
- F007 動畫錄製 / 匯出影片

## Open Questions

### OQ-1：F008 拖曳寫入權限 — 旅伴能拖嗎？

PATCH entries API 受 Cloudflare Access 保護，需登入成員身份。

**選項 A：僅 owner 可拖**
- 優：權限管理簡單，不需區分 owner vs 旅伴
- 缺：旅伴無法參與規劃，降低協作價值

**選項 B：登入成員（旅伴）皆可拖**
- 優：協作規劃更有趣，旅伴可直接調整順序
- 缺：需前端讀取 Access 身份（`CF-Access-Authenticated-User-Email` header）+ 後端驗證 permissions 表

**預設建議**：選項 B，登入成員皆可拖（與現有 manage 頁權限邏輯一致），未登入使用者拖曳時顯示「登入後可調整順序」提示。實作時需決定此項。

### OQ-2：F007 播放動畫的觸發方式

**選項 A：手動按鈕觸發**（Play 按鈕，預設暫停）
- 優：不干擾正常瀏覽；用戶主動決定何時看動畫
- 缺：需要使用者發現「有播放功能」

**選項 B：進入頁面自動播放（一次）**
- 優：第一次體驗驚喜感強；無需使用者操作
- 缺：多次進入同頁面時重複播放會煩人；可能干擾地圖互動

**預設建議**：選項 A，手動按鈕觸發。地圖右上角（或下方控制列）顯示播放按鈕（Material Symbols `play_circle`），44px touch target，hover 顯示 tooltip「播放動線動畫」。
