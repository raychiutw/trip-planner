# Trip Planner 專案記憶

## 使用者偏好
- Agent teammates 使用 sonnet 模型
- 僅程式碼/JSON 變更才跑測試
- 盡量使用 agent teams 並行處理
- 多 agent 並行修改檔案時，用 `isolation: "worktree"` 隔離避免衝突
- `/tp-rebuild` 和 `/tp-create` 不問問題，直接給最佳解法

## 資料流
- **MD → JSON**：`data/trips-md/{slug}/` → `npm run build` → `data/dist/{slug}/`（分檔 JSON）+ `data/dist/trips.json`（registry：slug/name/dates/owner）
- JS 載入順序：shared.js → menu.js → icons.js → app.js/edit.js/setting.js
- `fileToSlug` 路徑為 `data/dist/{slug}/`

## UI 模式
- 漢堡選單左滑 drawer、展開收合 ＋/－、Day 標籤 📍 Day N
- 卡片統一：section 白色圓角卡片，子元素無底色
- `icons.js` 集中管理 inline SVG icon + emoji 對映；TRANSPORT_TYPES key 為字串，transit 用 `type` 欄位
- WMO 天氣碼值為 icon name 字串，渲染用 `iconSpan()`
- 底部面板三段式吸附（50%/75%/90% dvh），backdrop 防捲動穿透
- 連續捲動模式：scroll 追蹤更新 URL hash + pill highlight；手動點擊後 600ms 內不更新
- 標題列：行程頁左對齊無底線；設定頁/編輯頁居中 + `--bg` 底色 + 底線 + `::before` 36px 佔位
- Speed Dial 開啟時 backdrop 阻止背景捲動，深色模式加深透明度
- FAB（＋）在 index.html 右下角，連結 edit.html?trip={slug}

## 行程品質
- R0 禁用 null（`typeof null === "object"` 導致 schema 測試失敗）
- tp-create 三階段：Phase 1 讀 `data/examples/` 產骨架（blogUrl 空字串、googleRating 省略）→ Phase 2 並行 Agent 搜尋充填 → Phase 3 驗證
- tp-create 易遺漏 `hotel.checkout`（已在 tp-create.md 補提醒）
- template 同步：異動 MD 格式時須同步更新 `data/examples/*.md`
- Skill：`/tp-create`、`/tp-edit`、`/tp-issue`、`/tp-rebuild`、`/tp-rebuild-all`、`/tp-check`

## 工具
- 記憶檔跨機同步：`scripts/memory-sync.sh`（export/import），hook 自動 export
- edit.html：GitHub Issues 送出修改請求，回覆用 `body_html` 渲染 markdown
- `/tp-issue`：讀取 trip-edit Issues → 改 MD → build → 白名單檢查 → test → commit

## 經驗筆記
- `days[].date` 格式不一致：多數行程用 `M/D（曜）`，kyoto 用 ISO，template 用 ISO（暫不處理）
- GitHub API `state` 預設 `open`，查全部需帶 `&state=all`
- shared.css 捲動基礎設施為行程頁設計，新頁面需全面中和（詳見 CLAUDE.md）
- shared.css 歷程：`body overflow-x:hidden` → `html overflow-x:clip`；`.page-layout min-height:100vh` → `100dvh`
