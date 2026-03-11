## Context

edit.html 的 Issue 系統目前將所有請求都打上 `trip-edit` label、body 用 JSON 格式，且不區分「修改行程」和「諮詢建議」。此外 codebase 中 `slug` 和 CSS `transit` 命名不一致，需統一。

## Goals / Non-Goals

**Goals:**
- 旅伴可選擇「修改行程」或「問建議」模式送出 Issue
- tp-request skill 依 label 分流處理，諮詢類不修改檔案
- Issue body 改為純文字，列表顯示 label badge + body 內容
- 全站 `slug` → `tripId`、CSS `transit` → `travel` 命名統一
- scheduler log 改為每日一檔 + 7 天自動清理

**Non-Goals:**
- 不做向下相容（舊 JSON body Issue 已 closed）
- 不改 URL param 名稱（`?trip=` 維持不變，只改內部變數名）
- 不改 MD 原始檔格式（`- travel:` 已經是 travel）
- 不改 GitHub Issue labels 格式（維持 kebab-case）

## Decisions

### D1: 模式路由用 GitHub label 而非 body metadata

labels `trip-edit` / `trip-plan` 已足夠區分模式。body 保持純文字，不需要 blockquote metadata 行。

**替代方案**：body 第一行 blockquote 寫模式 → 增加解析複雜度且 label 已攜帶資訊，不必要。

### D2: Issue body 純文字，metadata 全由 Issue 本身攜帶

| 資訊 | 來源 |
|------|------|
| mode | label（trip-edit / trip-plan） |
| tripId | label（非 trip-edit/trip-plan 的那個） |
| owner | tripId 尾段（`tripId.split('-').pop()`） |
| timestamp | `issue.created_at` |
| text | `issue.body` |

**替代方案**：JSON body → 難讀、冗餘，砍掉。

### D3: tp-request 意圖安全矩陣

|  | 意圖=修改 | 意圖=諮詢 |
|---|---|---|
| **trip-edit** | ✅ 改 MD → commit → deploy | 💬 comment 回覆，不改檔案 |
| **trip-plan** | 💬 comment 提醒換模式 | ✅ 💬 comment 回覆，不改檔案 |

只有左上格修改檔案。意圖判斷由 LLM 在 skill 執行時進行。

### D4: slug → tripId rename 策略

全域 find-and-replace，分層進行：
1. `trips.json` 欄位名 `"slug"` → `"tripId"`
2. JS 函式名 `fileToSlug` → `fileToTripId`、`slugToFile` → `tripIdToFile`
3. JS 變數名 `slug` → `tripId`、`tripSlug` → `tripId`（合併重複命名）
4. Skill / memory MD 文件中的 slug 引用
5. 測試檔案同步更新
6. CLAUDE.md + openspec/config.yaml 同步更新

### D5: CSS transit → travel rename

純 CSS class rename + 對應 JS 和測試中的字串更新：
- `.tl-segment-transit` → `.tl-segment-travel`（4 個 class）
- `app.js` 中生成 HTML 的字串
- 測試中 `.toContain('tl-segment-transit')` 等斷言

### D6: scheduler log rotation

- `scripts/logs/` 新資料夾（加入 `.gitignore`）
- 每次執行時 `Get-ChildItem *.log | Where LastWriteTime -lt 7天 | Remove-Item`
- 每日一檔 `tp-request-YYYY-MM-DD.log`，同一天多次執行 append

## Risks / Trade-offs

- **trips.json BREAKING change** → 所有讀取 `slug` 的前端邏輯須同步改。build.js 產出和前端消費在同一 repo，一次 commit 即可確保一致。
- **大量檔案改動** → rename 涉及 JS/CSS/測試/文件約 20+ 檔案。用全域 replace 確保不遺漏，再跑測試驗證。
- **scheduler rename** → Windows Task Scheduler 已註冊舊腳本路徑，需重新 register。先 unregister 再 register 新路徑。
