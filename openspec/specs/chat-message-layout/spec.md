## MODIFIED Requirements

### Requirement: 系統訊息左對齊顯示

系統訊息（包含問候語）SHALL 以左對齊氣泡卡片方式呈現，帶有 Spark icon，最大寬度 80%。（此需求不變）

#### Scenario: 問候語顯示為系統訊息

- **WHEN** edit 頁面載入完成
- **THEN** 問候語（早安/午安/晚安 + 副標「有什麼行程修改需求？」）顯示為左對齊卡片，含 Spark icon，寬度不超過訊息區域的 80%

#### Scenario: 系統訊息不在右側出現

- **WHEN** 渲染系統訊息卡片
- **THEN** 卡片對齊訊息區域左側，右側留有空白

## REMOVED Requirements

### Requirement: 使用者訊息右對齊氣泡

**Reason**: Issue 歷史紀錄改為左對齊列表式呈現（見 edit-page spec），不再使用右對齊氣泡佈局。
**Migration**: 使用新的 `.issue-item` 列表項目樣式取代 `.message-user` 氣泡樣式。
