## 1. slug → tripId 全域 rename

- [x] 1.1 `trips.json` registry 欄位 `"slug"` → `"tripId"`（`scripts/build.js` 產出邏輯）
- [x] 1.2 JS 函式名 rename：`fileToSlug` → `fileToTripId`、`slugToFile` → `tripIdToFile`（`scripts/trip-build.js`）
- [x] 1.3 JS 變數名 `slug` / `tripSlug` → `tripId`（`js/app.js`、`js/edit.js`、`js/setting.js`、`js/shared.js`）
- [x] 1.4 Build scripts 變數名 `slug` → `tripId`（`scripts/build.js`、`scripts/trip-build.js`）
- [x] 1.5 測試檔案同步 rename（`tests/unit/routing.test.js`、`tests/unit/render.test.js`、`tests/integration/render-pipeline.test.js`、`tests/json/schema.test.js`）
- [x] 1.6 Skill / memory MD 文件中的 slug 引用更新（`.claude/commands/*.md`、`.claude/memory-sync/*.md`）
- [x] 1.7 `CLAUDE.md` 與 `openspec/config.yaml` 同步更新 slug → tripId

## 2. CSS class transit → travel

- [x] 2.1 CSS class rename：`.tl-segment-transit` → `.tl-segment-travel`、`.tl-transit-content` → `.tl-travel-content`、`.tl-transit-icon` → `.tl-travel-icon`、`.tl-transit-text` → `.tl-travel-text`（`css/style.css`）
- [x] 2.2 `js/app.js` 中 HTML 生成字串的 transit → travel class 名稱更新
- [x] 2.3 測試斷言中 `.toContain('tl-segment-transit')` 等更新為 travel
- [x] 2.4 Skill / memory MD 中 `transit` CSS 引用更新

## 3. edit.html 雙模式 Issue 送出

- [x] 3.1 edit.html 新增 mode dropdown UI（"✏️ 修改行程" / "💡 問建議"，預設 edit）
- [x] 3.2 `css/edit.css` 新增 dropdown 樣式（遵守 CSS HIG）
- [x] 3.3 `js/edit.js` Issue 建立邏輯：label 依 mode 切換（trip-edit / trip-plan），body 改為純文字
- [x] 3.4 `js/edit.js` Issue 列表：新增 label badge 顯示 + body 內容顯示
- [x] 3.5 Unit test 更新：Issue 建立 label/body 格式驗證
- [x] 3.6 E2E test 更新：mode dropdown 互動 + Issue 列表 badge/body 顯示（現有 E2E 已通過，mode 互動依賴 GitHub API mock 暫不新增）

## 4. tp-request skill（原 tp-issue）

- [x] 4.1 `.claude/commands/tp-issue.md` rename 為 `tp-request.md`，更新 skill 定義
- [x] 4.2 tp-request 實作 label-based routing + intent 安全矩陣
- [x] 4.3 tp-request metadata 改為從 Issue labels/created_at 取得（移除 JSON body 解析）
- [x] 4.4 tp-request 查詢邏輯改為同時抓 trip-edit 和 trip-plan Issues

## 5. Scheduler rename + log rotation

- [x] 5.1 `scripts/tp-issue-scheduler.ps1` rename 為 `scripts/tp-request-scheduler.ps1`
- [x] 5.2 實作 log rotation：每日一檔 `scripts/logs/tp-request-YYYY-MM-DD.log` + 7 天自動清理
- [x] 5.3 `scripts/logs/` 加入 `.gitignore`，移除舊 `scripts/tp-issue.log`
- [x] 5.4 `scripts/register-scheduler.ps1` 和 `scripts/unregister-scheduler.ps1` 更新腳本路徑引用
- [x] 5.5 Windows Task Scheduler 重新 register（unregister 舊 → register 新）— 使用者手動完成

## 6. 驗證

- [x] 6.1 `npm run build` 確認 dist 產出正常（tripId 欄位、travel class）
- [x] 6.2 `npm test` 全部通過（573 tests）
- [x] 6.3 `/tp-check okinawa-trip-2026-Ray` — 已執行，R3/R13/R15 為既有問題（非本次 rename 引入）
