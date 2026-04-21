# Proposal: PR6 — autoplan A+B Findings

## 背景

autoplan retrospective 針對 PR3–PR5 的實作掃描出 11 個 findings，
分為兩類：

- **A 類（4 項）** — Regression：功能宣稱實作但實際缺失或邏輯有誤
- **B 類（7 項）** — Quality：未達 Apple HIG 或設計規範標準

## 11 個 Items

### A 類 — Regression（功能假對齊）

| ID | 標題 | 問題 |
|----|------|------|
| F001 | TripMapRail 缺 `dark` prop | `useLeafletMap` 支援 `dark` 但 TripMapRail 沒傳給 `useLeafletMap`，黑暗模式下地圖底圖永遠淺色 |
| F002 | TripMapRail `fitDoneRef` 跨行程不 reset | 切換行程後 `fitDoneRef` 已是 `true`，`fitBounds` 不再觸發，地圖停留在前一個行程視角 |
| F003 | Mobile Type Scale 未真正落地 | `tokens.css` 定義了 mobile type scale tokens 但 `.ocean-hero-title`、`.ocean-h1` 等 class 在 `@media (max-width: 760px)` 下缺少對應 override，hero title mobile 仍是 22px 而非 24px |
| F004 | 缺 `color-scheme` 宣告 | 未宣告 `color-scheme`，瀏覽器預設使用 UA light scheme，scrollbar、form element、selection color 在 dark mode 下無法自動跟隨 |

### B 類 — Quality（宣稱做的真的做、editorial follow-through）

| ID | 標題 | 問題 |
|----|------|------|
| F005 | TripMapRail 未 React.lazy | Leaflet 是重型套件，TripMapRail 應用 `React.lazy` 做 code split，避免影響首頁 bundle |
| F006 | TripMapRail marker click integration test 不完整 | 現有測試 mock `map: null`，marker click 核心路徑跳過，缺乏真正驗證 navigate 被觸發 |
| F007 | TripMapRail scroll fly-to active day 未實作 | PR5 autoplan 宣稱「scroll-triggered fly-to」，但 TripMapRail 無任何 scroll/IntersectionObserver 監聽 |
| F008 | 10 色 palette 缺 color-blind aid | 10 條路線只靠顏色區分，無法通過 WCAG 2.1 §1.4.1 色盲輔助要求 |
| F009 | MobileBottomNav「訊息」應改「助理」 | 設計稿定義第三 tab 為「助理」，實作為「訊息」，label 與 icon 不符設計意圖 |
| F010 | 「看地圖」chip tap target 未達 44px | Apple HIG 最小 tap target 44×44pt，`.day-map-chip` 目前只有 inline-flex 無 min-height 約束 |
| F011 | `map-page-day-query.test.tsx` source string match 應 runtime 化 | 現有測試讀原始碼 string 做 assert，無法驗證 `?day=abc`、`?day=999` 等 edge case 的實際 runtime 行為 |

## 設計原則

1. **Fix 假對齊**：已宣告的功能必須真正有效（F001、F002、F004）
2. **讓宣稱做的真的做**：autoplan 建議了但沒實作的項目補齊（F007、F005）
3. **Editorial follow-through**：設計決定有始有終，label/規格落到程式碼（F003、F008、F009、F010）
4. **測試有效性提升**：測試應驗證行為而非源碼字串（F006、F011）

## 範圍說明

- 不引入新頁面或新路由
- 不更動 D1 schema 或 API
- 不更動 CI/CD 設定
- 純前端程式碼 + CSS + 測試

## 完成標準

- `npx tsc --noEmit` 0 errors
- `npm test` 全綠
- 每個 item 有對應的紅→綠 TDD commit
