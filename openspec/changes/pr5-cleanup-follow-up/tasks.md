# Tasks: PR 5 Cleanup Follow-up

## F001：清 dead CSS（`.ocean-body` / `.ocean-main` / `.ocean-side` / `.info-panel`）

- [ ] F001.1 red test（`tests/unit/dead-css-cleanup.test.ts`）：tokens.css 不應含 `.ocean-body` 或 `.ocean-main` 或 `.ocean-side` selector（grep）
- [ ] F001.2 檢查 `InfoPanel.tsx` 是否仍被任何元件 import（若 orphan 一起刪，連同相關 CSS rules）
- [ ] F001.3 刪除 `css/tokens.css` 中對應 dead rules，保留 print-mode 必要的 fallback（若有）
- [ ] F001.4 驗證 print mode screenshot 仍正常（手動截圖或 Playwright print snapshot）

---

## F002：DaySection inline style → CSS class

- [ ] F002.1 red test（`tests/unit/day-section-no-inline-style.test.tsx`）：DaySection.tsx render 後的 DOM 不含 `style="..."` attribute（除了明確必要的 dynamic value inline）
- [ ] F002.2 把 2 處 `style={{}}` object literal 搬到對應 CSS class（在 `css/tokens.css` 或 component scoped）
- [ ] F002.3 若 inline style 包含 dynamic value（如 `color`），改用 CSS custom property pass through（`--var: value`）

---

## F003：TripMapRail singleton style injection

- [ ] F003.1 red test（`tests/unit/trip-map-rail-singleton-style.test.tsx`）：多個 `<TripMapRail>` render 後 DOM 只有一個 `<style data-scope="trip-map-rail">` 節點（不重複 inject）
- [ ] F003.2 實作 singleton injection：module-level flag + `useEffect` 一次 inject `<style>` 至 `document.head`，cleanup 時 unmount 清除
- [ ] F003.3 重跑既有 TripMapRail 相關測試確認仍全過

---

## F004：MobileBottomNav `onClearSheet` 改 optional

- [ ] F004.1 red test（`tests/unit/mobile-bottom-nav-optional-clear-sheet.test.tsx`）：不傳入 `onClearSheet` prop 的 MobileBottomNav 不 crash 且渲染正常
- [ ] F004.2 `MobileBottomNav.tsx` prop type 改 `onClearSheet?: () => void`（移除必填）
- [ ] F004.3 檢查 `TripPage.tsx` 及所有 call site，若傳入的 onClearSheet 已是 dead prop 則一併移除

---

## F005：OverflowMenu `needsDivider` 邏輯簡化

- [ ] F005.1 red test（`tests/unit/overflow-menu-divider.test.tsx`）：既有 divider 插入行為不變（before/after 結構斷言）
- [ ] F005.2 移除 `prev.action !== item.action` 冗餘分支，保留 `prev.group !== item.group` 判斷
- [ ] F005.3 重跑 snapshot / structural test 確認 divider 位置與數量一致

---

## F006：StopDetailPage / MapPage header 統一使用 `<TriplineLogo>`

- [ ] F006.1 red test（`tests/unit/stop-detail-page-logo.test.tsx`）：StopDetailPage header 含 `<a href="/"><TriplineLogo /></a>` 結構（或等效 TriplineLogo render）
- [ ] F006.2 red test（`tests/unit/map-page-logo.test.tsx`）：MapPage header 含同上結構
- [ ] F006.3 替換 `StopDetailPage.tsx` header 的 inline wordmark 為 `<TriplineLogo />`
- [ ] F006.4 替換 `MapPage.tsx` header 的 inline wordmark 為 `<TriplineLogo />`
- [ ] F006.5 視覺 regression check：手動對照或 Playwright screenshot diff（確認 logo 大小/位置一致）

---

## F007：QA script T8 sticky 邏輯修正

- [ ] F007.1 修正 `.playwright-mcp/qa-pr3.mjs` T8 assert 邏輯：
  - 移除「scroll 前後 rail top 相同」的錯誤斷言
  - 改為三次 scroll snapshot：初始位置 → scroll 觸發 sticky → 繼續 scroll；第二/三次 snapshot 的 rail top 應保持穩定（ `<nav-height`）
- [ ] F007.2 重跑 QA T8，確認 pass（sticky 確實黏住後 top 穩定）
