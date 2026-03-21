## 1. Timeline isToday 修正

- [x] 1.1 修改 `src/pages/TripPage.tsx`：將 `localToday` 作為 prop 傳給 Timeline
- [x] 1.2 修改 `src/components/trip/Timeline.tsx`：接收 `localToday` prop，用 `useMemo` 計算 `isToday`

## 2. DaySection timeline memo

- [x] 2.1 修改 `src/pages/TripPage.tsx` DaySection：用 `useMemo` 包裹 `timeline.map(toTimelineEntry)`

## 3. DayNav timer cleanup

- [x] 3.1 修改 `src/components/trip/DayNav.tsx`：新增 `useEffect` cleanup 清除 longPressTimer

## 4. usePrintMode stale closure

- [x] 4.1 修改 `src/hooks/usePrintMode.ts`：新增 `isDarkRef` = `useRef(isDark)`，handlers 讀取 ref.current

## 5. useBodyScrollLock hook

- [x] 5.1 新增 `src/hooks/useBodyScrollLock.ts`：抽取 body scroll lock + Escape key 邏輯
- [x] 5.2 修改 `src/components/trip/InfoSheet.tsx`：使用 `useBodyScrollLock(isOpen)` 取代原有邏輯
- [x] 5.3 修改 `src/components/trip/QuickPanel.tsx`：使用 `useBodyScrollLock(isOpen)` 取代原有邏輯

## 6. 測試

- [x] 6.1 執行 `npx tsc --noEmit` 確認型別無誤
- [x] 6.2 執行 `npm test` 確認所有測試通過
