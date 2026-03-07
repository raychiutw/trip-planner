## MODIFIED Requirements

### Requirement: R1 料理偏好詢問
`/tp-rebuild` 或 `/tp-create` 為某行程產生餐廳推薦前，SHALL 先讀取 MD frontmatter `foodPreferences`；若欄位存在且非空則直接採用，否則詢問使用者並將回答寫回 meta.md。後續推薦的第 1 家餐廳 SHALL 對應偏好 1、第 2 家對應偏好 2、第 3 家對應偏好 3。

#### Scenario: MD 已有偏好
- **WHEN** 行程 meta.md 的 `foodPreferences` 為非空值
- **THEN** SHALL 直接採用，不詢問使用者

#### Scenario: MD 無偏好
- **WHEN** 行程 meta.md 的 `foodPreferences` 不存在或為空
- **THEN** SHALL 詢問「有沒有特別想吃的料理類型？最多三類，依優先排序」，取得回答後 SHALL 寫回 meta.md frontmatter

#### Scenario: 餐廳順序對齊偏好
- **WHEN** 某 restaurants infoBox 包含多家餐廳推薦
- **THEN** 第 1 家 SHALL 對應偏好 index 0、第 2 家對應 index 1、第 3 家對應 index 2

#### Scenario: R1/R3 category 嚴格對齊
- **WHEN** restaurants infoBox 中的餐廳按順序排列
- **THEN** 每家餐廳的 `category` SHALL 包含對應 `foodPreferences` 的關鍵字（index 0 對齊偏好 0、index 1 對齊偏好 1、index 2 對齊偏好 2）
- **AND** 不符合時 SHALL 以紅燈（fail）標示

#### Scenario: 偏好料理不可得時
- **WHEN** 某偏好料理在行程地點附近找不到評價足夠的餐廳
- **THEN** SHALL 以行程地點附近評價最高的餐廳補位，並在 `notes` 欄位標註「當地無符合偏好之選項，改推薦{實際料理類型}」

### Requirement: tp-rebuild 品質檢查整合

`/tp-rebuild` 全面重整單一行程時，SHALL 在修正前後各執行一次 tp-check 品質驗證 report。修正前的 report 用於識別需修正項目，修正後的 report 用於確認修正結果。

#### Scenario: 修正前 tp-check

- **WHEN** `/tp-rebuild {tripSlug}` 開始執行
- **THEN** SHALL 先執行 tp-check 完整模式（before-fix report）
- **AND** 顯示完整 report 供參照

#### Scenario: 修正後 tp-check

- **WHEN** `/tp-rebuild` 完成所有修正
- **THEN** SHALL 再執行一次 tp-check 完整模式（after-fix report）
- **AND** 顯示完整 report 確認修正結果

#### Scenario: tp-rebuild-all 整合

- **WHEN** `/tp-rebuild-all` 逐趟執行重整
- **THEN** 每趟完成後 SHALL 執行一次 tp-check 完整模式（after-fix report）

#### Scenario: 修正前不備份

- **WHEN** `/tp-rebuild` 即將修改行程 MD
- **THEN** 無需備份（MD 由 git 版控管理）

## REMOVED Requirements

### Requirement: 修正前備份
**Reason**: MD 為唯一資料來源，由 git 版控管理，不再需要 backup 目錄
**Migration**: 依賴 git history 取代 data/backup/
