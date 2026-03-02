# Spec: light-mode-colors

淺色模式桌機版色彩翻新。

## 適用範圍

僅影響淺色模式（`body:not(.dark)`），深色模式完全不動。

## CSS 變數

| 變數 | 值 | 用途 |
|------|-----|------|
| `--card-bg` | `#EDE8E3` | 卡片 / sidebar / info-panel 背景 |
| `--white` | `#FFFFFF` | 頁面背景（body） |
| `--blue` | `#C4704F` | Day header 背景、focus 高亮 |

## 元素對照

| 選擇器 | 背景色 |
|--------|--------|
| `body` | `var(--white)` |
| `#tripContent section` | `var(--card-bg)` |
| `.info-card` | `var(--card-bg)` |
| `footer` | `var(--card-bg)` |
| `.day-header` | `var(--blue)`，文字 `var(--white)` |
| `.sidebar` | `var(--card-bg)` |
| `.info-panel` | `var(--card-bg)` |
| `.sticky-nav` | `var(--card-bg)` |

## Focus 樣式

所有互動按鈕（`.sidebar-toggle`、`.dh-menu`、`.dn`、`.menu-item`）：

```css
:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--blue);
}
```

取代瀏覽器預設 outline。
