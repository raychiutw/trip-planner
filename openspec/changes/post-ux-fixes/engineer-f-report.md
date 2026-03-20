# Engineer F Report

> v2: 根據 Challenger 回饋調整

## C.4 — InfoSheet 高度依內容 max 85%

**檔案**: `src/components/trip/InfoSheet.tsx`, `css/style.css`

**修改內容**:
- CSS 改為 `height: min(fit-content, 85dvh); max-height: 85dvh`，純 CSS 驅動初始高度，無 JS 測量
- 移除 `computeStops()` JS 測量函式
- 拖曳 snap 改為 px 步進制（`SNAP_STEP_PX = 120px`）：向上拖 +120px，向下拖 -120px，低於 120px 則關閉
- 保留 height transition 讓 snap 動畫平滑

**Challenger 回饋對應**: 用純 CSS `min(fit-content, 85dvh)` 取代 JS 測量，STOPS 改為絕對 px 步進

## C.5 — InfoSheet scroll lock

**檔案**: `src/components/trip/InfoSheet.tsx`

**修改內容**:
- 採用 iOS Safari 標準解法：開啟時 `position: fixed; top: -scrollY; width: 100%`
- 關閉時還原 `position/top/width` 並用 `window.scrollTo()` 恢復捲動位置
- `useEffect` cleanup 中也還原，防止元件卸載時遺漏

**Challenger 回饋對應**: 從簡單 `overflow: hidden` 改為 iOS Safari 安全的 `position: fixed` 方案

## C.6 — InfoSheet 手勢整合（iOS 模式）

**檔案**: `src/components/trip/InfoSheet.tsx`

**修改內容**:
- 新增 `bodyRef` 追蹤 `.info-sheet-body` 捲動狀態
- 使用原生 `addEventListener` + `{ passive: false }` 掛載 body touch 事件，確保 `preventDefault()` 有效
- 只做「到頂 + 向下拖 → 縮小/關閉」，移除「到底 + 向上拖 → 放大」邏輯
- `bodyDragAccumulator` 確保連續 >10px 同方向移動才觸發，避免誤觸
- 在 body `touchStart` 記錄 `initialScrollTop`

**Challenger 回饋對應**: 移除「到底→放大」（不直覺）、改用原生事件監聽 + `{ passive: false }`

## D.1 — Sticky nav 背景不透明度

**檔案**: `css/style.css`

**修改內容**:
- `color-mix()` 不透明度從 85% 提高到 92%
- 新增 `box-shadow: 0 1px 0 var(--color-border)` 做微妙底部分隔線
- 使用 `var(--color-border)` 確保 6 主題 x light/dark 都能適配

## D.2 — Sentry CSP connect-src

**檔案**: `src/lib/sentry.ts`

**修改內容**:
- Sentry DSN 目前未啟用（被註解），暫不修改 CSP
- 在 `sentry.ts` 加上 TODO 備註：啟用 DSN 時需在所有 HTML 的 `connect-src` 加上 `https://*.ingest.us.sentry.io`
- HTML 檔案維持原狀

**Challenger 回饋對應**: DSN 未啟用，改為程式碼備註提醒，避免無效的 CSP 擴張
