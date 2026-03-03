## Why

網站已遷移至 Cloudflare Pages 部署，但程式碼中仍有多處硬編碼舊的 GitHub Pages URL 尚未更新。同時 HuiYun 行程的 themeColor 與 Ray 撞色（皆為 `#0077B6`），需依行程特性調整為青綠色系做區隔。

## What Changes

- 將 `index.html` og:url、`CLAUDE.md`、`.claude/commands/deploy.md`、MEMORY.md 中的 GitHub Pages URL 更新為 `https://trip-planner-dby.pages.dev/`
- 將 HuiYun 行程的 `themeColor` 從 `#0077B6`（海藍）改為 `#2AA5A0`（青綠），呼應其海岸巡遊行程特性

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `cloudflare-deploy`: 落實既有 spec 中「URL 參考更新」要求，將所有硬編碼 URL 替換為 Cloudflare Pages 網址

## Impact

- `index.html` — og:url meta tag
- `CLAUDE.md` — 專案 URL 說明
- `.claude/commands/deploy.md` — deploy skill 確認網址
- MEMORY.md — 專案資訊 URL
- `data/trips/okinawa-trip-2026-HuiYun.json` — meta.themeColor
