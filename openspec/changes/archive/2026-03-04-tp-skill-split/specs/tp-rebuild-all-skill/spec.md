## ADDED Requirements

### Requirement: /tp-rebuild-all skill 定義
`/tp-rebuild-all` SHALL 批次重建所有行程 JSON。skill 檔案位於 `.claude/commands/tp-rebuild-all.md`。

#### Scenario: 執行批次重建
- **WHEN** 使用者執行 `/tp-rebuild-all`
- **THEN** SHALL 讀取 `data/trips.json` 取得所有行程檔案路徑
- **AND** SHALL 逐一對每個行程執行 `/tp-rebuild` 相同的重整邏輯（R1-R10）

#### Scenario: 逐一處理
- **WHEN** 批次重建進行中
- **THEN** SHALL 依序處理每個行程，顯示目前進度（如「處理中：2/4 okinawa-trip-2026-HuiYun」）

#### Scenario: 最終驗證
- **WHEN** 所有行程重整完成
- **THEN** SHALL 執行 `npm test` 確認全部通過
- **AND** SHALL 不自動 commit（由使用者決定）

### Requirement: /tp-rebuild-all 白名單限制
`/tp-rebuild-all` SHALL 僅修改 `data/trips/*.json`，不得修改其他檔案。

#### Scenario: 白名單檢查
- **WHEN** 批次重建過程中
- **THEN** 允許修改的檔案僅有 `data/trips/*.json`
- **AND** 其他所有檔案一律不得修改
