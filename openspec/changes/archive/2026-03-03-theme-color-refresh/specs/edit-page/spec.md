## MODIFIED Requirements

參考 `openspec/specs/edit-page/spec.md`（聊天式佈局、底部輸入框規則）。

### Requirement: Send 按鈕 accent 色繼承

`.edit-send-btn` 在 enabled 狀態（`:not(:disabled)`）的背景色 SHALL 引用 `var(--accent)`。由於 `--accent` 在 light mode 下已更新為 `#C4956A`（Item 18），send 按鈕的 enabled 背景色將自動反映新 accent 值，無需額外修改 CSS 規則。

#### Scenario: Light mode send 按鈕 enabled 狀態顯示新 accent 色

- **WHEN** 頁面為 light mode 且 `.edit-send-btn` 為 enabled（未 disabled）狀態
- **THEN** 按鈕背景 SHALL 顯示為 `#C4956A`（`var(--accent)` 新值）

#### Scenario: Dark mode send 按鈕不受影響

- **WHEN** 頁面為 dark mode（含 `.dark` class）且 `.edit-send-btn` 為 enabled 狀態
- **THEN** 按鈕背景 SHALL 維持 `#3D3A37`（`body.dark .edit-send-btn` 覆蓋值）

---

### Requirement: Send 按鈕 disabled 狀態使用灰色

`.edit-send-btn` 在 disabled 狀態下 SHALL 使用灰色背景，明確傳達「不可點擊」語意。

- disabled 背景：`var(--border)`（light mode `#E5E0DA`，dark mode 對應值）
- disabled 文字色：`var(--text-muted)`

#### Scenario: Send 按鈕 disabled 時顯示灰色

- **WHEN** `.edit-send-btn` 為 disabled 狀態（輸入框為空或尚未輸入）
- **THEN** 按鈕背景 SHALL 為 `var(--border)` 灰色，文字色 SHALL 為 `var(--text-muted)`，`cursor` SHALL 為 `not-allowed`
