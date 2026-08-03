## ADDED Requirements

### Requirement: tp-create skill 新建行程

`/tp-create` skill SHALL 從零產生符合 `trip-quality-rules.md` 所有品質規則的行程 JSON。產生前詢問料理偏好，產生後執行 tp-check 驗證。

#### Scenario: 指定描述新建行程
- **WHEN** 使用者執行 `/tp-create` 並提供行程描述（如「沖繩五日自駕」）
- **THEN** SHALL 讀取 `trip-quality-rules.md` 所有品質規則，依描述產生完整行程 JSON

#### Scenario: 未指定描述
- **WHEN** 使用者執行 `/tp-create` 未提供描述
- **THEN** SHALL 詢問行程目的地、天數、旅行方式等基本資訊

#### Scenario: 料理偏好詢問
- **WHEN** 新建行程且尚無 `meta.foodPreferences`
- **THEN** SHALL 依品質規則詢問料理偏好

#### Scenario: 產生完整 JSON 結構
- **WHEN** 產生行程 JSON
- **THEN** SHALL 包含 meta、footer、autoScrollDates、flights（若有）、highlights、suggestions、checklist、days 等完整結構
- **AND** 每日 timeline SHALL 符合 `trip-quality-rules.md` 中所有適用的品質規則

#### Scenario: 寫入檔案
- **WHEN** 行程 JSON 產生完成
- **THEN** SHALL 寫入 `data/trips/{slug}.json`
- **AND** SHALL 更新 `data/trips.json` 索引（新增 entry）

#### Scenario: 白名單檢查
- **WHEN** 執行 `git diff --name-only`
- **THEN** 只允許 `data/trips/{slug}.json` 和 `data/trips.json` 被修改
- **AND** 其他檔案被改時 SHALL `git checkout` 還原

#### Scenario: 測試與驗證
- **WHEN** JSON 寫入完成
- **THEN** SHALL 執行 `npm test`
- **AND** SHALL 執行 `/tp-check` 完整模式驗證
- **AND** SHALL 不自動 commit
