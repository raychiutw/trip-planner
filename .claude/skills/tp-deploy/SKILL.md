---
name: tp-deploy
description: Use when the user wants to commit all pending changes, push to GitHub, and verify the Cloudflare Pages deployment.
user-invocable: true
---

Commit 所有程式碼變更並 push 到 GitHub。

**注意**：行程資料已直接寫入 D1 database（透過 API），無需 build 步驟。本 skill 僅處理前端程式碼（HTML/CSS/JS）、設定檔、skill 檔案等的 git 部署。

## 步驟

1. `git pull origin master`
2. 確認有哪些程式碼變更（非行程資料）：
   ```bash
   git status --short
   git diff --name-only
   ```
3. `git add` 有修改的程式碼檔案（不加 `.claude/`、`.gemini/` 個人設定；不加 `data/trips-md/`、`data/dist/` 舊版行程資料目錄）
4. `git commit` 用繁體中文訊息描述改了什麼
5. `git push` 到 origin/master

## 說明

- 行程資料變更（景點、餐廳、行程內容等）已透過 D1 API 即時生效，不需要 git push 即可上線
- 只有前端程式碼（`index.html`、`edit.html`、`css/`、`js/`、`functions/` 等）需要透過 git push 部署到 Cloudflare Pages
