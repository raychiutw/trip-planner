<!-- /autoplan restore point: /c/Users/Ray/.gstack/projects/raychiutw-trip-planner/master-autoplan-restore-20260323-222145.md -->
## Why

四個頁面（行程頁、設定頁、管理頁、Admin 頁）的 CSS 風格不一致：頁面寬度用了四種不同的 max-width（720px/520px/900px/600px）、sticky-nav 在每個頁面各自重複定義、捲動重置 code 在 setting.css 和 admin.css 重複、行程頁有毛玻璃效果但其他頁面沒有、padding-top 和 nav 標題對齊也不統一。需要統一設計語言。

## What Changes

- 定義 `--page-max-w` token，所有非行程頁共用同一個 max-width
- 抽出 `.page-simple` 共用 class，統一 setting/admin/manage 的捲動重置
- 統一 sticky-nav 樣式：所有頁面用相同的 border 和 backdrop-filter
- 統一 desktop padding-top
- 統一 nav 標題對齊方式
- 移除各頁面重複的 `.sticky-nav` 定義
- 統一深色模式 sticky-nav 基礎樣式到 shared.css（行程頁保留特殊 accent-foreground 覆寫）

## Capabilities

### New Capabilities
- `page-layout-tokens`: 定義跨頁面共用的 layout token（max-width、padding-top）和 `.page-simple` class

### Modified Capabilities

## Impact

- `css/shared.css` — 新增 `--page-max-w` token + `.page-simple` class + 統一 sticky-nav
- `css/setting.css` — 移除重複的捲動重置和 sticky-nav 定義，改用 `.page-simple`
- `css/admin.css` — 同上
- `css/manage.css` — sticky-nav 統一
- `css/style.css` — 行程頁 sticky-nav 保持特殊效果但 base 來自 shared
- `src/pages/SettingPage.tsx` — html class 加 `.page-simple`
- `src/pages/AdminPage.tsx` — 同上
- 不影響 API、D1、功能邏輯

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 1 | CEO | Accept all 3 premises | P6 bias-action | Verified duplication in code; premise 3 (admin wider) is minor visual change | — |
| 2 | CEO | Choose Approach A (token + .page-simple) | P5 explicit + P3 pragmatic | Minimal diff, maximum DRY; Approach B (@layer) overengineered | Approach B |
| 3 | CEO | Mode: SELECTIVE EXPANSION | P1 completeness | Standard choice for focused refactoring with room for cherry-picks | EXPANSION, REDUCTION |
| 4 | CEO | Auto-approve: check if edit.css is dead code | P2 boil-lakes | In blast radius, <1 file effort | — |
| 5 | CEO | TASTE: Dark mode sticky-nav unification | — | Could unify body.dark .sticky-nav across pages; viable but cosmetic | Surfaced at gate |
| 6 | Design | Admin sticky-nav stays position:relative via .page-simple | P5 explicit | Admin is short page, relative was intentional; sticky would be behavior change | Make admin sticky |
| 7 | Design | Clarify --page-max-w is desktop-only (media query) | P1 completeness | Prevents implementer confusion about mobile behavior | — |
| 8 | Eng | .page-simple class on html only (not body) | P5 explicit | Descendant selectors work from html; body class is redundant | Add to both |
| 9 | Eng | E2E via /browse covers test gaps (no CSS unit tests needed) | P6 bias-action | CSS-only; visual verification is the right tool | Write CSS unit tests |
| 10 | Eng | Setting scroll bounce is #1 regression risk | P1 completeness | Documented known issue; .page-simple must preserve all 7 scroll reset props | — |
| 11 | Gate | Add dark mode sticky-nav to scope (user override) | User choice | User chose to include dark mode nav unification | Skip dark mode |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAN | 0 unresolved, SELECTIVE_EXPANSION mode |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | CLEAN | 2 improvements (position:relative, desktop media query) |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAN | 8.4/10 avg, 2 fixes applied |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | unavailable | — |

**VERDICT:** APPROVED via `/autoplan` — 11 decisions (10 auto + 1 user override: dark mode nav added to scope). Ready for implementation.
