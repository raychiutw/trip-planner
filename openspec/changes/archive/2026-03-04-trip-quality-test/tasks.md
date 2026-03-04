## 1. 修改現有測試

- [x] 1.1 `quality.test.js` R3 餐廳數量：`>= 3` 改為 `>= 1 && <= 3`

## 2. 新增測試

- [x] 2.1 `quality.test.js` R5：非「家」飯店須有 `blogUrl` 欄位（string 或 null，欄位須存在）
- [x] 2.2 `quality.test.js` R7：非「家」飯店須有 `hotel.infoBoxes` 含 `type=shopping`，shops ≥ 3
- [x] 2.3 `quality.test.js` R1/R3：餐廳 `category` 順序對齊 `meta.foodPreferences`（有 foodPreferences 時才檢查）

## 3. 同步更新主規格

- [x] 3.1 `openspec/specs/trip-enrich-rules/spec.md` — 合併 R3 數量規則 delta
