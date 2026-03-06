## MODIFIED Requirements

### Requirement: 漢堡選單修復

**變更**：index.html 不再有 sidebar，因此漢堡選單按鈕（`data-action="toggle-sidebar"`）在 index.html 的 sticky-nav 中 SHALL 移除。

#### Scenario: index.html sticky-nav 無漢堡選單

- **WHEN** index.html 載入完成（任何螢幕寬度）
- **THEN** sticky-nav 內 SHALL NOT 包含漢堡選單按鈕

## ADDED Requirements

### Requirement: index.html 雙欄佈局

index.html 在桌機版（≥1200px）SHALL 使用雙欄佈局（content + info-panel），不含 sidebar 欄位。

```
grid-template-columns: 1fr var(--panel-w)
```

#### Scenario: 桌機版雙欄佈局

- **WHEN** 使用者在 ≥1200px 寬度裝置開啟 index.html
- **THEN** 頁面佈局為雙欄：左側內容區（`1fr`）+ 右側 info-panel（`var(--panel-w)`）

#### Scenario: 中等螢幕單欄

- **WHEN** 使用者在 768px～1199px 寬度裝置開啟 index.html
- **THEN** 頁面為單欄佈局，info-panel 隱藏

#### Scenario: 手機版單欄

- **WHEN** 使用者在 <768px 寬度裝置開啟 index.html
- **THEN** 頁面為單欄佈局，info-panel 隱藏

### Requirement: index.html 移除 sidebar HTML

index.html SHALL 不包含 `<aside class="sidebar">` 元素。sidebar 相關的 HTML（sidebar header、sidebar-nav、sidebar-toggle）SHALL 從 index.html 移除。

#### Scenario: index.html DOM 無 sidebar

- **WHEN** index.html 載入完成
- **THEN** DOM 中 SHALL NOT 存在 `#sidebar` 元素
