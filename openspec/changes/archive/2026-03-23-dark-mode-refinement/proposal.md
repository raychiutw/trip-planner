## Why

Dark mode 的卡片全部同色、shadow 不可見、separator 對比度不足，缺乏 iOS 原生的 elevated surface 層次感。精緻化 dark mode 可以大幅提升暗色主題的視覺品質。

## What Changes

- Dark mode 卡片加入 elevated surface 色調（不同層級不同亮度）
- Dark mode shadow 改用 glow + border 替代不可見的黑色 shadow
- Dark mode separator 改用 `rgba(255,255,255,0.12)` 半透明白色
- FAB/sheet 在 dark mode 加入微弱的 accent glow

## Capabilities

### New Capabilities
- `dark-polish`: Dark mode 精緻化

### Modified Capabilities
（無）

## Impact

- **CSS**：`css/style.css` + `css/shared.css` dark mode 區塊修改
- **前端**：不需改 React 程式碼，純 CSS
