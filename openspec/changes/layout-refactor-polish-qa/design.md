## Context

Phase 2-5 ship 後累計 ~8 週 layout + feature 工作。此 Phase 把「工程完成」升級為「產品級」— 填平 Phase 2-5 各自 ship 時遺留的 polish 工作 + 整體 regression + 品質 gates + docs。

## Goals / Non-Goals

**Goals:**
- 所有 Phase 2-5 的 user-visible polish 補齊（animation / empty state / error handling）
- Lighthouse / a11y / bundle size 三項 quality gates 明定且通過
- Playwright E2E full coverage（跨 Phase 2-5 journeys）
- CHANGELOG + README + DESIGN.md Decisions Log 同步更新
- Sentry / daily-check 整合確認

**Non-Goals:**
- 不新增 feature（單純 polish + QA）
- 不做 UI redesign（視覺基於 DESIGN.md + Mindtrip benchmark 已定）
- 不做 i18n（英文 locale 非 V1 goal）
- 不做 Native App（仍 web-only）

## Decisions

### 1. Animation timing: 200ms ease-in-out
**為何**：符合 Apple HIG + Material Design 平均值，不慢不快。既有 DESIGN.md 已有 Motion section 定義；此 Phase 只 enforce apply。
**備選**：300ms+ 拖累手機感；100ms 以下感覺 snap（反而不像動畫）。

### 2. Error boundary per-page
**為何**：Ideas/Explore/Map 任一 page crash 不該炸整個 app。React 16+ error boundary pattern。
**實作**：`<ErrorBoundary>` wrap 每 page 的 AppShell children，fallback 顯示「此頁發生錯誤，請重試或回首頁」+ Sentry report。

### 3. Lighthouse CI gate: 80+ performance, 90+ a11y
**為何**：80+ performance 是 trip-planner 既有 target（非 Instagram 級），90+ a11y 是公司級品質 — 使用者常有老人。
**實作**：新增 `.github/workflows/lighthouse.yml`，每 PR 跑 lighthouse + comment 結果。

### 4. Bundle size gate: 各 chunk < 300 KB gzipped
**為何**：首頁 critical path 保持快；新 Explore / Map / dnd-kit 可 lazy load 進獨立 chunk。
**實作**：`vite build --bundle-analyzer`，若某 chunk > 300 KB warn PR。

### 5. Playwright matrix: Chrome desktop + iOS webkit + Chrome Android
**為何**：三個 viewport/engine 覆蓋主要 user devices。iOS webkit 特別重要（safari 行為常 edge case）。
**實作**：`playwright.config.ts` 加 3 projects，CI 跑全 matrix。

### 6. DESIGN.md Decisions Log 走 `/design-consultation update`
**為何**：Phase 1 已建 2026-04-24 條，Phase 6 ship 時補「Layout Refactor Phase 2-5 完成」宣告 + 2026-05-xx 新 entry。
**備選**：手動 edit DESIGN.md — 違反專案 rule。

### 7. Feature flag removal (若 Phase 2-5 有用)
**為何**：Phase 2 當初 right-sheet 過渡方案可能有 flag；Phase 6 清乾淨。
**實作**：`grep -r FEATURE_FLAG src/` 確認無遺留。

## Risks / Trade-offs

- **[Risk] Polish scope creep 無 end gate** → Mitigation: 嚴格以 Phase 2-5 的 "not done" 清單為範圍，不新增 feature
- **[Risk] Lighthouse CI 可能 fail 現有 page（e.g. TripPage 既有 perf 問題）** → Mitigation: 若 fail 屬 legacy issue，document 為 Open Question 不 block ship
- **[Risk] Playwright matrix 慢** → Mitigation: CI 僅 main branch + tag release 跑 full；PR 跑 Chrome desktop only
- **[Risk] DESIGN.md 多次編輯導致 conflict** → Mitigation: 集中 Phase 6 一次做完 Decisions Log 更新

## Migration Plan

1. **Week 12 Day 1**：audit Phase 2-5 遺留 polish items list；Playwright full matrix baseline
2. **Week 12 Day 2**：animation + empty state + error boundary
3. **Week 12 Day 3**：a11y audit（keyboard nav / ARIA / contrast）
4. **Week 12 Day 4**：Lighthouse CI + bundle analyzer
5. **Week 12 Day 5**：feature flag cleanup + CHANGELOG / README / DESIGN.md Decisions Log
6. **Week 12 end**：Full E2E + staging → prod ship
7. **Rollback**：polish items 非 structural，revert 單 commit 即可

## Open Questions

- Lighthouse 若 fail legacy page 是否 block ship？**建議**：legacy page 之前的 baseline 若 < 80 → document 為 Open Question 不 block；新 page（Explore / new TripPage layout）必 > 80
- Animation 是否要提供 `prefers-reduced-motion` 支援？**建議**：是（a11y 最佳實踐），animation wrapper 檢查 media query 關閉動畫
- Feature flag 若發現有遺留，刪除是否 breaking？**建議**：先驗 prod 使用情境，若 flag 永遠 on → 安全刪
