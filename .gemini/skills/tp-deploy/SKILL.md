---
name: tp-deploy
description: Commit 程式碼變更並 push 到 GitHub，部署至 Cloudflare Pages。適用於完成前端程式碼修改後需要正式發布時。
---

# tp-deploy

Commit 程式碼變更並 push 到 GitHub，部署至 Cloudflare Pages。

**注意**：行程資料已直接寫入 D1 database（透過 API），無需 build 步驟。本技能僅處理前端程式碼（HTML/CSS/JS）、設定檔、skill 檔案等的 git 部署。

## 步驟
1. **更新專案**：執行 `git pull origin master`。
2. **暫存變更**：執行 `git add` 有修改的程式碼檔案（不包含 `.gemini/`、`.claude/` 等個人配置資料夾；不包含 `data/trips-md/`、`data/dist/` 舊版行程資料目錄）。
3. **提交變更**：使用繁體中文描述修改內容並執行 `git commit`。
4. **推送變更**：執行 `git push` 到 `origin/master`。
5. **確認部署**：提醒使用者前往 https://trip-planner-dby.pages.dev/ 確認部署結果。

## 說明
- 行程資料變更（景點、餐廳、行程內容等）已透過 D1 API 即時生效，不需要 git push 即可上線
- 只有前端程式碼（`index.html`、`edit.html`、`css/`、`js/`、`functions/` 等）需要透過 git push 部署到 Cloudflare Pages
