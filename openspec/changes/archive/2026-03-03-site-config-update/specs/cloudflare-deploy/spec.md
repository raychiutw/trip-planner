## MODIFIED Requirements

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
