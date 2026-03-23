## Context

trip-planner 是部署於 Cloudflare Pages 的 React 19 + TypeScript + Vite 8 多入口應用。現有 CSS 架構為 6 個原生 CSS 檔（1,951 行），使用完整的 CSS Custom Properties 設計系統：42 個 token、4 套主題色（sun/sky/zen/print）× light/dark、`color-mix()`、`backdrop-filter` 毛玻璃、`clip-path` 旗標等進階 CSS。

Tailwind CSS v4 是 CSS-first 架構，不再需要 `tailwind.config.js`，改用 `@import "tailwindcss"` + `@theme` + `@custom-variant` 在 CSS 中完成所有配置。內建 Lightning CSS 引擎，支援 CSS Nesting、`@layer`、自動 vendor prefix。Vite 有第一方 plugin `@tailwindcss/vite`。

## Goals / Non-Goals

**Goals:**
- 將元件樣式從 CSS 檔遷移至 Tailwind v4 utility classes
- 保留現有 4 套主題 × light/dark 的多主題系統
- 保留所有進階 CSS 效果（color-mix、backdrop-filter、clip-path、safe-area-inset）
- 升級 Vitest 3→4、啟用 React Compiler v1.0、升級 tsconfig
- CSS 總量顯著減少（目標：保留的 CSS < 400 行，其餘遷移至 utility）

**Non-Goals:**
- 不更換 React 版本（已是最新 19.2.4）
- 不引入 UI 元件庫（Radix、shadcn 等）
- 不修改 D1 schema 或 API
- 不重新設計任何 UI 視覺，僅遷移技術實作

## Decisions

### D1：Tailwind v4 主題架構

**策略：CSS Custom Properties 作為 token 層，Tailwind `@theme` 作為消費層。**

```css
/* src/app.css */
@import "tailwindcss";

/* 匯入主題 token（保留原本的 CSS Custom Properties） */
@import "../css/shared.css" layer(base);

/* 用 @theme 將 CSS Custom Properties 橋接為 Tailwind utility */
@theme {
  --color-accent: var(--accent);
  --color-accent-subtle: var(--accent-subtle);
  --color-accent-bg: var(--accent-bg);
  --color-bg: var(--bg);
  --color-bg-secondary: var(--bg-secondary);
  --color-bg-tertiary: var(--bg-tertiary);
  --color-hover-bg: var(--hover-bg);
  --color-text: var(--text);
  --color-text-muted: var(--text-muted);
  --color-text-on-accent: var(--text-on-accent);
  --color-border: var(--border);
  --color-error: var(--error);
  --color-error-bg: var(--error-bg);
  --color-success: var(--success);
  --color-overlay: var(--overlay);

  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-ring: var(--shadow-ring);

  --radius-xs: var(--radius-xs);
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-full: var(--radius-full);

  --font-system: var(--font-system);

  --spacing-padding-h: var(--padding-h);

  --text-large-title: var(--fs-large-title);
  --text-title: var(--fs-title);
  --text-title2: var(--fs-title2);
  --text-title3: var(--fs-title3);
  --text-headline: var(--fs-headline);
  --text-body: var(--fs-body);
  --text-callout: var(--fs-callout);
  --text-subheadline: var(--fs-subheadline);
  --text-footnote: var(--fs-footnote);
  --text-caption: var(--fs-caption);
  --text-caption2: var(--fs-caption2);
}
```

這樣 `bg-accent`、`text-text-muted`、`rounded-md`、`shadow-md` 等 utility class 會自動對應到 CSS Custom Properties，主題切換時值自動跟隨。

### D2：Dark Mode 與多主題的 Custom Variant

Tailwind v4 預設用 `prefers-color-scheme` 控制 `dark:`。我們需要覆蓋為 class-based：

```css
@custom-variant dark (&:where(.dark, .dark *));
```

對於主題特定樣式（如 `body.dark .tl-card`），保留少量 CSS 規則在 `css/style.css` 中，不強行用 Tailwind。

### D3：不可遷移的 CSS 規則

以下樣式保留在精簡後的 CSS 檔中，不遷移至 Tailwind utility：

| 類別 | 範例 | 原因 |
|------|------|------|
| `clip-path` | `.tl-flag` 的 `polygon()` | Tailwind 無原生 utility |
| `color-mix()` + `backdrop-filter` 組合 | `.tl-card` 半透明 + 毛玻璃 | 需要 `body[class*="theme-"]` selector |
| `@media print` | 40+ 行列印覆蓋 | 需要大量 `!important`，不適合 utility |
| `.print-mode` | 列印模式覆蓋 | 類似 print media |
| `prefers-reduced-motion` | 動畫降級 | 需要 targeted selector |
| Pseudo-element | `.tl-flag-num`、`.sg-priority-*::before`、`.dh-nav-wrap::before/after` gradient fade | Tailwind 對 `::before` content 有限支援 |
| 複雜 `:not()` / `:last-child` | `.admin-permission-item:not(:last-child)` | 語義上保留 CSS 更清楚 |
| `scrollbar-*` 相關 | custom scrollbar 樣式 | 瀏覽器前綴多 |
| `safe-area-inset` | `env(safe-area-inset-bottom)` in `max()` | Tailwind v4 有部分支援但組合複雜 |

