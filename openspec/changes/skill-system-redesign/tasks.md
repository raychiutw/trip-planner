## 1. tp-deploy 改名

- [x] 1.1 將 `.claude/commands/deploy.md` 改名為 `.claude/commands/tp-deploy.md`
- [x] 1.2 更新 tp-deploy.md 內容：加入 `git pull origin master` 作為第一步

## 2. tp-check skill 建立

- [x] 2.1 建立 `.claude/commands/tp-check.md`：定義輸入（tripSlug 或選擇列表）、只讀不改、逐項 R1-R12 檢查
- [x] 2.2 tp-check.md 定義完整模式 report 格式：表頭（tripSlug + 時間戳）、summary 行（🟢🟡🔴 計數）、規則明細表、warnings/failures 清單
- [x] 2.3 tp-check.md 定義精簡模式 report 格式：單行 `tp-check: 🟢 N  🟡 N  🔴 N`

## 3. tp-edit skill 建立

- [x] 3.1 建立 `.claude/commands/tp-edit.md`：定義輸入（tripSlug + 自然語言描述）、局部修改邏輯、檔案白名單
- [x] 3.2 tp-edit.md 整合備份流程：修改前備份到 `data/backup/{slug}_{timestamp}.json`
- [x] 3.3 tp-edit.md 整合 tp-check 精簡模式：修改完成後輸出精簡 report
- [x] 3.4 tp-edit.md 加入連動更新說明：checklist、backup、suggestions 同步

## 4. tp-rebuild / tp-rebuild-all 重構

- [x] 4.1 更新 `.claude/commands/tp-rebuild.md`：加入修正前 tp-check 完整 report（before-fix）
- [x] 4.2 更新 tp-rebuild.md：加入修正後 tp-check 完整 report（after-fix）
- [x] 4.3 更新 tp-rebuild.md：加入修改前備份流程
- [x] 4.4 更新 `.claude/commands/tp-rebuild-all.md`：每趟完成後執行 tp-check 完整 report

## 5. tp-issue 重構

- [x] 5.1 更新 `.claude/commands/tp-issue.md`：改為 tp-edit 的 GitHub Issue 包裝層
- [x] 5.2 tp-issue.md 加入備份流程：每個 Issue 修改前備份
- [x] 5.3 tp-issue.md 加入 tp-check 精簡 report：每個 Issue 處理完後輸出

## 6. add-spot 棄用

- [x] 6.1 刪除 `.claude/commands/add-spot.md`

## 7. 備份基礎設施

- [x] 7.1 建立 `data/backup/` 目錄（含 `.gitkeep`）
- [x] 7.2 更新 `.gitignore`：加入 `data/backup/*.json` 和 `scripts/*.log`

## 8. Windows 排程腳本

- [x] 8.1 建立 `scripts/tp-issue-scheduler.ps1`：切換目錄、執行 Claude CLI、追加 log
- [x] 8.2 建立 `scripts/register-scheduler.ps1`：註冊 `TripPlanner-AutoIssue` 排程（每 15 分鐘）
- [x] 8.3 建立 `scripts/unregister-scheduler.ps1`：移除排程任務

## 9. Favicon

- [x] 9.1 建立 `images/` 目錄
- [x] 9.2 建立 `images/favicon.svg`：地圖 Pin 造型 + TP 白色粗體文字，背景 #C4704F
- [x] 9.3 從 SVG 產生 PNG 套件：`favicon-32x32.png`、`favicon-16x16.png`、`apple-touch-icon.png`（180×180）、`icon-192.png`、`icon-512.png`
- [x] 9.4 更新 `index.html` `<head>`：加入三行 favicon link 標籤（SVG + PNG fallback + apple-touch-icon）
- [x] 9.5 更新 `edit.html` `<head>`：加入相同三行 favicon link 標籤
- [x] 9.6 更新 `setting.html` `<head>`：加入相同三行 favicon link 標籤

## 10. 驗證

- [x] 10.1 確認所有新建/修改的 skill 檔案語法正確（人工檢視）
- [x] 10.2 執行 `npm test` 確認現有測試不受影響
