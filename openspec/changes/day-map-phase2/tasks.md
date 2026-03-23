## F007：動態路線播放

- [ ] F007.1 擴充 `src/components/trip/MapRoute.tsx` — 新增 `partialIndex?: number` prop，當設定時只繪製前 N 個 segment（漸進繪製前置）
- [ ] F007.2 擴充 `src/components/trip/MapMarker.tsx` — 新增 `animationState?: 'idle' | 'active' | 'inactive'` prop；'active' 套用 `.map-marker--animated-active`（scale 1.25 + shadow-lg），'inactive' 套用 `.map-marker--animated-inactive`（opacity 0.35）
- [ ] F007.3 建立 `src/components/trip/MapAnimation.tsx` — 動畫邏輯元件（不渲染 DOM），管理 `idle → playing → paused → completed` 狀態機，用 `requestAnimationFrame` + `performance.now()` 計算實際經過時間驅動進度
- [ ] F007.4 實作播放速度 — `speedMultiplier: 1 | 2 | 3`，每個 segment 動畫時長 = 800ms / speedMultiplier
- [ ] F007.5 實作播放控制列 UI（在 DayMap.tsx 內）— `position: absolute; bottom: 0;`，包含重播按鈕 + 播放/暫停按鈕 + 速度 pill（1x/2x/3x）+ 進度條（可點擊跳轉）
- [ ] F007.6 新增 `css/map.css` 播放控制列樣式 — `.map-animation-controls`、`.map-animation-btn`（44px）、`.map-animation-speed-pill`（active/inactive 狀態）、`.map-animation-progress`（4px 進度條）、`.map-marker--animated-active`、`.map-marker--animated-inactive`
- [ ] F007.7 修改 `src/components/trip/DayMap.tsx` — 整合 MapAnimation 元件 + 播放控制列，傳遞 `partialIndex` 給 MapRoute + `animationState` 給每個 MapMarker
- [ ] F007.8 實作播放完成行為 — 動畫結束後所有 marker 回到正常（idle）狀態，控制列顯示重播按鈕
- [ ] F007.9 實作 Accessibility — 播放按鈕 `aria-label` + `aria-pressed`；速度選擇 `role="radiogroup"` + `role="radio"` + `aria-checked`；進度條 `role="progressbar"` + `aria-valuenow`
- [ ] F007.10 新增 unit tests — MapAnimation 狀態機（idle/playing/paused/completed）、speedMultiplier 時長計算、partialIndex 更新邏輯、MapRoute partialIndex prop、MapMarker animationState prop（預計 15+ tests）
- [ ] F007.11 E2E test — 播放按鈕可見 + 點擊後播放控制列顯示、速度 pill 切換、重播行為

**依賴**：Phase 1 的 DayMap、MapMarker、MapRoute、useMapData

---

## F008：拖曳排序

- [ ] F008.1 確認 open question OQ-1（拖曳寫入權限）— 決定旅伴（非 admin）能拖嗎？方案 A（僅 owner）或方案 B（登入成員皆可），決定前不開始 F008 實作
- [ ] F008.2 建立 `src/components/trip/MapDragSort.tsx` — 管理拖曳狀態（draggingId + overIndex）、本地 sort_order 樂觀更新、PATCH API 回寫（逐一請求）、失敗回滾邏輯
- [ ] F008.3 實作樂觀更新 — 拖曳放開後立即更新本地 entries 順序（重新計算連續 sort_order 1, 2, 3, ...），地圖 MapMarker 編號同步更新
- [ ] F008.4 實作 PATCH API 批次回寫 — debounce 500ms 後發送，逐一呼叫 `PATCH /api/trips/:id/entries/:eid`（`sort_order` 欄位），競態保護（拖曳中不發送上一次未完成的請求）
- [ ] F008.5 實作錯誤回滾 — PATCH 失敗時回滾 entries 至拖曳前順序 + 顯示 Toast「更新順序失敗，已還原」
- [ ] F008.6 修改 `src/components/trip/TimelineEvent.tsx`（或 Timeline 容器）— 新增拖曳手把（`drag_indicator` icon，20px，左側）；認證使用者才顯示（根據 OQ-1 決定的權限判斷）；套用 HTML5 DnD API（`draggable`、`onDragStart`、`onDragOver`、`onDrop`）
- [ ] F008.7 實作拖曳視覺 — 被拖曳 entry 套用 `.timeline-entry--dragging`（opacity 0.5）；懸停目標套用 `.timeline-entry--drag-over`（dashed accent outline）
- [ ] F008.8 新增 `css/map.css` 拖曳樣式 — `.timeline-drag-handle`（20px，cursor: grab）、`.timeline-entry--dragging`、`.timeline-entry--drag-over`
- [ ] F008.9 實作 iOS Safari 相容性 — 測試 HTML5 DnD 在 iOS Safari 的行為，必要時用 Pointer Events API 作為降級（`onPointerDown` + `onPointerMove` + `onPointerUp`）
- [ ] F008.10 實作 Accessibility — 拖曳手把 `aria-label="拖曳以重新排序 景點名稱"` + `role="button"` + `tabIndex={0}`；鍵盤 Up/Down 箭頭鍵調整順序；`aria-live="polite"` 通知排序成功
- [ ] F008.11 新增 unit tests — MapDragSort 樂觀更新、sort_order 正規化、PATCH 回寫、錯誤回滾；Timeline drag handle 渲染（認證 vs 未認證）（預計 15+ tests）
- [ ] F008.12 E2E test — 拖曳手把可見（認證）/ 隱藏（未認證）；拖曳後 entry 順序更新；PATCH API 呼叫驗證；失敗回滾行為
