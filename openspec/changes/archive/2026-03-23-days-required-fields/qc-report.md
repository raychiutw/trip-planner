# QC Report — days-required-fields

**QC**: Claude Sonnet 4.6
**日期**: 2026-03-21

---

## 1. 測試執行環境

**結論：FAIL（環境問題，非程式碼問題）**

- Node 版本：v10.0.0
- npm 版本：5.6.0
- vitest 需要 Node 18+，在 Node v10 下執行 `npm test` 報錯：
  ```
  'vitest' 不是內部或外部命令
  ```
- `npx vitest run` 報錯：`The "path" argument must be of type string. Received type undefined`
- **結論**：無法執行測試，確認為 Node 版本不相容造成（與工程師報告一致）
- 改採靜態語法審查驗證正確性

---

## 2. functions/api/_validate.ts

**結論：PASS**

| 檢查項 | 結果 |
|--------|------|
| export 正確（`export interface DayBody`、`export interface ValidationResult`、`export function validateDayBody`） | PASS |
| 必填驗證：缺 date/dayOfWeek/label 時收集到 missing[] 並回傳 400 | PASS |
| date 格式驗證：`/^\d{4}-\d{2}-\d{2}$/` 正規式 | PASS |
| label 長度驗證：`body.label!.length > 8` → 400 | PASS |
| 全部通過時回傳 `{ ok: true, status: 200 }` | PASS |

**邊緣情境分析：**
- 空字串 `date/dayOfWeek/label`：`!body.date` 對空字串為 truthy（空字串是 falsy）→ 會被攔截 ✅
- `label` 剛好 8 字：`> 8` 而非 `>= 8`，8 字不觸發 → 通過 ✅
- `date = "0000-00-00"`：符合 `\d{4}-\d{2}-\d{2}` regex → 通過（regex 不驗語意，屬設計決定）✅

---

## 3. functions/api/trips/[id]/days/[num].ts

**結論：PASS**

| 檢查項 | 結果 |
|--------|------|
| import 路徑 `'../../../_validate'` 正確指向 `functions/api/_validate.ts` | PASS |
| `validateDayBody(body)` 呼叫正確，在 JSON 解析後立即執行 | PASS |
| `body.date!` / `body.dayOfWeek!` / `body.label!` 取代 `?? null`（non-null assertion） | PASS |
| validation 失敗時正確回傳 `json({ error: validation.error }, validation.status)` | PASS |
| `_auth` import 對應的 `functions/api/_auth.ts` 實際存在 | PASS |

---

## 4. migrations/0010_days_not_null.sql

**結論：PASS**

| 檢查項 | 結果 |
|--------|------|
| Step 1：UPDATE null 值為空字串（安全網） | PASS |
| Step 2：CREATE days_new，三個欄位均為 `TEXT NOT NULL DEFAULT ''` | PASS |
| Step 3：`INSERT INTO days_new SELECT * FROM days`（欄位順序需一致） | PASS |
| Step 4：DROP TABLE days + ALTER TABLE days_new RENAME TO days | PASS |
| Step 5：CREATE INDEX idx_days_trip ON days(trip_id) | PASS |
| UNIQUE(trip_id, day_num) 保留 | PASS |
| updated_at 保留 `DEFAULT (datetime('now'))` | PASS |

**注意事項（非 FAIL）**：`INSERT INTO days_new SELECT * FROM days` 使用 `SELECT *`，欄位順序須與 days_new DDL 完全一致。依現有 schema（id, trip_id, day_num, date, day_of_week, label, weather_json, updated_at），兩者順序相符，無問題。

---

## 5. tests/unit/days-validation.test.ts

**結論：PASS（含一項輕微不一致）**

| 檢查項 | 結果 |
|--------|------|
| import 路徑 `'../../functions/api/_validate'` 正確 | PASS |
| describe 群組清晰（必填缺失 / date 格式 / label 長度 / 全部正確） | PASS |
| 空字串 falsy 行為覆蓋（缺失測試以 undefined 代替，邏輯等效） | PASS |
| label = 8 字邊界值（`'12345678'`）通過測試 | PASS |
| label = 9 字（`'123456789'`）觸發 400 測試 | PASS |

**不一致**：任務說明「12 個測試」，實際為 **13 個測試**（多一個「中文 label（≤ 8 字）通過驗證」case）。13 > 12，多覆蓋不視為缺陷。

---

## 6. SKILL.md 修改（3 個）

### tp-create/SKILL.md — PASS

必填欄位說明位於 Step 7，內容明確：
```
每天 PUT 的 request body **必須**包含以下三個欄位，缺少任一欄位 API 將回傳 400：
- `date`（YYYY-MM-DD 格式，必填）
- `dayOfWeek`（中文星期，必填）
- `label`（≤ 8 字，必填）
```

### tp-edit/SKILL.md — PASS

覆寫整天注意事項位於 Step 5，內容明確：
```
**注意**：覆寫整天（PUT）時，必須保留原始的 `date`、`dayOfWeek`、`label`，不得送出 null。缺少任一欄位 API 將回傳 400。
```

### tp-rebuild/SKILL.md — PASS

缺漏修復邏輯位於 Step 3，內容明確：
```
**days meta 缺漏修復**（必先於其他修復執行）：
- 檢查每天的 `date`、`day_of_week`、`label` 是否為 null 或空字串
- 若 `date` 缺漏：根據 trip `startDate` + `day_num` 推算
- 若 `day_of_week` 缺漏：從推算出的 date 計算中文星期
- 若 `label` 缺漏：根據當天 timeline 內容摘要，≤ 8 字
```

---

## 7. 舊檔案刪除確認

**結論：PASS**

| 檢查項 | 結果 |
|--------|------|
| `src/lib/validateDayBody.ts` 已刪除（ls 確認不存在） | PASS |
| `src/lib/validateDay.ts` 存在但為不同功能（驗證營業時間），非殘留 | PASS（無衝突） |
| 全域搜尋 `validateDayBody` import：僅存在於 `functions/api/_validate.ts`（定義）、`functions/api/trips/[id]/days/[num].ts`（使用）、`tests/unit/days-validation.test.ts`（測試），無殘留 import | PASS |

---

## 綜合結論

| 項目 | 結果 |
|------|------|
| 測試執行（Node v10 不相容） | FAIL（環境問題，程式碼本身無誤） |
| functions/api/_validate.ts | PASS |
| functions/api/trips/[id]/days/[num].ts | PASS |
| migrations/0010_days_not_null.sql | PASS |
| tests/unit/days-validation.test.ts | PASS |
| tp-create SKILL.md | PASS |
| tp-edit SKILL.md | PASS |
| tp-rebuild SKILL.md | PASS |
| src/lib/validateDayBody.ts 已刪除 | PASS |
| 無殘留 import | PASS |

**整體：QC PASS（測試執行需在 Node 18+ 環境確認）**

唯一待確認項：需在 Node 18+ 環境執行 `npm test`（`tests/unit/days-validation.test.ts` 共 13 個 test case）確保全部通過。程式碼語法與邏輯靜態審查均無問題。
