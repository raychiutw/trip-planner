## MODIFIED Requirements

### Requirement: URL 參考更新

所有專案內硬編碼的 GitHub Pages URL SHALL 更新為 Cloudflare Pages 網址 `https://trip-planner-dby.pages.dev/`。包含：
- `index.html` 的 `og:url` meta tag
- `.claude/commands/tp-deploy.md` 的確認網址
- `CLAUDE.md` 的專案 URL
- Memory 檔案的專案 URL

#### Scenario: OG URL 正確

- **WHEN** 社群平台抓取 `index.html` 的 OG meta
- **THEN** `og:url` SHALL 為 `https://trip-planner-dby.pages.dev/`

#### Scenario: deploy skill 確認網址

- **WHEN** 執行 `/tp-deploy` skill
- **THEN** 開啟的確認網址 SHALL 為 `https://trip-planner-dby.pages.dev/`

#### Scenario: CLAUDE.md 專案 URL

- **WHEN** 讀取 `CLAUDE.md` 的專案資訊
- **THEN** URL SHALL 為 `https://trip-planner-dby.pages.dev/`

### Requirement: deploy skill 改名

deploy skill SHALL 從 `/deploy` 改名為 `/tp-deploy`，統一 `tp-` 前綴。部署流程加入 `git pull` 作為第一步。

#### Scenario: skill 檔案改名

- **WHEN** 實作本變更
- **THEN** SHALL 將 `.claude/commands/deploy.md` 改名為 `.claude/commands/tp-deploy.md`

#### Scenario: tp-deploy 流程

- **WHEN** 使用者執行 `/tp-deploy`
- **THEN** SHALL 依序執行：
  1. `git pull origin master`
  2. `git add` 有修改的檔案（不加 `.claude/`）
  3. `git commit` 用繁體中文訊息
  4. `git push` 到 origin/master
  5. 開啟瀏覽器 `https://trip-planner-dby.pages.dev/` 確認

#### Scenario: tp-deploy 不嵌入 tp-check

- **WHEN** `/tp-deploy` 執行
- **THEN** SHALL NOT 執行 tp-check 品質驗證
