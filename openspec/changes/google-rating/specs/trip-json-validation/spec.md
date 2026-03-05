# Spec: trip-json-validation（修改）

## ADDED Requirements

### Requirement: googleRating schema 驗證

Schema 驗證 SHALL 確認 `googleRating` 欄位在存在時為合法數字（1.0–5.0）。欄位為選填，不存在時驗證 SHALL 通過。

#### Scenario: timeline event googleRating 型別驗證

- **WHEN** timeline event 物件含有 `googleRating`
- **THEN** 值 SHALL 為數字型別（`typeof === 'number'`）
- **AND** 值 SHALL 在 1.0 至 5.0 的範圍內（含邊界）
- **AND** 不符合時 SHALL 產生 schema 驗證錯誤

#### Scenario: restaurant googleRating 型別驗證

- **WHEN** restaurant 物件含有 `googleRating`
- **THEN** 值 SHALL 為數字型別
- **AND** 值 SHALL 在 1.0 至 5.0 的範圍內（含邊界）
- **AND** 不符合時 SHALL 產生 schema 驗證錯誤

#### Scenario: shop googleRating 型別驗證

- **WHEN** shop 物件含有 `googleRating`
- **THEN** 值 SHALL 為數字型別
- **AND** 值 SHALL 在 1.0 至 5.0 的範圍內（含邊界）
- **AND** 不符合時 SHALL 產生 schema 驗證錯誤

#### Scenario: googleRating 缺失時驗證通過

- **WHEN** timeline event、restaurant 或 shop 物件不含 `googleRating`
- **THEN** schema 驗證 SHALL 通過（選填欄位不存在不報錯）
