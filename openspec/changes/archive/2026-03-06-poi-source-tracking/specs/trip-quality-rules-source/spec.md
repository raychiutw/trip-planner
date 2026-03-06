## MODIFIED Requirements

### Requirement: 品質規則單一真相來源

`.claude/commands/trip-quality-rules.md` SHALL 包含所有行程品質規則的完整定義，包括 R13 POI 真實性驗證的 source-based 驗證等級。所有行程操作 skill SHALL 引用此檔案，不自行定義規則。

#### Scenario: R13 規則包含 source 驗證邏輯
- **WHEN** 讀取 trip-quality-rules.md 中的 R13 規則
- **THEN** SHALL 定義：source="ai" 的 POI 驗證失敗為 fail（紅燈），source="user" 的 POI 驗證失敗為 warning（黃燈）

#### Scenario: tp-check R13 依 source 區分等級
- **WHEN** tp-check 執行 R13 驗證，發現 POI 不存在
- **AND** 該 POI 的 source 為 "ai"
- **THEN** SHALL 判定為 fail（紅燈）

#### Scenario: tp-check R13 user source 為 warning
- **WHEN** tp-check 執行 R13 驗證，發現 POI 不存在
- **AND** 該 POI 的 source 為 "user"
- **THEN** SHALL 判定為 warning（黃燈）

#### Scenario: schema test 檢查 source 欄位
- **WHEN** 執行 JSON schema 測試
- **THEN** SHALL 驗證所有非豁免 POI 包含 `source` 欄位，值為 `"user"` 或 `"ai"`
