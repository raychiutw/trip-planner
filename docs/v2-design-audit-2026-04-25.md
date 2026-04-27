# V2 Design Audit — 2026-04-25

Side-by-side comparison of every V2 page on prod against the canonical mockups
in `docs/design-sessions/`. Desktop (1280×800) AND mobile (375×812).

**Status legend:**
- ✅ Aligned — matches mockup
- 🟡 Partial — visual aesthetic correct, structure differs
- 🔴 Gap — needs follow-up work
- ⏭ Deferred — Phase 3 / out of V2 scope

**Theme baseline (verified on prod after V2 Terracotta pivot):**
- accent: `#D97848` ✓
- bg: `#FFFBF5` ✓
- fg: `#2A1F18` ✓
- meta theme-color: `#D97848` ✓

---

## Auth pages — prod uses standalone scoped layout, mockups use AppShell-wrapped layout with right hero pane

| Page | Desktop | Mobile | Mockup target |
|------|---------|--------|---------------|
| /login | ✅ split-screen + brand hero (#318) | ✅ single-column | mockup-login-v2.html |
| /signup | ✅ split-screen + brand hero (#319) | ✅ single-column | mockup-signup-v2.html |
| /login/forgot | ✅ split-screen + brand hero (#319) | ✅ single-column | mockup-forgot-v2.html |
| /auth/password/reset | ✅ split-screen + Final Step hero (#319, form view) / single-column (invalid + success view) | ✅ single-column | (V2 design language) |
| /signup/check-email | ✅ split-screen + Almost there hero (#319) | ✅ single-column | (V2 design language) |

**Common gaps across all auth pages:**

1. 🟡 **No AppShell wrapping.** Mockups (login/signup/forgot) all show auth pages
   inside the AppShell with sidebar visible (`聊天 / 行程 / 地圖 / 探索 / 登入`)
   and right-side terracotta brand hero pane. Prod renders auth as standalone
   centered cards. Aesthetic (cream + terracotta CTA + warm dark text) is
   already aligned via tokens.css; only the structural shell is missing.
2. 🔴 **No right-side brand hero on desktop.** Mockup desktop has a 40vw
   right pane with terracotta gradient + tagline "把每次旅程留在身邊" /
   "ACCOUNT RECOVERY 5 分鐘搞定" / per-page brand reinforcement.
3. 🟡 **Top step indicator missing** on multi-step flows (forgot→check-email,
   signup→check-email). Mockup shows `STEP 1 / 2` chip in card header.

**Auth-specific fixes applied this PR:**

1. ✅ **Google login graceful fallback** (`LoginPage.tsx`): button is now hidden
   until `/api/public-config` confirms `GOOGLE_CLIENT_ID` env is set. New
   `functions/api/public-config.ts` endpoint exposes `{ providers: { google },
   features: { passwordSignup, emailVerification } }`. Per user direction
   "沒有 google 沒關係 先開放自建帳號".
2. ✅ **Self-registration flow promoted.** The "沒有帳號? 建立帳號" link is now
   above the CF Access fallback so the primary path is unmistakable.
3. ✅ **CF Access transition link demoted** — moved below the signup link so the
   V2 self-signup is the obvious primary action.

**Auth-specific follow-ups (P2):**

1. ⏭ Wrap `/login`, `/signup`, `/login/forgot`, `/auth/password/reset`,
   `/signup/check-email` in `AppShell` so unauthenticated users see the same
   sidebar + chrome as logged-in. Sidebar already supports `user: null`.
2. ✅ **DONE in #318 + #319.** Desktop `<aside>` right-pane brand hero added
   to login/signup/forgot/reset/check-email. Shared via
   `src/components/auth/AuthBrandHero.tsx`. LoginPage still inlines the
   pattern — folding into shared component is a future cleanup PR.
3. ⏭ Add `STEP 1/2` indicator chips on the forgot→check-email flow.

---

## Trip page (`/trip/:id`) — biggest IA mismatch

**Desktop:** 🔴 mockup-trip-v2.html shows a `/trips` LANDING page with a card
grid of all user trips (沖繩之旅 / 首爾美食行 / 台中週末小旅), each rendered as
a peach-gradient card. Right pane shows the selected trip's day chips + stop
list. Header is just `我的行程` with sort/filter chips.

Prod `/trip/:id` is the trip-DETAIL view — a 3-pane shell with day-grouped
timeline in the center column and a placeholder right pane saying
`行程已顯示在左側`. There's no parent `/trips` index page at all; the user
arrives via deep link (`/trip/okinawa-trip-2026-Ray`).

**Mobile:** 🟡 prod renders the timeline cleanly with day chips at the top,
similar in spirit to the mobile mockup, but lacks the gradient day pills and
the floating bottom action bar from the mockup.

**Trip-specific gaps:**

1. 🔴 **No `/trips` landing page.** Mockup desktop is a "my trips" overview
   that doesn't exist in prod. Click into a trip → see the detail view.
   Currently we go straight to detail, no grid step.
2. 🔴 **No gradient trip cards.** Mockup shows each trip as a peach/amber/teal
   warm-gradient card with title + days. Prod has no card surface for trips.
3. 🟡 **Right pane is placeholder text.** Mockup shows trip days breakdown +
   stop list in the right pane; prod shows static "行程已顯示在左側" copy.
4. 🟡 **Mobile bottom action bar.** Mockup shows a floating `+` CTA + day pill
   filter row pinned to bottom. Prod has the BottomNavBar (route nav) instead.

**Trip-specific follow-ups (P2/P3):**

1. ⏭ Build `/trips` landing page (`TripsListPage`) with peach-gradient card
   grid. Re-route default landing from `/trip/:default` to `/trips`.
2. ⏭ Right pane: render selected day's stop summary instead of placeholder.
3. ⏭ Mobile: add the bottom action sheet pattern from mockup-trip-v2 mobile.

---

## Explore page (`/explore`)

**Desktop:** 🔴 mockup-explore-v2.html shows a 2×3 grid of POI cards with
full-color gradient backgrounds (teal / peach / blue / orange / green / brown
— POI category palette). Right pane shows the selected POI detail.

Prod `/explore` is functional but plain: title + description + search bar +
empty `儲存池 0 個已儲存 POI`. No card grid. No right pane.

**Mobile:** 🟡 prod mobile is essentially the desktop content stacked. Mockup
mobile has the same card grid layout in single-column.

**Explore-specific gaps:**

1. 🔴 **No POI card grid** with gradient surfaces.
2. 🔴 **No POI category palette.** Mockup uses 6 distinct hues for category
   badges; prod has none.
3. 🟡 **Empty-state UX.** Prod's empty state ("還沒有儲存任何 POI…") is bland;
   mockup uses an empty state with category cards prompting exploration.

**Explore follow-ups (P3):**

1. ⏭ Add POI card grid component with gradient backgrounds keyed to category.
2. ⏭ Right-pane POI detail view.
3. ⏭ Improved empty state with category prompts.

---

## Settings pages (`/settings/*`, `/developer/apps`) — no mockup; align to V2 shell

| Page | Desktop | Mobile | Notes |
|------|---------|--------|-------|
| /oauth/consent | ✅ form-based POST, terracotta CTA | ✅ same | recently rewritten in /review pass |
| /settings/connected-apps | ✅ AppShell wrap | ✅ AppShell wrap (sidebar hidden by media query) | this PR |
| /developer/apps | ✅ AppShell wrap | ✅ AppShell wrap | this PR |
| /settings/sessions | ✅ AppShell wrap | ✅ AppShell wrap | this PR |

**Settings follow-ups:**

1. ✅ **DONE this PR.** ConnectedAppsPage / DeveloperAppsPage / SessionsPage
   wrapped in `AppShell` with `<DesktopSidebarConnected />` so logged-in user
   sees sidebar nav + account chip on every settings route.
2. ⏭ Add page-level breadcrumb / "← 帳號設定" back link pattern. Sidebar
   highlighting on `/settings/sessions` falls back to nearest match
   (「已連結應用」) since there's no sessions-specific nav item — minor polish.

---

## Shell components — sidebar visible, header/sheet structure differs

### DesktopSidebar (`src/components/shell/DesktopSidebar.tsx`)

✅ Cream background (matches mockup `--sidebar-bg: #FFFBF5`)
✅ Brand "Tripline" + terracotta accent dot
✅ Active state: dark cocoa bg + cream text
✅ "新增行程" CTA in terracotta
🟡 Mockup spacing is slightly tighter — prod uses 12px sidebar padding, mockup
   uses 14px. Minor.
✅ `comingSoon` flag hides 聊天/地圖 from nav until Phase 3 implements them
   (per `mockup-chat-v2` / `mockup-map-v2` design exists but build deferred).
   **Login is NOT hidden** — it stays visible per user direction.

### BottomNavBar (mobile, `src/components/shell/BottomNavBar.tsx`)

✅ 4-tab IA (`行程 / 地圖 / 訊息 / 更多`) per CLAUDE.md
🟡 Mockup shows a wider rounded action bar with floating `+` button; prod is
   flatter sticky bar. Functional parity but visual treatment differs.

### Header (page-level, varies per page)

🔴 Mockup shows a uniform top header bar with breadcrumb / page title +
   secondary actions chip row. Prod has page-specific headers (TripPage shows
   day chip nav, ExplorePage shows just title + description).
🔴 No persistent top "tabs" pattern (mockup signup shows `新增 / 登入 / 已登錄帳號`
   tabs). Prod treats /login and /signup as separate routes without that
   shared header.

---

## Per-page polish items (small CSS-only fixes feasible later)

| File | Issue | Fix | Status |
|------|-------|-----|--------|
| `src/pages/LoginPage.tsx` | CF Access fallback link | removed (V2 cutover, this PR series) | ✅ done |
| `src/pages/SignupPage.tsx` | "至少 8 字元" hint right-aligned — mockup has it inline-after | minor copy reflow | ⏭ |
| `src/pages/ExplorePage.tsx` | Empty state container has 360px min-height — feels weighty | tighten to fit content | ⏭ |
| `src/components/shell/DesktopSidebar.tsx` | Sidebar padding `20px 12px` — mockup uses `20px 14px` | bump 12 → 14 | ⏭ |

---

## Scoring

| Category | Grade | Notes |
|----------|-------|-------|
| Color & Theme | A | Terracotta token migration complete, warm shadows, semantic colors aligned. |
| Typography | B+ | Inter + Noto Sans TC, headings warm dark brown. Mockup uses slightly heavier display weights on hero pages. |
| Spacing & Layout | B | Tokens consistent. AppShell on auth pages would lift this to A. |
| Visual Hierarchy | B | Auth pages clean, but trip page right pane is placeholder + missing card grid hurts hierarchy. |
| Interaction States | A- | Hover / focus / disabled all reasonable; locked-out countdown is a delight. |
| Responsive | B+ | Mobile auth pages strong, trip page mobile works but doesn't match mockup's bottom action sheet. |
| Content & Copy | A- | Friendly, specific, error states named. Empty states could be warmer. |
| Motion | B | Sheet animations + toast slide tokens defined; auth pages don't use them. |
| Performance Feel | A | TTFB ~96ms on prod /, no FOUT, font-display: swap. |
| AI Slop | A | Zero generic SaaS patterns. Custom palette, branded shell, no purple gradient. |

**Overall design score: B+ (was C before terracotta pivot, was D before V2 layout pivot).**

**AI slop score: A (single-theme intentional terracotta system; no symmetrical 3-column generic SaaS layout; warm brown shadows are specific and rare).**

---

## Quick wins applied this PR

1. ✅ `/api/public-config` endpoint added — backend signal for "is Google
   configured" so frontend can hide buttons.
2. ✅ `LoginPage` Google button gated on the public-config probe.
3. ✅ Footer link `沒有帳號? 建立帳號` promoted above the CF Access fallback.
4. ✅ Audit document (this file) lists every gap with status + follow-up tag.

## Follow-ups in priority order (P1 → P3)

| Priority | Item | Estimated CC time | Status |
|----------|------|------|--------|
| P1 | Wrap auth pages in AppShell so sidebar visible to anonymous users | ~30min | ⏭ deferred — anonymous click on sidebar nav causes redirect-bounce; not worth UX cost without disabling-while-anon polish |
| P1 | Add `<aside>` desktop right-pane brand hero to login/signup/forgot | ~45min | ✅ #318 + #319 (5 pages, shared `AuthBrandHero` component) |
| P2 | `/trips` landing page with peach-gradient trip cards | ~60min | ✅ this PR — `TripsListPage` wired at `/trips`, JP/KR/TW/other gradient covers |
| P2 | Right pane on `/trip/:id` shows selected day's stop summary | ~30min | ✅ already shipped — `TripSheet` (itinerary/ideas/map/chat tabs) replaced placeholder before this audit was written; audit claim was stale |
| P2 | Wrap `/settings/*` and `/developer/*` in AppShell | ~20min | ✅ this PR — connected-apps + developer/apps + settings/sessions wrapped |
| P3 | `/explore` POI card grid with category-keyed gradients | ~90min | ⏭ deferred to dedicated explore-redesign sprint (also needs right-pane POI detail + improved empty state) |
| P3 | Implement `/chat` (LLM concierge) — mockup-chat-v2 design exists | several days | ⏭ pending |
| P3 | Implement `/map` (cross-trip global map) | ~2 days | ⏭ pending |

---

## Screenshots

All comparison screenshots saved to `.gstack/design-shots/`:
- `prod-d-{login,signup,forgot,reset,check-email,consent,explore,trip}.png` — desktop
- `prod-m-{login,signup,forgot,reset,check-email,consent,explore,trip}.png` — mobile
- `mock-d-{login,signup,forgot,trip,explore}.png` — mockup desktop
- `mock-m-{login,signup,forgot,trip,explore}.png` — mockup mobile
