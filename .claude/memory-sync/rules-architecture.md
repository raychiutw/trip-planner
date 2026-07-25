# 架構參考

## CSS/JS 拆分規則

> **2026-07-25 刪除。** 原本這裡是一張多頁架構的檔案分工表（`css/style.css`、`css/edit.css`、`js/app.js`、`js/shared.js`…），**那些檔案全部不存在**。現在是 React SPA：CSS 只有 `css/tokens.css` 一個檔，JS 在 `src/`（entry `src/entries/main.tsx`）。元件與外殼結構見 `.claude/skills/tp-ux-verify/references/page-structure.md`。

## 桌機版面

> **2026-07-25 刪除。** 原本記載 `isDesktop()` User-Agent 偵測與 `sidebar 260px + content + info-panel 280px` 的斷點分工，**已被 rev2 三欄取代**。現行：桌機 ≥1024px 三欄 `--grid-3pane-desktop`（sidebar `--sidebar-width-desktop` / 行程 / 地圖 + 堆疊面板），手機 <1024px 底部 4-tab。版面 SoT 是 `DESIGN.md`。

## 交通統計

- `calcDrivingStats()` 從 `timeline[].transit` 篩選交通類型，按類型分組
- 每日統計可收合，開車超過 120 分鐘以警告樣式顯示
- `calcTripDrivingStats(days)` 彙總全旅程，渲染於航班區段下方

## AI 修改行程功能（edit.html）

```
Trip 頁面 → FAB → edit.html?trip={slug} → 輸入文字 → POST GitHub Issue (label: trip-edit)
/tp-request → 讀 Issue → 改 MD → build → test → commit push → close Issue
```

- **GitHub PAT**：Fine-Grained，僅 `Issues: Read+Write`
- **白名單**：只允許修改 `data/trips-md/{slug}/**`
