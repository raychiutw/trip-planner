## ADDED Requirements

### Requirement: Textarea 自動伸縮

textarea SHALL 隨使用者輸入內容自動調整高度，初始為單行高度（`rows="1"`），最大高度受 `max-height: 160px` 限制，超過後出現捲軸。

#### Scenario: 輸入單行文字時 textarea 高度最小

- **WHEN** 使用者在 textarea 輸入一行文字
- **THEN** textarea 高度 SHALL 為單行高度，不出現多餘空白

#### Scenario: 輸入多行文字時 textarea 自動長高

- **WHEN** 使用者輸入超過一行的文字（含換行）
- **THEN** textarea 高度 SHALL 自動增加至符合內容所需高度

#### Scenario: 超過最大高度時出現捲軸

- **WHEN** 使用者輸入內容超過 160px 高度
- **THEN** textarea 高度 SHALL 固定在 160px，內容可捲動

#### Scenario: 清空文字後 textarea 恢復最小高度

- **WHEN** 使用者清空 textarea 內所有文字
- **THEN** textarea 高度 SHALL 恢復為單行高度

### Requirement: Enter 鍵送出

使用者 SHALL 可按 Enter 鍵送出修改需求，按 Shift+Enter 插入換行。

#### Scenario: Enter 鍵觸發送出

- **WHEN** textarea 有文字且使用者按下 Enter 鍵（不含 Shift）
- **THEN** 系統 SHALL 觸發送出流程，等同點擊送出按鈕

#### Scenario: Shift+Enter 插入換行

- **WHEN** 使用者按下 Shift+Enter
- **THEN** textarea SHALL 插入換行字元，不觸發送出

#### Scenario: textarea 為空時 Enter 不送出

- **WHEN** textarea 為空且使用者按下 Enter
- **THEN** 系統 SHALL 不觸發送出，不產生任何動作

## MODIFIED Requirements

### Requirement: 輸入框送出按鈕狀態

送出按鈕 SHALL 在 textarea 為空時 `disabled` 暗色；textarea 有文字時啟用（`var(--accent)` 主色）。深色模式的 disabled 狀態 SHALL 使用 CSS 變數（`var(--hover-bg)` 背景 + `var(--gray)` 文字），不得硬寫色碼。

#### Scenario: textarea 為空時送出按鈕禁用

- **WHEN** 使用者尚未在 textarea 輸入任何文字
- **THEN** 送出按鈕顯示 `disabled` 狀態，顏色暗化，無法點擊

#### Scenario: textarea 有文字時送出按鈕啟用

- **WHEN** 使用者在 textarea 輸入至少一個字元
- **THEN** 送出按鈕變為可點擊狀態，顯示主色（`var(--accent)`）

#### Scenario: 深色模式 disabled 按鈕使用 CSS 變數

- **WHEN** 頁面為 dark mode 且送出按鈕為 disabled
- **THEN** 按鈕背景 SHALL 為 `var(--hover-bg)`、文字色 SHALL 為 `var(--gray)`，不得使用硬寫十六進位色碼

## REMOVED Requirements

### Requirement: 輸入框工具列結構

**Reason**: 標題列已顯示行程名稱，行程 select 下拉選單不再需要。[+] 按鈕從未實作且無明確用途。
**Migration**: 工具列簡化為只含送出按鈕，行程切換改由標題列或 sidebar 處理。
