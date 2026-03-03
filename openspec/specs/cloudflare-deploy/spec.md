## ADDED Requirements

### Requirement: Cloudflare Pages 部署設定

專案 SHALL 透過 Cloudflare Pages 部署，連接 GitHub repo 的 `master` 分支。Build command 留空，output directory 為 `/`。push 至 `master` 後 SHALL 自動觸發部署。

#### Scenario: push 觸發自動部署

- **WHEN** 開發者 push 程式碼至 `origin/master`
- **THEN** Cloudflare Pages SHALL 自動偵測並部署最新版本

#### Scenario: 無 build step

- **WHEN** Cloudflare Pages 觸發部署
- **THEN** SHALL 直接使用根目錄的靜態檔案，不執行任何 build command

### Requirement: URL 參考更新

所有專案內硬編碼的 GitHub Pages URL SHALL 更新為 Cloudflare Pages 網址 `https://trip-planner-dby.pages.dev/`。包含：
- `index.html` 的 `og:url` meta tag
- `.claude/commands/deploy.md` 的確認網址
- `CLAUDE.md` 的專案 URL
- Memory 檔案的專案 URL

#### Scenario: OG URL 正確

- **WHEN** 社群平台抓取 `index.html` 的 OG meta
- **THEN** `og:url` SHALL 為 `https://trip-planner-dby.pages.dev/`

#### Scenario: deploy skill 確認網址

- **WHEN** 執行 `/deploy` skill
- **THEN** 開啟的確認網址 SHALL 為 `https://trip-planner-dby.pages.dev/`

#### Scenario: CLAUDE.md 專案 URL

- **WHEN** 讀取 `CLAUDE.md` 的專案資訊
- **THEN** URL SHALL 為 `https://trip-planner-dby.pages.dev/`

### Requirement: GitHub Pages 停用

GitHub repo 的 Pages 功能 SHALL 停用，避免重複部署。

#### Scenario: 停用後無 GitHub Pages 部署

- **WHEN** push 至 `master`
- **THEN** GitHub Pages SHALL NOT 觸發部署（僅 Cloudflare Pages 部署）
