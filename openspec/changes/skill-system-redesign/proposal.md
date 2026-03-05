## Why

現有 skill 體系存在三個問題：(1) 品質檢查與修正耦合在 `/tp-rebuild` 裡，無法單獨驗證行程品質；(2) 自然語言編輯（新增景點、調整行程）分散在 `/add-spot`（已過時）和 `/tp-issue` 裡，缺乏統一入口；(3) 行程 JSON 修改後無備份機制，誤改難以回溯。另外 `/deploy` 命名未統一 `tp-` 前綴，缺少自動化排程處理 GitHub Issue，且網站無 favicon（瀏覽器 tab 顯示空白預設圖）。

## What Changes

- **新增 `/tp-check`**：獨立品質驗證 skill，逐項檢查 R1-R12 規則並輸出紅綠燈 report（🟢 passed / 🟡 warning / 🔴 failed），支援完整模式與精簡模式
- **新增 `/tp-edit`**：自然語言行程編輯 skill，接受口語描述局部修改行程 JSON，修改後自動執行 tp-check 精簡 report
- **重構 `/tp-rebuild`**：修正前後各執行一次 tp-check（before-fix 完整 report + after-fix 完整 report），聚焦 R1-R12 修正
- **重構 `/tp-issue`**：改為包裝 `/tp-edit` 的 GitHub Issue 驅動入口
- **改名 `/deploy` → `/tp-deploy`**：統一 `tp-` 前綴，純部署（不嵌入 tp-check）
- **新增備份機制**：所有修改行程 JSON 的 skill（tp-rebuild、tp-edit、tp-issue）在修改前備份到 `data/backup/{slug}_{timestamp}.json`，每個行程最多保留 10 份
- **新增 Windows 排程**：`scripts/` 目錄下建立 PowerShell 腳本，註冊 Windows Task Scheduler 每 15 分鐘自動執行 `/tp-issue`
- **棄用 `/add-spot`**：功能併入 `/tp-edit`，**BREAKING** 移除 `.claude/commands/add-spot.md`
- **新增網站 favicon**：地圖 Pin 造型 + TP 文字，陶土色背景白色文字，產生 SVG + PNG 全套尺寸，三頁 HTML 加入 `<link rel="icon">`

## Capabilities

### New Capabilities
- `tp-check-report`: tp-check 品質驗證 report 格式定義（紅綠燈狀態、完整/精簡模式、嵌入策略）
- `tp-edit-skill`: tp-edit 自然語言行程編輯 skill 定義（輸入解析、局部修改、備份、check 整合）
- `trip-json-backup`: 行程 JSON 備份機制（備份路徑、命名規則、保留策略、.gitignore）
- `auto-issue-scheduler`: Windows Task Scheduler 自動執行 tp-issue 排程（PowerShell 腳本、註冊/移除、log 機制）
- `site-favicon`: 網站 favicon 與 touch icon（SVG + PNG 套件、HTML link 標籤、apple-touch-icon）

### Modified Capabilities
- `trip-enrich-rules`: tp-rebuild 修改為前後各執行一次 tp-check，修正範圍維持 R1-R12
- `cloudflare-deploy`: 改名 `/deploy` → `/tp-deploy`，步驟加入 git pull

## Impact

- `.claude/commands/`：新增 `tp-check.md`、`tp-edit.md`、`tp-deploy.md`，修改 `tp-rebuild.md`、`tp-rebuild-all.md`、`tp-issue.md`，刪除 `deploy.md`、`add-spot.md`
- `scripts/`：新增 `tp-issue-scheduler.ps1`、`register-scheduler.ps1`、`unregister-scheduler.ps1`
- `data/backup/`：新增目錄（gitignore 排除）
- `.gitignore`：新增 `data/backup/`、`scripts/*.log`
- `images/`：新增 `favicon.svg`、`favicon-32x32.png`、`favicon-16x16.png`、`apple-touch-icon.png`、`icon-192.png`、`icon-512.png`
- `index.html`、`edit.html`、`setting.html`：`<head>` 加入 favicon link 標籤
- 其餘 js/css/tests 不受影響
