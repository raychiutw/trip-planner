## Context

載入狀態只有文字提示，缺乏現代 App 的骨架屏效果。

## Goals / Non-Goals

**Goals:**
- DaySkeleton 元件模擬真實佈局
- Shimmer 動畫
- 替換所有文字載入提示

**Non-Goals:**
- 不做漸進式載入（progressive loading）

## Decisions

### D1. DaySkeleton 結構
```
┌─────────────────────┐
│ ████████ (day-header)│
├─────────────────────┤
│ ██████████████ (weather bar) │
├─────────────────────┤
│ ● ████████████ (timeline event 1) │
│   █████████████████  │
│ ● ████████████ (timeline event 2) │
│   █████████████████  │
│ ● ████████████ (timeline event 3) │
└─────────────────────┘
```

### D2. Shimmer CSS
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton-bone {
  background: linear-gradient(90deg, var(--color-tertiary) 25%, var(--color-secondary) 50%, var(--color-tertiary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}
```

## Risks / Trade-offs
- **[Risk] 骨架與實際佈局不匹配** → Mitigation：骨架結構參考真實 DaySection
