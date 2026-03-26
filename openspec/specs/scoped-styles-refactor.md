# SCOPED_STYLES 重構設計文件

## 現況

TripPage V2 轉換過程中，Tailwind 無法表達的 CSS 規則被放在各元件的 `SCOPED_STYLES` 常數中，透過 `<style>{SCOPED_STYLES}</style>` 注入 DOM。

### 使用分布

| 檔案 | 行數 | 內容 |
|------|------|------|
| `TripPageV2.tsx` | ~143 行 | day-header、keyframes、glass、print、section cards、link styles |
| `DayNav.tsx` | ~9 行 | dark pill border、desktop font size、tooltip animation |
| `InfoSheet.tsx` | ~29 行 | dark mode bg/shadow、focus management、mobile detent |
| `QuickPanel.tsx` | ~24 行 | dark mode shadows、focus management、print hide |

## 壞味道

### 1. TripPageV2 的 SCOPED_STYLES 過大（143 行）
不是 "scoped styles"，是一個完整的 stylesheet 塞在 JS template literal 裡。

### 2. 每次 render 插入 `<style>` tag
4 個元件各自插入 `<style>`，共 4 個 `<style>` tag 在 DOM 中。雖然瀏覽器能處理，但不是最佳實踐。

### 3. IDE 無法 lint
template literal 裡的 CSS 沒有語法高亮、autocomplete、也無法被 stylelint 檢查。

### 4. CSS 規則散落三處
同一個元素的樣式分散在：
- Tailwind inline className
- SCOPED_STYLES `<style>` block
- tokens.css `@layer base`

維護者需要查三個地方才能理解完整樣式。

### 5. 規則分類不清
SCOPED_STYLES 混合了「Tailwind 真的不支援」和「只是懶得放 tokens.css」的規則。

## 什麼該留在 SCOPED_STYLES（合理用途）

只有 Tailwind 4 **真正無法表達**的 CSS pattern：

- `body.dark .xxx` — 需要 body class context 的 dark mode 覆寫
- `body:not(.dark) .xxx` — 需要 body context 的 light mode 規則
- `.parent > :not([attr])` — 複雜子元素選擇器
- `:focus:not(:focus-visible)` — focus 管理
- `@keyframes` — 動畫定義（Tailwind `animate-*` 只能引用已定義的 keyframe）
- `@media print` — 列印覆寫
- `@media (max-width: ...)` + 多屬性 — 複雜媒體查詢

## 什麼該搬到 tokens.css `@layer base`

不需要 body context 或特殊選擇器的基礎樣式：

| 目前位置 | 規則 | 搬到 |
|---------|------|------|
| TripPageV2 SCOPED | `[data-tl-card] { background: color-mix... }` | tokens.css `@layer base` |
| TripPageV2 SCOPED | `.skeleton-bone { ... }` + `@keyframes shimmer` | tokens.css `@layer base` |
| TripPageV2 SCOPED | `#tripContent-v2 section { bg, radius, margin }` | tokens.css `@layer base` |
| TripPageV2 SCOPED | `#tripContent-v2 a { color, underline }` | tokens.css `@layer base` |
| TripPageV2 SCOPED | `.info-panel { display, bg, radius }` | tokens.css `@layer base` |
| TripPageV2 SCOPED | `.day-header-v2 { ... }` light/dark | tokens.css `@layer base` |
| TripPageV2 SCOPED | `.edit-fab-v2:hover { ... }` | tokens.css `@layer base` |
| TripPageV2 SCOPED | `.nav-inline-title-v2 { ... }` | tokens.css `@layer base` |

## 重構後結構

