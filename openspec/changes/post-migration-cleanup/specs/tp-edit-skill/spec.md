## MODIFIED Requirements

### Requirement: tp-edit 自然語言行程編輯

`/tp-edit` skill SHALL 接受自然語言描述，局部修改指定行程 MD 檔案。修改後自動執行 `npm run build` 和 tp-check 精簡 report。

#### Scenario: 指定 tripSlug 與描述

- **WHEN** 使用者執行 `/tp-edit {tripSlug} {自然語言描述}`
- **THEN** SHALL 讀取 `data/trips-md/{tripSlug}/` 下的 MD 檔案
- **AND** 依描述內容局部修改對應 MD 檔案
- **AND** 修改後執行 `npm run build` + tp-check 精簡模式

#### Scenario: 未指定 tripSlug

- **WHEN** 使用者執行 `/tp-edit` 未帶 tripSlug
- **THEN** SHALL 讀取 `data/dist/trips.json` 列出所有行程供選擇

#### Scenario: 局部修改範圍

- **WHEN** tp-edit 執行修改
- **THEN** SHALL 只修改描述涉及的部分（如特定日的午餐、新增景點到特定日）
- **AND** SHALL NOT 全面重跑 R1-R12（全面修正使用 `/tp-rebuild`）

#### Scenario: 修改部分符合品質規則

- **WHEN** tp-edit 修改了某個 entry
- **THEN** 被修改的部分 SHALL 符合 R1-R12 對應的品質規則

#### Scenario: 連動更新

- **WHEN** tp-edit 的修改影響到 checklist、backup、suggestions
- **THEN** SHALL 同步更新受影響的 MD 檔案

#### Scenario: 檔案白名單（正面表列）

- **WHEN** tp-edit 執行
- **THEN** 僅允許編輯 `data/trips-md/{tripSlug}/**`
- **AND** `data/dist/**` 為 build 產物，僅由 `npm run build` 產生，嚴禁手動編輯
- **AND** 除正面表列以外的所有檔案一律嚴禁編輯

#### Scenario: 修改後驗證

- **WHEN** tp-edit 完成修改
- **THEN** SHALL 執行 `git diff --name-only` 確認只改了 `data/trips-md/` 和 `data/dist/`（後者由 build 產生）
- **AND** 有其他檔案被改時 SHALL `git checkout` 還原

## REMOVED Requirements

### Requirement: 修改前備份
**Reason**: MD 為唯一資料來源，由 git 版控管理，不再需要 data/backup/
**Migration**: 依賴 git history 取代 data/backup/
