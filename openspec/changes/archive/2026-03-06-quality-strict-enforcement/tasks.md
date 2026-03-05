## 1. 品質規則文件更新

- [x] 1.1 `.claude/commands/trip-quality-rules.md`：R11 確認措辭為 SHALL（strict），移除 warn 相關描述
- [x] 1.2 `.claude/commands/trip-quality-rules.md`：R12 確認措辭為 SHALL（strict），商店 googleRating 改為必填
- [x] 1.3 `openspec/specs/trip-enrich-rules/spec.md`：同步更新 R4/R11/R12 的 SHOULD→SHALL、warn→fail

## 2. 測試升級

- [x] 2.1 `quality.test.js`：R1/R3 category 對齊從 `console.warn` 改為 `expect` 斷言（strict fail）
- [x] 2.2 `quality.test.js`：新增 R4 測試 — 非 travel、非「餐廳未定」的 timeline event 須有 `blogUrl` 欄位
- [x] 2.3 `quality.test.js`：新增 R11 測試 — 實體地點 event 須有 `locations[]`、餐廳須有 `location`、gasStation 須有 `location`
- [x] 2.4 `quality.test.js`：新增 R12 測試 — 實體地點 event、餐廳、商店須有 `googleRating`（數字 1.0-5.0）

## 3. 資料補齊

- [x] 3.1 執行 `/tp-rebuild-all` 重掃所有行程，修正 R1/R3 category 對齊、補齊 R4 blogUrl、R11 location、R12 googleRating

## 4. 驗證

- [x] 4.1 `npm test` 全部通過（460 tests passed，含新增的 strict 測試）
