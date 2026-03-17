---
name: tp-code-verify
description: Use before committing code changes to validate naming conventions, coding standards, and test green status. Runs validation loop until all checks pass.
user-invocable: true
---

Commit 前程式碼品質驗證。驗證命名規範 + 測試全過，紅燈則持續修改直到綠燈。

⚡ prompt 有指定檔案或範圍時，以 prompt 為準；否則使用以下預設範圍。

## 驗證規則來源

- 命名規範：`references/naming-rules.md`
- CSS HIG：`references/css-hig-rules.md`
- 程式碼標準：`references/coding-standards.md`

## 預設檢查範圍

檢查範圍定義詳見 `references/coding-standards.md`。

```
js/          app.js  shared.js  icons.js  setting.js  manage.js  admin.js
css/         shared.css  style.css  setting.css  manage.css  admin.css
html/        index.html  setting.html  manage/index.html  admin/index.html
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
      - 命名違規：根據 `references/naming-rules.md` 修正
      - CSS HIG 違規：根據 `references/css-hig-rules.md` 修正
      - 測試失敗：分析原因並修正程式碼
   c. 重新跑 `npm test`
   d. 重複直到全過

## 驗證項目

| # | 項目 | 參照 |
|---|------|------|
| 1 | JS 函式命名（camelCase） | `references/naming-rules.md` |
| 2 | JS 常數命名（UPPER_SNAKE_CASE） | `references/naming-rules.md` |
| 3 | JS 可變狀態（camelCase，不得 UPPER_CASE） | `references/naming-rules.md` |
| 4 | CSS class（kebab-case） | `references/naming-rules.md` |
| 5 | CSS custom property（--kebab-case） | `references/naming-rules.md` |
| 6 | HTML 靜態 ID（camelCase） | `references/naming-rules.md` |
| 7 | HTML data 屬性（kebab-case） | `references/naming-rules.md` |
| 8 | API tripId（`SELECT id AS tripId`） | `references/naming-rules.md` |
| 9 | 無防禦性 tripId（不得 `.id \|\| .tripId`） | `references/naming-rules.md` |
| 10 | mapRow 統一轉換 | `references/naming-rules.md` |
| 11 | CSS HIG 12 條（H1-H12） | `references/css-hig-rules.md` |
| 12 | Unit tests 全過 | — |
| 13 | 觸控目標 44px | `references/coding-standards.md` |
| 14 | 圖示 inline SVG | `references/coding-standards.md` |
| 15 | 無框線設計 | `references/coding-standards.md` |
| 16 | border-radius 5 級 token | `references/coding-standards.md` |
