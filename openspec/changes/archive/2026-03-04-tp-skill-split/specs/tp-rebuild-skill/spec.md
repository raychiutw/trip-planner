## ADDED Requirements

### Requirement: /tp-rebuild skill 定義
`/tp-rebuild` SHALL 全面重整單一行程 JSON，依 R1-R10 品質規則逐項檢查並修正。skill 檔案位於 `.claude/commands/tp-rebuild.md`。

#### Scenario: 指定 tripSlug
- **WHEN** 使用者執行 `/tp-rebuild okinawa-trip-2026-Ray`
- **THEN** SHALL 讀取 `data/trips/okinawa-trip-2026-Ray.json` 並依 R1-R10 全面重整

#### Scenario: 未指定 tripSlug
- **WHEN** 使用者執行 `/tp-rebuild` 未帶參數
- **THEN** SHALL 讀取 `data/trips.json` 列出所有行程供使用者選擇

#### Scenario: 重整範圍
- **WHEN** 執行重整
- **THEN** SHALL 逐項檢查 R1-R10 並修正不符合的欄位
- **AND** SHALL 不改變 timeline 順序或增減景點
- **AND** SHALL 不改 js/css/html，只修改 `data/trips/{tripSlug}.json`

#### Scenario: 重整完成驗證
- **WHEN** 重整完成
- **THEN** SHALL 執行 `npm test` 確認通過
- **AND** SHALL 不自動 commit（由使用者決定）

### Requirement: /tp-rebuild 品質規則引用
`/tp-rebuild.md` SHALL 包含完整的 R1-R10 品質規則文字，與原 `render-trip.md` 內容一致。

#### Scenario: 規則完整性
- **WHEN** 讀取 `/tp-rebuild.md`
- **THEN** SHALL 包含 R1 至 R10 所有品質規則

### Requirement: /tp-rebuild 白名單限制
`/tp-rebuild` SHALL 僅修改指定的行程 JSON 檔案，不得修改其他檔案。

#### Scenario: 白名單檢查
- **WHEN** 重整過程中
- **THEN** 允許修改的檔案僅有 `data/trips/{tripSlug}.json`
- **AND** 其他所有檔案一律不得修改
