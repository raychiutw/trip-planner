## Context

行程 JSON 的 `suggestions.content.cards` 已包含 `priority` 欄位（high/medium/low），每個 priority 下有 `items` 陣列。目前 `app.js` 的 `renderSuggestions()` 渲染所有建議卡片時完全忽略 priority，外觀一致。`renderInfoPanel()` 只顯示倒數計時和基本統計，無建議摘要。

現有 CSS 色彩層級：
- 亮色卡片背景：`var(--card-bg)` = `#EDE8E3`
- 深色卡片背景：`var(--card-bg)` = `#292624`

## Goals / Non-Goals

**Goals:**
- 讓使用者一眼辨識建議優先等級（背景色 + 圓點）
- 在資訊面板提供各等級建議數量摘要
- 深色/亮色模式均正確顯示

**Non-Goals:**
- 不改變建議的排序邏輯（維持 JSON 原始順序）
- 不新增篩選或互動功能
- 不修改 JSON 結構

## Decisions

### D1: 優先度底色方案

**選擇**：用 CSS class + 背景色，不動 CSS 變數系統。

| 優先度 | 亮色背景 | 深色背景 |
|--------|----------|----------|
| high | `rgba(239, 68, 68, 0.08)` | `rgba(239, 68, 68, 0.12)` |
| medium | `rgba(234, 179, 8, 0.08)` | `rgba(234, 179, 8, 0.12)` |
| low | 不加底色（保持 `var(--card-bg)`） | 同左 |

**理由**：用 `rgba` 半透明疊加在現有卡片背景上，不需新增變數，深淺模式自然適配。

### D2: 優先度圓點

**選擇**：CSS `::before` 偽元素，8px 圓點，放在建議卡片標題前方。

| 優先度 | 圓點顏色 |
|--------|----------|
| high | `#EF4444`（紅） |
| medium | `#EAB308`（黃） |
| low | `#F97316`（橘） |

**理由**：用偽元素不需改 HTML 結構，顏色與底色系列一致。

### D3: 資訊面板統計卡片

**選擇**：在 `renderInfoPanel()` 的統計區域後方加一張「建議摘要」卡片。

結構：
```
建議摘要
● 高優先：N 項
● 中優先：N 項
● 低優先：N 項
```

計數邏輯：遍歷 `suggestions.content.cards` 各 priority 的 `items.length`。

**理由**：與現有 stats 卡片風格一致，不需新 UI 元件。

### D4: CSS class 命名

建議卡片加上 `.sg-priority-high`、`.sg-priority-medium`、`.sg-priority-low` class。

**理由**：前綴 `sg-` 避免與其他模組衝突，語意清晰。

## Risks / Trade-offs

- [rgba 底色在某些背景上可能不夠明顯] → 已選 0.08/0.12 opacity 平衡可見度與不刺眼
- [圓點與卡片 icon 可能視覺衝突] → 建議卡片目前無 icon，不衝突
