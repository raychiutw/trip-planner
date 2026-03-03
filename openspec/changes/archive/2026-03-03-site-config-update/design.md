## Context

網站已從 GitHub Pages 遷移至 Cloudflare Pages（`trip-planner-dby.pages.dev`），但程式碼中仍有 4 處硬編碼舊 URL。此外 HuiYun 行程的 themeColor 與 Ray 撞色。

目前 URL 引用位置（經 grep 確認）：
- `index.html:12` — `<meta property="og:url" content="https://raychiutw.github.io/trip-planner/">`
- `CLAUDE.md:14` — `GitHub Pages：https://raychiutw.github.io/trip-planner/`
- `.claude/commands/deploy.md:7` — `https://raychiutw.github.io/okinawa-trip-2026/`
- MEMORY.md — `https://raychiutw.github.io/trip-planner/`

## Goals / Non-Goals

**Goals:**
- 所有硬編碼 URL 指向 `https://trip-planner-dby.pages.dev/`
- HuiYun themeColor 從 `#0077B6` 改為 `#2AA5A0`，與 Ray 做視覺區隔

**Non-Goals:**
- 不處理 openspec archive 中的歷史 URL（封存不改）
- 不調整其他行程的 themeColor

## Decisions

### 1. URL 全部替換為 `https://trip-planner-dby.pages.dev/`

deploy.md 的確認 URL 改為首頁（不再指向特定行程），因為網站現在是多行程架構。

### 2. HuiYun 青綠色 `#2AA5A0`

HuiYun 行程以海岸巡遊為主（殘波岬、翡翠海灘、古宇利島），青綠色呼應淺海意象，與 Ray 深藍（`#0077B6`）區隔。

## Risks / Trade-offs

- [風險] 舊 GitHub Pages URL 若仍有外部連結指向 → 不在此 change 範圍，需另行設定 redirect
- [風險] deploy.md 確認 URL 改為首頁後，需手動選擇行程才能看到特定行程 → 可接受，首頁有行程選單
