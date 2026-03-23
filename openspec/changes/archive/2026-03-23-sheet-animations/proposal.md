## Why

InfoSheet / QuickPanel 開啟時背景不動、動效缺乏彈性，與 iOS 原生 sheet 有明顯差距。背景 scale-down 效果和 spring easing 是純 CSS 改動，工作量極小但視覺衝擊力最強。

## What Changes

- Sheet 開啟時，背後的 `.container` 加上 `scale(0.95) + border-radius` 的縮小效果，產生 iOS 卡片堆疊景深
- Sheet 開啟/關閉動畫改用 spring easing（帶微過衝的 cubic-bezier），關閉用更快的 ease-out
- InfoSheet 和 QuickPanel 統一適用

## Capabilities

### New Capabilities
- `sheet-motion`: Sheet 背景 scale-down + spring easing 動效

### Modified Capabilities
（無）

## Impact

- **CSS**：`css/style.css` 或 `css/shared.css` 加入 spring easing token + container transition
- **React**：`InfoSheet.tsx`、`QuickPanel.tsx` 在 open/close 時控制 `.container` 的 class
- **前端**：不影響功能，純視覺改善
