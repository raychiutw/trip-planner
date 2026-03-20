## Tailwind CSS v4 整合 — @theme 作為唯一 token source

### Requirement: @theme 為色彩 token 唯一定義處

系統 SHALL 在 `css/shared.css` 的 `@theme` 區塊中定義所有色彩 design token（`--color-*` 命名空間），
預設值對應 theme-sun light。其他 CSS 檔案 MUST 引用 `var(--color-*)` 命名空間的變數。

完整色彩 token 命名對照：

| 舊名 | 新名（@theme） | Tailwind utility |
|------|---------------|-----------------|
| `--accent` | `--color-accent` | `bg-accent`, `text-accent` |
| `--accent-subtle` | `--color-accent-subtle` | `bg-accent-subtle` |
| `--accent-bg` | `--color-accent-bg` | `bg-accent-bg` |
| `--bg` | `--color-background` | `bg-background` |
| `--bg-secondary` | `--color-secondary` | `bg-secondary` |
| `--bg-tertiary` | `--color-tertiary` | `bg-tertiary` |
| `--hover-bg` | `--color-hover` | `bg-hover` |
| `--text` | `--color-foreground` | `text-foreground` |
| `--text-muted` | `--color-muted` | `text-muted` |
| `--text-on-accent` | `--color-accent-foreground` | `text-accent-foreground` |
| `--border` | `--color-border` | `border-border` |
| `--error` | `--color-destructive` | `text-destructive` |
| `--error-bg` | `--color-destructive-bg` | `bg-destructive-bg` |
| `--success` | `--color-success` | `text-success` |
| `--overlay` | `--color-overlay` | `bg-overlay` |
| `--badge-open-bg` | `--color-badge-open` | `bg-badge-open` |
| `--badge-closed-bg` | `--color-badge-closed` | `bg-badge-closed` |
| `--plan-mode-bg` | `--color-plan-bg` | `bg-plan-bg` |
| `--plan-mode-text` | `--color-plan-text` | `text-plan-text` |
| `--plan-mode-bg-hover` | `--color-plan-hover` | `bg-plan-hover` |
| `--priority-*-bg` | `--color-priority-*-bg` | `bg-priority-*-bg` |
| `--priority-*-dot` | `--color-priority-*-dot` | `bg-priority-*-dot` |

不改名的 token（不需 utility，保留在 `:root` 或 `@layer base` body 選擇器）：
- `--scrollbar-thumb`, `--scrollbar-thumb-hover`
- `--cmp-light-bg`, `--cmp-light-surface`, `--cmp-light-input`
- `--cmp-dark-bg`, `--cmp-dark-surface`, `--cmp-dark-input`

非色彩 token 移入 `@theme`（命名已對齊 Tailwind namespace）：
- `--radius-xs/sm/md/lg/full` → `rounded-*` utilities
- `--shadow-md`, `--shadow-lg` → `shadow-*` utilities

#### Scenario: @theme 中定義 accent 色彩 token

- **WHEN** 載入 `css/shared.css`
- **THEN** `@theme` 中 SHALL 存在 `--color-accent: #E86A4A`

#### Scenario: 舊命名 --accent 已不存在

- **WHEN** 搜尋所有 CSS 與 TSX 檔案（排除 `@media print` 內的 fallback）
- **THEN** SHALL 不存在 `var(--accent)` 引用

---

### Requirement: Theme override 定義於 @layer base

系統 SHALL 在 `@layer base` 中以 `body.theme-*` 選擇器覆寫 `@theme` 定義的色彩變數。
Light theme 先、dark override 後，dark 繼承 `--cmp-*` 從 light。

#### Scenario: sky 主題覆寫 accent

- **WHEN** 頁面有 `body.theme-sky`
- **THEN** `--color-accent` SHALL 為 `#2870A0`

#### Scenario: dark mode 覆寫

- **WHEN** 頁面有 `body.theme-sun.dark`
- **THEN** `--color-accent` SHALL 為 `#F4A08A`

---

### Requirement: Tailwind CSS v4 Vite 整合

系統 SHALL 在 `vite.config.ts` 中使用 `@tailwindcss/vite` plugin。
`css/shared.css` SHALL import `tailwindcss/theme` 與 `tailwindcss/utilities`（略過 preflight 避免影響既有 reset）。

#### Scenario: Vite build 成功

- **WHEN** 執行 `npm run build`
- **THEN** 建置 SHALL 成功完成

#### Scenario: TypeScript 零錯誤

- **WHEN** 執行 `npx tsc --noEmit`
- **THEN** SHALL 無錯誤輸出

#### Scenario: 所有測試通過

- **WHEN** 執行 `npm test`
- **THEN** 所有測試 SHALL 通過

---

### Requirement: 非色彩 token 保留於 :root

系統 SHALL 在 `:root` 中定義不需 Tailwind utility 的 token：
`--shadow-ring`、`--fs-*`（11 級）、`--font-system`、`--lh-*`、`--ease-apple`、
`--duration-*`、`--tap-min`、`--z-*`、`--content-max-w`、`--info-panel-w`、`--nav-h`、`--padding-h`

#### Scenario: --shadow-ring 引用新命名

- **WHEN** 載入 `css/shared.css`
- **THEN** `--shadow-ring` SHALL 引用 `var(--color-accent)`（非舊名 `var(--accent)`）
