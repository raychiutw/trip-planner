## Why

前端效能掃描發現 2 個高嚴重度問題和多個中嚴重度問題：Timeline `isToday` 每次 render 重算破壞 useMemo、DaySection timeline map 每次產生新 array 使子元件 memo 失效、DayNav long-press timer 未清理有 memory leak 風險、body scroll lock 邏輯在兩個元件中重複 60 行。

## What Changes

- **H6**: 修正 `Timeline.tsx` 的 `isToday` 計算，用 `useMemo` 包裹避免破壞下游 memo
- **H7**: 修正 `TripPage.tsx` DaySection 的 timeline map，用 `useMemo` 包裹避免每次產生新 array
- **M4**: 修正 `DayNav.tsx` long-press timer 在 unmount 時清除
- **M1**: 修正 `usePrintMode.ts` 的 stale closure 風險，用 ref 取代直接引用 isDark
- **D1**: 抽取 `useBodyScrollLock` hook，消除 InfoSheet/QuickPanel 重複邏輯

## Capabilities

### New Capabilities
- `frontend-perf-fixes`: 修正前端 React 效能問題和 memory leak

### Modified Capabilities
（無既有 spec 層級行為變更）

## Impact

- **元件**：`src/components/trip/Timeline.tsx`、`DayNav.tsx`、`InfoSheet.tsx`、`QuickPanel.tsx`
- **頁面**：`src/pages/TripPage.tsx`
- **Hooks**：`src/hooks/usePrintMode.ts`，新增 `src/hooks/useBodyScrollLock.ts`
- **測試**：新增對應 unit test
