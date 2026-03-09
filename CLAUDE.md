# 行程規劃網站（trip-planner）

## 專案結構

```
index.html          edit.html           setting.html
css/                shared.css  style.css  edit.css  setting.css
js/                 shared.js   icons.js   app.js   edit.js   setting.js
data/trips-md/      {tripId}/meta.md  day-*.md  flights.md  checklist.md  backup.md  suggestions.md  emergency.md
data/dist/          trips.json  {tripId}/meta.json  day-*.json  ...（build 產物，嚴禁手動編輯）
data/examples/      meta.md  day-*.md  flights.md  ...（行程 MD 格式範本）
scripts/            build.js  trip-build.js  memory-sync.sh
tests/              unit/  integration/  json/  e2e/
.claude/commands/   trip-quality-rules.md  tp-check.md  tp-create.md  tp-edit.md  tp-request.md  tp-patch.md
                    tp-rebuild.md  tp-rebuild-all.md  tp-deploy.md  tp-run.md  tp-shutdown.md  search-strategies.md
.claude/settings.json     hooks（memory 變更後自動 export）
.claude/memory-sync/      記憶檔跨機同步中繼站
openspec/                 config.yaml  specs/  changes/
```

- Cloudflare Pages：https://trip-planner-dby.pages.dev/

## 開發規則

- **Git**：commit 後不自動 push，由使用者手動觸發；commit 訊息繁體中文；push 後檢查是否需同步更新 `CLAUDE.md` 與 `openspec/config.yaml`
- **測試**：commit 前必須測試全過（pre-commit hook 自動執行）；文件變更不跑測試
- **資料層**：`data/trips-md/` 為唯一資料來源；`data/dist/` 由 `npm run build` 自動產生，嚴禁手動編輯
- **行程品質**：產生或修改行程 MD 須遵守 `.claude/commands/trip-quality-rules.md`，完成後執行 `/tp-check`；異動 MD 格式時須同步更新 `data/examples/*.md`
- **內容**：繁體中文台灣用語、travel 含 type + 分鐘數、days 變動同步 checklist/backup/suggestions
- **UI**：無框線設計、卡片統一、全站 inline SVG（Material Symbols Rounded）
- **CSS HIG 紀律**（`tests/unit/css-hig.test.js` 自動守護 12 條規則）：
  - **font-size**：僅用 11 級 Apple text style token（`--fs-large-title` 至 `--fs-caption2`）
  - **duration**：僅用 `var(--duration-fast/normal/slow)`，禁止硬編碼秒數
  - **spacing**：margin/padding/gap 須為 4pt grid（4 的倍數），裝飾 pseudo-element 除外
  - **touch target**：互動元素最小 44px（`var(--tap-min)`）
  - **border-radius**：5 級 token（`--radius-xs/sm/md/lg/full`）
  - **focus-visible**：`outline: none` 必須搭配 `box-shadow: var(--shadow-ring)`；表單輸入（textarea/input）用文字游標顯示焦點，不需 box-shadow
  - **overlay/backdrop**：使用 `var(--overlay)` token，不得硬寫 `rgba(0,0,0,...)`
  - **frosted glass nav**：sticky-nav 用 `color-mix(in srgb, var(--bg) 85%, transparent)` + `backdrop-filter`，不得用實色 `var(--bg)`
  - **dark mode**：若 base 已用 `var(--token)` 且 token 在 `body.dark` 有覆寫，不需額外寫 `body.dark .class` 規則
  - **#fff 禁令**：`color: #fff` 改用 `var(--text-on-accent)`
  - **color mode preview**：使用 `var(--cmp-*)` token，不得硬寫色碼
- **Agent**：sub agent 預設 sonnet，複雜邏輯實作或需判斷力時用 opus；獨立工作用 `run_in_background: true`，多 agent 並行時用 `isolation: "worktree"` 隔離；需共享進度用 `TeamCreate` 建團隊
- **OpenSpec**：功能開發遵守 openspec 流程（proposal → design → specs → tasks → apply），除非使用者同意跳過

## 已知問題與解法

### Chrome 手機版捲動彈回（設定頁）

**問題**：`setting.html` 在 Chrome 手機版捲到底部會彈回頂部。

**根因**：`shared.css` 的捲動基礎設施（`overflow-x: clip`、`scrollbar-gutter: stable`、`.container` 的 `transition: transform`、`.sticky-nav` 的 `position: sticky`）為行程頁設計，與設定頁簡單結構在 Chrome 合成層計算中衝突。必須全部中和，單獨移除任一無效。

**解法**（`css/setting.css`）：

```css
html.page-setting { scroll-behavior: auto; scrollbar-gutter: auto; overflow: visible; overscroll-behavior: none; }
.page-setting { max-width: none; overflow: visible; }
.page-setting .page-layout { display: block; min-height: 0; }
.page-setting .container { transition: none; }
.page-setting .sticky-nav { position: relative; }
```

**教訓**：新增頁面時，若結構與行程頁差異大，須一次性重置所有捲動相關屬性，不要逐項猜測。
