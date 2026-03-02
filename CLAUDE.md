# 行程規劃網站（trip-planner）

## 專案結構

```
index.html          edit.html           switch.html
css/                shared.css  menu.css  style.css  edit.css  switch.css
js/                 shared.js   menu.js   icons.js   app.js   edit.js   switch.js
data/               trips.json  trips/
tests/              unit/  integration/  json/  e2e/
.claude/commands/   add-spot.md  deploy.md  render-trip.md
```

- GitHub Pages：https://raychiutw.github.io/trip-planner/

## 開發規則

詳見 memory 規則檔，以下為摘要：

- **Git**：commit 後不自動 push，由使用者手動觸發；push 後檢查是否需同步更新 `CLAUDE.md` 與 `openspec/config.yaml`；commit 訊息繁體中文
- **測試**：commit 前必須測試全過（pre-commit hook 自動執行）；文件變更不跑測試
- **UI**：無框線設計、卡片統一、全站 inline SVG、行程切換用 `switch.html`
- **內容**：繁體中文台灣用語、transit 含 type + 分鐘數、days 變動同步 checklist/backup/suggestions
- **/render-trip**：只改 `data/trips/*.json`，禁改 js/css/html
- **Agent Teams**：teammates 用 sonnet，獨立工作用 `run_in_background: true`
