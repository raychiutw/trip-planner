## Why

Phase 2-5 完成 layout + feature 主體，但每 Phase ship 後仍留下 polish items（動畫 / 空狀態 / 錯誤處理 / a11y / perf / 整合 E2E）。Phase 6 集中處理這些收尾，讓整個 12 週 layout refactor 可**以產品級品質**向使用者宣布完成。

同時需要：
- 記錄整個 refactor 到 CHANGELOG
- 確認 Sentry / daily-check / Playwright CI 仍對新 layout green
- DESIGN.md Decisions Log 補齊
- 移除任何 Phase 2-5 的 feature flag（若有）

## What Changes

- **Polish items**:
  - Sheet 開/關 animation（CSS transition ~200ms ease-in-out）
  - Modal enter/exit animation
  - Empty state 文案統一（Ideas / Explore / Saved / 新 trip）
  - Loading state skeleton 取代既有 spinner（可選）
  - Error boundary per-page + Sentry breadcrumb
- **Performance**:
  - Lighthouse CI pass 80+ all pages（桌機 / 手機）
  - Bundle size audit：layout + Explore + dnd-kit 額外 < 100 KB gzipped 成本
  - Code split per route（lazy load Explore / Map / Chat）
- **A11y audit**:
  - 鍵盤 tab order 合理
  - ARIA labels 補齊 sheet tabs / sidebar / bottom nav
  - Focus trap 進入 modal / sheet 正確
  - Color contrast WCAG AA（對照 Terracotta palette）
- **E2E coverage**:
  - Playwright 整 suite 跑 Phase 2-5 所有 journey
  - iOS webkit + Chrome Android viewport matrix
- **Documentation**:
  - CHANGELOG 加 layout refactor entry
  - README 更新 layout 結構說明
  - DESIGN.md Decisions Log 加 2026-04-24 session 決策（Q1-Q6）
- **Monitoring**:
  - Sentry release 標記 2026-05-xx layout v3
  - daily-check 驗新 layout 不破 routes

## Capabilities

### New Capabilities

- `layout-shippable-quality`: 定義 layout refactor 整體的 shippable quality gates — performance / a11y / E2E coverage / monitoring / docs，所有 gate pass 才 ship prod

### Modified Capabilities

（無 requirement-level 變更；Phase 6 是 polish 不動行為）

## Impact

- **檔案層面**：
  - 各 component 加 CSS transition / animation
  - 各 page 加 error boundary
  - CHANGELOG.md / README.md 更新
  - DESIGN.md Decisions Log append（走 `/design-consultation update`）
  - `.github/workflows/` CI 加 lighthouse / bundle analyzer step（可選）
- **測試**：
  - Playwright 既有 suite + 新 layout coverage
  - Lighthouse CI config
  - A11y axe-core integration
- **相依**：無新 runtime 套件；dev tool 可新增 lighthouse-ci, axe-core, playwright
- **Breaking**：無（純 polish + 驗證）
