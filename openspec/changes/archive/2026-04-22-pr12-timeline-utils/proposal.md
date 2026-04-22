# Proposal: PR12 — Timeline Utils 重構（Tech Debt 清理）

## 背景

PR #213（v2.0.2.7）post-hoc audit 發現 3 項 tech debt，均屬非功能性問題，不影響現有行為，但拉高日後維護成本：

1. **重複邏輯**：`parseTimeRange`、`formatDuration`、`deriveTypeMeta` 三個純函式在 `TimelineEvent.tsx` 與 `TimelineRail.tsx` 各有一份完整定義，合計重複約 60 行。
2. **過時 JSDoc**：`TimelineRail.tsx` 頂端 JSDoc 寫「mobile-only compact timeline（設計稿 design_mobile.jsx 版本）」，PR 11 後 TimelineRail 已同時服務桌機與手機，描述與現實脫節。
3. **Dead prop**：`TimelineEventProps` 宣告 `index: number`，但 `TimelineEvent` function body 從未使用，屬於無效介面雜訊。

## 問題詳述

| ID | 類型 | 問題 | 影響 |
|----|------|------|------|
| F001 | Duplicate logic | `parseTimeRange` / `formatDuration` / `deriveTypeMeta` 在兩個檔案各有一份 | 修改時必須同步兩處，容易漏改導致行為分歧 |
| F002 | Duplicate logic | F001 的兩組定義在 `parseTimeRange` 細節完全相同（含 midnight-crossing 邏輯） | 同上 |
| F003 | Stale JSDoc | `TimelineRail` 頂端文件仍寫「mobile-only」 | 閱讀者誤判元件適用範圍 |
| F004 | Dead prop | `index: number` 宣告於 `TimelineEventProps`，未使用 | 呼叫端必須傳入無意義值，型別契約錯誤 |

## 設計原則

- **DRY**：共用邏輯抽到 `src/lib/` pure util 模組，兩個元件 import 同一來源。
- **JSDoc 反映實況**：文件只描述目前行為，不保留歷史痕跡。
- **Dead code 清理**：移除未使用的 prop，縮小元件的公開介面。
- **零行為變更**：純 refactor，不修改任何 runtime 邏輯；視覺無差異。

## 解法

### F001 — 新建 `src/lib/timelineUtils.ts`

新增 `src/lib/timelineUtils.ts`，export 三個函式與相關型別：

- `ParsedTime`（interface）
- `parseTimeRange(timeStr?: string | null): ParsedTime`
- `formatDuration(mins: number): string`
- `deriveTypeMeta(entry: TimelineEntryData): { icon: string; label: string; accent: boolean }`

**副檔名選擇 `.ts`（非 `.tsx`）**：`deriveTypeMeta` 回傳純資料物件 `{ icon: string; label: string; accent: boolean }`，icon 以字串名稱傳遞（如 `'plane'`、`'hotel'`），在呼叫端才傳入 `<Icon name={meta.icon} />`。三個函式均無 JSX 輸出，`.ts` 即可。

### F002 — TimelineEvent / TimelineRail 改 import from lib

兩個元件刪除本地的三個函式定義，改為：

```ts
import { parseTimeRange, formatDuration, deriveTypeMeta } from '../../lib/timelineUtils';
```

`ParsedTime` interface 隨函式移至 lib；`TimelineEntryData` 仍維持在 `TimelineEvent.tsx` export（TimelineRail 已 import type from TimelineEvent，此依賴關係不變）。

### F003 — TimelineRail JSDoc 更新

將 `TimelineRail.tsx` 頂端 JSDoc 第一行：

> `TimelineRail — mobile-only compact timeline (設計稿 design_mobile.jsx 版本)`

改為：

> `TimelineRail — 桌機與手機統一 compact editorial rail（PR 11 / v2.0.2.7 後同時服務兩端）`

同步移除對 `design_mobile.jsx` 的參照。

### F004 — TimelineEvent 刪 `index` prop

`TimelineEventProps` 移除 `index: number` 欄位；`TimelineEvent` function 簽名對應移除 `index` 解構（若有）。

## 影響評估

| 面向 | 說明 |
|------|------|
| 行為 | 無變更，純 refactor |
| 視覺 | 無變更 |
| API 相容性 | `TimelineEventProps` 移除 `index` — 呼叫端若有傳入需同步刪除（breaking for callers，需搜尋確認） |
| 測試 | 預期新增 2–3 個 unit tests（timelineUtils.ts 三函式） |
| Bundle | 新增一個小 lib 檔，對 bundle size 無實質影響（三函式本來就在 bundle 內，只是從單點 import） |

## 完成標準

- `npx tsc --noEmit` 0 errors
- `npm test` 全綠
- `src/lib/timelineUtils.ts` 有對應 unit tests
- `TimelineEvent.tsx` 與 `TimelineRail.tsx` 無本地函式重複定義
