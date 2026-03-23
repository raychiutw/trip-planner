# days 必填欄位驗證

## 問題

HuiYun 沖繩行程的 Day 3 缺 `day_of_week`、Day 5 缺 `date` + `day_of_week` + `label` 三欄位，導致 DayNav pill 顯示數字「5」而非日期「7/6」。

根因：從 DB schema → API → Skill 五層都沒有強制 `date`、`day_of_week`、`label` 為必填，違反 R0 品質規則（禁止 null）。

## 修復範圍

1. **DB migration**：recreate `days` table，`date`/`day_of_week`/`label` 加 `NOT NULL DEFAULT ''`
2. **API 端點**：`PUT /days/:num` 加 server-side 必填驗證（400 error）
3. **tp-create skill**：確保每天生成完整 meta
4. **tp-edit skill**：PUT 整天前驗證欄位不為 null
5. **tp-rebuild skill**：將缺漏 meta 列為修復項目

## 不做

- 前端防禦（前端已有 fallback 顯示 day_num，這是合理降級）

## 影響評估

- 改動範圍：1 個 DB migration + 1 個 API 端點 + 3 個 skill 文件
- 風險：中（DB recreate table 需確保資料完整，已手動修復 HuiYun 缺漏資料）
- 向後相容：PUT API 回傳 400 而非靜默存 null，可能影響已有呼叫端（但目前只有 skill 呼叫）
- 前提：所有現有資料 null 欄位已修復（已完成）
