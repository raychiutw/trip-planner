## Context

目前部署在 GitHub Pages（`raychiutw.github.io/trip-planner/`），純靜態無 build step。所有 HTML 內的資源引用皆為相對路徑（`css/shared.css`、`js/app.js`、`edit.html`），不依賴特定 base path。

唯一包含絕對 URL 的位置：
- `index.html:12` — `<meta property="og:url" content="https://raychiutw.github.io/trip-planner/">`
- `.claude/commands/deploy.md` — 確認用的瀏覽器 URL
- `CLAUDE.md` — 專案資訊中的網站連結
- Memory 檔案 — 專案資訊參考

## Goals / Non-Goals

**Goals:**
- 部署從 GitHub Pages 遷移至 Cloudflare Pages
- 部署速度從 1~3 分鐘降至 10~30 秒
- 保持 git push 觸發自動部署的工作流
- 更新所有硬編碼的 URL 參考

**Non-Goals:**
- 不使用 Cloudflare Functions（維持純靜態）
- 不設定自訂網域（先用 `*.pages.dev` 預設網域）
- 不修改任何 JS/CSS 功能邏輯

## Decisions

### D1: 部署方式 — Git 連接（非 wrangler CLI）

**選擇**：Cloudflare Dashboard 直接連接 GitHub repo，push 自動觸發部署。

**替代方案**：使用 `wrangler pages deploy` CLI 手動部署 → 拒絕，增加部署步驟複雜度，git 連接最簡單。

**理由**：與現有 git push 工作流一致，無需額外安裝 wrangler CLI。

### D2: Build 設定

**選擇**：
- Build command：留空（無 build step）
- Build output directory：`/`（根目錄）
- Production branch：`master`

**理由**：專案是純靜態 HTML/CSS/JS，不需任何 build 過程。

### D3: 專案名稱與 URL

**選擇**：Cloudflare Pages 專案名稱設為 `trip-planner`，產生預設 URL `trip-planner.pages.dev`。

**注意**：如果名稱已被佔用，Cloudflare 會自動加後綴（如 `trip-planner-xxx.pages.dev`）。屆時需以實際產生的 URL 為準。

### D4: deploy skill 更新

**選擇**：修改 `.claude/commands/deploy.md`，將確認 URL 從 `raychiutw.github.io/trip-planner/` 改為 Cloudflare Pages 網址。push 目標仍為 `origin/master`。

### D5: GitHub Pages 停用

**選擇**：手動在 GitHub repo Settings → Pages 停用。此為手動操作，列為 task 但非程式碼變更。

## Risks / Trade-offs

- [Cloudflare Pages 專案名稱被佔用] → 使用實際分配的 URL，可後續綁定自訂網域
- [GitHub Pages 停用後舊 URL 失效] → 無外部連結依賴，影響極小
- [Cloudflare 免費帳戶限制] → 每月 500 次 build、無限頻寬，對個人專案綽綽有餘
