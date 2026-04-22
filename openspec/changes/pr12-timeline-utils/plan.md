# Plan: PR12 — Timeline Utils 重構

## 執行策略

嚴格 TDD 紅→綠，每個 feature 兩個 commit：
1. `test(F00N): red — 描述` — 失敗測試（測試先行，確認紅燈）
2. `refactor(F00N): 描述` — 最小實作（純重構，無行為變更）

## 執行順序

```
F001 → F002 → F003 → F004
```

### F001 — 新建 `src/lib/timelineUtils.ts`（含 unit tests）

最先執行，為後續所有 F 提供穩固基礎。lib 本身有獨立 unit tests，可作為行為參考點。

### F002 — TimelineEvent / TimelineRail 改 import from lib

依賴 F001 完成。兩個元件同一 commit 處理（確保 `tsc` 不報 duplicate identifier）。完成後立即驗證 `tsc` + `npm test`。

### F003 — TimelineRail JSDoc 更新

不依賴 F002，但排在後面確保注意力集中。純文件變更，commit 獨立，方便 reviewer 快速審閱。

### F004 — TimelineEvent 刪 `index` prop

最後執行，因需搜尋所有呼叫端（`Timeline.tsx` 等），確認無 excess property 傳入。執行前先跑 `npx tsc --noEmit` 取得 baseline。

## 每 F 完成後

1. `npx tsc --noEmit` → 確認 0 errors
2. `npm test` → 確認全綠
3. 更新 `progress.jsonl` 加一行

## Commit 節奏

| Commit | 訊息 |
|--------|------|
| test(F001): red — timelineUtils unit tests | 新增 timelineUtils.test.ts，三函式測試，此時 import 不存在，預期紅燈 |
| refactor(F001): 新建 src/lib/timelineUtils.ts | 搬移三函式與 ParsedTime，tests 轉綠 |
| test(F002): red — source-match guard 無本地函式定義 | 驗證兩個元件無本地 parseTimeRange，預期紅燈 |
| refactor(F002): TimelineEvent / TimelineRail import from timelineUtils | 刪本地定義、加 import，tests 轉綠 |
| test(F003): red — source-match 不含 mobile-only / design_mobile.jsx | 預期紅燈 |
| docs(F003): 更新 TimelineRail JSDoc | 反映桌機 + 手機統一使用現況，tests 轉綠 |
| test(F004): red — source-match TimelineEventProps 不含 index | 預期紅燈 |
| refactor(F004): 移除 TimelineEvent index dead prop | 刪 Props 宣告，同步清理所有呼叫端，tests 轉綠 |

## DoD（Definition of Done）

- `npx tsc --noEmit` 0 errors
- `npm test` 全綠
- `src/lib/timelineUtils.ts` 覆蓋 `parseTimeRange`、`formatDuration`、`deriveTypeMeta` unit tests
- `TimelineEvent.tsx` 與 `TimelineRail.tsx` 無本地函式重複定義
- `TimelineRail.tsx` JSDoc 無 `mobile-only`、無 `design_mobile.jsx` 字串
- `TimelineEventProps` 無 `index` 欄位
- 不 push（後續 ship flow 處理 PR）
