## MODIFIED Requirements

### Requirement: tp-create 產出格式改為 MD
`/tp-create` skill SHALL 產出 `data/trips-md/{slug}/` 目錄下的 MD 檔案群，取代原本產出單一完整 JSON。

#### Scenario: 產生 MD 檔案群
- **WHEN** 行程資料準備完成
- **THEN** SHALL 產出 `data/trips-md/{slug}/meta.md`（含 name、owner frontmatter）
- **THEN** SHALL 產出 `data/trips-md/{slug}/day-N.md`（每日一檔）
- **THEN** SHALL 產出各 section MD 檔案（highlights.md、suggestions.md、checklist.md 等）

#### Scenario: 執行 build
- **WHEN** MD 檔案群寫入完成
- **THEN** SHALL 執行 `npm run build` 產生 dist
- **THEN** SHALL 執行 `npm test` 驗證

#### Scenario: 不再寫入完整 JSON
- **WHEN** tp-create 執行
- **THEN** SHALL NOT 寫入 `data/trips/{slug}.json`
- **THEN** SHALL NOT 更新 `data/trips.json`（由 build 自動產生 dist/trips.json）

#### Scenario: 白名單檢查（更新）
- **WHEN** 執行 `git diff --name-only`
- **THEN** 只允許 `data/trips-md/{slug}/**` 和 `data/dist/**` 被修改
