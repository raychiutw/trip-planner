## Context

StickyNav 的 blur 效果因 92% 不透明度而幾乎不可見。Sheet panel 無 blur。

## Goals / Non-Goals

**Goals:**
- StickyNav 不透明度降至 72%，blur 更明顯
- InfoSheet/QuickPanel panel 加入 backdrop-filter blur
- 可選 accent tint overlay

**Non-Goals:**
- 不改 blur 以外的樣式

## Decisions

### D1. StickyNav
```css
.sticky-nav {
  background: color-mix(in srgb, var(--color-background) 72%, transparent);
  backdrop-filter: saturate(200%) blur(24px);
}
```

### D2. Sheet Panel
```css
.info-sheet-panel,
.quick-panel-sheet {
  background: color-mix(in srgb, var(--color-secondary) 88%, transparent);
  backdrop-filter: saturate(180%) blur(28px);
}
```

## Risks / Trade-offs
- **[Risk] 低階裝置 blur 效能** → Mitigation：backdrop-filter 是 GPU 加速的，效能影響小
- **[Risk] 降低不透明度影響可讀性** → Mitigation：72% + blur 仍有足夠對比
