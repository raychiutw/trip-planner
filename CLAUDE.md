# 行程規劃網站（trip-planner）

## 專案結構

```
index.html          edit.html           setting.html
css/                shared.css  menu.css  style.css  edit.css  setting.css
js/                 shared.js   menu.js   icons.js   app.js   edit.js   setting.js
data/               trips.json  trips/
tests/              unit/  integration/  json/  e2e/
.claude/commands/   trip-quality-rules.md  tp-create.md  tp-rebuild.md  tp-rebuild-all.md  tp-issue.md
```

- Cloudflare Pages：https://trip-planner-dby.pages.dev/

## 開發規則

詳見 memory 規則檔，以下為摘要：

- **Git**：commit 後不自動 push，由使用者手動觸發；push 後檢查是否需同步更新 `CLAUDE.md` 與 `openspec/config.yaml`；commit 訊息繁體中文
- **測試**：commit 前必須測試全過（pre-commit hook 自動執行）；文件變更不跑測試
- **UI**：無框線設計、卡片統一、全站 inline SVG、設定頁用 `setting.html`（行程切換 + 色彩模式）
- **行程品質**：產生或修改行程 JSON 須遵守 `.claude/commands/trip-quality-rules.md` 中定義的所有品質規則，完成後執行 `/tp-check`；異動行程 JSON 結構時須同步更新 `data/examples/template.json`
- **內容**：繁體中文台灣用語、transit 含 type + 分鐘數、days 變動同步 checklist/backup/suggestions
- **/tp-rebuild**、**/tp-rebuild-all**、**/tp-issue**：只改 `data/trips/*.json`，禁改 js/css/html
- **Agent Teams**：teammates 用 sonnet，獨立工作用 `run_in_background: true`，多 agent 並行時用 `isolation: "worktree"` 隔離避免檔案衝突；需共享進度或 agent 間溝通時用 `TeamCreate` 建團隊（TaskList + SendMessage 協調）
- **OpenSpec 流程**：功能開發必須遵守 openspec 流程（proposal → design → specs → tasks → apply），除非使用者明確同意跳過。主要 specs 位於 `openspec/specs/`，歷史變更封存在 `openspec/changes/archive/`
