# Code Review Report: days-required-fields

**Reviewer**: Code Reviewer
**Date**: 2026-03-21
**Change**: days 必填欄位驗證（DB migration + API validation + skill 文件）

---

## 判定：REQUEST CHANGES

需修正 1 個 P0 問題後方可 APPROVE。

---

## 1. 正確性 + 可讀性 + 測試覆蓋

### 正確性

**[P0] API endpoint 驗證通過後仍用 `?? null` 寫入 DB**

`functions/api/trips/[id]/days/[num].ts` 第 185-187 行：

```typescript
body.date ?? null,
body.dayOfWeek ?? null,
body.label ?? null,
```

雖然前面已驗證 `!body.date` 等條件，確保 falsy 值不會通過，但 `?? null` 語意上表達的是「允許 null fallback」，與 NOT NULL 約束和驗證邏輯的意圖矛盾。若未來有人重構驗證順序或加入條件跳過驗證，這裡會靜默寫入 null，觸發 DB 層 NOT NULL constraint error（500）而非回傳有意義的 400。

**建議**：改用 `body.date!`、`body.dayOfWeek!`、`body.label!`（因驗證已通過，non-null assertion 是正確的），或用 `as string`。

### 可讀性

- Migration SQL 註解清晰，步驟分明。
- `validateDayBody.ts` 結構良好，interface 定義明確。
- API endpoint 的 inline 驗證可讀性佳，變數命名清晰。

### 測試覆蓋

- 測試覆蓋了 5 種缺欄位組合、3 種 date 格式錯誤、label 邊界值（8 字/9 字）、正常通過。覆蓋良好。
- **缺少邊界測試**：`date` 為空字串 `""` 的情況。由於驗證用 `!body.date`，空字串會被 falsy 擋下，行為正確，但建議補一個測試明確記錄此行為。
- **缺少邊界測試**：`dayOfWeek` 值域驗證（design.md 無此需求，不阻擋，標記為建議）。

## 2. 架構影響評估

### 影響的上下游模組

- **DB**：`days` table schema 變更（NOT NULL 約束）
- **API**：`PUT /api/trips/:id/days/:num` 新增 400 回傳路徑
- **呼叫端**：tp-create、tp-edit、tp-rebuild 三個 skill

### validateDayBody.ts 與 endpoint 的關係

`validateDayBody.ts`（`src/lib/`）已被建立但 **endpoint 並未 import 使用**。endpoint 內有完全重複的 inline 驗證邏輯。詳見第 6 點 Design Pattern 建議。

### 呼叫端更新狀況

- tp-create：已更新，明確列出三個必填欄位及 400 回傳說明。 **充分**。
- tp-edit：已更新，加入 PUT 時保留 date/dayOfWeek/label 的警告。 **充分**。
- tp-rebuild：已更新，加入 days meta 缺漏修復邏輯（推算 date、dayOfWeek、摘要 label）。 **充分**。
- **tp-patch**：此 skill 透過 PATCH 修改 entries/restaurants/shopping，不直接 PUT days，**不受影響**。
- **tp-check**：只讀取資料，不做寫入，**不受影響**。
- **tp-request**：不涉及 days 寫入，**不受影響**。

## 3. 效能影響分析

- `validateDayBody.ts` 約 44 行，對 bundle size 影響極小。
- 目前此模組只被 test 引用，未被 endpoint 引用（見第 6 點），若整合後會從 `src/lib/` import 到 `functions/api/`，需確認 Vite/Wrangler bundling 不會把前端 lib 混入 worker bundle（Cloudflare Pages Functions 有獨立 build pipeline，應無問題）。
- 無不必要的重複計算。

## 4. 安全性審查

- **XSS 風險**：無。驗證邏輯只檢查值的存在性和格式，不將 user input 拼接到 HTML。API 回傳 JSON。
- **Injection 風險**：無。所有 SQL 均使用 prepared statement 的 `.bind()` 方式，不拼接字串。
- error message 中的欄位名稱是硬編碼的字串（`date`、`dayOfWeek`、`label`），不會洩漏 user input。

## 5. 向後相容

### API 介面變更

- `PUT /days/:num` 現在會回傳 400 若缺少 date/dayOfWeek/label。
- 目前所有呼叫端都是 skill（tp-create、tp-edit、tp-rebuild），且已更新文件說明必填欄位。不影響前端（前端不呼叫此 PUT endpoint）。
- **相容性：OK**。

