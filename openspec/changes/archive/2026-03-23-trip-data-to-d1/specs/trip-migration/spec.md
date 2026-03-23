## ADDED Requirements

### Requirement: MD to D1 遷移腳本
系統 SHALL 提供 `scripts/migrate-md-to-d1.js` 腳本，讀取 `data/trips-md/` 下所有行程的 MD 檔案，parse 後 INSERT 到 D1 的結構化 table。

#### Scenario: 完整遷移一個行程
- **WHEN** 執行遷移腳本指定 okinawa-trip-2026-Ray
- **THEN** meta.md → trips table、day-*.md → days + hotels + entries + restaurants + shopping tables、flights/checklist/backup/suggestions/emergency.md → trip_docs table

#### Scenario: 遷移所有行程
- **WHEN** 執行遷移腳本不指定行程
- **THEN** 遍歷 data/trips-md/ 下所有子目錄，逐一遷移

### Requirement: 遷移驗證
遷移後 SHALL 比對 API 回傳的 JSON 與現有 dist JSON 的一致性。

#### Scenario: 驗證一天的資料
- **WHEN** 遷移完成後
- **THEN** GET /api/trips/:id/days/:num 的回傳結構與 data/dist/:id/day-:num.json 語義一致（欄位名可能不同但值相同）

### Requirement: 冪等性
遷移腳本 SHALL 支援重複執行（先清除再重建），不產生重複資料。

#### Scenario: 重複執行
- **WHEN** 對同一行程執行兩次遷移
- **THEN** 第二次覆蓋第一次的資料，最終結果一致
