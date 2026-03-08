# Trip Planner 專案記憶

## 使用者偏好
- Agent teammates 使用 sonnet 模型
- 僅程式碼/JSON 變更才跑測試
- 盡量使用 agent teams 並行處理
- 多 agent 並行修改檔案時，用 `isolation: "worktree"` 隔離避免衝突
- `/tp-rebuild` 和 `/tp-create` 不問問題，直接給最佳解法（遇模糊需求自行判斷）

## 專案架構（2026-03-07 更新）
- CLAUDE.md 精簡摘要，詳細規則在 memory 檔
- `openspec/` 目錄：功能開發流程（proposal → design → specs → tasks → apply）
- `setting.html`：行程切換 + 色彩模式設定
- JS 載入順序：shared.js → menu.js → icons.js → app.js/edit.js/setting.js
- **MD 為唯一資料來源**：`data/trips-md/{slug}/`（meta.md + day-*.md + flights.md + ...）
- **Build 產物**：`npm run build` → `data/dist/{slug}/`（分檔 JSON）+ `data/dist/trips.json`（自動 registry，含 slug/name/dates/owner）
- `fileToSlug` 路徑為 `data/dist/{slug}/`
- `data/trips/` 和 `data/trips.json` 已刪除（由 dist 取代）
- Git：commit 後不自動 push，由使用者手動觸發
- OpenSpec 流程：功能開發須遵守，除非使用者同意跳過

## 已建立的功能模式
- app.js `renderRestaurant()` 支援 `blogUrl` 欄位（繁中網誌連結）
- app.js `validateTripData()` 驗證行程 JSON 結構 + URL + mapcode
- UI：漢堡選單左滑 drawer、展開收合指示器 ＋/－、Day 標籤 📍 Day N
- 卡片統一風格：section 白色圓角卡片，子元素無底色；suggestion-card 不再用 priority class
- 設定頁 `setting.html`（含行程切換 + 色彩模式），取代舊 `switch.html`
- 行程 MD 變動後須執行 `npm run build` 重建 dist
- edit.html：漢堡選單 + X 關閉 + URL ?trip= 直入 + GitHub Issues 送出修改請求 + Issue 回覆用 `body_html` 渲染 markdown
- FAB 按鈕（＋）在 index.html 右下角，連結 edit.html?trip={slug}
- Cowork skill `/tp-issue`：讀取 trip-edit Issues → 改 MD → build → 白名單檢查 → test → commit
- 全站 icon 使用 inline SVG（Material Symbols Rounded）；`icons.js` 集中管理 SVG icon + emoji 對映表
- TRANSPORT_TYPES key 為字串，JSON transit 用 `type` 欄位（非 emoji）
- 行程 JSON 已移除所有 emoji，icon 由 JS 參數化決定
- WMO 天氣碼值為 icon name 字串，渲染用 `iconSpan()`
- 底部面板三段式吸附（50%/75%/90% dvh），backdrop 防捲動穿透（touchmove + wheel preventDefault），sheet-body 內部 stopPropagation 允許內容捲動
- 連續捲動模式：所有 Day 同頁顯示，scroll 追蹤自動更新 URL hash + pill highlight；手動點擊後 600ms 內不自動更新 hash
- 標題列統一：行程頁左對齊無底線；設定頁/編輯頁居中 + `--bg` 底色 + 底線 + `::before` 36px 佔位
- E2E 測試：`tests/e2e/setting-page.spec.js`（含捲動穩定性測試，共 13 案例）
- Speed Dial 開啟時 backdrop 阻止背景捲動，深色模式 backdrop 加深透明度
- 記憶檔跨機同步：`scripts/memory-sync.sh`（export/import），npm scripts `memory:export` / `memory:import`，透過 `.claude/memory-sync/` 中繼 + git 同步；hook 自動在 memory 檔變更後執行 export

## 行程 JSON 品質規則（強制）
- 產生或修改 `data/trips-md/` 時，無論透過 skill 或自然語言，必須遵守 `.claude/commands/trip-quality-rules.md` 中定義的所有品質規則
- **R0 禁用 null**：JSON 中不得有 `null` 值（`typeof null === "object"` 導致 schema 測試失敗）
- **tp-create 三階段**：Phase 1 讀取 `data/examples/` MD 範例檔為格式參考產骨架（blogUrl 空字串、googleRating 省略）→ Phase 2 並行 Agent 搜尋充填 → Phase 3 驗證
- 完成後執行 `/tp-check` 驗證
- **template 同步**：異動行程 MD 格式（新增/移除/改名欄位）時，須同步更新 `data/examples/*.md`
- Skill 對照表：
  - 新增行程：`/tp-create`
  - 修改行程：`/tp-edit`
  - Issue 修改：`/tp-issue`
  - 重建單一：`/tp-rebuild`
  - 重建全部：`/tp-rebuild-all`
  - 檢查行程：`/tp-check`

## 經驗筆記
- `days[].date` 格式全站不一致：5/6 行程用 `M/D（曜）`，kyoto 用 ISO `2026-03-06`，template 用 ISO → 慣例與範本不同步（暫不處理）
- tp-create 易遺漏 `hotel.checkout`：details 中有退房時間但未提取到 checkout 欄位（已在 tp-create.md 補提醒）
- GitHub API `state` 參數預設是 `open`，查全部 Issue 需明確帶 `&state=all`（已踩坑修正）
- shared.css 捲動基礎設施（overflow-x:clip、scrollbar-gutter:stable、container transition、page-layout flex）為行程頁設計，新頁面結構不同時需全面中和，不能逐項修（詳見 CLAUDE.md「已知問題與解法」）
- shared.css 變更歷程：`body overflow-x:hidden` → `html overflow-x:clip`；`.page-layout min-height:100vh` → `100dvh`
