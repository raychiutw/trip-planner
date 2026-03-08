## MODIFIED Requirements

### Requirement: tp-edit 操作對象改為 MD
`/tp-edit` skill SHALL 讀寫 `data/trips-md/{slug}/` 下的 MD 檔案，取代原本操作完整 JSON。

#### Scenario: 讀取行程資料
- **WHEN** 使用者執行 `/tp-edit {tripSlug} {描述}`
- **THEN** SHALL 讀取 `data/trips-md/{tripSlug}/` 下的 MD 檔案
- **THEN** SHALL NOT 讀取 `data/trips/{tripSlug}.json`

#### Scenario: 寫入修改
- **WHEN** tp-edit 完成修改
- **THEN** SHALL 寫入 `data/trips-md/{tripSlug}/` 下對應的 MD 檔案
- **THEN** SHALL 執行 `npm run build` 更新 dist
- **THEN** SHALL 執行 tp-check 驗證

#### Scenario: 未指定 tripSlug 時列出行程
- **WHEN** 使用者未帶 tripSlug
- **THEN** SHALL 讀取 `data/dist/trips.json` 列出所有行程供選擇

#### Scenario: 白名單（更新）
- **WHEN** tp-edit 執行
- **THEN** SHALL 只修改 `data/trips-md/{tripSlug}/**` 和 `data/dist/**`
- **THEN** SHALL NOT 修改 js/css/html/tests 等其他檔案

### Requirement: tp-issue 路徑更新
`/tp-issue` 的 tp-edit 邏輯跟隨路徑變更。

#### Scenario: Issue 處理流程（更新）
- **WHEN** `/tp-issue` 處理 GitHub Issue
- **THEN** SHALL 以 tp-edit 邏輯操作 MD 檔案
- **THEN** 修改通過後 commit + push + close Issue

### Requirement: tp-rebuild / tp-rebuild-all 路徑更新
重建 skills SHALL 操作 MD 檔案。

#### Scenario: tp-rebuild 操作 MD
- **WHEN** 使用者執行 `/tp-rebuild {tripSlug}`
- **THEN** SHALL 讀寫 `data/trips-md/{tripSlug}/` 下的 MD 檔案
- **THEN** SHALL 執行 `npm run build` 更新 dist

#### Scenario: tp-rebuild-all 操作 MD
- **WHEN** 使用者執行 `/tp-rebuild-all`
- **THEN** SHALL 逐一讀寫 `data/trips-md/*/` 下的 MD 檔案
- **THEN** SHALL 執行 `npm run build` 更新 dist

### Requirement: tp-check 改為檢查 MD
品質規則檢查對象改為 MD frontmatter。

#### Scenario: tp-check 讀取 MD
- **WHEN** 使用者執行 `/tp-check {tripSlug}`
- **THEN** SHALL 讀取 `data/trips-md/{tripSlug}/` 下的 MD 檔案進行驗證
- **THEN** SHALL NOT 讀取 `data/trips/{tripSlug}.json`
