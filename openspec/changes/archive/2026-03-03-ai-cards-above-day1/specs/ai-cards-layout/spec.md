## ADDED Requirements

### Requirement: AI 卡牌排列於 Day 1 上方

`renderTrip()` SHALL 在 Day sections 迴圈之前渲染兩個 AI 區塊，順序為：
1. AI行程亮點（highlights）— section id: `sec-highlights`
2. AI 行程建議（suggestions）— section id: `sec-suggestions`

兩個區塊 SHALL 使用與 Day sections 相同的 `<section>` + `.day-header.info-header` 結構。

#### Scenario: 渲染順序

- **WHEN** 行程主頁載入完成
- **THEN** 頁面 SHALL 依序顯示：AI行程亮點 → AI 行程建議 → Day 1 → Day 2 → ...

#### Scenario: suggestions 不再出現於 info sections

- **WHEN** 行程主頁載入完成
- **THEN** suggestions SHALL 不在 flights/checklist/backup/emergency 之間出現，僅出現在 Day 1 上方

### Requirement: sparkle icon 註冊

`js/icons.js` 的 ICONS 物件 SHALL 註冊 `sparkle` icon，用於 AI行程亮點的 section header 和選單項目。

#### Scenario: sparkle icon 可用

- **WHEN** 呼叫 `iconSpan('sparkle')`
- **THEN** SHALL 回傳包含 sparkle SVG path 的 `<span>` 元素
