## MODIFIED Requirements

### Requirement: Schema 驗證層（路徑變更）
驗證對象從 `data/trips/*.json` 改為 `data/dist/*/` 下的分檔 JSON。驗證邏輯不變，僅掃描路徑改變。

#### Scenario: 涵蓋所有行程（路徑變更）
- **WHEN** 執行 Schema 驗證測試
- **THEN** SHALL 動態掃描 `data/dist/*/meta.json` 取得行程清單
- **THEN** SHALL 對每個行程讀取 `data/dist/{slug}/meta.json` + `data/dist/{slug}/day-*.json` 進行驗證
- **THEN** SHALL NOT 掃描 `data/trips/` 目錄（已移除）

### Requirement: Quality 驗證層（路徑變更）
驗證對象從 `data/trips/*.json` 改為 `data/dist/*/` 下的分檔 JSON。

#### Scenario: Quality 測試讀取 dist
- **WHEN** 執行 Quality 驗證測試
- **THEN** SHALL 從 `data/dist/{slug}/` 組合行程資料進行 R2-R9 檢查
- **THEN** SHALL NOT 讀取 `data/trips/*.json`

### Requirement: Claude Code Hook（路徑變更）
Hook 觸發條件從 `data/trips/*.json` 改為 `data/trips-md/**/*.md`。

#### Scenario: Hook 觸發（MD 檔案）
- **WHEN** Claude Code 的 Edit 或 Write tool 修改 `data/trips-md/**/*.md`
- **THEN** SHALL 自動執行 `npm run build && npm test -- tests/json/`

#### Scenario: Hook 不再監控完整 JSON
- **WHEN** Claude Code 修改任何檔案
- **THEN** SHALL NOT 對 `data/trips/*.json` 路徑設定 hook（路徑已不存在）

## REMOVED Requirements

### Requirement: rules-json-schema.md 同步
`rules-json-schema.md` 已隨 `docs/` 目錄移除，不再需要同步。
