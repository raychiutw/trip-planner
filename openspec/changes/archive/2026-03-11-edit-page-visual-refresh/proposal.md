## Why

edit.html 功能完整但視覺過於素淡——issue 項目無卡片背景直接貼在頁面底色上，回覆區與問題體缺乏視覺分隔，空白狀態只有一行小字，模式切換 pill 的 selected 狀態與 hover 幾乎無法區分。需要透過 CSS-only 的視覺翻新提升頁面精緻度，同時嚴格遵守 12 條 CSS HIG 規則。

## What Changes

- Issue 項目卡片化：加背景色、圓角、hover 效果，用 gap 取代無底色的 padding 分隔
- Badge 精緻化：縮小字級、調深色值、補 dark mode 覆寫
- Reply 區分隔線：用 `border-top` 視覺區隔「使用者問了什麼」與「AI 回了什麼」
- 空白狀態升級：從純文字變成有底色的卡片，字級放大
- Input Card 統一：light/dark 統一用 `--bg-secondary`，消除多餘的 dark override
- Mode Pill 高亮升級：selected 改用 `--accent-bg` + `--accent`，與 hover 區分
- Send Button 微動畫：disabled 縮小、enabled 彈回正常尺寸
- Nav 標題精確置中：spacer 寬度與 close btn 等寬
- 間距微調：body/meta margin 放寬、桌機頂部留白縮減、iOS safe-area 支援

## Capabilities

### New Capabilities

- `edit-visual-polish`: 涵蓋 issue 卡片化、badge 精緻化、reply 分隔、空白狀態升級、input card 統一、mode pill 高亮、send button 動畫、nav 置中修正、間距調整等純 CSS 視覺改善

### Modified Capabilities

- `edit-page`: 桌機版頂部留白從 48px 改為 24px；輸入卡片亮色背景從 `var(--bg)` 改為 `var(--bg-secondary)`；issue 項目從虛線分隔改為獨立卡片

## Impact

- **檔案範圍**：僅 `css/edit.css`，無 HTML / JS 變更
- **測試**：須通過 `tests/unit/css-hig.test.js`（12 條規則）
- **JSON 結構**：無影響
- **相依性**：無新增套件
