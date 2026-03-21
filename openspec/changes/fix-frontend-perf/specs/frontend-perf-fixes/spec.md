## ADDED Requirements

### Requirement: Timeline isToday 不破壞 useMemo
`Timeline` 元件的 `isToday` 計算 SHALL 不在 render body 中呼叫 `new Date()`，以避免破壞 `useMemo` 依賴。

#### Scenario: isToday 穩定不變
- **WHEN** parent 未改變 props
- **THEN** Timeline 的 `useMemo` SHALL 不重新計算（isToday 值穩定）

#### Scenario: 日期切換時正確更新
- **WHEN** `localToday` prop 從 "2026-07-02" 變為 "2026-07-03"
- **THEN** `isToday` SHALL 正確反映新日期

### Requirement: DaySection timeline array memo
`DaySection` 中的 `timeline.map(toTimelineEntry)` 結果 SHALL 用 `useMemo` 包裹，避免每次 render 產生新 array reference。

#### Scenario: day 資料未變時不重建 array
- **WHEN** DaySection re-render 但 `day.timeline` 未變
- **THEN** 傳給 Timeline 的 `events` prop SHALL 為同一個 reference

### Requirement: DayNav long-press timer cleanup
`DayNav` 的 long-press `setTimeout` SHALL 在元件 unmount 時清除。

#### Scenario: unmount 期間觸發 timer
- **WHEN** 使用者在 touch 進行中離開頁面
- **THEN** timer SHALL 被 clearTimeout 清除，不會呼叫已 unmount 的 setState

### Requirement: usePrintMode 不持有 stale isDark
`usePrintMode` 的 `togglePrint` 和 print event handlers SHALL 透過 ref 讀取最新的 `isDark` 值。

#### Scenario: 切換 dark mode 後立即 print
- **WHEN** 使用者切換 dark → light，然後立即觸發 print
- **THEN** print handler SHALL 讀到最新的 isDark = false

### Requirement: useBodyScrollLock 共用 hook
body scroll lock 邏輯 SHALL 抽取為 `useBodyScrollLock(isOpen)` hook，`InfoSheet` 和 `QuickPanel` SHALL 使用此 hook 取代各自的重複實作。

#### Scenario: InfoSheet 開啟時鎖定 body 捲動
- **WHEN** `isOpen` 從 false 變為 true
- **THEN** body SHALL 設為 fixed positioning，保存目前捲動位置

#### Scenario: QuickPanel 關閉時恢復 body 捲動
- **WHEN** `isOpen` 從 true 變為 false
- **THEN** body SHALL 恢復原始 style，捲動位置 SHALL 還原
