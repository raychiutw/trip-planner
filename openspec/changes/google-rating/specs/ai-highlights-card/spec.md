# Spec: ai-highlights-card（修改）

## MODIFIED Requirements

### Requirement: highlights 僅在主內容區渲染

`renderHighlights(data)` 函式 SHALL 保留，且 SHALL 僅在主內容區（day cards 上方）呼叫。Info panel（桌機右側欄 / 手機底部 sheet）SHALL 不再渲染 highlights 卡牌。

#### Scenario: Info panel 不顯示 highlights

- **WHEN** `renderInfoPanel(data)` 執行
- **THEN** 輸出 HTML SHALL 不包含 highlights 卡牌（summary 段落及 tags pill）
- **AND** info panel 其餘卡牌（倒數計時、行程統計、建議）SHALL 正常顯示

#### Scenario: 主內容區仍顯示 highlights

- **WHEN** 主行程頁面渲染完成
- **THEN** day cards 上方 SHALL 仍顯示 highlights 卡牌（summary + tags）
- **AND** 渲染結果 SHALL 與移除前相同

#### Scenario: renderHighlights 函式保留

- **WHEN** 讀取 `js/app.js`
- **THEN** `renderHighlights` 函式定義 SHALL 存在
- **AND** 函式 SHALL 可在主內容區正常呼叫