### tokens.css
```css
/* ===== V2 page-level base styles ===== */
@layer base {
    /* Day header */
    body:not(.dark) .day-header-v2 { background: var(--color-accent-subtle); background-image: var(--theme-header-gradient); color: var(--color-foreground); }
    body.dark .day-header-v2 { background: var(--color-accent-bg); background-image: var(--theme-header-gradient); }

    /* Timeline card glass */
    [data-tl-card] { background: color-mix(in srgb, var(--color-background) 92%, transparent); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
    body.dark [data-tl-card] { background: color-mix(in srgb, var(--color-tertiary) 88%, transparent); box-shadow: 0 1px 0 rgba(255,255,255,0.04); }
    body.dark [data-tl-segment] { border-left-color: rgba(255,255,255,0.12); }

    /* Skeleton shimmer */
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    .skeleton-bone { background: linear-gradient(90deg, var(--color-tertiary) 25%, var(--color-secondary) 50%, var(--color-tertiary) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-sm); }

    /* Section cards */
    #tripContent-v2 section { background: var(--color-secondary); border-radius: var(--radius-md); margin-bottom: var(--spacing-3); overflow: hidden; }
    #tripContent-v2 a:not(.map-link):not(.map-link-inline) { color: var(--color-foreground); text-decoration: underline; }

    /* Info panel */
    .info-panel { display: none; background: var(--color-secondary); border-radius: var(--radius-lg); }
    @media (min-width: 1200px) { .info-panel { display: block; position: fixed; right: 0; top: var(--spacing-nav-h); width: var(--info-panel-w); height: calc(100dvh - var(--spacing-nav-h)); overflow-y: auto; padding: var(--spacing-3); } }

    /* Nav inline title */
    .nav-inline-title-v2 { opacity: 0; transition: opacity var(--duration-nav-fade, 250ms) ease; }
    .nav-inline-title-v2.visible { opacity: 1; }

    /* Edit FAB */
    .edit-fab-v2:hover { transform: scale(1.1); box-shadow: var(--shadow-lg); }
}
```

### TripPageV2 SCOPED_STYLES（精簡到 ~30 行）
```css
/* 只留 Tailwind 無法表達的 */
@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.day-content-enter-v2 { animation: fadeSlideIn var(--transition-duration-normal) var(--transition-timing-function-apple) both; }
.day-content-loaded-v2 { animation: fadeIn 300ms var(--transition-timing-function-apple) both; }
.sticky-nav-v2 > :not([aria-hidden="true"]) { position: relative; z-index: 1; }
/* Print mode */
.print-mode .sticky-nav-v2 { display: none; }
.print-mode .edit-fab-v2 { display: none !important; }
.print-mode .print-exit-btn-v2 { display: block; }
.print-mode #tripContent-v2 section { background: var(--color-background) !important; }
.print-mode .day-header-v2 { background: var(--color-background); position: relative !important; }
@media print { .sticky-nav-v2, .edit-fab-v2, .print-exit-btn-v2 { display: none !important; } }
/* Desktop info-panel layout offset */
@media (min-width: 1200px) { .page-layout-v2:has(.info-panel) { padding-right: calc(var(--info-panel-w) + var(--spacing-3)); } }
/* Appearance cards (border active state) */
.color-mode-card-v2, .color-theme-card-v2 { ... }
```

### 元件 SCOPED_STYLES（保持精簡）
DayNav、InfoSheet、QuickPanel 的 SCOPED_STYLES 已經很小（9-29 行），且都是 body.dark / @keyframes / @media 規則，屬於合理用途，保持不動。

## 效果

| 指標 | 重構前 | 重構後 |
|------|--------|--------|
| TripPageV2 SCOPED 行數 | 143 | ~30 |
| tokens.css base 規則 | 7 行 | ~40 行 |
| `<style>` tag 數量 | 4 | 4（不變，但 TripPageV2 的大幅縮小） |
| IDE CSS lint 覆蓋 | 部分 | tokens.css 完整覆蓋 |
| 樣式查找位置 | 3 處 | 2 處（tokens.css + inline Tailwind） |

## 風險

- `@layer base` 優先級低於 `@layer utilities`，base 規則不會覆蓋 Tailwind utilities ✅（這是期望行為）
- `body.dark` context selector 在 `@layer base` 中的特異性足夠覆蓋 Tailwind utilities ✅（body.dark 是 class selector，比 utility 更 specific）
- 已知陷阱：`@layer base` 的 shorthand `margin: 0` 會覆蓋 Tailwind longhand `margin-top` — 避免使用 shorthand

## 實施計畫

1. 將上述規則搬到 tokens.css `@layer base`
2. 從 TripPageV2 SCOPED_STYLES 移除搬走的規則
3. 跑 tsc + vitest + vite build 驗證
4. 瀏覽器截圖比對確認無視覺變化
