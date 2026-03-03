## ADDED Requirements

### Requirement: 送出按鈕使用 filled 向上箭頭 SVG

edit 頁送出按鈕（`#submitBtn`）SHALL 使用 filled 向上箭頭 SVG 圖示取代原本的紙飛機圖示。SVG MUST 使用 `fill="currentColor"` 以跟隨按鈕文字色（enabled 時白色、disabled 時灰色）。

#### Scenario: 按鈕圖示為向上箭頭

- **WHEN** edit.html 頁面載入
- **THEN** `#submitBtn` 內的 SVG SHALL 顯示一個向上指的箭頭（↑），而非紙飛機

#### Scenario: 圖示顏色跟隨按鈕狀態

- **WHEN** 使用者在 textarea 輸入文字（按鈕啟用）
- **THEN** 箭頭圖示 SHALL 顯示為白色（`#fff`），按鈕背景為 `var(--accent)`

#### Scenario: disabled 狀態圖示為灰色

- **WHEN** textarea 為空（按鈕停用）
- **THEN** 箭頭圖示 SHALL 顯示為灰色（`var(--gray)`），按鈕背景為灰色調
