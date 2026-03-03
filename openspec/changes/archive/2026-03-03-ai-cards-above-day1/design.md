## Context

行程主頁 `renderTrip()` 的渲染順序為：Nav Pills → Day sections → Info sections（flights/checklist/suggestions/backup/emergency）→ Driving stats → Footer。suggestions 被埋在 info 區最底部，使用者需大量捲動才能看到。

行程 JSON 目前有 `suggestions` 欄位（cards 陣列），但沒有「行程特色分析」的資料結構。

## Goals / Non-Goals

**Goals:**
- 新增 `highlights` JSON 欄位，以摘要 + 標籤呈現行程特色
- 將 highlights（AI行程亮點）和 suggestions（AI 行程建議）移到 Day 1 上方
- 兩張卡牌為必顯區塊，缺資料時顯示驗證錯誤
- 導航選單加入兩個新項目並重新命名

**Non-Goals:**
- 不改變 suggestions 的內部結構（cards/priority/items 維持不變）
- 不新增 CSS 檔案，樣式寫在 `css/style.css`
- 不改變 renderSuggestions 函式本身的渲染邏輯

## Decisions

### D1: highlights JSON 結構

採用摘要 + 標籤方案：

```json
"highlights": {
  "title": "AI行程亮點",
  "content": {
    "summary": "100-200 字的行程分析...",
    "tags": ["文化", "自然", "美食"]
  }
}
```

**理由**: 與 suggestions 的 cards 陣列區隔，摘要更適合快速瀏覽，標籤能一目了然行程主軸。

### D2: 渲染位置 — Day 迴圈前獨立區塊

在 `renderTrip()` 中，Day sections 迴圈之前插入：
1. `renderHighlights(data.highlights)`
2. 原有 suggestions 渲染邏輯（從 infoSections 搬出）

同時從 `infoSections` 陣列移除 `{ key: 'suggestions', ... }`。

**理由**: 最小改動，不影響其餘 info sections 的渲染。

### D3: Section ID 與導航

| 卡牌 | section id | 選單標籤 | icon |
|------|-----------|---------|------|
| AI行程亮點 | `sec-highlights` | AI行程亮點 | `sparkle`（新 icon） |
| AI 行程建議 | `sec-suggestions`（不變） | AI 行程建議 | `lightbulb`（不變） |

**理由**: suggestions 沿用既有 id 避免斷連結。highlights 用新 id。sparkle icon 對應 AI / 分析語意。

### D4: highlights 卡牌樣式

- 摘要文字：一般段落排版
- 標籤列：水平 flex wrap，每個標籤用 pill 樣式（圓角背景、小字）
- 使用 `var(--accent)` 作為標籤底色（低透明度）

### D5: 必顯驗證

`validateTripData()` 新增：
- `data.highlights` 不存在 → error
- `data.suggestions` 不存在 → error（原為 optional，改為必填）

### D6: suggestions title 改名

Trip JSON 中的 `suggestions.title` 由各 JSON 自行定義，目前為「行程建議修改事項」。改為「AI 行程建議」統一命名。

## Risks / Trade-offs

- **[JSON 必填欄位]** → 現有 banqiao-trip 無 suggestions，需補上。所有 trip JSON 都要新增 highlights。
- **[sparkle icon 不存在]** → 需在 `js/icons.js` 的 `ICONS` 註冊新 icon SVG path。
