## Context

InfoSheet/QuickPanel 開啟時背景靜止，動效使用標準 ease-out 缺乏彈性。CSS 的 `.container` 已預留 `transition: transform` 設定（shared.css），暗示原設計意圖就是要做背景 scale-down。

## Goals / Non-Goals

**Goals:**
- Sheet 開啟時背景 scale(0.95) + border-radius 縮小效果
- 開啟動畫改用 spring easing（帶微過衝）
- 關閉動畫改用快速 ease-out（無過衝）

**Non-Goals:**
- 不改 sheet 的 drag/gesture 邏輯
- 不改 sheet 的 detent 系統

## Decisions

### D1. Spring Easing Tokens
```css
:root {
  --ease-spring: cubic-bezier(0.32, 1.28, 0.60, 1.00);
  --ease-sheet-close: cubic-bezier(0.4, 0, 1, 1);
  --duration-sheet-open: 420ms;
  --duration-sheet-close: 280ms;
}
```

### D2. Container Scale-Down
Sheet 開啟時，給 `.container` 加 class `sheet-open`：
```css
.container.sheet-open {
  transform: scale(0.95) translateY(10px);
  border-radius: var(--radius-lg);
  transition: transform var(--duration-sheet-open) var(--ease-spring),
              border-radius var(--duration-sheet-open) var(--ease-spring);
}
```

### D3. 實作方式
InfoSheet 和 QuickPanel 在 open/close 時，透過 `document.querySelector('.container')?.classList.toggle('sheet-open', isOpen)` 控制。或用 React state 從 TripPage 傳入。

考量到 InfoSheet 和 QuickPanel 都在 TripPage 內，可以用 callback prop 通知 TripPage 控制 container class。

## Risks / Trade-offs

- **[Risk] scale-down 在低階 Android 裝置可能掉幀** → Mitigation：使用 `will-change: transform` + GPU 加速，scale 動畫效能很好
- **[Risk] spring 過衝可能在小螢幕上看起來過大** → Mitigation：過衝量只有 1.28（約 6% 超出），視覺上很微妙
