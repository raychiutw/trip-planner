# 程式碼標準（Coding Standards）

此為唯一權威來源，涵蓋非命名、非 HIG 的通用程式碼標準。
命名規範見 `naming-rules.md`；CSS HIG 見 `css-hig-rules.md`。

---

## 觸控目標

互動元素（按鈕、連結、選項等）最小尺寸 **44px**，使用 `var(--tap-min)`。

---

## 圖示

- 全站使用 **inline SVG**（Material Symbols Rounded）
- **不使用** emoji、icon font、img tag 圖示
- 所有圖示透過 `js/icons.js` 的 `ICONS` registry 管理

---

## 無框線設計

- 卡片和按鈕**不加 `border`**
- 用**背景色差**區分層級（`--bg` → `--bg-secondary` → `--bg-tertiary`）
- 分隔線用 `--border` token，但盡量以間距取代分隔線

---

## border-radius

僅使用 5 級 token，禁止任意值：

| Token | 值 | 用途 |
|-------|----|------|
| `--radius-xs` | `4px` | 小標籤 |
| `--radius-sm` | `8px` | 按鈕、輸入框 |
| `--radius-md` | `12px` | 卡片 |
| `--radius-lg` | `16px` | 大卡片、底部表單 |
| `--radius-full` | `99px` | 膠囊形狀 |

例外：`50%`（正圓形）與非對稱值（如 `0 0 12px 12px`）允許。

---

## 檢查範圍（我們的程式碼）

**納入驗證**：
```
js/          app.js  shared.js  icons.js  setting.js  manage.js  admin.js
css/         shared.css  style.css  setting.css  manage.css  admin.css
html/        index.html  setting.html  manage/index.html  admin/index.html
functions/   api/**/*.ts（所有 Pages Functions）
server/      index.js  lib/auth.js  routes/process.js
tests/       unit/*.test.js  integration/*.test.js  e2e/*.spec.js  setup.js
```

**排除**（不驗證）：
```
node_modules/  .wrangler/  .playwright-mcp/  openspec/  .claude/  .gemini/
package*.json  wrangler.toml  migrations/*.sql
scripts/*.ps1  scripts/*.sh
tests/e2e/api-mocks.js（mock 資料）
```
