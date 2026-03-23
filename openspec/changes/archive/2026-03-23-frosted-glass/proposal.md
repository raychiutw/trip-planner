## Why

StickyNav 的 backdrop-filter blur 效果因背景不透明度過高（92%）而幾乎不可見。InfoSheet / QuickPanel 缺乏毛玻璃材質感。強化 material blur 可以產生 iOS 特有的景深質感。

## What Changes

- StickyNav 背景不透明度從 92% 降至 72%，增強 blur 可見度
- InfoSheet / QuickPanel 的 panel 背景加入 backdrop-filter blur
- 可選：StickyNav 加入品牌色 tint overlay

## Capabilities

### New Capabilities
- `glass-material`: 毛玻璃材質強化

### Modified Capabilities
（無）

## Impact

- **CSS**：`css/shared.css`（StickyNav）、`css/style.css`（InfoSheet/QuickPanel panel）
- **前端**：不需改 React 程式碼，純 CSS
