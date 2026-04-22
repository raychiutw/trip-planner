# Design Decisions: PR12 — Timeline Utils 重構

## F001 — 新建 `src/lib/timelineUtils.ts`

**決策**：放 `src/lib/`，副檔名 `.ts`（非 `.tsx`）。

**命名依據**：
`src/lib/` 現有 `formatUtils.ts`（通用格式化）、`drivingStats.ts`（行駛統計）、`mapDay.ts`（行程資料轉換）等，均以功能語意命名。`timelineUtils.ts` 對齊此慣例，清楚標示用途範圍（timeline 元件專用 util）。

**`.ts` vs `.tsx` 決策根據**：
讀取 `TimelineEvent.tsx` 與 `TimelineRail.tsx` 原始碼確認：`deriveTypeMeta` 回傳 `{ icon: string; label: string; accent: boolean }`，其中 `icon` 為 icon 名稱字串（`'plane'`、`'hotel'` 等），在呼叫端才傳入 `<Icon name={meta.icon} />`。三個函式均無 JSX 輸出、無 ReactElement 型別。**結論：`.ts` 即可，不需要 `.tsx`。**

**Trade-off**：
- 另一方案是放 `src/components/trip/` 並讓 TimelineEvent import、TimelineRail import from TimelineEvent — 但這讓 TimelineEvent 成為 TimelineRail 的邏輯來源，模糊元件與 util 的邊界，且 TimelineEvent 本身就有被其他地方 import 的 type（`TimelineEntryData`），混入 util 增加耦合風險。
- 放 `src/lib/` 確保純 util（no side effect, no React dep）的組織位置一致。

## F002 — TimelineEntryData 仍留在 TimelineEvent.tsx

**決策**：`TimelineEntryData` type 繼續 export 自 `TimelineEvent.tsx`，不搬到 `timelineUtils.ts`。

**理由**：
- `TimelineEntryData` 已被 `mapDay.ts`、`TodayRouteSheet.tsx` 等非 timeline 元件 import，搬移會波及更多檔案，scope 超出本次 refactor 目標。
- `timelineUtils.ts` 需要 `TimelineEntryData` 做 `deriveTypeMeta` 參數型別 — 直接 `import type { TimelineEntryData } from '../components/trip/TimelineEvent'`，形成 lib → component type 的單向依賴（只引 type，不引 runtime），TypeScript 型別系統允許且不產生 circular dependency。
- 若未來另立 PR 統一型別來源（如 `src/types/timeline.ts`），本次架構不構成阻礙。

**Trade-off**：
- 接受 lib 引用 component type 的方向：純 type import（`import type`），不影響 runtime bundle；型別定義的所有權維持在 component 層，符合「誰宣告誰負責」的現有慣例。

## F003 — JSDoc 更新範圍

**決策**：只更新 TimelineRail 頂端 JSDoc 第一行及對 `design_mobile.jsx` 的參照；保留 Structure 段（`Left gutter`、`Dot`、`Row` 等）因仍準確描述元件結構。

**Trade-off**：
- 不重寫整段 JSDoc 避免引入不相關變更，保持 diff 最小。
- 不同步更新 `TimelineEvent.tsx` JSDoc（其描述「Ocean 4-col stop card」仍準確），不需修改。

## F004 — 刪 `index` prop

**決策**：直接刪除 `TimelineEventProps.index` 宣告；不以 `_index` 重命名（`_` prefix 表示有意保留但暫不使用，此 prop 完全無任何使用意圖）。

**呼叫端確認**：
讀取 `TimelineEvent.tsx` 確認 function 簽名為 `({ entry, isNow, isPast }: TimelineEventProps)`，`index` 已不在解構中，僅 Props interface 有殘留宣告。實作前需搜尋 `<TimelineEvent` 所有使用處，確認是否有呼叫端傳入 `index={...}`，若有則同步移除（屬 breaking change，但 PR 內統一處理）。

**Trade-off**：
- 不加 `@deprecated` 過渡期：本次 PR 已是 post-hoc audit，沒有外部消費者，直接刪除最乾淨。
- 若 CI TypeScript strict 開啟，任何仍傳 `index` 的呼叫端會在 `tsc` 報錯（excess property），可作為自動防護網。

## 未選替代方案

| 替代方案 | 不選理由 |
|---------|---------|
| 不抽 lib，改 TimelineRail import from TimelineEvent | TimelineEvent 成為 TimelineRail 的邏輯來源，模糊元件邊界 |
| 抽到 `src/components/trip/timelineHelpers.ts` | component 目錄內放 util 破壞 `src/lib/` 的 util 組織慣例 |
| 刪 TimelineEvent 整個檔案（含 type） | `TimelineEntryData` 仍被 mapDay.ts / TodayRouteSheet.tsx import，不可輕刪 |
| `deriveTypeMeta` 改為 `.tsx` | 函式回傳純資料物件，無 JSX，無需 `.tsx` |
