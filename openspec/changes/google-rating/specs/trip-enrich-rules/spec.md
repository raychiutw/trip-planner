# Spec: trip-enrich-rules（修改）

## ADDED Requirements

### Requirement: R12 Google 評分完整性

實體地點類 timeline event 與所有餐廳 SHOULD 具備 `googleRating` 欄位。R12 採 warn 模式（`console.warn`），不強制中斷測試，允許資料逐步補齊。

**不檢查的 event 類型**：
- `transit` 欄位存在（交通節點）
- `title` 包含「餐廳未定」
- 純描述型 event（無實體地點，例如行程概覽、注意事項）

#### Scenario: 實體地點 event 缺少 googleRating 發出警告

- **WHEN** timeline event 為實體地點類（非 transit、非「餐廳未定」）
- **AND** event 物件不含 `googleRating`
- **THEN** SHALL 以 `console.warn` 輸出 `Day X "${title}" missing googleRating`
- **AND** 測試 SHALL 不因此失敗（warn 模式）

#### Scenario: 餐廳缺少 googleRating 發出警告

- **WHEN** restaurant 物件不含 `googleRating`
- **THEN** SHALL 以 `console.warn` 輸出 `Day X "${餐廳名}" missing googleRating`
- **AND** 測試 SHALL 不因此失敗（warn 模式）

#### Scenario: 含 googleRating 時不發出警告

- **WHEN** timeline event 或 restaurant 物件含有 `googleRating`
- **THEN** SHALL 不發出 R12 相關警告

#### Scenario: transit event 略過 R12 檢查

- **WHEN** timeline event 含有 `transit` 欄位
- **THEN** SHALL 略過 R12 檢查，不發出警告

#### Scenario: 「餐廳未定」event 略過 R12 檢查

- **WHEN** timeline event 的 `title` 包含「餐廳未定」
- **THEN** SHALL 略過 R12 檢查，不發出警告

#### Scenario: shop 的 googleRating 不強制檢查

- **WHEN** shop 物件不含 `googleRating`
- **THEN** SHALL 不發出 R12 警告（shop 評分為選填，不在 R12 強制範圍）
