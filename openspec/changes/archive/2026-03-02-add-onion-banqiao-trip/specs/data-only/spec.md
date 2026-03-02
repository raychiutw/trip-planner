## ADDED Requirements

### Requirement: 新增 Onion 板橋測試行程資料
系統 SHALL 在 `data/trips/` 目錄新增 `banqiao-trip-2026-Onion.json`，格式與現有行程 JSON schema 一致。`data/trips.json` 索引 SHALL 包含此行程的項目。

#### Scenario: 行程頁面正常載入
- **WHEN** 使用者在設定頁選擇 "Onion 的板橋之旅"
- **THEN** 系統載入 15 天行程內容，每天顯示住宿（家）與景點