預估保留 ~300 行不可遷移 CSS。

### D4：CSS 檔案重組

**Before：**
```
css/shared.css    (386 行) — token + theme + reset + shared components
css/style.css     (570 行) — trip page 元件
css/setting.css   (186 行) — 設定頁
css/manage.css    (337 行) — 旅伴請求頁
css/admin.css     (197 行) — 權限管理頁
css/edit.css      (275 行) — 編輯頁
```

**After：**
```
src/app.css              — Tailwind 入口 + @theme + @custom-variant
css/shared.css           — :root token + 主題變數 + reset（~310 行，僅刪元件樣式）
css/overrides.css        — 不可遷移規則（print mode, clip-path, color-mix 等，~300 行）
css/setting.css          — 刪除（全部遷移至 Tailwind）
css/manage.css           — 刪除（全部遷移至 Tailwind）
css/admin.css            — 刪除（全部遷移至 Tailwind）
css/edit.css             — 刪除（全部遷移至 Tailwind）
css/style.css            — 刪除（可遷移部分移至 Tailwind，不可遷移部分移至 overrides.css）
```

### D5：React Compiler 整合

```ts
// vite.config.ts
import react from '@vitejs/plugin-react';

react({
  babel: {
    plugins: ['babel-plugin-react-compiler'],
  },
})
```

啟用後不需要立即移除現有 `React.memo` / `useMemo` / `useCallback`，Compiler 會跳過已手動 memo 的地方。後續可逐步清理。

### D6：Vitest 升級策略

Vitest 3→4 主要 breaking change：
- `vitest/config` 匯出路徑變更
- Browser mode API 變更（我們不用）
- 預設 `pool` 改為 `forks`

升級步驟：直接 `npm install vitest@latest -D`，跑 `npm test` 看是否通過，有 breaking 再逐一修。

### D7：tsconfig 升級

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",                  // ← 升級
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,    // ← 新增
    "verbatimModuleSyntax": true,        // ← 新增
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "paths": { "@/*": ["./src/*"] },
    "baseUrl": "."
  }
}
```

`verbatimModuleSyntax` 要求所有 type-only import 使用 `import type`，可能需要修改現有 import。

### D8：HTML 入口 CSS 引用調整

4 個 HTML 入口需更新 CSS 引用：

```html
<!-- Before -->
<link rel="stylesheet" href="/css/shared.css">
<link rel="stylesheet" href="/css/style.css">

<!-- After -->
<!-- shared.css 和 overrides.css 由 src/app.css @import 統一管理 -->
<!-- 各入口的 main.tsx 中 import '../app.css' -->
```

### D9：元件遷移範例

**Before（raw CSS）：**
```css
/* css/style.css */
.tl-card { background: var(--bg); border-radius: var(--radius-sm); padding: 12px 16px; }
.tl-card-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tl-title { font-weight: 600; font-size: var(--fs-title3); line-height: var(--lh-tight); color: var(--accent); flex: 1; min-width: 0; }
```

**After（Tailwind utility in JSX）：**
```tsx
<div className="bg-bg rounded-sm p-3 px-4">
  <div className="flex items-center gap-2 flex-wrap">
    <h3 className="font-semibold text-title3 leading-tight text-accent flex-1 min-w-0">
      {title}
    </h3>
  </div>
</div>
```

注意：`bg-bg`、`text-accent`、`rounded-sm`、`text-title3` 等都透過 `@theme` 映射到 CSS Custom Properties。

## Risks / Trade-offs

- [風險] Tailwind v4 與 Vite 8 + Rolldown 的 `@tailwindcss/vite` 相容性需驗證 → 緩解：Tailwind v4 內建 Lightning CSS，與 Rolldown 不衝突
- [風險] `@theme` 映射 CSS Custom Properties 時，部分值含 `rgba()` / `color-mix()` 可能在 Tailwind 的 opacity modifier（如 `bg-accent/50`）中失效 → 緩解：不使用 Tailwind opacity modifier，直接用 CSS Custom Property 值
- [風險] `verbatimModuleSyntax` 啟用後可能觸發大量 `import type` 修改 → 緩解：可用 IDE 自動修復
- [風險] React Compiler 對某些不遵守 Rules of React 的程式碼可能產生錯誤 → 緩解：先啟用，觀察 console warning
- [風險] 遷移過程中的視覺回歸 → 緩解：分批遷移，每批後進行視覺比對
- [取捨] 保留 ~300 行不可遷移 CSS 是務實的做法，比強制用 arbitrary value 更可維護
- [取捨] CSS 檔從 6 個減至 3 個（app.css + shared.css + overrides.css），在 Tailwind 遷移完成後可考慮進一步合併

## Open Questions

- `css-hig.test.js` 測試目前如何驗證 CSS 規則？是否需要重寫以適應 Tailwind？→ 需在實作時檢查測試邏輯
- 4 個 HTML 入口的 CSS `<link>` 標籤是否可完全改為 JS import，或需保留部分 `<link>` 以避免 FOUC？→ 傾向全部改為 JS import，Vite 會自動產生 `<link>`
