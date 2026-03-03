## MODIFIED Requirements

### Requirement: info panel 無條件渲染

`renderInfoPanel` SHALL 無條件將生成的 HTML 寫入 `#infoPanel`，不受 panel 的當前可見性影響。

- SHALL NOT 以 `offsetParent`、`offsetWidth`、`offsetHeight` 或任何可見性屬性作為寫入 `innerHTML` 的前置條件
- panel 在 768–1199px 視口下為 `display: none` 屬於 CSS 控制的顯示狀態，HTML 內容 SHALL 仍然存在

### Requirement: 視口從中寬切換至桌機寬時 sidebar 有內容

- **WHEN** 使用者在 768–1199px 視口下載入或觸發 `renderInfoPanel`
- **AND** 使用者之後將視口拉寬至 ≥1200px
- **THEN** `#infoPanel` SHALL 立即顯示正確的倒數計時、交通統計與建議摘要，不需重新載入頁面

#### Scenario: panel display:none 時仍寫入 innerHTML

- **WHEN** `renderInfoPanel` 被呼叫且 `#infoPanel` 的 computed display 為 `none`
- **THEN** `panel.innerHTML` SHALL 被更新為最新的 html 字串

#### Scenario: panel 轉為可見後內容正確

- **WHEN** CSS media query 使 `#infoPanel` 的 display 從 `none` 變為 `block`（視口 ≥1200px）
- **THEN** panel 內容 SHALL 與底部 sheet（`#bottomSheetBody`）的內容相同，無需任何額外操作

#### Scenario: bottomSheetBody 渲染不受影響

- **WHEN** `renderInfoPanel` 被呼叫
- **THEN** `#bottomSheetBody`（若存在）SHALL 同樣更新為相同的 html 字串，行為與修改前一致
