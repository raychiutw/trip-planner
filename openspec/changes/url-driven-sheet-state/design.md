## Context

Phase 2 AppShell sheet slot 暫 render `<TripMapRail>` 作為過渡方案。Phase 3 把 sheet slot 換成完整的 `<TripSheet>`，內含 4 個 tabs（Itinerary / Ideas / Map / Chat），state 全 URL-driven。

Mindtrip screenshot（Image 11）顯示他們 URL 是 `/chat/6015558?tripSheet=1&tripTab=itinerary`。我們簡化成單一 param `?sheet=<tab>`（<tab> 為 'itinerary' 'ideas' 'map' 'chat' 之一），更 concise 且 collapse 時 param 消失。

## Goals / Non-Goals

**Goals:**
- `<TripSheet>` 讀 query param 決定開關 + tab
- Back/forward button 自然運作（`navigate({search})` + React Router 標準行為）
- `/trip/:id/map` 301 redirect to `/trip/:id?sheet=map`（保 bookmark compat）
- Ideas tab 串接 Phase 1 的 `/api/trip-ideas` API（基本 list + add，no drag）
- Chat tab 為 placeholder（Phase 4+ 實作）

**Non-Goals:**
- 不做 drag-and-drop（Phase 5）
- 不做 AI chat per-trip persistence（Phase 4+）
- 不做 Bookings / Calendar / Media tabs（Mindtrip 有，trip-planner 不做或後期再加）
- 不改 Itinerary tab 的 timeline render 邏輯（只 host，不改）

## Decisions

### 1. Single query param `?sheet=<tab>` 而非分開 `?tripSheet=1&tripTab=itinerary`
**為何**：Mindtrip 用兩個 param 稍冗長；實務上 sheet 不開時就不需要 tripTab。用 `?sheet=` 缺席表示關閉、有值表示開 + 顯示該 tab，邏輯簡潔。
**備選**：Mindtrip 原 pattern — 冗餘，拒絕。

### 2. 使用 react-router-dom v7 `useSearchParams`
**為何**：既有 dependency（`react-router-dom ^7.13.2`），標準 hook 有 `get` `set` api，簡化 query manipulation。
**備選**：URLSearchParams 直接操作 + manual navigate — 多寫 boilerplate。

### 3. `/trip/:id/map` redirect 實作在 Router 層
**為何**：SPA routing — 在 `<Routes>` 加 `<Route path="/trip/:id/map" element={<Navigate to="..." replace />} />`。無需 server-side 301（Cloudflare Pages 的 redirect rules 可選但 SPA routing 先攔）。
**備選**：Cloudflare Pages `_redirects` 檔 server-side — 需配合 SPA fallback，複雜度較高。

### 4. Tab 切換 `replace` 不 `push` history
**為何**：使用者切 tab 是細粒度 UI 操作，每次切都 push 會塞滿 back stack。用 replace 讓 back button 回到 sheet 打開前的狀態，較符合直覺。
**備選**：push — back button 會按 tab 順序 replay，不符合使用者心智。

### 5. Sheet 關閉 → 移除 `sheet` param，用 replace
**為何**：關閉是更細的 UI 操作，同理 replace。
**實作**：`setSearchParams({}, {replace: true})` 清 param。

### 6. Ideas tab 本 Phase 只做 list + add，不做 drag
**為何**：drag 是 Phase 5 dnd-kit 專案。Phase 3 若同時做 drag 會 scope creep。Ideas tab 的 list + add button + promote-to-entry button（text-based）夠用。
**備選**：Phase 3 順便做 drag — 拒絕，分階段 ship 較穩。

## Risks / Trade-offs

- **[Risk] `?sheet=<invalid>` 使用者亂改 URL** → Mitigation: TripSheet 內部 validate，invalid 值降級為「關閉 sheet」，不 throw error
- **[Risk] Phase 2 ship 後 map rail 在 /trip/:id 看不到（過渡方案依賴 Phase 3）** → Mitigation: Phase 2 + Phase 3 合併單一 release（建議）或 Phase 2 sheet slot 暫 render MapRail
- **[Risk] 既有 `/trip/:id/map` bookmark 使用者困惑** → Mitigation: 301 redirect（SPA router Navigate）+ 告知 admin
- **[Trade-off] 所有 tab 同時在 memory render（即便 hidden）可能 perf issue** → Mitigation: 條件 render（只 render 當前 tab），切 tab 時 unmount 前 tab；複雜 state 需持久化時再 lift up

## Migration Plan

1. **Week 5 Day 1-2**：寫 TripSheet + useSearchParams hook + unit test
2. **Week 5 Day 3**：`/trip/:id/map` route redirect 實作
3. **Week 5 Day 4-5**：Ideas tab UI 串接 `/api/trip-ideas`
4. **Week 6 Day 1-2**：Chat / Map tab placeholder + 整合測試
5. **Week 6 Day 3**：Playwright E2E 驗 back/forward button + 301 redirect
6. **Week 6 Day 4**：`/tp-team` pipeline + staging
7. **Week 6 Day 5**：ship prod
8. **Rollback**：revert TripSheet + restore MapRail in AppShell sheet slot；query param route 也 revert

## Open Questions

- Sheet 展開時 main content 是否 shrink（給 sheet 空間）還是 overlay？**建議 shrink**（grid template 下自然行為，non-modal）
- `?sheet=ideas` 跟 `?sheet=` 與 Page 的其他 query 共存嗎（例： Phase 4 `?filter=restaurants`）？**建議**：用 prefix `?sheet=...&sheet_filter=...` 或分空間，避免混淆
- Ideas tab 空狀態（0 ideas）顯示什麼？Mindtrip 顯示「Add」大卡 — trip-planner 是否複製此 pattern？Q6 DESIGN.md 可訂，Phase 3 先用 placeholder「點 Add 新增 idea」
