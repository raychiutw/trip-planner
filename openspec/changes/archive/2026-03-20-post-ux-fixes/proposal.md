# UX 大改版後修復 — 提案

## 背景

Tailwind CSS v4 遷移 + UX 全面升級 + 6 套主題配色（`ux-overhaul-6themes`）上線後，Key User 回報多項異常。經 PM 派出 8 個調查 agent + 2 個 Playwright QC agent 全面掃描，共發現 14 項問題。

## 問題清單

### Group A — 快速修（CSS/一行程式碼）

| # | 問題 | 根因 | 影響檔案 |
|---|------|------|----------|
| 2 | Day Header + 餐廳卡片 `border-left` 違反無框線設計 | design.md 自行宣告例外，Key User 不同意 | css/style.css |
| 5 | 手機版底部白邊 | footer/container 缺 `env(safe-area-inset-bottom)` | css/style.css |
| 12 | DayNav pill 顯示星期幾 | Key User 要求只顯示 `MM/DD` | src/components/trip/DayNav.tsx |
| 14 | 交通統計 sheet 顯示 "Day undefined" | day_num 取值錯誤 | src/components/trip/DrivingStats.tsx |

### Group B — 中等（元件邏輯修改）

| # | 問題 | 根因 | 影響檔案 |
|---|------|------|----------|
| 3 | SpeedDial 垂直 flex 不是 2×3 iOS grid | `flex-direction: column-reverse` | css/style.css + SpeedDial.tsx |
| 8 | 左右滑動切日期不動 | useSwipeDay closure 過期 | src/hooks/useSwipeDay.ts |
| 11b | Panel `.dragging` class 未套用 | React 沒加 className | src/components/trip/InfoSheet.tsx |
| 13 | Active pill 下方常駐 label | 缺 day.label 小標籤 | DayNav.tsx + css/style.css |

### Group C — 大型（手勢引擎重做 + SVG 創作）

| # | 問題 | 根因 | 影響檔案 |
|---|------|------|----------|
| 1 | 新主題缺 ThemeArt SVG（Forest/Sakura/Ocean） | 3 主題 × 6+ SVG 未實作 | src/components/trip/ThemeArt.tsx |
| 9 | Bottom Panel 高度應依內容 max 85% | 固定 75dvh | InfoSheet.tsx + css/style.css |
| 10 | Bottom Panel 開啟時背景可捲動 | body 缺 scroll lock | InfoSheet.tsx |
| 11 | Panel 拖曳 vs 內容捲動衝突 | 手勢未整合 iOS 模式 | InfoSheet.tsx |

### Group D — 設定/低優先

| # | 問題 | 根因 | 影響檔案 |
|---|------|------|----------|
| 4 | Sticky nav 捲動不可見 | 半透明 backdrop-filter | css/style.css（需實機驗證） |
| 7 | Sentry CSP 被擋 | `connect-src` 缺 Sentry domain | _headers 或 wrangler.toml |

## 修復策略

- Group A + B：兩個工程師 worktree 並行，已派出
- Group C：Group A+B 完成後再處理（InfoSheet #9-11 一起做）
- Group D：低優先，最後處理
- 每組完成後經 Code Review + QC 驗證
