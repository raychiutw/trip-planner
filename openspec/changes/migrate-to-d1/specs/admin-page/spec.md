## ADDED Requirements

### Requirement: 行程選擇
admin 頁面 SHALL 提供行程選擇 dropdown，列出所有在 `data/dist/trips.json` 中的行程（從靜態 JSON 讀取，不經 API）。

#### Scenario: 選擇行程
- **WHEN** admin 從 dropdown 選擇一個 tripId
- **THEN** 載入該行程的 permissions 列表（GET /api/permissions?tripId=xxx）

### Requirement: 顯示權限列表
admin 頁面 SHALL 顯示選定行程的所有已授權 email，包含 email 和 role。

#### Scenario: 有已授權成員
- **WHEN** 選定行程有 2 筆 permissions
- **THEN** 顯示表格：email、role、移除按鈕

#### Scenario: 無已授權成員
- **WHEN** 選定行程無 permissions
- **THEN** 顯示「尚未授權任何成員」

### Requirement: 新增權限
admin 頁面 SHALL 提供 email 輸入欄位和新增按鈕，新增成功後自動刷新列表。

#### Scenario: 成功新增
- **WHEN** admin 輸入 email 並點擊新增
- **THEN** POST /api/permissions { email, tripId, role: "member" }
- **AND** 成功後列表即時更新
- **AND** Access policy 自動同步

#### Scenario: 重複新增
- **WHEN** admin 新增已存在的 email + tripId 組合
- **THEN** 回傳 409 Conflict，顯示「此 email 已有權限」

### Requirement: 移除權限
admin 頁面 SHALL 在每筆權限旁提供移除按鈕，點擊後確認再移除。

#### Scenario: 確認後移除
- **WHEN** admin 點擊移除按鈕並確認
- **THEN** DELETE /api/permissions/:id
- **AND** 成功後列表即時更新
- **AND** Access policy 視情況同步（permission-sync 規則）

#### Scenario: 取消移除
- **WHEN** admin 點擊移除按鈕但取消確認
- **THEN** 不執行任何操作

### Requirement: 頁面遵循 HIG 規範
admin 頁面 SHALL 遵循現有 CSS HIG 規範（無框線設計、Apple text style tokens、inline SVG icons）。

#### Scenario: 樣式一致
- **WHEN** admin 頁面渲染
- **THEN** 視覺風格與 index.html / setting.html 一致
