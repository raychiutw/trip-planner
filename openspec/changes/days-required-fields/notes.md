# Notes: days-required-fields

## Challenger Report 摘要（2026-03-21）

- 🔴 #3 品質：unit test 未實際執行 → **已解決**（Node 升級 v22 後 13/13 PASS）
- 🟡 #8 相容性：migration 加 `PRAGMA foreign_keys = OFF` → **已修復**
- 🟡 #9A 資料完整：`SELECT *` 改明確列欄位 → **已修復**
- 🟡 #9B date 語意驗證：regex 不驗 `2026-99-99` → **記錄為技術債**，未來可加 `new Date()` 驗證
- 🟢 其餘 7 項低風險：記錄，不修

## 決策紀錄

- 驗證邏輯放 `functions/api/_validate.ts`，API endpoint import 使用，test 也從此路徑 import
- `src/lib/validateDayBody.ts` 已刪除，避免兩份維護
- 既有 test 失敗（css-hig margin 6px、escape/map-day/map-row SyntaxError）與本改動無關
