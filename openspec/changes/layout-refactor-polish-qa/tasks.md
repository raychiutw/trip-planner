## 1. Audit Phase 2-5 遺留

- [ ] 1.1 Audit 每 Phase ship 時的 known issues / deferred polish
- [ ] 1.2 條列 polish items（動畫 / 空狀態 / error handling）
- [ ] 1.3 條列 a11y issues（keyboard / ARIA / contrast）
- [ ] 1.4 條列 perf issues（bundle size / lighthouse）

## 2. Error boundaries

- [ ] 2.1 寫 failing test：ExplorePage throw error → ErrorBoundary catch + Sentry report
- [ ] 2.2 建 `<ErrorBoundary>` component（若不存在）+ Sentry integration
- [ ] 2.3 每 top-level page wrap error boundary
- [ ] 2.4 Fallback UI：「此頁發生錯誤」+ 回首頁 CTA

## 3. Animations

- [ ] 3.1 寫 failing test：TripSheet 開關 transition 200ms
- [ ] 3.2 寫 failing test：prefers-reduced-motion 時 transition 0ms
- [ ] 3.3 加 CSS transition 到 TripSheet / Modal
- [ ] 3.4 新增 `@media (prefers-reduced-motion: reduce)` override

## 4. Empty states + loading

- [ ] 4.1 Ideas tab empty state 統一文案 + Mindtrip 風 Add card 視覺
- [ ] 4.2 Explore 搜尋空結果 empty state
- [ ] 4.3 Saved pool empty state
- [ ] 4.4 Loading skeleton（可選，lightweight）取代 spinner

## 5. A11y audit

- [ ] 5.1 安裝 axe-core / playwright-axe
- [ ] 5.2 跑 axe 驗所有 page，修 violation
- [x] 5.3 鍵盤 tab order 驗證（手動 + Playwright test）
- [x] 5.4 ARIA labels 補齊 sidebar / bottom nav / sheet tabs
- [ ] 5.5 Focus trap in modal / sheet 正確
- [ ] 5.6 Color contrast 對照 Terracotta palette（用 Chrome DevTools Lighthouse 驗）

## 6. Performance

- [ ] 6.1 Lighthouse CI config (`.github/workflows/lighthouse.yml`)
- [ ] 6.2 Threshold: performance ≥ 80, a11y ≥ 90
- [ ] 6.3 新 page 必達標；legacy page 列 open issue 不 block
- [ ] 6.4 Bundle analyzer：各 chunk < 300 KB gzipped
- [ ] 6.5 Code split：Explore / Map / Chat lazy load
- [ ] 6.6 dnd-kit lazy load（只 Ideas/Itinerary tab 需要時載入）

## 7. Playwright E2E matrix

- [ ] 7.1 `playwright.config.ts` 加 iOS webkit + Chrome Android projects
- [ ] 7.2 E2E suite: 桌機 login → 建 trip → 加 ideas → promote → reorder
- [ ] 7.3 E2E suite: 手機 login → explore → save POI → add to trip
- [ ] 7.4 E2E suite: sheet tab 切換 + URL query 驗證
- [ ] 7.5 E2E suite: drag-to-promote 4 scenarios
- [ ] 7.6 CI main branch 跑 full matrix；PR 跑 Chrome desktop

## 8. Feature flag cleanup

- [ ] 8.1 `grep -r FEATURE_FLAG src/ functions/` 列所有 flag
- [ ] 8.2 確認 prod flag always-on 狀態
- [ ] 8.3 移除 flag code（讓 default behavior always run）
- [ ] 8.4 typecheck + test pass

## 9. Documentation

- [ ] 9.1 走 `/design-consultation update` 把 layout refactor 完成 entry 加到 DESIGN.md Decisions Log
- [ ] 9.2 CHANGELOG.md 加 `## v3.0.0 - Layout Refactor (2026-05-xx)` entry 概述 Phase 2-5
- [ ] 9.3 README.md 更新「Layout 結構」section 反映新 IA
- [ ] 9.4 `tp-claude-design` skill 的 `trip-planner-overrides.md` 若有改動同步

## 10. Monitoring

- [ ] 10.1 Sentry release mark `layout-v3-2026-05-xx`
- [ ] 10.2 Sentry error rate baseline 設 threshold alert
- [ ] 10.3 daily-check 驗 /manage, /trip/:id, /explore routes 皆 200
- [ ] 10.4 Telegram 通知渠道 smoke test

## 11. Ship

- [ ] 11.1 Full Playwright E2E matrix green
- [ ] 11.2 Lighthouse CI green
- [ ] 11.3 Bundle size gate pass
- [ ] 11.4 `/tp-team` full pipeline
- [ ] 11.5 Staging → prod ship
- [ ] 11.6 Post-ship 監控 24h（Sentry / daily-check 無異常）
- [ ] 11.7 合進 master + push
