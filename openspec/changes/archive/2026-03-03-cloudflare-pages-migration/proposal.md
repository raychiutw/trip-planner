## Why

GitHub Pages 部署速度慢（push 後需 1~3 分鐘才生效），影響頻繁 UI 調整的開發節奏。Cloudflare Pages 對純靜態網站的部署速度約 10~30 秒，且提供全球 CDN、PR Preview、免費 Analytics 等附加價值。

## What Changes

- **新增 Cloudflare Pages 部署設定**：在 Cloudflare Dashboard 連接 GitHub repo，設定零 build 靜態部署
- **更新 OG URL**：`index.html` 的 `og:url` meta tag 更新為新網址
- **更新 deploy skill**：`.claude/commands/deploy.md` 的確認網址改為 Cloudflare Pages 網址
- **更新專案文件**：`CLAUDE.md` 和 memory 中的 GitHub Pages URL 替換為新網址
- **停用 GitHub Pages**：在 GitHub repo settings 關閉 Pages 功能（避免重複部署）

## Capabilities

### New Capabilities

- `cloudflare-deploy`：Cloudflare Pages 部署設定與工作流

### Modified Capabilities

（無現有 spec 需修改 — 部署平台不影響功能規格）

## Impact

- **HTML**：`index.html`（og:url meta tag）
- **設定檔**：`.claude/commands/deploy.md`
- **文件**：`CLAUDE.md`、memory 檔案
- **JS/CSS**：無變更（所有路徑皆為相對路徑，不受影響）
- **JSON**：無變更
- **外部服務**：需在 Cloudflare Dashboard 手動建立 Pages 專案
