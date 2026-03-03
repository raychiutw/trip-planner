## 1. Cloudflare Pages 設定（手動）

- [x] 1.1 在 Cloudflare Dashboard 建立 Pages 專案，連接 `raychiutw/trip-planner` GitHub repo，production branch 設為 `master`，build command 留空，output directory 設為 `/`
- [x] 1.2 確認首次部署成功，記錄實際分配的 `*.pages.dev` 網址

## 2. 更新專案內 URL 參考

- [x] 2.1 `index.html`：`og:url` meta tag 更新為 Cloudflare Pages 網址
- [x] 2.2 `.claude/commands/deploy.md`：確認網址改為 Cloudflare Pages 網址
- [x] 2.3 `CLAUDE.md`：GitHub Pages URL 替換為 Cloudflare Pages 網址
- [x] 2.4 Memory 檔案（`MEMORY.md`）：更新專案 URL

## 3. 停用 GitHub Pages（手動）

- [x] 3.1 在 GitHub repo Settings → Pages 停用 Pages 功能

## 4. 驗證

- [x] 4.1 Push 變更後確認 Cloudflare Pages 自動部署成功
- [x] 4.2 確認網站所有頁面（index / edit / setting）正常運作
