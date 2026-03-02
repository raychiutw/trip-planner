## ADDED Requirements

### Requirement: 輸入框固定在底部
底部輸入框 SHALL 固定在 chat container 底部，不隨訊息區域捲動，採用圓角卡片樣式（`border-radius: 16px`）。

#### Scenario: 捲動訊息時輸入框保持可見
- **WHEN** 使用者向上捲動訊息區域
- **THEN** 底部輸入框保持在畫面底部，不隨內容捲動消失

#### Scenario: 輸入框樣式為圓角卡片
- **WHEN** 頁面渲染完成
- **THEN** 輸入框容器具有 `border-radius: 16px`，符合無框線設計規範（背景色差、適當 padding、`box-shadow`）

### Requirement: 輸入框送出按鈕狀態
送出按鈕 SHALL 在 textarea 為空時 `disabled` 暗色；textarea 有文字時啟用（`#C4704F` 主色）。

#### Scenario: textarea 為空時送出按鈕禁用
- **WHEN** 使用者尚未在 textarea 輸入任何文字
- **THEN** 送出按鈕顯示 `disabled` 狀態，顏色暗化，無法點擊

#### Scenario: textarea 有文字時送出按鈕啟用
- **WHEN** 使用者在 textarea 輸入至少一個字元
- **THEN** 送出按鈕變為可點擊狀態，顯示主色（`#C4704F`）

### Requirement: 輸入框工具列結構
輸入框工具列 SHALL 包含左側 [+] 按鈕（預留位置，disabled）、中間行程名稱下拉選單、右側送出按鈕，結構與現有功能邏輯不變。

#### Scenario: 行程下拉選單顯示於輸入框中
- **WHEN** 底部輸入框渲染完成
- **THEN** 中間區域顯示行程名稱 `<select>` 下拉選單，切換後直接跳轉對應行程 edit 頁

#### Scenario: [+] 按鈕為禁用佔位
- **WHEN** 底部輸入框渲染完成
- **THEN** 左側 [+] 按鈕呈現 `disabled` 狀態，視覺上佔位但不可互動
