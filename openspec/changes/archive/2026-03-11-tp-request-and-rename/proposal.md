## Why

tp-issue skill 目前將所有旅伴 Issue 都當「行程修改」處理，但部分 Issue 只是諮詢建議（如 #74 散步推薦），不應修改檔案。此外 codebase 有兩處命名不一致：`slug`（應為 `tripId`）和 CSS class `transit`（資料層已用 `travel`）。趁此機會一併統一。

## What Changes

### A. tp-request 雙模式（原 tp-issue）

- edit.html 輸入框新增 **模式切換 dropdown**（預設「✏️ 修改行程」/「💡 問建議」）
- Issue label 由硬編碼 `trip-edit` 改為依模式切換：`trip-edit`（修改）或 `trip-plan`（諮詢）
- **Issue body 格式**：從 JSON 改為純文字（旅伴輸入的原文），metadata 全由 Issue 自身攜帶（labels、title、created_at）
- Issue 歷史列表顯示 **label badge**（edit/plan）+ **body 內容**
- **tp-issue.md skill 改名為 tp-request.md**，處理兩種 label：
  - `trip-edit` + 意圖=修改 → 改 MD → commit → deploy
  - `trip-edit` + 意圖=諮詢 → comment 回覆，不改檔案
  - `trip-plan` + 意圖=諮詢 → comment 回覆，不改檔案
  - `trip-plan` + 意圖=修改 → comment 提醒「請用修改行程模式重新送出」
- **tp-issue-scheduler.ps1 改名為 tp-request-scheduler.ps1**：
  - log 改為每日一檔（`scripts/logs/tp-request-YYYY-MM-DD.log`）
  - 每次執行時刪除超過 7 天的 log
  - 舊 `scripts/tp-issue.log` 移除

### B. slug → tripId **BREAKING**

- 全站 rename：`slug` → `tripId`
- 影響：`trips.json` registry 欄位、JS 函式名（`fileToSlug`→`fileToTripId`）、URL param `?trip=`（不變）、localStorage、GitHub Issue labels、所有 skill/memory MD 文件

### C. CSS class transit → travel

- `.tl-segment-transit` → `.tl-segment-travel`
- `.tl-transit-content` → `.tl-travel-content`
- `.tl-transit-icon` → `.tl-travel-icon`
- `.tl-transit-text` → `.tl-travel-text`
- 記憶檔/skill 中 `transit 分鐘數` → `travel 分鐘數`

## Capabilities

### New Capabilities
- `trip-request-mode`: edit.html 雙模式（trip-edit / trip-plan）Issue 送出、label 路由、body 格式、列表顯示、tp-request skill 定義、scheduler log rotation

### Modified Capabilities
- `edit-page`: 輸入框新增 mode dropdown、Issue 列表新增 label badge 和 body 顯示、body 格式從 JSON 改為純文字
- `tp-edit-skill`: 改名為 tp-request，新增 trip-plan 處理邏輯和意圖 fallback

## Impact

### 影響檔案

| 類別 | 檔案 |
|------|------|
| 前端 JS | `js/app.js`、`js/edit.js`、`js/setting.js` |
| 前端 CSS | `css/style.css`、`css/edit.css` |
| 建置 | `scripts/build.js`、`scripts/trip-build.js` |
| 排程 | `scripts/tp-issue-scheduler.ps1`（改名）、`scripts/register-scheduler.ps1`、`scripts/unregister-scheduler.ps1` |
| Skill | `.claude/commands/tp-issue.md`（改名）、所有引用 slug/transit 的 command MD |
| 記憶 | `.claude/memory-sync/*.md` 中的 slug/transit 引用 |
| 測試 | `tests/unit/routing.test.js`、`tests/unit/render.test.js`、`tests/integration/render-pipeline.test.js`、`tests/json/schema.test.js` |
| 資料 | `data/dist/trips.json`（slug→tripId 欄位名） |
| 文件 | `CLAUDE.md`、`openspec/config.yaml` |

### JSON 結構變更
- `trips.json`：`slug` 欄位 rename 為 `tripId` — **BREAKING**（前端讀取邏輯須同步改）
- day-*.json / checklist / backup / suggestions：不受影響（不含 slug 或 transit 欄位）