### DB Migration 安全性

**Migration 採 DROP TABLE + RENAME 策略，需確認 FK 影響**：

`hotels` 和 `entries` 都有 `REFERENCES days(id) ON DELETE CASCADE`。`DROP TABLE days` 在 foreign_keys = ON 時會觸發級聯刪除。

**結論**：D1 預設 `PRAGMA foreign_keys = OFF`（SQLite 預設行為），且 codebase 中沒有任何地方執行 `PRAGMA foreign_keys = ON`（已搜尋確認）。因此 DROP TABLE 不會觸發級聯刪除，hotels/entries 資料安全。

**但仍有風險**：若未來 D1 改變預設行為（雖然可能性低），此 migration 會導致資料遺失。Design.md 已記錄此假設。

- `INSERT INTO days_new SELECT *` 依賴欄位順序一致，migration 中 `days_new` 的欄位定義與原 `days` table 完全相同（只改了 NOT NULL 約束），順序一致，**OK**。
- Step 1 先 UPDATE null → '' 確保不違反 NOT NULL 約束，**OK**。

## 6. Design Pattern 建議

### [P1] 驗證邏輯重複：inline vs validateDayBody.ts

**現況**：
- `functions/api/trips/[id]/days/[num].ts` 第 150-167 行：inline 驗證
- `src/lib/validateDayBody.ts`：完全相同的驗證邏輯

**問題**：兩份邏輯需同步維護，未來修改一處遺漏另一處會產生不一致。

**建議**（二選一）：
1. **Endpoint import validateDayBody**：endpoint 改為 `import { validateDayBody } from '../../../../src/lib/validateDayBody'`，移除 inline 驗證。需確認 Cloudflare Pages Functions 的 build pipeline 能解析此 import path。
2. **將 validateDayBody 移至 functions/ 內**：例如 `functions/api/_validate.ts`，endpoint 和 test 都從此處 import。這樣更符合 Cloudflare Functions 的慣例。

**推薦方案 2**，因為 `src/lib/` 是前端 bundle 的 lib 目錄，放一個純 server-side 驗證函式在此不符合專案結構慣例。

## 7. 技術債標記

| # | 項目 | 優先級 |
|---|------|--------|
| TD-1 | 驗證邏輯存在兩份（inline + validateDayBody.ts），應合併為一份 | P1 |
| TD-2 | `dayOfWeek` 無值域驗證（只驗存在性，不驗是否為 "一"~"日" 之一） | P2 |
| TD-3 | `date` 無語意驗證（regex 只檢查格式，`2026-99-99` 也會通過） | P2 |
| TD-4 | Migration 假設 D1 foreign_keys = OFF，未明確在 SQL 中設定 PRAGMA | P3 |

## 8. 跨模組 Side Effect

### Skill 影響

已確認所有 6 個 skill（tp-create、tp-edit、tp-rebuild、tp-patch、tp-check、tp-request）：
- 3 個涉及 PUT days 的 skill 已更新（tp-create、tp-edit、tp-rebuild）
- 3 個不涉及 PUT days 的 skill 不受影響（tp-patch、tp-check、tp-request）
- **無遺漏**。

### Migration FK 影響

- `hotels.day_id REFERENCES days(id)` 和 `entries.day_id REFERENCES days(id)`：DROP TABLE days 後，這些 FK 指向的 table 被 rename 為 days，id 值不變。D1 foreign_keys = OFF，不觸發級聯操作。**安全**。
- Migration 後 `days` table 的 AUTOINCREMENT 序列會重置（因為是新 table），但由於 `INSERT INTO days_new SELECT *` 保留了原始 id 值，後續 AUTOINCREMENT 會從最大 id + 1 繼續。**安全**。

---

## 修正要求摘要

### 必須修正（P0）

1. **`[num].ts` 第 185-187 行**：將 `body.date ?? null` 改為 `body.date!`（或 `body.date as string`），同理 `dayOfWeek` 和 `label`。驗證已通過，不應再有 null fallback。

### 建議修正（P1，不阻擋 APPROVE 但強烈建議）

2. 合併驗證邏輯為一份（移除 inline 或移除 validateDayBody.ts，建議保留一份在 `functions/api/` 下）。

### 可選改進（P2/P3，記錄為技術債）

3. `dayOfWeek` 值域驗證
4. `date` 語意驗證（valid date check）
5. Migration 明確設定 `PRAGMA foreign_keys = OFF`
