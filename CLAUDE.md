# 行程規劃網站（trip-planner）

## 專案結構

```
index.html          edit.html           setting.html
css/                shared.css  menu.css  style.css  edit.css  setting.css
js/                 shared.js   menu.js   icons.js   app.js   edit.js   setting.js
data/trips-md/      {slug}/meta.md  day-*.md  flights.md  checklist.md  backup.md  suggestions.md  emergency.md
data/dist/          trips.json  {slug}/meta.json  day-*.json  ...
scripts/            build.js  trip-build.js
tests/              unit/  integration/  json/  e2e/
.claude/commands/   trip-quality-rules.md  tp-create.md  tp-rebuild.md  tp-rebuild-all.md  tp-issue.md
```

- Cloudflare Pages：https://trip-planner-dby.pages.dev/

## 開發規則

詳見 memory 規則檔，以下為摘要：

- **Git**：commit 後不自動 push，由使用者手動觸發；push 後檢查是否需同步更新 `CLAUDE.md` 與 `openspec/config.yaml`；commit 訊息繁體中文
- **測試**：commit 前必須測試全過（pre-commit hook 自動執行）；文件變更不跑測試
- **UI**：無框線設計、卡片統一、全站 inline SVG、設定頁用 `setting.html`（行程切換 + 色彩模式）
- **行程品質**：產生或修改行程 MD 須遵守 `.claude/commands/trip-quality-rules.md` 中定義的所有品質規則，完成後執行 `/tp-check`；異動行程 MD 格式時須同步更新 `data/examples/*.md`
- **內容**：繁體中文台灣用語、transit 含 type + 分鐘數、days 變動同步 checklist/backup/suggestions
- **/tp-rebuild**、**/tp-rebuild-all**、**/tp-issue**：僅允許編輯 `data/trips-md/{slug}/**`；`data/dist/**` 為 build 產物，由 `npm run build` 自動產生，嚴禁手動編輯
- **Agent Teams**：teammates 用 sonnet，獨立工作用 `run_in_background: true`，多 agent 並行時用 `isolation: "worktree"` 隔離避免檔案衝突；需共享進度或 agent 間溝通時用 `TeamCreate` 建團隊（TaskList + SendMessage 協調）
- **OpenSpec 流程**：功能開發必須遵守 openspec 流程（proposal → design → specs → tasks → apply），除非使用者明確同意跳過。主要 specs 位於 `openspec/specs/`，歷史變更封存在 `openspec/changes/archive/`

## 已知問題與解法

### Chrome 手機版捲動彈回（設定頁）

**問題**：`setting.html` 在 Chrome 手機版捲到底部會彈回頂部，Safari 正常，行程頁正常。

**根因**：`shared.css` 的捲動基礎設施（`overflow-x: clip`、`scrollbar-gutter: stable`、`.container` 的 `transition: transform`、`.sticky-nav` 的 `position: sticky`）是為行程頁（有側邊欄、大量內容、flex 排版）設計的。設定頁結構簡單（無側邊欄、內容少、block 排版），這些屬性在 Chrome 的合成層 / 捲動上下文計算中產生衝突，導致捲動位置被重置。**單獨移除任一屬性都無效**，必須全部中和。

**解法**（`css/setting.css`）：設定頁全面覆蓋 shared.css 的捲動相關屬性：

```css
html.page-setting { scroll-behavior: auto; scrollbar-gutter: auto; overflow: visible; overscroll-behavior: none; }
.page-setting { max-width: none; overflow: visible; }
.page-setting .page-layout { display: block; min-height: 0; }
.page-setting .container { transition: none; }
.page-setting .sticky-nav { position: relative; }
```

**教訓**：新增頁面時，若該頁結構與行程頁差異大，須檢查 shared.css 繼承的捲動屬性是否適用，必要時全面中和。不要逐項猜測，應一次性重置所有捲動相關屬性再逐步排除。
