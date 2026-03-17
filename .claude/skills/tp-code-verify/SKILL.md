---
name: tp-code-verify
description: Use before committing code changes to validate naming conventions, coding standards, and test green status. Runs validation loop until all checks pass.
user-invocable: true
---

Commit 前程式碼品質驗證。驗證命名規範 + 測試全過，紅燈則持續修改直到綠燈。

⚡ prompt 有指定檔案或範圍時，以 prompt 為準；否則使用以下預設範圍。

## 預設檢查範圍

```
js/          app.js  shared.js  icons.js  setting.js  manage.js  admin.js  map-row.js
css/         shared.css  style.css  setting.css  manage.css  admin.css
html/        index.html  setting.html  edit.html  manage/index.html  admin/index.html
functions/   api/**/*.ts（所有 Pages Functions）
server/      index.js  lib/auth.js  routes/process.js
tests/       unit/*.test.js  integration/*.test.js  e2e/*.spec.js  setup.js
```

**排除**：`node_modules/`、`.wrangler/`、`.playwright-mcp/`、`openspec/`、`.claude/`、`.gemini/`、`package*.json`、`wrangler.toml`、`migrations/*.sql`、`scripts/*.ps1`、`scripts/*.sh`、`tests/e2e/api-mocks.js`（mock 資料）

## 步驟

1. 執行 `npm test` — 包含 naming-convention.test.js 和所有 unit/integration 測試
2. 若全過 → 🟢 綠燈，可以 commit
3. 若有失敗 → 🔴 紅燈：
   a. 列出所有失敗的測試名稱和錯誤訊息
   b. 根據錯誤類型自動修正：
      - 命名違規：根據 `openspec/config.yaml` naming 規範修正
      - 測試失敗：分析原因並修正程式碼
   c. 重新跑 `npm test`
   d. 重複直到全過

## 驗證項目

### A. 命名規範

| # | 項目 | 掃描範圍 | 規則 |
|---|------|---------|------|
| 1 | JS 函式命名 | `js/*.js` `server/**/*.js` | camelCase |
| 2 | JS 常數命名 | `js/*.js` | UPPER_SNAKE_CASE，不被重新賦值 |
| 3 | JS 可變狀態 | `js/*.js` | camelCase，不得 UPPER_CASE |
| 4 | CSS class | `css/*.css` | kebab-case |
| 5 | CSS custom property | `css/*.css` | --kebab-case |
| 6 | HTML 靜態 ID | `*.html` `manage/*.html` `admin/*.html` | camelCase |
| 7 | HTML data 屬性 | 同上 | kebab-case |
| 8 | API tripId | `functions/api/trips*.ts` | `id AS tripId`，不回傳裸 `id` |
| 9 | 無防禦性 tripId | `js/*.js` | 不得出現 `.id \|\| .tripId` |
| 10 | mapRow 統一轉換 | `js/app.js` | 不得散寫 `if (x.snake) x.camel = x.snake` |

### B. CSS HIG 規範（12 條，由 `tests/unit/css-hig.test.js` 自動守護）

| # | 規則 | 說明 |
|---|------|------|
| H1 | font-size 禁硬編碼 px | 僅允許 `var(--fs-*)`、`em`/`rem`/`%` |
| H2 | transition duration 禁硬編碼 | 僅允許 `var(--duration-*)`，例外 `0s` |
| H3-H5 | spacing 4pt grid | padding/margin/gap px 值必須為 4 的倍數 |
| H6 | 禁 `#fff` | 改用 `var(--text-on-accent)`，例外 `.g-icon`/`.n-icon`/`.cmp-` |
| H7 | sticky-nav frosted glass | 必須用 `color-mix` + `backdrop-filter`，不得實色 |
| H8 | color mode preview token | 使用 `var(--cmp-*)` |
| H9 | outline:none 搭配 shadow-ring | `outline: none` 必須搭配 `box-shadow: var(--shadow-ring)` |
| H10 | overlay token | 使用 `var(--overlay)`，不得硬寫 `rgba(0,0,0,...)` |
| H11 | pseudo-element 4pt grid | `::before`/`::after` 遵守 4pt grid |
| H12 | dh-nav 禁 center | `.dh-nav` base 禁止 `justify-content: center` |

**Dark mode**：優先用 `var(--token)` 寫 base 樣式，僅在 dark mode 需不同值時才加 `body.dark` 覆寫。

### C. 其他

| # | 項目 | 說明 |
|---|------|------|
| 11 | Unit tests 全過 | `npm test` 0 failures（含 naming-convention + css-hig） |
| 12 | 觸控目標 | 互動元素最小 44px（`var(--tap-min)`） |
| 13 | 圖示 | 全站 inline SVG（Material Symbols Rounded），不用 emoji |
| 14 | 無框線設計 | 用背景色區分層級，不用 border |
| 15 | border-radius | 僅用 5 級 token `--radius-xs/sm/md/lg/full` |

## 命名規範速查

| 情境 | 規範 | 範例 |
|------|------|------|
| JS 函式 | camelCase | `renderHotel`, `mapApiDay` |
| JS 本地變數 | camelCase | `tripId`, `currentConfig` |
| JS 真常數 | UPPER_SNAKE_CASE | `DRIVING_WARN_MINUTES` |
| JS 可變狀態 | camelCase | `trip`, `currentTripId` |
| CSS class | kebab-case | `day-header`, `tl-event` |
| CSS custom property | --kebab-case | `--fs-body`, `--radius-md` |
| HTML 靜態 ID | camelCase | `stickyNav`, `tripContent` |
| HTML 動態 ID | kebab-case | `day-slot-1`, `hourly-3` |
| HTML data 屬性 | kebab-case | `data-trip-id` |
| API trip identifier | tripId | `SELECT id AS tripId` |
