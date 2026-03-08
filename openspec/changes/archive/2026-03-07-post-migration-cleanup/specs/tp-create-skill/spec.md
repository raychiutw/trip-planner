## MODIFIED Requirements

### Requirement: tp-create skill 新建行程

`/tp-create` skill SHALL 從零產生符合 `trip-quality-rules.md` 所有品質規則的行程 MD 檔案群。產生前詢問料理偏好，產生後執行 build + tp-check 驗證。

#### Scenario: 範本參考來源

- **WHEN** 產生行程 MD 檔案群
- **THEN** SHALL 讀取 `data/examples/` 下的 MD 範例檔作為格式參考
- **AND** SHALL NOT 參考 `data/examples/template.json`（已刪除）

#### Scenario: 產生完整 MD 檔案群

- **WHEN** 產生行程
- **THEN** SHALL 在 `data/trips-md/{slug}/` 下產生：meta.md、day-N.md（每日一檔）、flights.md（若有）、checklist.md、backup.md、suggestions.md、emergency.md（若有）
- **AND** 每個 MD 檔案格式 SHALL 與 `data/examples/` 範例一致

#### Scenario: 白名單檢查

- **WHEN** 執行 `git diff --name-only`
- **THEN** 僅允許 `data/trips-md/{slug}/**` 出現在 diff
- **AND** `data/dist/**` 僅由 `npm run build` 產生，嚴禁手動編輯
- **AND** 除正面表列以外的所有檔案一律嚴禁編輯

#### Scenario: 測試與驗證

- **WHEN** MD 寫入完成
- **THEN** SHALL 執行 `npm run build` 產生 dist
- **AND** SHALL 執行 `npm test`
- **AND** SHALL 執行 `/tp-check` 完整模式驗證
- **AND** SHALL 不自動 commit
