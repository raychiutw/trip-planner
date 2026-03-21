## Context

前端掃描發現多處 React 效能問題，主要集中在 memo 被繞過和 cleanup 缺失。這些問題在行動裝置上影響更明顯。

## Goals / Non-Goals

**Goals:**
- 修正 Timeline useMemo 被繞過的問題
- 修正 DaySection 每次 render 產生新 array reference
- 修正 DayNav long-press timer memory leak
- 修正 usePrintMode stale closure
- 消除 body scroll lock 重複邏輯

**Non-Goals:**
- 不做 bundle splitting（React.lazy）— 移至後續
- 不做 Sentry dynamic import — 移至後續
- 不改資料層架構（mapDay 型別）

## Decisions

### D1. Timeline isToday 修正

現有：`const isToday = dayDate === new Date().toISOString().split('T')[0]`（render body）

改為：在 parent（TripPage）中計算 `localToday`，透過 prop 傳給 Timeline，Timeline 內用 `useMemo` 比較 `dayDate === localToday`。TripPage 已有 `getLocalToday()` 呼叫，直接複用。

### D2. DaySection timeline memo

現有：`timeline.map(e => toTimelineEntry(e as ...))` 在 render 中每次執行

改為：在 DaySection 內用 `useMemo(() => timeline.map(toTimelineEntry), [day?.timeline])` 包裹。

### D3. useBodyScrollLock hook

從 InfoSheet + QuickPanel 抽取共用邏輯：
- body scroll lock（iOS fixed positioning + saved scroll）
- Escape key close handler

介面：`useBodyScrollLock(isOpen: boolean)`
回傳：無（pure side effect hook）

### D4. DayNav timer cleanup

新增 `useEffect` cleanup：
```tsx
useEffect(() => {
  return () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };
}, []);
```

### D5. usePrintMode stale closure

將 `isDark` 存入 ref，handlers 讀取 ref.current 而非 closure 中的值。

## Risks / Trade-offs

- **[Risk] useBodyScrollLock 抽取可能遺漏元件特定邏輯** → Mitigation：逐行對比 InfoSheet/QuickPanel 實作，確保完全等價
- **[Risk] Timeline prop 變更影響呼叫端** → Mitigation：只新增 optional prop `localToday`，有 fallback
