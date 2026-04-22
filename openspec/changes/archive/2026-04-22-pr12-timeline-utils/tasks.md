# Tasks: PR12 — Timeline Utils 重構

## 執行順序

F001（新建 util lib + unit tests）→ F002（兩檔 import 重構）→ F003（JSDoc）→ F004（dead prop）

---

## F001 — 新建 `src/lib/timelineUtils.ts` 並補 unit tests

- [ ] 🔴 紅：寫測試 `tests/unit/timelineUtils.test.ts`
  - `parseTimeRange(undefined)` 回傳 `{ start: '', end: '', duration: 0 }`
  - `parseTimeRange('09:00-11:30')` 回傳 `{ start: '09:00', end: '11:30', duration: 150 }`
  - `parseTimeRange('23:00-01:00')` midnight-crossing，`duration` 為 120
  - `formatDuration(0)` 回傳 `''`
  - `formatDuration(90)` 回傳 `'1h 30m'`
  - `formatDuration(60)` 回傳 `'1h'`
  - `formatDuration(45)` 回傳 `'45m'`
  - `deriveTypeMeta({ title: '機場接送' })` 回傳 `{ icon: 'plane', label: '飛行', accent: false }`
  - `deriveTypeMeta({ title: '午餐', description: 'restaurant' })` 回傳 `{ icon: 'fork-knife', label: '用餐', accent: true }`
  - `deriveTypeMeta({ title: '步行市區' })` 回傳 `{ icon: 'walk', label: '散步', accent: false }`
- [ ] 🟢 綠：新建 `src/lib/timelineUtils.ts`，將三個函式與 `ParsedTime` interface 從 `TimelineEvent.tsx` 搬入並 export
- [ ] 更新 `progress.jsonl`

## F002 — TimelineEvent / TimelineRail 改 import from lib

- [ ] 🔴 紅：確認 `timelineUtils.test.ts` 通過後，在 `tests/unit/timelineUtils.test.ts` 補充一條 source-match guard：`TimelineEvent.tsx` 與 `TimelineRail.tsx` 原始碼均不含本地 `function parseTimeRange`（確保未來不會意外重新引入本地版本）
- [ ] 🟢 綠：
  - `TimelineEvent.tsx` — 刪除本地 `ParsedTime` interface 及 `parseTimeRange`、`formatDuration`、`deriveTypeMeta` 三函式定義，加 import from `../../lib/timelineUtils`
  - `TimelineRail.tsx` — 同上刪除本地三函式定義，加 import from `../../lib/timelineUtils`
- [ ] 執行 `npx tsc --noEmit` 確認 0 errors
- [ ] 執行 `npm test` 確認全綠
- [ ] 更新 `progress.jsonl`

## F003 — TimelineRail JSDoc 更新

- [ ] 🔴 紅：在 `tests/unit/timelineUtils.test.ts`（或獨立測試檔）加 source-match：`TimelineRail.tsx` 原始碼不含 `mobile-only` 字串、不含 `design_mobile.jsx` 字串
- [ ] 🟢 綠：更新 `TimelineRail.tsx` 頂端 JSDoc
  - 第一行改為：`TimelineRail — 桌機與手機統一 compact editorial rail（PR 11 / v2.0.2.7 後同時服務兩端）`
  - 移除所有對 `design_mobile.jsx` 的參照
- [ ] 執行 `npm test` 確認全綠
- [ ] 更新 `progress.jsonl`

## F004 — TimelineEvent 刪 `index` prop

- [ ] 🔴 紅：在測試檔加 source-match guard：`TimelineEventProps` 不含 `index` 欄位
- [ ] 🟢 綠：
  - `TimelineEvent.tsx` `TimelineEventProps` 移除 `index: number`
  - `TimelineEvent` function 簽名（目前 `{ entry, isNow, isPast }`）確認 `index` 未在解構中出現（已確認：現有 function 簽名已無 `index` 解構，僅 Props 型別宣告有殘留）
  - 搜尋專案所有呼叫端（`Timeline.tsx` 等），確認是否有傳入 `index` prop，若有則同步移除
- [ ] 執行 `npx tsc --noEmit` 確認 0 errors
- [ ] 執行 `npm test` 確認全綠
- [ ] 更新 `progress.jsonl`
