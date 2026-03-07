## ADDED Requirements

### Requirement: MD 為行程 source of truth
行程資料的唯一 source of truth 為 `data/trips-md/{slug}/` 目錄下的 MD 檔案群。所有 skills 操作（建立、編輯、重建、檢查）SHALL 直接讀寫 MD 檔案。

#### Scenario: skill 編輯行程
- **WHEN** 使用者透過 tp-edit / tp-rebuild / tp-patch / tp-issue 修改行程
- **THEN** skill SHALL 讀取並修改 `data/trips-md/{slug}/` 下的 MD 檔案
- **THEN** 修改完成後 SHALL 執行 `npm run build` 更新 dist

#### Scenario: skill 新建行程
- **WHEN** 使用者透過 tp-create 建立新行程
- **THEN** skill SHALL 產出 `data/trips-md/{slug}/` 目錄下的完整 MD 檔案群（meta.md + day-N.md + 各 section MD）
- **THEN** 建立完成後 SHALL 執行 `npm run build` 產生 dist

#### Scenario: skill 檢查行程
- **WHEN** 使用者透過 tp-check 檢查行程品質
- **THEN** skill SHALL 讀取 `data/trips-md/{slug}/` 下的 MD 檔案進行驗證

### Requirement: meta.md 包含 name 和 owner
每個行程的 `meta.md` frontmatter SHALL 包含 `name`（行程顯示名稱）和 `owner`（擁有者）欄位。

#### Scenario: meta.md frontmatter 結構
- **WHEN** meta.md 被讀取
- **THEN** frontmatter SHALL 包含 `name` 字串欄位（如 `Ray 的沖繩之旅`）
- **THEN** frontmatter SHALL 包含 `owner` 字串欄位（如 `Ray`）

### Requirement: build.js 全部重建
`scripts/build.js` SHALL 掃描 `data/trips-md/` 下所有行程目錄，對每個跑 `trip-build.js` 產生 dist，最後產生 `dist/trips.json`。

#### Scenario: 執行 npm run build
- **WHEN** 執行 `npm run build`
- **THEN** SHALL 對 `data/trips-md/` 下每個行程目錄執行 trip-build.js
- **THEN** SHALL 產生 `data/dist/trips.json`（自動 registry）
- **THEN** 失敗的行程 SHALL 報告錯誤但不中斷其他行程的 build
