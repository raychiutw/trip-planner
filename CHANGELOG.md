# Changelog

All notable changes to Tripline will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [2.14.0] - 2026-04-26

**PR-O: 帳號頁簡化 + sidebar 管理 → trip 共編 IA 重組（V2-P7）**。User 指示 IA：「只保留帳號，登出移到最下方，原 sidebar 管理功能移到行程內做共編功能；一般帳號針對自己行程設定共編，admin 帳號可以對所有行程設定共編。」

### Added
- **`CollabSheet` component**（`src/components/trip/CollabSheet.tsx`）— 每個 trip 在 OverflowMenu 「更多 → 共編設定」 點開的 sheet。提供已授權成員 list + 新增 email + 移除 perm。reuse `usePermissions` hook + `apiFetchRaw` POST/DELETE。
- **`group` icon**（`src/components/shared/Icon.tsx`）— Material 風格人群 SVG，用於共編入口（OverflowMenu + ACTION_MENU_GRID）。
- **`'collab': '共編設定'`** 加入 `SHEET_TITLES` 與 `OVERFLOW_ITEMS`（settings group）+ `ACTION_MENU_GRID`（mobile bottom-nav 「更多」 sheet 顯示）。
- **`tests/unit/collab-sheet.test.tsx`** — empty tripId placeholder + populated load + add POST → reload 三個 smoke case。

### Changed
- **API: `/api/permissions` GET/POST/DELETE 從 admin-only 放寬為 admin OR trip owner**。新 helper `ensureCanManageTripPerms(context, auth, tripId)` 在 `permissions.ts` export，DELETE 端反查 `record.trip_id` 後驗證。一般 user 可管自己 owner 行程的共編；admin 仍對所有行程有權。
- **`SessionsPage` (帳號頁) 簡化** — heading 從「帳號設定 / 裝置管理、深淺模式與登出」 改為純「帳號 / {email}」。`.tp-account-actions` 中段 block 移除，改為 `.tp-account-footer` block 放在頁面**最下方**（device list + info banner 之後），裡面是深淺模式 toggle + 登出按鈕。
- **`DesktopSidebar` 拿掉「管理」 nav item** — `NAV_ITEM_MANAGE` const 移除，`isAdmin` prop 標 `@deprecated`（保留以避免 ConnectedSidebar 端 break）。

### Removed
- **`src/pages/AdminPage.tsx`** — admin 共編管理已搬進 CollabSheet，整檔刪除。
- **`tests/unit/admin-page.test.tsx`** — 對應 AdminPage 的 8 個 test 整檔刪除（被新 collab-sheet.test.tsx 3 個 case 替代，net -5 tests）。

### Deprecated
- `/admin` route → `Navigate to="/trips" replace`。typeing /admin 在 URL bar 會跳到行程列表（admin 從各 trip 的 OverflowMenu 進共編 sheet）。
- Cloudflare Access policy sync code（`addEmailToAccessPolicy` / `removeEmailFromAccessPolicy`）— V2-P6 cutover 後 CF Access 已移除，這些 best-effort sync 對非 admin 來說 env vars 不存在會 silent fail，無影響但屬 dead code。下個 sweep 可清。

### Internal
- `tests/unit/desktop-sidebar.test.tsx` — admin nav item 測試從「應該看到」改為「也不再看到」。
- `tests/unit/overflow-menu-divider.test.tsx` — 第三個 divider index 7 → 8（settings group 多 collab 一項）。
- `tests/unit/quick-panel.test.js` — OVERFLOW_ITEMS length 11 → 12，expected keys 加入 `'collab'`。
- verify gate: tsc clean / functions tsc clean / 122 files / 1026 tests pass / 53 API files / 525 API tests pass。

### 後續可加
- CollabSheet 加 role 切換（owner / editor / viewer）— 目前一律 'member'。
- CollabSheet 加擁有者標示（顯示 `trip.owner` 跟 trip_permissions list 區分）。
- CollabSheet 加離開行程按鈕（user 自己離開）— 目前只有 owner/admin 可移除別人。
- AdminDashboard 全 trip 視角（admin only）— 目前 admin 只能進單個 trip 的 collab sheet，沒有 cross-trip 視圖。

## [2.13.3] - 2026-04-26

**PR-N: 剩下 7 項 anti-slop HIGH 修正（hex hardcode → tokens, decorative emoji → Icon）**。User 直接也修指示，audit 9 項裡 PR-M 已清 3 項，本 PR 清剩 6 項 HIGH（IdeasTabContent / OceanMap / DayNav / TripsListPage / EntryActionPopover / InlineAddPoi）。

### Internal
- **`css/tokens.css`** — 新增 8 個 trip cover token（`--color-cover-{jp,kr,tw,other}-{from,to}`）含 light + dark 兩套；無 visual 改動，純把 hex 從 component code 抽出來。
- **DayNav.tsx** — 3 處 `color: #fff` → `var(--color-accent-foreground)`（active state day chip 文字 + weather chip + date label）。dark mode 自動 invert（accent-foreground 在暗色變 deep-cocoa）。
- **OceanMap.tsx** — pin active state `border-color: #fff; color: #fff` → token；polyline idle color `'#94A3B8'`（slate-400 cool grey）→ `'var(--color-line-strong, #C8B89F)'`（warm 跟 brand 對齊）。
- **IdeasTabContent.tsx** — danger button hover `#dc2626` → `var(--color-destructive)`，跟 `--color-warning` `--color-success` semantic 一致。
- **TripsListPage.tsx** — 4 個 `.tp-trip-cover-{jp,kr,tw,other}` gradient 改用新 cover token；2 處 `color: #fff` → `var(--color-accent-foreground)`。
- **EntryActionPopover.tsx** — `<p>⚠️ {pendingHint}</p>` → `<p><Icon name="warning" /><span>{pendingHint}</span></p>`，emoji 換 Icon system 既有 `warning` SVG。CSS `.tp-action-pending-note` 加 flex layout 對齊 icon。
- **InlineAddPoi.tsx** — `🤖 AI 幫我找` → `<Icon name="sparkle" />` + text；`✏️ 自訂景點` → `<Icon name="edit" />` + text。chip CSS 加 `.svg-icon` size。

### Anti-slop audit 進度
- HIGH 9 項：✅ 全清（PR-M 3 + PR-N 6）
- MED 1 項：DayArt.tsx 42 hex 待 PR-O 帶（決定要不要 SVG path color 也走 token，scope 較大）

### Verify gate
- tsc clean / 122 files / 1031 tests pass

## [2.13.2] - 2026-04-26

**PR-M: NewTripModal proof banner 移除 + emoji 清 + 底部 viewport 不被遮（QA round 4 + anti-slop sweep）**。User 截圖 2 點 + anti-slop audit 同檔 3 項一次帶。

### Removed
- **Hero social proof banner** — `.tp-new-hero-proof` JSX + CSS + `DEFAULT_TOTAL_TRIPS=1247` constant + `formatTripCount` helper + `totalTrips` prop。fake-stat anti-slop（「1,247 個行程已在 Tripline 上分享 / 平均規劃時間 8 分鐘」沒實際資料來源）+ user 截圖確認 mobile hero 太擠。
- **目的地 input 📍 emoji** — `.tp-new-dest-pin` span + 對應 padding-left 44px hack。anti-slop emoji 濫用（label「目的地」+ placeholder 已能清楚定位用途）。
- **月份 carousel emoji** — `MONTH_ICONS = ['❄️', '🌸', ...]` array + `MonthChoice.icon` field + `<span className="icon">` JSX。anti-slop emoji 濫用（月份數字本身已是強 semantic indicator，季節 emoji 是裝飾性 noise）。

### Fixed
- **Mobile modal 底部被 viewport / iOS home indicator 遮住** — `.tp-new-modal` 加 `max-height: calc(100dvh - 32px)`（dvh 對應 Safari URL bar 動態高度），`.tp-new-form` 改 `overflow-y: auto` + `min-height: 0` + `padding-bottom: max(24px, env(safe-area-inset-bottom, 24px))`。grid child `min-height: 0` 是讓 max-height 約束生效的關鍵（grid 預設 min-height auto 會撐爆）。

### Internal
- 對應 anti-slop audit 第 1、2、5 項（emoji 月份 / 📍 / fake stat）一次清，剩 6 項（PR-N 處理）。
- `.tp-new-flex-month .m` font-size: footnote → callout（emoji 拿掉後月份文字單獨 carry，需放大維持視覺權重）。
- `tests/unit/new-trip-modal.test.tsx` 兩個 social proof 測試改寫：`renders hero pane with eyebrow + headline copy` + `hero pane no longer renders social proof banner`。
- verify gate: tsc clean / 122 files / 1031 tests pass。

## [2.13.1] - 2026-04-26

**PR-L: /map 手機控制條微調 + marker click 顯示 POI 卡（QA round 3）**。User 標註截圖三個改動。

### Fixed
- **左下「全覽 / 我的位置」 pill bar** — mobile `.tp-global-map-actions` `bottom: 130px → 100px`，再往下靠 carousel 上緣 30px，視覺更緊湊不浪費空白。
- **右下 zoom 控制移到右上** — `<OceanMap zoomControlPosition="bottomright" />` → `topright`，避開手機底部 carousel + pill bar 區的擁擠，與 Apple Maps / Google Maps 手機版習慣一致。
- **點 marker 沒顯示 POI 資訊** — mobile（<1024px）desktop sheet pane 隱藏，原本 marker click 等於沒效果。新增 `.tp-global-map-mobile-poi` 浮動卡 render 在 carousel 上方（`bottom: 152px`），含 close 按鈕、`STOP NN` eyebrow、title h3、type/time/rating chips、`跳到行程 →` CTA。

### Internal
- 純 CSS 位移 + 一個 prop 改值 + 一個 JSX block + 對應 mobile-only CSS。desktop ≥1024px 行為 0 改動（sheet pane 維持）。
- 卡片 close 按鈕同時清掉 `selectedPinId`，與 marker 再次點擊行為一致。
- verify gate: tsc clean / 122 files / 1031 tests pass。

## [2.13.0] - 2026-04-26

**PR-K: 聊天訊息時間 + Timeline 拖拉排序 + iOS-style grip icon（3 個 feature）**。Round 2 user feedback 三個 feature 合一個 PR。

### Added
- **Chat 訊息時間** — `ChatMessage` 加 `createdAt?: string`，`rowToMessages` 從 `created_at`/`updated_at` 帶入。每個 bubble 下方 render `<time>` 元素：`HH:mm`（同日）或 `MM/DD HH:mm`（跨日）。font-size caption2 + muted color，user 對齊 right、assistant 對齊 left。
- **Timeline stop 拖拉排序** — `TimelineRail` 包 `DndContext` + `SortableContext`，每 row 用 `useSortable`。drag end → optimistic local order override + Promise.all PATCH 每個 entry 的 `sort_order = 新 index` → dispatch `tp-entry-updated` → refetch 拿 backend authoritative order。失敗 revert override。
- **`grip` icon (iOS-style)** — `Icon` registry 加 3 條水平線 icon（Apple Reminders/Lists drag affordance）。stroke-width 2 + linecap round。`.ocean-rail-grip` 32×32 button 在 row 左側 dot 旁，cursor grab/grabbing，hover accent，`touch-action: none` 阻止瀏覽器 swipe 接管。

### Internal
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` — 已在 deps，無新 dep。
- `useSortable({ id: entry.id, disabled: entry.id == null })` — 沒儲存的 row（local-only）不可拖。
- `PointerSensor` activation distance 8px — 避免誤觸 toggle expand。
- 拖拉 handle 跟 row click area 完全分離（grip button vs row button），無 click 衝突。
- verify gate: tsc clean / 122 files / 1031 tests pass。

### 後續可加
- Cross-day drag（拖到別天） — 目前 only same-day reorder。需要 day boundary drop targets 或 keyboard fly-to-day。
- Drag preview / overlay — 目前用 dnd-kit 預設 transform，可加 DragOverlay 顯示「拖拉中」 visual。
- Sort_order PATCH batching — 目前 N 個 entry N 個 PATCH，可加 bulk endpoint `/entries/reorder` 一次完成。

## [2.12.10] - 2026-04-26

**QA round 2 PR-J：TripPage mobile day-strip clip + 看地圖 chip 移除（2 fixes）**。手機 trip 詳情頁兩個 user feedback 改動。

### Fixed
- **手機 day-strip 被 URL bar 切到** — `.ocean-day-strip` mobile 加 `top: env(safe-area-inset-top, 0)` + `padding-top: 8 → 16px`。iOS Safari/Chrome URL bar 跟 sticky day cards 之間有自然 buffer，rounded top corner 不再被視覺切。
- **每日 hero「📖 看地圖」 chip 移除** — `DaySection.ocean-hero-chips` 拿掉 `<Link to={mapHref}>看地圖</Link>` chip 元素 + `Link` import。bottom nav 已有「地圖」 tab 入口，每天 hero 重複 chip 是 noise。

### Removed
- `tests/unit/day-section-map-link.test.tsx` — 整檔刪。test 是針對「看地圖 chip」 feature 的，feature 拿掉後 test stale。

### Internal
- 純 CSS + 1 JSX block 刪除 + 1 test file 刪除。verify gate: tsc clean / 122 files / 1031 tests pass（−4 stale tests）。
- `MAP_CHIP_STYLES` 內的 `.day-map-chip` CSS 留著（其他地方未必用，留 fallback；下個 sweep 可清）。

## [2.12.9] - 2026-04-26

**QA round 2 PR-I：/map mobile redesign per user feedback（4 changes）**。手機 /map QA 截圖 4 個 explicit 改動 — 化繁為簡。

### Fixed (per user mobile screenshot directives)
- **Header 簡化**：拿掉「Global Map」 eyebrow + `${pins} stops · ${days} days` meta，只留 trip dropdown。資訊在 sheet overview (PR-G) 已重複，header 太擠。
- **Mobile carousel 拿掉 eyebrow + title** — 「● 沖繩五日 · DAY 01 · 7 STOPS」 + 「點 marker 看詳情」 caption 重複又佔垂直空間，刪除。
- **Cross-day continuous scroll**：carousel 從 single-day filter 改 flatten 全部 pins。Day 1 最後 stop → Day 2 第一 stop 直接接續滑換。每 card eyebrow 加 `D{dayNum}·` prefix 標示所屬 day。
- **Active card border = `dayColor(dayNum)`**：active 卡片 border + 軟 box-shadow 用該 day 的 polyline 顏色。inactive 卡片 left-border 3px 同色 hint 該 stop 屬哪天。
- **Pill bar 往下靠**：mobile bottom 240 → 130（carousel 縮短後距離拉近）。
- **OceanMap cluster 完全 disable**（user 更正：「移除 cluster」）— `<OceanMap cluster={false} />` 在 GlobalMapPage 直接關掉 supercluster。每個 stop 顯示為個別 pin，無數字 bubble。`.ocean-map-cluster` styling 留 fallback（其他頁若再開可用），改 white bg + `line-strong` border 視覺。

### Removed
- `carouselDay` useMemo — cross-day flatten 後不再需要 single-day filter。

### Internal
- 純 JSX + CSS。verify gate: tsc clean / 1035 tests pass。
- mockup `/tmp/tripline-mockup-poi-edit.html` 沒 mobile carousel spec — 此 PR 依 user 直接 feedback（screenshot annotations）為 ground truth。
- 後續可加 unit test（cross-day carousel render + dayColor border）— 目前 GlobalMapPage 無 test 檔。

## [2.12.8] - 2026-04-26

**QA fix series PR-H: Supercluster radius tweak（2 issues）**。Map cluster bubble overlap in dense areas — bump radius 60→80 + maxZoom 15→16。

### Fixed
- **BUG-042 / 043 cluster overlap** — `OceanMap` `new Supercluster({ radius: 60, maxZoom: 15 })` → `{ radius: 80, maxZoom: 16 }`。dense areas（沖繩本島、東京）cluster 更 aggressive 避免疊在一起，user zoom in 一級拆開細節。

### Internal
- 1 行 config tweak。verify gate: tsc clean / 1035 tests pass。
- supercluster docs: https://github.com/mapbox/supercluster — radius default 40，maxZoom default 16。我們之前 60/15 太鬆。

## [2.12.7] - 2026-04-26

**QA fix series PR-G: /map default sheet content（2 issues）**。`/map` 桌機 right sheet pane 沒選 pin 時 99% 空白只有「點 marker」hint — 改成 trip overview（trip 名 + meta + day list with first-stop preview，每 day row 可點直接 setSelectedPinId 到該天首 pin）。

### Fixed
- **BUG-044 / 045 default sheet content** — `selectedPin == null && resolved` 時 render `.tp-global-map-sheet-overview`：
  - **header**：trip 名（title2）+ `${pins.length} stops · ${pinsByDay.size} days` meta
  - **day list**：每 day swatch dot（`dayColor(N)`）+ eyebrow `DAY 0X · N stops` + first-stop title preview。整 row click → `setSelectedPinId(pins[0].id)` 跳到該天第一個景點
  - **bottom hint**：「點地圖上的 marker 看單一景點詳情，線段是真實導航路線」 提示卡（`--color-secondary` bg）
  - 既有 「無 trip / 沒選 trip」 empty state 不變

### 暫緩到 PR-G2/G3
- BUG-005 right sheet auto-scroll — 需 PO 確認進入 trip 後預設 scroll 到 top 還是 active day
- BUG-008 警告卡文案 — 「美國村可能早於 AEON 北谷店 營業時間」 logic 需 PO 看
- BUG-009 trip embedded mode share — 需 share button design + URL pattern
- BUG-028 native date picker — 大 feature（custom datepicker library / build）
- BUG-042/043 map cluster overlap — Leaflet supercluster radius config 深調
- BUG-046 全覽/我的位置 + zoom 控制位置 — UX 決策需 user 確認

### Internal
- 純 JSX + CSS。verify gate: tsc clean / 1035 tests pass。
- 未加 unit test — `tests/unit/global-map-page.test.tsx` 不存在。可以後續補（new test 確認 default sheet renders + day click triggers）。

## [2.12.6] - 2026-04-26

**QA fix series PR-F: misc polish（4 issues）**。Theme toggle / month carousel / emoji alignment / mobile card title tooltip — 一輪 polish 收尾。

### Fixed
- **BUG-006 ThemeToggle active state** — pressed button 從 `shadow-sm` 升 `shadow-md + inset 1.5px accent border + accent-deep color`，跟 NewTripModal segmented (PR-B) 一致。
- **BUG-031 month carousel right-fade mask** — `.tp-new-flex-months` 加 28px gradient mask + 同 PR-A DayNav / PR-D mobile carousel pattern。
- **BUG-032 month emoji alignment** — `.tp-new-flex-month .icon` 從 16 → 18px + `display: block` + `height: 18px` 強制 baseline 對齊（active state 不偏移）。
- **BUG-037 mobile carousel title tooltip** — `.pc-title` 加 `title={pin.title}` HTML attribute，long names truncated 後 hover 看 full text。

### 暫緩
- BUG-022 popover heading z-index — 經分析非可重現 issue，skip。
- BUG-023 popover backdrop — mockup 規範無 backdrop，skip per mockup directive。
- BUG-036 mobile day strip mask — PR-A 已加（DayNav 桌機 + mobile 共用同 CSS），skip。

### Internal
- 純 CSS + 1 JSX attribute。verify gate: tsc clean / 1035 tests pass。

## [2.12.5] - 2026-04-26

**QA fix series PR-E: formatDuration 中文化（2 issues）**。Timeline rail / map carousel / lightbox 等多處共用 `formatDuration` helper，從 raw 「30m」「1h 30m」 改成中文「30 分鐘」「1 小時 30 分」 — 一處改 cover 4+ 顯示位置。

### Fixed
- **BUG-038 / 048 formatDuration i18n** — `src/lib/timelineUtils.ts` 改回傳：
  - 純分鐘：`${m} 分鐘`（例：30 → "30 分鐘"）
  - 純小時：`${h} 小時`（例：60 → "1 小時"）
  - 組合：`${h} 小時 ${m} 分`（例：90 → "1 小時 30 分"，組合場景去「鐘」更精簡）
- **`tests/unit/timelineUtils.test.ts`** — 4 個 case 同步更新預期值。

### 暫緩到 PR-E2
- BUG-008 警告卡 logic 「美國村可能早於 AEON 北谷店 營業時間（食品區 ~24:00）」 — 文案邏輯需 product owner 確認後才動 wording。

### Internal
- 無 component 改動 — pure helper signature 保持，只改實作。verify gate: tsc clean / 1035 tests pass。

## [2.12.4] - 2026-04-26

**QA fix series PR-D: Mobile map carousel + pill bar + trip switcher caret（3 issues）**。手機 /map 頁的 carousel overflow 視覺暗示、pill bar 跟 carousel 距離、trip switcher dropdown affordance — 三個 CSS-only fix。

### Fixed
- **BUG-039 mobile carousel right-fade mask** — `.tp-global-map-mobile-cards` 加 28px gradient mask 暗示「還有 stop 可水平滑」，比照 PR-A DayNav pattern。
- **BUG-040 pill bar 距離 carousel 加 gap** — mobile `.tp-global-map-actions` 從 `bottom: 220px` → `240px`，給 pill bar 跟 carousel 之間更明顯氣口（碰觸 risk↓）。
- **BUG-041 / 047 trip switcher caret affordance** — `.tp-global-map-trip-btn .caret` 從 12px / muted → 14px / accent / weight 700。「▾ 是 dropdown」 視覺權重出來。

### 暫緩到 PR-D2（cluster + default sheet content）
- BUG-042 cluster overlap：需要動 supercluster radius / map zoom config，比 CSS fix 大
- BUG-044 / 045 default sheet 99% 空白：需要新 component（trip overview / day stops list）+ 路由邏輯
- BUG-046 control 兩邊分開：UX 決策需確認後再動

### Internal
- 純 CSS。verify gate: tsc clean / 1035 tests pass。
- mockup `/tmp/tripline-mockup-poi-edit.html` `.mobile-poi-stack` + `.map-action-bar` spec 對齊。

## [2.12.3] - 2026-04-26

**QA fix series PR-C: TimelineRail action row 補齊 mockup 4 個 icon button（1 issue）**。依 mockup spec — 行內 expand 的 action row 應有「⛶ / ⎘ / ⇅ / 🗑 / ✕」5 個 button，prod 只有前 3 個。補完 🗑 + ✕。

### Fixed (per mockup spec)
- **BUG-012 action row 補 🗑 + ✕** — mockup `.actions` 4 個 iconbtn 全部補齊：
  - **🗑 delete**：DELETE `/api/trips/:id/entries/:eid`（既有端點）+ `window.confirm` 確認 + dispatch `tp-entry-updated`。`.is-danger` variant 用 `--color-priority-high-*` tokens 對齊 DESIGN.md semantic colors
  - **✕ collapse**：呼叫 `onToggle()` 把行收闔，pure UI no API
  - 兩個 button 不論單天/多天 always 顯示，跟 ⎘/⇅ conditional on 多天 拆開

### Internal
- 無 test 變動 — 純 JSX + handler，既有 timeline-rail-inline-expand tests 仍 pass。verify gate: tsc clean / 1035 tests pass。
- 註解避坑：SCOPED_STYLES template literal 內註解禁用 backtick（會關閉 string）。

## [2.12.2] - 2026-04-26

**QA fix series PR-B: NewTripModal mockup-aligned polish + PR-A revert（5 issues）**。依 mockup `/tmp/tripline-newtrip-v1-split-hero-v2.html` spec 修 NewTripModal hero/form 的視覺缺漏。同時 retroactively review PR-A — swatch 14px 升級違反 mockup 12px spec，這版復原。

### Fixed (per mockup spec)
- **BUG-026 destination 📍 icon** — 加 `.tp-new-dest-wrap` + `.tp-new-dest-pin` 直接 lift mockup `.dest-input .pin` pattern。Input padding-left 14 → 44 騰出 icon 空間，icon Terracotta accent 色 + `pointer-events: none`。
- **BUG-027 summary 文案** — destination 空時顯示「請先輸入目的地」 取代「未選地點」（後者像 toggle option 而非 prompt）。
- **BUG-029 segmented active state 對比** — 從 `box-shadow: var(--shadow-sm)` 升級成 `var(--shadow-md) + inset 0 0 0 1.5px accent`。color 從 `--color-foreground` 改 `--color-accent-deep`，視覺權重翻倍。
- **BUG-030 stepper 字級** — `.tp-new-flex-num` 從 `--font-size-title` (1.75rem) 升 `--font-size-large-title` (2.125rem)。對齊 mockup `.flex-stepper .num` spec。`min-width` 56→64px 容納大字。

### PR-A retroactive review（per mockup directive）
- **swatch size 復原 12px** — PR-A 為解 BUG-020 visibility 而升 14px 違反 mockup spec。border opacity 從 0.08 → 0.10 增加 contrast，size 維持 mockup 12px。

### Internal
- 無 test 變動 — CSS + JSX visual fix。verify gate: tsc clean / 1035 tests pass。
- `修復時也要遵守 design md 和 mockup html` — user directive 2026-04-26。PR-B 起每個 fix 對 mockup HTML + DESIGN.md 比對後才寫。
- TS template literal 注意 — backtick 在 SCOPED_STYLES 註解內會關閉字串。改用單引號或 plain text。

## [2.12.1] - 2026-04-26

**QA fix series PR-A: sheet overflow root cause（4 issues）**。 prod adversarial QA 抓到 sheet pane 太窄導致 day strip / EntryActionPopover 全 overflow。一個 root cause 解 4 個 HIGH/MEDIUM bug。

### Fixed
- **BUG-002 / 007 sheet width** — `TripsListPage` 3-pane sheet 從 `min(420px, 32vw)` bump 到 `min(560px, 38vw)`。1440px viewport sheet 從 420 → 547，給嵌入的 TripPage day-strip + popover 喘息空間。main pane 從 780 → 653，3-col trip cards 仍 fit。
- **BUG-019 / 021 popover overflow** — `EntryActionPopover` 加 `max-height: min(calc(100vh - 120px), 480px)` + `overflow-y: auto`。「複製到時段」 select 不再被 viewport 截斷，day list 太長時 popover 內 scroll。
- **BUG-002 day strip 視覺暗示** — `DayNav` 加右側 32px linear-gradient mask + 顯示 `webkit-scrollbar` 3px thumb。user 一眼看到「還有 day 可水平捲」 affordance。
- **BUG-020 popover swatch 辨識度** — `.tp-action-swatch` 12px → 14px + 加 `border: 1px solid rgba(0,0,0,0.08)` hairline。day color 在小尺寸下看得更清楚。

### Internal
- 無 test 變動 — CSS-only fix。verify gate: tsc clean / 1035 tests pass。
- QA report 全文 `.gstack/qa-reports/qa-report-prod-2026-04-26-adversarial.md` (49 issues 共 6 個 PR 修)。

## [2.12.0] - 2026-04-26

**v2.10 Wave 3：pois.photos schema + StopLightbox photo carousel（PR6/3，最後一棒）**。
完成 V3 mockup 整合 — POI 詳情頁的「⛶ 放大檢視」 lightbox 從 PR3 的純 placeholder 升級為真實照片 carousel（◀ ▶ + 分頁點 + caption + attribution）。資料 schema + frontend 全完成；populate 照片內容（從 Wikimedia Commons 抓）走後續 admin script 跑。

### Migration
- **`migrations/0038_pois_photos.sql`** — `ALTER TABLE pois ADD COLUMN photos TEXT`。Nullable，JSON-encoded array of `{ url, thumbUrl?, caption?, source?, attribution? }`。
- **`migrations/rollback/0038_pois_photos_rollback.sql`** — `DROP COLUMN photos`（D1 / SQLite 3.35+ 支援）。

### Added
- **`PoiPhoto` type**（`src/components/trip/TimelineEvent.tsx`）— `{ url, thumbUrl?, caption?, source?, attribution? }`。
- **`TimelineEntryData.photos`** 欄位 — `PoiPhoto[] | null`，從 `pois.photos` JSON column parse 而來。
- **`mapDay.parsePhotos()`** 安全解析 — malformed JSON / non-array / 缺 url 的 item 都 fallback null（不 throw）。frontend 可放心 graceful。
- **StopLightbox photo carousel** — `entry.photos.length ≥ 1` 時 render 黑底大圖 + ◀ ▶ nav button + 底部分頁點 + caption + attribution（hyperlink 到 source）。空 / null → 維持原 placeholder。
- **鍵盤導航** — lightbox open + photos 存在時，`←` `→` 切換照片，`Esc` 關閉。
- **單張照片** 自動隱藏 nav button + pager dots（不 redundant UI）。

### Changed
- **API 自動 surface photos** — `functions/api/trips/[id]/days/_merge.ts` 用 `SELECT * FROM pois`，新欄位自動帶到 response。`json()` helper 不會深 parse JSON 字串，frontend 在 mapDay 處理。
- **`RawEntryPoi` interface** 加 `photos?: string | null`。

### Internal
- 新增 `tests/unit/stop-lightbox.test.tsx`（+10 case）：placeholder vs carousel 切換、thumbUrl 優先、caption + attribution + source link、prev/next 環繞、ArrowLeft/ArrowRight 鍵盤、單張隱藏 nav。
- 新增 `tests/unit/map-day-photos.test.ts`（8 case）：valid JSON / NULL / 空字串 / 空陣列 / malformed / object（非陣列）/ 混合 valid+invalid filter / all-invalid。

### 部署順序
1. `wrangler d1 migrations apply trip-planner-db --env preview` — staging 先試
2. PR 預覽 deploy → 開 lightbox 看 placeholder 仍 OK（photos NULL 為常態）
3. `wrangler d1 migrations apply trip-planner-db` — production
4. 驗 prod lightbox 仍 graceful

### Pending（v2.13+ follow-up）
- **`scripts/populate-poi-photos.js`** — Wikimedia Commons API populate script（待寫）：
  - 為每個 POI by name query Commons → 抓 top result image + thumbUrl
  - Rate limit + cache + dry-run mode
  - Cron 每週掃 photos NULL 的 pois
- **User upload flow** — 直接上傳到 R2 + 寫 photos JSON
- **per-entry photo override** — 目前 photos 只在 pois master，未來可加 trip_pois.photos 覆寫

## [2.11.0] - 2026-04-26

**v2.10 Wave 2：InlineAddPoi 接 Nominatim search（PR5/3）**。發現 `/api/poi-search` 端點已經為 ExplorePage 寫好（v2.0 時期），所以 Wave 2 只需要 wire frontend — InlineAddPoi 從 PR3 純 placeholder 改成真實 search + add flow。

### Added
- **InlineAddPoi 真實 search** — 接 existing `GET /api/poi-search?q=&limit=10`（Nominatim proxy + 24h Cloudflare edge cache）。
  - Debounce 250ms（避免每按鍵 fetch）
  - MIN_QUERY_LEN = 2 字元才 fire（< 2 不 fetch）
  - AbortController cancel 前一次 in-flight 請求（避免 race）
  - Loading spinner 在 search input 右側
  - 結果列 max-height 360px scroll
- **InlineAddPoi 真實 Add** — 點 Add → POST `/api/trips/:id/days/:dayNum/entries` body `{ title, poi_type, lat, lng, source: 'user-search' }`。entries 端點內部 findOrCreatePoi 處理 POI master upsert。成功 → dispatch `tp-entry-updated` → DaySection refetch。
- **狀態 indicator** — Add button 「+ 加入」→ 「加入中…」 → 「✓ 已加」（success state，按鈕變成功色）。

### Changed
- **InlineAddPoi 拿掉 PR3 的 placeholder result 列 + disabled「附近 / AI 推薦」 chip** — 真 search 取代後不需要假 chip 占位。「🤖 AI 幫我找」 + 「✏️ 自訂景點」 chip 仍 route /chat 保留 fallback 出口。
- **`mapNominatimCategory()` helper** — Nominatim `class`（tourism/amenity/shop/...）→ Tripline poi_type 白名單（hotel/restaurant/shopping/parking/transport/activity/attraction），對齊 entries POST 的 ALLOWED_POI_TYPES。

### Internal
- `tests/unit/inline-add-poi.test.tsx` 完全重寫（從 9 case → 16 case）：
  - collapsed / expand / close
  - chat fallback chip URL 對
  - search enabled、< MIN_QUERY_LEN 不 fetch、debounce 250ms、cancel 前一次
  - results 渲染、empty hint、upstream error
  - Add → POST entries（URL + method + body 正確 + 含 poi_type mapping）
  - 成功 → dispatch tp-entry-updated + 「✓ 已加」 state、失敗 → error display
- 用 `vi.useFakeTimers()` + `vi.advanceTimersByTime()` 測 debounce — 不依賴真實時間。

### Backend（無改動 — Nominatim proxy 已存在）
- `functions/api/poi-search.ts` 早為 ExplorePage 寫好，沒重做。`Cache-Control: public, max-age=86400` 走 Cloudflare edge cache 24h，無需 KV 設定。User-Agent header `Tripline/1.0 (https://trip-planner-dby.pages.dev)` 已合 Nominatim ToS。
- 規劃中的「server-side rate limit per-user」 暫不做 — Cloudflare edge cache 已能擋掉大部分重複請求，且 Nominatim 的 IP-level rate limit 是上游而非我方責任。需要時 follow-up 再加。

### Pending（Wave 3 即將跟上 PR6）
- `pois.photos` JSON column migration
- Wikimedia Commons populate script
- StopLightbox photo carousel wire（取代「📷 照片功能即將推出」 placeholder）

## [2.10.0] - 2026-04-26

**v2.10 Wave 1：copy + move + StopDetailPage 清理（PR4/3）**。把 v2.9 PR3 的 ⎘/⇅ button standalone 元件接上 backend。`/trip/:id/stop/:eid` 老 deep-link 改 redirect 到 trip 詳情頁，刪 StopDetailPage 整支死碼。後續 Wave 2 接 POI search、Wave 3 接 photos。

### Added
- **POST `/api/trips/:id/entries/:eid/copy`**（`functions/api/trips/[id]/entries/[eid]/copy.ts`） — body `{ targetDayId, sortOrder?, time? }`，複製 entry 到目標 day。targetDay 必驗屬同 trip（防越權）。sortOrder 預設追加到目標 day 末尾。audit log action='insert' diff 含 `copiedFromEntryId` 反向追溯。註：trip_pois 不複製（schema 含 hotel/timeline/shopping context 較複雜，需要時 follow-up）。
- **PATCH `/api/trips/:id/entries/:eid` 加 `day_id` 進 ALLOWED_FIELDS** — 跨天 move via 既有 PATCH 流程（perm / audit / diff 全 free）。day_id 必驗屬同 trip（同 copy 防護），非 integer → 400、不存在 → 404、跨 trip → 403。
- **`TripDaysContext`**（`src/contexts/TripDaysContext.tsx`） — 輕量 day-list snapshot（`DayOption[]`），讓 RailRow 不用 prop drill 4 層就能拿到 popover 用的 day 選項。
- **TimelineRail expanded row 接 ⎘/⇅ button** — 點開 EntryActionPopover (action='copy' or 'move')，confirm → fetch → dispatch `tp-entry-updated`。≥2 days + dayId 才顯示按鈕。

### Changed
- **EntryActionPopover 新增 `onConfirm?` prop** — 給 callback 即啟用 wired mode：confirm 不再 disabled、隱藏「即將推出」notice、改顯示「請先選擇目標日」tooltip 直到 user 選好。fallback 走 v2.9 PR3 mock 模式（standalone tests 仍可跑）。新增 loading state（「複製中…」）+ error display（role=alert）。
- **TripPage 提供 `TripDaysContext.Provider`** — 從 `dayNums + allDays + daySummaryMap` 推 `DayOption[]` 給後代。
- **`/trip/:tripId/stop/:entryId` 改 redirect** — 不再 render StopDetailPage，改 `<Navigate to={`/trips?selected=${tripId}&focus=${entryId}`} />`。舊分享 link 仍 land。`StopDetailRedirect` 元件處理 useParams + 構造 URL。
- **DaySection 傳 `dayId` 給 Timeline → TimelineRail** — 為了 ⎘/⇅ popover 知道「目前那天」要 disabled。

### Removed
- **`src/pages/StopDetailPage.tsx`** — 整支刪。PR2 後 list 不再連到，現在 URL 也走 redirect，這支 component 沒人 render 了。
- **`tests/unit/stop-detail-topbar-layout.test.tsx`** — 對應 test 一併刪。
- **main.tsx StopDetailPage lazy import** — 拿掉。

### Internal
- 新增 `tests/api/entry-copy-move.integration.test.ts`（10 case） — 涵蓋 copy 200、跨 trip 403、targetDay 不存在 404、未認證 401、targetDayId 非 number 400、sortOrder 預設追加、PATCH day_id move 200、跨 trip 403、不存在 404、非 integer 400。
- `tests/unit/entry-action-popover.test.tsx` 新增 4 case for wired mode — confirm enables after pick day、onConfirm payload、error display、wired hides pending notice。
- `tests/unit/timeline-rail-inline-expand.test.tsx` 新增 9 case for ⎘/⇅ wire — buttons 顯示條件、popover open、PATCH/POST URL+body 正確、tp-entry-updated dispatch、current day disabled。
- `docs/plans/v2.10-backend-backlog.md` — 整份 v2.10 計畫紀錄（5 件事拆 3 波 + 風險 + Wave 2/3 pending）。

### Pending（v2.11+）
- Wave 2：POI search Nominatim proxy + InlineAddPoi 接 search input（即將開 PR5）
- Wave 3：`pois.photos` JSON column + Wikimedia Commons populate + StopLightbox photo carousel
- Follow-up：trip_pois copy 支援（hotel context override）、TripsListPage 接 `?focus=:eid` 自動展開 inline expand + lightbox

## [2.9.0] - 2026-04-26

**Mindtrip-parity 補強 PR3：3 個 V3 mockup 元件完成 — StopLightbox（⛶ 放大檢視）+ EntryActionPopover（⎘⇅ copy/move）+ InlineAddPoi（取代 /chat Link）**。Pure UI scaffolding，照 mockup 做出視覺 + 互動結構，但 search / copy / move 端點還沒上 backend，buttons 標 disabled +「即將推出」tooltip。**已 wire**：⛶ 放大檢視 + InlineAddPoi。**未 wire**：EntryActionPopover（standalone 元件 + tests 完備，待 v2.10 接 ⎘⇅ button 入 TimelineRail 同時上 backend）。

### Added
- **`StopLightbox`**（`src/components/trip/StopLightbox.tsx`） — Fullscreen detail modal：左側照片區 placeholder（「照片功能即將推出」hint）+ 右側 meta pills (★ rating / clock 時段 / 📍 地址) + description + note 大字閱讀區 + locations chips（連 Google Maps）。ESC / ✕ / backdrop click 三個 close path。aria-modal + aria-labelledby 完整。
- **`EntryActionPopover`**（`src/components/trip/EntryActionPopover.tsx`） — ⎘ copy / ⇅ move popover（單一元件，action prop 切換 heading + CTA verb）：day picker 顯示 swatch + 已有 stop 數 + 目前那天 disabled + aria-pressed 切換、time slot select（同原時段 / 早上 / 午餐 / 午後 / 晚餐 / 自訂）、Confirm button **disabled + tooltip**「Copy/Move 端點即將推出」+ warning note。
- **`InlineAddPoi`**（`src/components/trip/InlineAddPoi.tsx`） — 取代 DaySection 的 `<Link to="/chat?...">+ 在 Day N 加景點</Link>` 為 inline 展開卡片：collapsed 時跟原 dashed-border button 視覺一致；expanded 時 search input（disabled + placeholder「改用 AI 助理」）+ chips（🤖 AI 幫我找 / ✏️ 自訂景點 → 兩個都 routes /chat 保留現有出口；📍 附近 / ⭐ AI 推薦的 → disabled）+ 3 筆 placeholder result 列（disabled「+ 加入」）+ pending notice。
- **`StopLightbox` 接到 TimelineRail** — expanded row 頂端新增「⛶ 放大檢視」accent chip button。點下開 lightbox。

### Changed
- **DaySection 加景點 affordance** — 從 `<Link to="/chat?...">` 換成 `<InlineAddPoi tripId dayNum />`。原 `.day-add-stop-row / .day-add-stop-btn` CSS 移到 `InlineAddPoi.tsx` 的 SCOPED_STYLES。
- **TimelineRail 展開列頂端新增 action row** — `tp-rail-actions`，目前只有 ⛶ 放大檢視一顆。⎘/⇅ 按鈕等 v2.10 backend 上線同步加。

### Internal
- 新增 3 個測試檔（共 29 case）：
  - `tests/unit/stop-lightbox.test.tsx`（9） — render / open-close / 內容 / photo placeholder / ESC / backdrop / content click 不關
  - `tests/unit/entry-action-popover.test.tsx`（11） — render copy/move heading / 當前 day disabled / pressing 切換 / time slot select / **confirm disabled + tooltip 驗證** / cancel
  - `tests/unit/inline-add-poi.test.tsx`（9） — collapsed → expand / search disabled / placeholder results disabled / AI/custom chip 連 /chat URL 對 / pending notice
- `EntryActionPopover` 採 `aria-pressed` + `aria-disabled` 而非自製 active state，screen-reader friendly。
- `StopLightbox` 用 `<MarkdownText>` render description / note，跟 timeline 內 inline display 行為一致（避免 user 在 lightbox 看到 raw markdown）。

### Pending（v2.10 計畫）
- POI search endpoint（或 Nominatim proxy）→ 接 InlineAddPoi search input
- `POST /api/trips/:id/entries/:eid/copy` 端點 + TimelineRail ⎘ button
- `PATCH /api/trips/:id/entries/:eid` 加 `day_id` 進 ALLOWED_FIELDS（或新 move 端點）+ TimelineRail ⇅ button
- `entry_photos` table 或 `pois.photos` JSON column → 接 StopLightbox 照片區
- StopDetailPage / `/trip/:id/stop/:eid` 路由清理（PR2 已留為 deep-link orphan）

## [2.8.0] - 2026-04-26

**Mindtrip-parity 補強 PR2：TimelineRail 反轉成 V3 inline expansion + click-to-edit 備註**。反轉 2026-04-19 commit 01382db「整行可點跳詳情頁」的決策 — 點 stop row 改成 toggle 內嵌 detail panel（描述 / 地點 / 備註），不再 navigate 到 StopDetailPage。備註欄位 click-to-edit + Cmd+Enter 儲存 / ESC 取消 + PATCH `/api/trips/:id/entries/:eid`。儲存成功後 dispatch `tp-entry-updated` 給 TripPage 觸發 refetchCurrentDay。

### Added
- **TimelineRail inline expand** — accordion 行為（一次只展開一個 row），expand 時 caret `›` 旋 90° 變 `⌄`，detail panel slides in 160ms。aria-expanded / aria-label 完整。
- **備註 click-to-edit** — 點備註區塊 → 變 textarea + Terracotta accent border + 3px focus ring。Cmd+Enter / ⌘+↩ 儲存 → PATCH 後 dispatch event。ESC 取消、textarea 寬度 100% / min-height 88px / resize vertical。空備註顯示 「+ 加備註」 dashed-style placeholder。
- **儲存中狀態 + 錯誤訊息** — 「儲存中…」label + disabled 雙鈕；PATCH 失敗顯示 inline error（role=alert）。
- **`tp-entry-updated` window event** — `{ tripId, entryId }` detail，TripPage 接收後呼叫 `refetchCurrentDay` 同步 timeline / map / sheet。

### Changed
- **TimelineRail click 行為**：`useNavigate('/trip/:id/stop/:eid')` → `setExpandedId(toggle)`。`/trip/:id/stop/:eid` URL 仍可直接訪問（StopDetailPage 保留為 deep-link share 用途），但列表已不再點到。
- **TimelineEvent.tsx 縮成 type-only module** — Timeline.tsx 早已 only render TimelineRail，TimelineEvent component 是 orphan。PR2 刪 component 程式碼，保留 `TimelineEntryData` / `TravelData` 兩個 type（5 個檔案還在 import）。

### Internal
- 新增 `tests/unit/timeline-rail-inline-expand.test.tsx`（13 case）— 涵蓋 collapse default / click expand / accordion 切換 / aria-expanded / 備註 click-to-edit / ESC 取消 / Cmd+Enter PATCH / Save button / event dispatch / 空備註 placeholder。
- 新增 `RailRow` sub-component 隔離每 row 的 useState（編輯/儲存狀態）— 避免父層 single-source state 互相干擾。
- TripPage 新增 `tp-entry-updated` listener（line 191–199）— 走既有 `refetchCurrentDayRef.current?.()` pattern，跟 online-restore listener 對齊。

## [2.7.0] - 2026-04-26

**Mindtrip-parity 補強 PR1：NewTripModal V1 split-hero v2 + 手機 map carousel polish**。/tp-claude-design 跑完 6 個 mockup，使用者選 V1 split-hero（新增行程）+ V3 inline-expand（編輯景點）— 本 PR 拿掉 NewTripModal 老的單欄表單，做成左 hero + 右 form 的 split-screen，並補齊「彈性日期」模式（numeric stepper + 6 個月 carousel）。順手把 GlobalMapPage 手機底部 stop carousel 那塊裝飾色塊拆掉、card 縮成 150px。PR2/3 後續跟上。

### Added
- **NewTripModal split-hero pane** — 左側 SVG 風景插圖（自繪、無 CDN 依賴）+ Terracotta 漸層 + social proof 卡片（avatars + 「已有 1,247 個行程在 Tripline 上分享」+ 平均規劃時間）。第一屏即承載 value prop，避開 title-screen anti-pattern。`<768px` 下 hero 收成上方 banner，form 全寬下接。
- **彈性日期 numeric stepper** — `−  5 天  +` 控件，1–30 天範圍，clamp 邊界。對齊 mindtrip 8:32.17 「How many days?」pattern。
- **月份 carousel** — 顯示未來 6 個月（含 emoji icon：❄️🌸☀️🏝️🍁🍂），horizontal scroll-snap，aria-pressed 控件 active state。submit 時用該月 1 日當 start，+ (days−1) 當 end。
- **`totalTrips` prop** — hero social proof 數字可從外部傳入（預設 1247 placeholder），未來接 API 可動態更新。

### Changed
- **NewTripModal max-width 460px → 880px** — 容納 split-screen layout。Form pane 維持 flex-column 結構，新增 close button 在右上。
- **`apiFetchRaw` 取代 raw `fetch('/api/trips')`** — 解 CR-4 違規，修復沒走 `reportFetchResult` 造成 online/offline detection 失準的隱患。
- **`segmented` button tap target 復原 44px** — refactor 過程意外從 44 降成 36，違反 H4，改回。
- **GlobalMapPage 手機底部 stop carousel 拆裝飾色塊** — 移除 `.pc-cover` 60px Terracotta 漸層 block；card width `flex: 0 0 200px` → `150px`，padding `10px` → `10px 12px`。手機一屏可見 2.2 張卡片（露出下一張 teaser），縮 30% 不犧牲字級。

### Internal
- 新增 `tests/unit/new-trip-modal.test.tsx`（11 個 case）— 涵蓋 hero pane 渲染、`totalTrips` prop、numeric stepper +/− clamping、月份 carousel selection、flexible submit 算 dates 正確（month-1st + days−1）、fixed-date regression。
- `vi.useFakeTimers({ toFake: ['Date'] })` 模式 — 月份 carousel 需 deterministic「current month」，但 testing-library `waitFor()` 要 real setTimeout 才能 poll。

## [2.6.2] - 2026-04-26

**`/map` 對齊 mockup-map-v2 — 9 個 issue 一起修**。trip switcher 不再被 leaflet zoom 壓住、桌機 sheet 補 ✕ close + 跳到行程 button + 同日其他 stop mini-list、cluster 數字 icon 點下去自動 zoom 展開、mobile 補底部 stop carousel 左右滑、加 全覽 + 我的位置 pill button。

### Added
- **Sheet header「✕ 關閉」+「跳到行程」accent button** — 對齊 mockup `.sheet-header`。✕ 清掉 `selectedPinId` 回到 empty state；「跳到行程」accent fill 跳到 `/trips?selected=...`。
- **Sheet「同日其他 stop」mini-list** — 顯示選中 pin 那天的所有 stops（time + dot + 名稱），active 高亮 accent，點 row 即切換 selected pin。對齊 mockup `.day-stop-mini`。
- **Sheet meta chips 完整化** — 國家 / 類型（住宿）/ 時間 / ★ rating，對齊 mockup `.sheet-poi-meta`。
- **Bottom-left「▣ 全覽 / ⊕ 我的位置」pill bar** — `fitBounds` 把所有 pins 收成一個畫面、`navigator.geolocation` 取座標 flyTo 14 zoom。對齊 mockup `.map-action-bar`。
- **Mobile 底部 POI carousel** — 顯示 active 那天（或選中 pin 那天）的所有 stops，水平滑動 + scroll-snap，點 card 切 selected pin（同步 sheet + 地圖 flyTo focus）。對齊 mockup `.mobile-poi-stack`。
- **Cluster 點擊 → 自動 zoom 展開** — `OceanMap` 給 cluster marker 加 click handler，呼叫 `supercluster.getClusterExpansionZoom` 算展開 zoom level，setView 過去；fallback 是 `currentZoom + 2`。

### Changed
- **Leaflet 內建 zoom +/- 從 topleft 搬 bottomright** — 避免跟左上 trip switcher overlap，對齊 mockup `.map-control-stack`。`useLeafletMap` 加 `zoomControlPosition` option，`OceanMap` 加同名 prop 透傳，`GlobalMapPage` 傳 `'bottomright'`。
- **Trip switcher z-index 20 → 1000** — 之前在某些 viewport 被 leaflet panes (z-index 600+) 壓住，現在用 1000 確保始終浮在最上層。
- **Sheet 結構改 `.sheet-header` + `.sheet-body` flex column** — header 固定不滾、body 內容可滾、整體高度撐滿 sheet pane。

### Internal
- `OceanMap` 新增 `onMapReady?: (map: L.Map | null) => void` prop — 給 `GlobalMapPage` 拿 leaflet 實例做 fitBounds / setView。one-shot on mount + null on cleanup。
- `useLeafletMap` 重構 zoom control：原本走 `L.map({zoomControl})` 拿不到 position，改 `L.map({zoomControl: false})` + 條件式 `L.control.zoom({position}).addTo(instance)`。

## [2.6.1] - 2026-04-26

**Mindtrip-parity DX：新增行程升級成 destination-first + 加景點 affordance + chat markdown 防呆**。/devex-review 發現我們 NewTripModal 比 mindtrip 弱（只給名稱+兩顆日期 vs 對方 destination + flexible/select dates + preferences），DaySection 沒有「加景點」入口（必須記得有 chat 模式），chat 渲染遇到 reply 含字面 `\n` 或單顆 tilde（價格範圍 `¥100~300`）就破版。這版補齊三個。Sidebar 同步拿掉 destructive 的「登出」link，改走 /settings/sessions device row revoke。

### Added
- **NewTripModal destination-first** — 從「行程名稱 + 出發/回程」改成「目的地 + 日期模式 + 偏好」。目的地是主欄位（placeholder「沖繩・京都・首爾・台南...」），日期改 segmented control「選日期 / 彈性日期」，彈性模式自動填今天 + 5 天佔位。新增「想做什麼？（選填）」textarea 寫進 trip.description。Country 自動偵測（沖繩/京都→JP、首爾→KR、台北→TW、曼谷→TH）。
- **DaySection「+ 在 Day N 加景點」入口** — 每個 day 的 timeline 末端加 dashed-border 按鈕，點下去帶 `?tripId=...&prefill=幫我加 Day N 的景點：` 跳到 `/chat`，input 自動聚焦尾端，URL query 用完即清避免重 prefill。Chat 流是 POI 編輯的官方路徑（tp-request → Mac Mini Claude），但之前沒入口 user 不會發現。
- **ChatPage prefill via searchParams** — `useSearchParams` 讀 `?tripId` 切 active trip + `?prefill` 填 input。

### Changed
- **Sidebar 拿掉「登出」link** — 避免 destructive action 跟主要 nav 同框，誤點機率降低。登出走 account chip → `/settings/sessions` 內的 device row revoke。
- **NewTripModal segmented control 守 44px tap target** — terracotta-preview 的 `.nav-tabs` 用 36px 是 mockup 簡化，實作守住 Apple HIG 最小觸控目標確保手機不誤點。

### Fixed
- **Chat markdown 渲染遇字面 `\n` 跟單顆 tilde 破版** — `renderMarkdown` 加 defensive normalize：`\\n`（雙重 JSON encode 進來的字面 backslash-n）→ 真換行；單顆 `~`（如 `Day 3~4`、`¥100~300`、`¥3,000~`）escape 成 `\~` 避免 GFM strikethrough 把整段文字吃掉。雙顆 `~~text~~` 仍保留 strikethrough 行為。

## [2.6.0] - 2026-04-26

**`/chat` 接通 Mac Mini tp-request + `/map` trip switcher + ManagePage 廢棄**。Chat 頁載入時帶歷史對話（每筆 tp-request row 渲染為 user/assistant bubble pair），未完成的 inflight 自動 resume SSE。前端 POST `/api/requests` 不再傳 mode — server 預設 `trip-plan`，tp-request skill 自動判別「改行程 vs 問建議」。`/map` 從 chip-filter 多 trip 改為 dropdown trip-switcher 模式（一次顯示一個行程，切換／空狀態 CTA），polyline 用 OceanMap 內建 useRoute 走真實導航線。Legacy `/manage` 編輯器移除，redirect 到 `/chat`。AdminPage 重新對齊 V2 terracotta-preview design。

### Added
- **Chat 歷史對話載入** — `ChatPage` 切 trip 時 `GET /api/requests?tripId=X&sort=asc&limit=20`，每筆 row 轉 user message + assistant reply（markdown 渲染）。Status `open`/`processing` 的 prior-session row 自動 resume SSE，typing dot 等 Mac Mini 回 reply 後就地替換。
- **`/map` trip switcher** — `GlobalMapPage` 完整重寫：左上 floating header 帶 dropdown 切 trip + N stops/M days meta，地圖用 `OceanMap mode="overview"` 真實導航折線（per-day polyline + hotel sortOrder=-1 入線），點 marker 在右側 sheet 顯示 POI detail（mobile 用底部浮卡）。沒任何 trip → terracotta hero card「+ 新增行程」。
- **AdminPage V2 重設計** — 包 AppShell + DesktopSidebarConnected + GlobalBottomNav，page heading 用 `.tp-page-heading`（crumb「管理」+ h1「權限管理」），三 sections 包進 `.tp-admin-section` 卡片。Trip select / permission list / add member 全部對齊 terracotta tokens。加 admin gate effect（非 admin redirect `/trips`）。
- **「管理」sidebar nav 連 /admin** — gear icon，admin-only 顯示（`email === lean.lean@gmail.com`）。

### Changed
- **`POST /api/requests` mode 變 optional** — 沒給 default `'trip-plan'`（滿足 DB CHECK constraint），tp-request skill 自己看 message 自動判別意圖。前端不再傳 mode 欄位。
- **`/manage` redirect → `/chat`** — 路由 `<Navigate to="/chat" replace />`，舊 bookmark 直接落到 chat 頁。`LoginPage` 預設 redirect、`Placeholder` default ctaHref、`BottomNavBar` 助理 tab 全改 `/chat` 或 `/trips`。
- **Sidebar nav matchPrefixes** — 「行程」拿掉 `/manage`、「管理」改只匹配 `/admin`。GlobalBottomNav 同步。
- **Sidebar 拿掉「+ 新增行程」按鈕** — 入口移到 TripsListPage（trailing dashed card / hero CTA）跟 GlobalMapPage empty state。Sidebar 底部只剩 ThemeToggle + account-card + 登出。

### Fixed
- **ChatPage empty state 文案對齊新 mode-less 行為** — 「有什麼要改、要加、要換，或者只是想問建議都可以。AI 會自動判斷是要動行程還是純對話」對應 skill 自動判別。
- **Sidebar 「管理」icon** — 之前 `'settings'` icon 不在 Icon library，render 出空白；改 `'gear'`（library 有定義）。

### Removed
- **`src/pages/ManagePage.tsx` (323 行)** — Legacy AI editor 由 `/chat` 取代（chat 走同一條 tp-request pipeline，UX 更簡潔）。
- **`tests/unit/request-api-v2.test.js`** — coupled to ManagePage.tsx，整檔刪除。

## [2.5.0] - 2026-04-26

**V2 design polish + 4 placeholder pages 變 functional**。把累積的 design 議題（DayNav 留白、day 錨點被 sticky strip 遮、桌機 sheet 上方空白、三欄捲動互踩、新增行程連結錯位）一次掃乾淨；同時把 `/chat` `/map` `/manage` `/explore` 四個 placeholder 變成可用 MVP，`/chat` 直接接 Mac Mini tp-request pipeline + SSE。地圖 polyline 規格寫進 DESIGN.md（飯店為當日線首），sidebar 加 admin-only「管理」連結 + 深淺模式 toggle。

### Added
- **`/chat` AI 對話 MVP** — `ChatPage` 接 `POST /api/requests` `{tripId, mode:'trip-plan'}` + `useRequestSSE` 監聽狀態 + `GET /api/requests/:id` 拿 reply 渲染 markdown。trip picker dropdown 切 active trip（寫 `LS_KEY_TRIP_PREF`），4 顆 suggestion chip 冷啟，輸入框 Enter 送出 / Shift+Enter 換行 / aria-label。
- **`/map` 全域 leaflet 地圖** — `GlobalMapPage` 用 `useLeafletMap` 渲染所有自己有權限行程的 POI，每 trip 一色（10 色 terracotta palette）。Per-day polyline 串接 hotel + entries by sortOrder（跨 day 不連線）。左上 chip 可逐 trip toggle 隱藏，點 marker 在右側 sheet 顯示 POI 細節 + 「打開行程」CTA，mobile 改用底部浮卡。
- **`/explore` tabs + multi-select + add-to-trip** — 兩 tab（搜尋 / 儲存池），儲存池卡片加 checkbox + sticky toolbar，多選後「加入行程」開 trip picker modal（POST entries endpoint 待接通則 toast 提示 + 切到該 trip）。
- **`NewTripContext` 全域新增行程 modal** — 取代各頁分散的 prop drilling，Sidebar / TripsListPage 三入口（trailing dashed card / 空 hero CTA / sidebar 底部按鈕）共用同一個 modal。POST `/api/trips` 含 auto slug + 4-char base36 suffix tripId。
- **`ThemeToggle` 共用元件** — 三段式 segmented（淺 / 自動 / 深），sidebar 底部 + SessionsPage 帳號 actions block 共用。
- **桌機 sidebar admin-only「管理」nav 項** — `DesktopSidebarConnected` 用 `email === lean.lean@gmail.com` gate，普通用戶看不到。`/manage` 同步加 admin gate effect（非 admin redirect `/trips`）。
- **桌機 sidebar account-card 變 Link** — 點擊進 `/settings/sessions`，作為桌機帳號入口。
- **手機 SessionsPage 加 ThemeToggle + 登出按鈕** — mobile 帳號 tab（連到 `/settings/sessions`）落地後直接看到深淺模式切換 + 紅框登出 button。
- **DESIGN.md「地圖 Polyline 規格」section** — 新章節明訂飯店為當日 polyline 起點（sortOrder=-1 自然成為線首），跨 day 不連線，hotel marker 仍維持 ink 色不違反 Stop Type Color Convention。

### Changed
- **DayNav mobile 留白方向** — `.ocean-day-strip` mobile padding `8px 16px` + 拿掉負 margin，strip 改在 `.ocean-page` 16px gutter 內；對齊 `mockup-trip-v2.html .mobile-day-strip` 樣式。
- **Day section 錨點實作** — `.ocean-day > .ocean-hero { scroll-margin-top }` 取代 `.ocean-day {...}`，因為 `id="day{N}"` 實際在 `.ocean-hero` 上，原本寫法 silently no-op；mobile 96px、desktop 200px、sheet 內 96px。
- **AppShell 三欄獨立捲動** — `.app-shell { height: 100dvh }`（原 min-height 讓 grid 隨內容漲），加 `overscroll-behavior: contain` 給 sidebar / main / sheet，scroll-chaining 不再傳到 document 或別欄。
- **行程 sheet 內 ocean-page padding-top: 0** — `.app-shell-sheet` 內覆蓋預設 28px top padding，並把 `.ocean-day-strip top: 64px` 收掉，桌機 sheet 不再有為已不存在的 topbar 預留的 64px 空白。
- **noShell 模式 TripPage 不渲染 Footer + FooterArt** — embedded 在 sheet 時把裝飾性 footer 拿掉（sheet 是窄欄，footer 浪費垂直空間）。
- **Manage page 變 admin-only** — 透過 `useCurrentUser` 比對 admin email；同時 sidebar nav matchPrefixes 把 `/manage` 從「行程」item 移出，改歸到 admin-only「管理」item。
- **OceanMap polyline 含 hotel** — `buildSegments` 拿掉 `filter(p => p.type === 'entry')`，改 `sort((a,b) => a.sortOrder - b.sortOrder)`，hotel sortOrder=-1 自然落在線首。

### Fixed
- **桌機 sheet 上方空白** — `.app-shell-sheet .ocean-page` padding-top 收掉 + `.ocean-day-strip` top:0/margin:0，sheet 不再有空白帶。
- **TimelineEvent stop click 在 embedded 模式無反應** — 用 `useTripId()` context hook 取代 `useParams`（在 `/trips?selected=` URL 拿不到 :tripId param）。
- **Mobile DayNav 點天數無錨點 scroll + 滑動不換 active day** — `scrollToDay` 改 `header.scrollIntoView`；scroll-spy listener 用 `findScrollContainer` 走父鏈到 `.app-shell-main` 真實 scroller。
- **新增行程連結錯誤** — sidebar 底部「+ 新增行程」按鈕在非 `/trips` 頁面 onClick 為 undefined 沒反應，改成全域 `useNewTrip().openModal` 預設行為。

### Removed
- **舊的 `.ocean-day { scroll-margin-top: 130/210px }`** — 規則放錯 element 上根本沒 hit，改寫到 `.ocean-day > .ocean-hero`。
- **TripsListPage local NewTripModal state** — 統一改用 `useNewTrip()` context；trailing card / hero CTA / sidebar 三入口共用一份 modal mount。

## [2.4.0] - 2026-04-25

**V2 OAuth full cutover + V2 design audit follow-ups**。Cloudflare Access 全拆，Tripline 自建 V2 OAuth 接管所有 auth（瀏覽器 session cookie + CLI Bearer token）。5 個 auth page 對齊 mockup-v2 桌機 split-screen + brand hero pane。3 個 settings page wrap 進 AppShell。新增 `/trips` landing page 帶 country-keyed peach-gradient trip cards。詳見 `docs/v2-design-audit-2026-04-25.md` + `.gstack/deploy-reports/2026-04-25-pr317-321-deploy.md`。

### Added
- **Auth pages 桌機 split-screen + brand hero pane**（≥1024px）— `/login` / `/signup` / `/login/forgot` / `/auth/password/reset` / `/signup/check-email` 桌機版改成 1fr/1fr grid，左 form card、右 terracotta gradient brand hero 帶 eyebrow + headline + features + footnote。手機（<1024px）維持單欄 centered card 不變。共用 `src/components/auth/AuthBrandHero.tsx`。
- **`/trips` landing page** — 新 `TripsListPage` 顯示登入用戶有權限的行程，每個 trip 渲染為 16/9 peach-gradient card（JP terracotta / KR cocoa / TW amber / 其他 warm-stone），點進去 → `/trip/:tripId` detail。
- **Settings AppShell wrap** — `/settings/connected-apps` / `/developer/apps` / `/settings/sessions` 包進 `AppShell` 帶 `DesktopSidebarConnected`，桌機看到 sidebar nav + account chip。
- **CLI service token 流程** — `/api/oauth/token` `grant_type=client_credentials`（RFC 6749 §4.4），confidential client、scope 限制、無 refresh token。對應 `scripts/lib/get-tripline-token.js` helper（auto-loads `.env.local`、60s pre-expiry refresh、`/tmp/tripline-cli-token-<uid>.json` cache）+ `scripts/provision-admin-cli-client.js` 一次性 provisioning。
- **`/api/public-config`** — side-effect-free probe endpoint，前端拿 `{ providers: { google }, features: { passwordSignup, emailVerification } }` graceful 渲染（沒設 `GOOGLE_CLIENT_ID` 時 LoginPage 自動隱藏 Google 按鈕）。
- **V2 Terracotta theme** — `css/tokens.css` 全面遷移 `--color-accent: #D97848` / `--color-background: #FFFBF5` / `--color-foreground: #2A1F18` + warm-tinted shadows，dark mode 換 deep-cocoa 對齊。`DESIGN.md` header 改 V2 Terracotta + canonical Palette table。
- **`useRequireAuth` hook** — `src/hooks/useRequireAuth.ts` wrap `useCurrentUser`，`user === null` 時 navigate `/login?redirect_after=...`。套到 ManagePage / AdminPage / ConnectedAppsPage / SessionsPage / DeveloperAppsPage。
- **SessionsPage unit test** — `tests/unit/sessions-page.test.tsx` 13 tests 補齊 V2-P6 multi-device session 管理 page 的覆蓋率。
- **TripsListPage unit test** — `tests/unit/trips-list-page.test.tsx` 6 tests covering loading / empty / cross-ref / fallback / 兩種失敗模式。

### Changed
- **Cloudflare Access 全拆** — 不再透過 Access policy 保護 `/manage` / `/admin` / `/api/requests` / `/api/my-trips` / `/api/permissions`。`functions/api/_middleware.ts` 重寫：先試 V2 session cookie（HMAC-SHA256 opaque），再試 Bearer token（用 `D1Adapter('AccessToken').find()`）。CF JWT decode + service token check 的死程式碼移除。
- **Scheduler scripts 改 Bearer auth** — `scripts/tp-request-scheduler.sh` / `scripts/tripline-job.sh` / `scripts/tripline-api-server.ts` 從 `CF-Access-Client-Id`/`Secret` headers 換成 `Authorization: Bearer $(node scripts/lib/get-tripline-token.js)`，TS 版用 `authedFetch` wrapper 401 自動 retry 一次。
- **Password hashing iterations** — `src/server/password.ts` PBKDF2 從 600k 降到 100k 以符合 CF Workers Free plan 10ms CPU budget。Self-describing hash format 確保舊 hash 仍可驗證。Workers Paid plan 啟用後可調回 600k。
- **Signup rate limit** — `functions/api/_rate_limit.ts` SIGNUP `maxAttempts: 3 → 10` per hour per IP（dev + NAT 共用 IP 太緊）。
- **DesktopSidebar padding** — `20px 12px → 20px 14px` 對齊 mockup spacing。
- **SignupPage password hint** — `「至少 8 字元」` 從 label-side `<span>` 移到 input `placeholder`，對齊 mockup-signup-v2。
- **CLAUDE.md auth section** — V2 OAuth 改為 sole auth、附上 mock auth 設定（`.dev.vars` / `DEV_MOCK_EMAIL`）+ admin CLI client provisioning 步驟。
- **`backups/` 加 `.gitignore`** — `scripts/dump-d1.js` 產的 daily JSON dump 不再髒 git status。

### Fixed
- **CSRF middleware bypass `/api/oauth/*` + Bearer requests** — 沒 Origin header 的 CLI curl 不再 403。
- **`get-tripline-token.js` 在 launchd 環境** — scripts launched from launchd 不 source `.env.local`，helper 自己 auto-load。
- **`provision-admin-cli-client.js` iter mismatch** — script 用 600k 但 prod 是 100k，driver `verifyPassword` 從 stored hash 讀 iter，500 error 修掉。
- **AuthBrandHero footnote font-size** — `11px → var(--font-size-caption2)`，pr2-tokens.test.ts hardcode 檢查通過。

### Removed
- **CF Access service token check** — `functions/api/_middleware.ts` 的 `decodeJwtPayload` + CF JWT path 全拆。
- **CF Access fallback link from LoginPage** — V2 self-signup 變唯一 primary CTA。

### Test results
- 988/988 unit tests pass
- TypeScript clean
- Cloudflare Pages prod deploy verified（screenshot evidence in `.gstack/deploy-reports/post-pr321-login.png`）

### Deferred (audit close-out)
- Auth pages AppShell wrap — anonymous click sidebar nav 會 redirect-bounce，需先做 disable-while-anon polish
- `/explore` POI grid + 右 pane detail + category palette — defer 到專屬 explore-redesign sprint（P3 ~90min+）
- `/chat`（LLM concierge）+ `/map`（cross-trip global map）— multi-day implementations，P3

## [2.3.0] - 2026-04-25

**Layout Refactor (B Workstream P1-P4) + V2 OAuth Day 0 spike + A11y polish**。SaaS pivot 第一階段：Mindtrip-inspired 3-pane shell + URL-driven sheet state + Explore MVP。Panva oidc-provider 在 CF Pages Functions + nodejs_compat 下能 import + instantiate（GREEN，進 V2-P1）。詳見 `docs/2026-04-25-session-retro.md` + `docs/v2-oauth-spike-result.md`。

### Added
- `src/components/shell/AppShell.tsx` — 3-pane / 2-pane layout primitive (sidebar + main + sheet slots)
- `src/components/shell/DesktopSidebar.tsx` — 5 nav items（聊天 / 行程 / 地圖 / 探索 / 登入）+ user chip
- `src/components/shell/BottomNavBar.tsx` — Mobile sticky bottom nav (4-tab IA)
- `src/components/trip/TripSheet.tsx` + `TripSheetTabs.tsx` — URL-driven sheet (`?sheet=itinerary|ideas|map|chat`) + ARIA tabs pattern + keyboard nav
- `src/lib/trip-url.ts` — Sheet URL helpers + `sheetTabId` / `sheetPanelId` ID conventions
- `src/pages/{Chat,GlobalMap,Explore,Login}Page.tsx` — 4 個新 page (placeholder + real Explore)
- `src/components/shared/Placeholder.tsx` — Reusable empty-state page UI
- `functions/api/poi-search.ts` — Nominatim search proxy + 24h CDN cache
- `functions/api/pois/find-or-create.ts` — POI master upsert
- `functions/api/oauth/spike.ts` — V2 Day 0 spike endpoint (will be rewritten in V2-P1)
- `migrations/0028_saved_pois.sql` + `0029_trip_ideas.sql` — Phase 1 schema
- `docs/v2-oauth-server-plan.md` + `docs/v2-oauth-spike-result.md` — V2 OAuth design (Panva oidc-provider + D1 adapter)
- A11y：`@media (prefers-reduced-motion: reduce)` global override 加到 `css/tokens.css`

### Changed
- `wrangler.toml` — 加 `compatibility_flags = ["nodejs_compat"]`（V2 OAuth）
- `src/entries/main.tsx` — 加 4 個新 routes + `<TripMapRedirect>` (`/trip/:id/map` → `?sheet=map`)
- `src/pages/{Trip,Manage}Page.tsx` — wrap in AppShell

### Fixed
- `scripts/init-local-db.js` TABLES 順序 — pois 必須在 trip_entries 之前（FK from migration 0026），原序讓 trip_entries / trip_pois import 0 rows
- `TripSheet` map tab 高度只佔 1/4 — TripMapRail sticky + `calc(100dvh - nav-h)` 在 sheet 內失效，加 SCOPED_STYLES override 撐滿
- `/manage` 跳 default trip — 移除 `public/_redirects`（rewrite to /index.html 觸發 wrangler canonical-strip 308 to /），改靠 `dist/manage/` directory canonical 308 to `/manage/`

### A11y (B-P6 partial)
- ARIA tabs pattern 完整關聯（id + aria-controls + role=tabpanel + aria-labelledby + hidden vs unmount）
- Keyboard navigation（ArrowLeft/Right/Home/End on tablist + roving tabindex）
- Color contrast WCAG 2.x AA verified（unit test 13 cases，light + dark theme）
- prefers-reduced-motion global override

### Performance baseline (B-P6 task 6.4)
- Total `dist/`: 1.9 MB raw (~600 KB gzipped initial estimate)
- Largest chunks: html2pdf 914K (lazy on PDF export), vendor 219K, OceanMap 168K (lazy), sentry 134K, TripPage 79K (lazy)
- All page-level routes lazy-loaded via `lazyWithRetry`

### Open follow-ups (B-P6 deferred to next sprint)
- axe-core install + run (task 5.1, 5.2)
- Lighthouse CI workflow (task 6.1-6.3)
- Playwright E2E matrix (task 7.x)
- Sentry release tagging + monitoring (task 10.x)
- TripSheet open/close animation transitions (task 3.1-3.3, 需先實作 transition)
- B-P5 Ideas drag-to-itinerary (V2 排程，等 Ideas tab real UI)
- V2-P1 ~ V2-P7 OAuth Server (14 週)

## [2.2.0.0] - 2026-04-24

**POI Unification Phase 3 — DROP legacy spatial columns，POI master 成為 spatial single source of truth**。`trip_entries` 正式移除 `location` / `maps` / `mapcode` / `google_rating` 四欄，entry 的座標、Google Maps URL、mapcode、評分全數由 `JOIN pois ON trip_entries.poi_id = pois.id` 取得。前後端 fallback 程式碼同步清除，Phase 2 過渡期結束。既有行程 100% 已 backfill（74 個 auto + 17 個 collision 手動分離成獨立 POI），資料全數保留。

### Added
- `migrations/0027_drop_entry_location.sql` — `ALTER TABLE trip_entries DROP COLUMN` 四欄（`location` / `maps` / `mapcode` / `google_rating`）。SQLite 3.35+ / D1 支援原生 `DROP COLUMN`，四欄均無 index / trigger / view，DROP 可直接成功。
- `migrations/rollback/0027_drop_entry_location_rollback.sql` — `ADD COLUMN` 恢復 schema。rollback 只還原 schema 不還原資料，必須搭配 0027 前的 backup 才能完整回退。
- `scripts/resolve-poi-collisions.js` — 為 (name, type) 碰撞 entries 建獨立 pois（名稱後綴 `#{entry.id}` 保證唯一），並重掛 `trip_entries.poi_id`。Phase 3 DROP 前 17 / 91 個 collision entries 全數分離成獨立 POI，保留原始座標。

### Changed
- `functions/api/trips/[id]/days/[num].ts` PUT — INSERT `trip_entries` 移除 `maps` / `google_rating` 欄位。
- `functions/api/trips/[id]/days/[num]/entries.ts` POST — INSERT `trip_entries` 移除 `maps` / `mapcode` / `google_rating` / `location`。
- `functions/api/trips/[id]/entries/[eid].ts` PATCH — `ALLOWED_FIELDS` 移除 `maps` / `mapcode` / `google_rating` / `location`。
- `functions/api/trips/[id]/days/_merge.ts` `assembleDay` — 移除 `entry.location` JSON 解析；spatial 欄位全走 `entry.poi` JOIN 結果。
- `functions/api/trips/[id]/audit/[aid]/rollback.ts` — `TABLE_COLUMNS.trip_entries` 同步移除四欄，確保舊 audit 事件 rollback 不會把已 DROP 欄位寫回。
- `src/types/trip.ts` `Entry` — 移除 `location` / `maps` / `mapcode` / `googleRating`；spatial 欄位透過 `Entry.poi` 取得。
- `src/lib/mapDay.ts` `toTimelineEntry` — `RawEntry` 移除 spatial 欄位，只讀 `raw.poi.*`。
- `src/hooks/useMapData.ts` `extractPinsFromDay` — 移除 `entry.location` fallback，spatial 來源只有 `entry.poi`。
- 測試同步 — `tests/unit/use-map-data.test.ts` / `extract-pins-all-days.test.ts` / `map-day.test.js` / `tests/api/days.integration.test.ts` 改用 `entry.poi` 而非 `entry.location`；`tests/api/helpers.ts seedEntry` 改接 `poiId` 而非 `location`。

### Breaking changes
- 任何外部 tooling / script / MCP 手動寫 `trip_entries.location` / `maps` / `mapcode` / `google_rating` 欄位都會失敗（欄位已 DROP）。必須透過 `PUT /days/:num` body（會走 `findOrCreatePoi` 寫入 pois master）或 `POST /entries` + `PUT /api/trips/:id/entries/:eid/poi-id` 設定 POI。

## [2.1.3.1] - 2026-04-24

**hotfix：migrate 腳本加 confidence gate 保護 map pin 精度**。Phase 2 dry-run 跑完發現 17 / 91 個 legacy entries 屬於 `(name, type)` 碰撞（同名但座標 > 300m 差異，多半是大型複合設施如美浜アメリカンビレッジ、イオンモール、Vessel/Super Hotel 內的不同停點）。若直接 `--apply`，POI 只留第一個 entry 的座標，其他 entry 的精準位置就永遠消失。改為 `--apply` 預設只套用 `confidence ≥ 0.8` 的 entries；低 confidence 項目保留 `poi_id = NULL`，讓 Phase 2 fallback 繼續讀 `entry.location`，等人工用 `PUT /api/trips/:id/entries/:eid/poi-id` 重掛。`--force` flag 可覆蓋此守則。

### Changed
- `scripts/migrate-entries-to-pois.js` — `--apply` 路徑加 `applyList = classified.filter(c => c.confidence >= 0.8)`；新增 `--force` flag。跳過數在 terminal 輸出提醒人工處理。

## [2.1.3.0] - 2026-04-24

**POI Unification Phase 2 — API 寫入 + JOIN 讀取 + 遷移腳本**。Timeline entry 從這版起走 POI master：`PUT /days/:num` 與 `POST /entries` 在寫入 `trip_entries` 後 find-or-create 對應 `pois` 列、回填 `trip_entries.poi_id`；`GET /days/:num` 則把 pois master JOIN 進 `entry.poi`，`toTimelineEntry` 與 `extractPinsFromDay` 優先讀 POI（fallback entry override 作為 Phase 2 遷移期保險）。既有行程無感；Phase 3 drop `entry.location / maps / google_rating` 欄位前跑遷移腳本一次把 legacy 資料回填 POI master 即可。

### Added
- `functions/api/_poi.ts` 流程擴充 — `batchFindOrCreatePois` 與 `findOrCreatePoi` 沒改，但 PUT / POST handler 把 entry 本身當成 POI 送進去，預設 `type = 'attraction'`，caller 可傳 `poi_type` 指定 `transport` / `activity`。
- `functions/api/trips/[id]/days/[num].ts` — PUT 產生 entry 後，以 `entryPoiIdx` 對應到 `batchFindOrCreatePois` 回傳的 ID，batch2 前置 `UPDATE trip_entries SET poi_id = ?`。
- `functions/api/trips/[id]/days/[num]/entries.ts` — POST 在 INSERT 前跑 `findOrCreatePoi`，`poi_id` 跟 `trip_entries` 同一筆 INSERT 寫入。
- `functions/api/trips/[id]/entries/[eid].ts` — PATCH `ALLOWED_FIELDS` 納入 `poi_id`，支援 admin 重掛既有 POI。
- `functions/api/trips/[id]/days/_merge.ts` — `fetchPoiMap` 改為可變參數 `(...rowLists)` 同時吃 trip_pois + trip_entries；`assembleDay` timeline 輸出 `entry.poi`（JSON deep-camel 後成 `entry.poi`）。
- `functions/api/trips/[id]/days.ts` — batch 模式 pois 子查詢 UNION 加入 `trip_entries.poi_id`，多天 GET 也帶 entry.poi。
- `src/lib/mapDay.ts` — `RawEntry.poi` 型別 + `toTimelineEntry` 優先讀 `poi.maps / poi.mapcode / poi.googleRating`。
- `src/hooks/useMapData.ts` — `extractPinsFromDay` 優先讀 `entry.poi.lat/lng`；舊 `entry.location` 留作 Phase 2 fallback。
- `src/types/trip.ts` — `Poi.type` 聯合型別新增 `'activity'`；`Entry.poiId` + `Entry.poi` 欄位。
- `scripts/migrate-entries-to-pois.js` — Phase 2 backfill。heuristic 分類 transport / activity / attraction；`--dry-run` 產出 markdown 報告 + uncertain 清單（confidence < 0.8），gate 5%；`--apply` 產 SQL 檔 + `wrangler d1 execute --remote --file`；`--clean-orphans` 順手清被刪 trip 殘留的 pois。
- `scripts/verify-entry-poi-backfill.js` — coverage assertion，有任何 `poi_id IS NULL` 的 entry 就 exit 1 列清單。
- 測試 — `tests/unit/map-day.test.js`（POI JOIN 4 case）、`tests/unit/extract-pins-all-days.test.ts`（POI 座標優先 2 case）、`tests/api/days-num.integration.test.ts`（PUT 寫 poi_id + GET 回 entry.poi JOIN 2 case）。

### Changed
- `.claude/skills/tp-shared/references/poi-spec.md` — 新增 timeline entry POI 段落說明 `poi_type` body 欄位、表格補 attraction / transport / activity 必填欄位。
- `.claude/skills/tp-quality-rules/SKILL.md` — 開頭補 Phase 2 POI Unification 段落，說明 R11 / R12 / R17 的資料來源自 POI master；body shape 本身不變。

### Security / Hardening（adversarial review 抓到）
- `functions/api/trips/[id]/days/[num].ts` + `functions/api/trips/[id]/days/[num]/entries.ts` — `poi_type` 加白名單驗證，非法值在 batch1 執行前就 400；避免 CHECK 失敗在 batch2 半途炸掉整天資料。
- `functions/api/trips/[id]/entries/[eid].ts` — `poi_id` 從 PATCH ALLOWED_FIELDS 拔掉，避免任何編輯者把 entry 指向任意 POI（跨 trip 資料外洩 / FK 違反）。admin 手動重掛走後續獨立 admin endpoint。
- `functions/api/pois/[id].ts` — DELETE `/api/pois/:id` 前新增 `UPDATE trip_entries SET poi_id = NULL WHERE poi_id = ?`，否則任何被 entry 引用的 POI 都會因 FK constraint 刪不掉。
- `functions/api/trips/[id]/audit/[aid]/rollback.ts` — `TABLE_COLUMNS.trip_entries` 加入 `poi_id`，否則任何 PATCH 含 poi_id 的 entry 稽核事件都無法 rollback。
- **新端點** `PUT /api/trips/:id/entries/:eid/poi-id`（`functions/api/trips/[id]/entries/[eid]/poi-id.ts`）— 取代 PATCH /entries 的 poi_id 路徑；驗證 POI 存在 + entry 屬於該 trip 後才重掛；支援 `poi_id: null` 清空；全部動作寫 audit_log。
- `functions/api/trips/[id]/days/[num]/entries.ts` — POST `findOrCreatePoi` 移進 try/catch 統一 error path；`title` 拒絕僅空白字串；INSERT 失敗仍可能留 orphan POI，交由 `migrate-entries-to-pois.js --clean-orphans` 清。
- `scripts/migrate-entries-to-pois.js` — 加 **(name, type) 碰撞偵測**：同 name+type 不同座標（> ~300m 差異）自動降 confidence 到 0.3 進 uncertain 隊列，避免把不同分店的 `麥當勞` / `駐車場` 合成一筆 POI。

### Migration steps（ship 後）
1. `node scripts/migrate-entries-to-pois.js --dry-run --trip all` — 檢查 heuristic 分類、uncertain 不超過 5%
2. 審閱 `.gstack/migration-reports/{ts}-uncertain.md`，把必要 override 以 `PATCH /entries/:eid` 設 `poi_id`
3. `node scripts/migrate-entries-to-pois.js --apply --trip all --clean-orphans` — 實際寫入 prod D1 + 清 orphan POI
4. `node scripts/verify-entry-poi-backfill.js` — 確認 100% coverage 才能進 Phase 3

## [2.1.2.0] - 2026-04-23

**POI Unification Phase 1 — schema prep（dormant）**。`pois.type` CHECK 新增 `activity`，`trip_entries` 加 nullable `poi_id` FK 欄位 + JOIN index。此階段純 schema，無使用者可見變化。Phase 2（API handler 走 find-or-create 把既有 timeline stop 資料回填 POI master）與 Phase 3（DROP 舊 entry.location 欄位）於後續 PR 進行。

規劃文件：`SPEC.md`（3-phase plan + 6 區 skill spec）；rollback SQL：`migrations/rollback/0025*` + `0026*`（附 apply 順序說明）。

### Added
- `migrations/0025_extend_poi_types.sql` — `pois.type` CHECK 納入 `activity`。SQLite 限制下用 **triple-rename swap** pattern 同時 rebuild `pois` / `trip_pois` / `poi_relations`（單 rebuild 會讓 dependent table 的 FK 指向 dropped `pois_old`，production insert 會 `no such table` fail —— pre-landing review 抓到，已修正 commit `1eb694d`）。
- `migrations/0026_trip_entries_poi_id.sql` — `trip_entries` 新增 `poi_id INTEGER REFERENCES pois(id)` nullable FK + `idx_trip_entries_poi_id` index。為 Phase 2 的 find-or-create / JOIN 路徑鋪路。
- `migrations/rollback/0025_*` + `migrations/rollback/0026_*` — 雙向可逆 SQL，附執行前資料完整性 SELECT + 0026 在 0025 之前 rollback 的順序說明。
- `SPEC.md` — POI unification 3-phase 計劃，依 spec-driven-development skill 6 區結構（objective / commands / project structure / code style / testing strategy / boundaries）。

### Infrastructure
- `.claude/settings.json` — 啟用 `agent-skills@addy-agent-skills` plugin（addyosmani/agent-skills marketplace，提供 spec-driven-development / planning / shipping-and-launch 等 engineering-workflow skills）。

## [2.1.1.0] - 2026-04-23

**移除 Tripline 品牌 logo（lego mark + Trip/Line wordmark）** — 所有頁面 header 的 32×32 Ocean 方塊、三線 lego mark（3 條遞減 opacity 橫線 + 3 個 stud dot）、以及右側 `Trip/Line` wordmark 整個拔掉。TripPage（桌機 topbar）/ ManagePage（AI 編輯 header）/ MapPage / StopDetailPage（header + 404 empty state）/ PageNav（shared sticky nav）五處都不再顯示品牌 logo；各頁同步失去「點 logo 回首頁」入口。meta tag、OG image、manifest、AI 聊天品牌名稱此次不動。

### Removed
- **`TriplineLogo` 元件** — 刪除 `src/components/shared/TriplineLogo.tsx`（-75 行）
- **5 處 header 使用位置** — TripPage / ManagePage / MapPage / StopDetailPage（×2）/ PageNav 全數移除 `<TriplineLogo>` 節點
- **CSS 樣式** — `.tripline-logo` / `.tripline-logo-desktop` / `.ocean-brand` wrapper（`.ocean-brand-label` 保留給 TripPage 行程名稱用）
- **Logo-existence 測試 3 檔** — `tripline-logo-link.test.tsx` / `stop-detail-page-logo.test.tsx` / `map-page-logo.test.tsx`

### Changed
- **`PageNav` prop 縮減** — 移除 `isOnline`（原本僅傳給 TriplineLogo），`AdminPage` 同步更新 caller
- **ManagePage / MapPage / StopDetailPage** — 刪除僅用於傳遞 TriplineLogo 的 `isOnline` 本地變數與 import
- **TripPage topbar** — `ocean-brand` wrapper 消失後，`DestinationArt` 與 `.ocean-brand-label`（行程名稱）改為 `.ocean-topbar-left` 的直接 flex sibling
- **反向 assertion 測試** — `stop-detail-topbar-layout.test.tsx`（header 2 children + 不含 home link）、`admin-page.test.tsx`（PageNav 內不含 Tripline home link），防止 logo 意外復活
- **`DESIGN.md`** — Decisions Log 新增 2026-04-23 棄用紀錄；Components / Icons section 移除 lego mark 描述

## [2.1.0.2] - 2026-04-23

**桌機行程地圖改走真實道路曲線** — 桌機右側 sticky map 之前用兩點直線連接各 stop，手機 MapPage 用 Mapbox Directions 畫實際道路。同一趟行程在兩個裝置看到完全不同的路線呈現。這版統一：桌機也走 Mapbox，曲線沿道路繞、與手機視覺一致。

### Fixed
- **桌機 TripMapRail polyline 直線 → 曲線** — TripMapRail 改為 delegate 給 OceanMap（之前是獨立 Leaflet 實作+ `L.polyline` 直線）。桌機 sticky map 現在用 `useRoute` 從 Mapbox Directions 抓實際道路，與手機 MapPage 共用同一渲染引擎、cluster 邏輯、font stack、IndexedDB 路線快取。使用者在兩個裝置看到的地圖線條從此一致。
- **桌機 re-render 不再 wipe 地圖位置** — OceanMap 加 `fitOnce` 旗標。TripPage IIFE 每次 re-render 會重建 pins 陣列，之前會把 rail 強拉回全行程 bounds、蓋掉使用者 drag + scroll-spy pan。現在首次 fitBounds 後保留使用者拖曳位置。
- **Scroll spy pan 位置還原為全 pin 平均** — 上一版 refactor 把 day centroid 從「全 pin 平均」改成「只算 entry pins」，hotel-only 天就不會 pan、含 hotel 的天 pan 位置會偏移。這版改回含 hotel 的全 pin 平均，行為真正與原本一致。

### Changed
- **TripMapRail 精簡為 thin wrapper**（-115 +45 行，淨 -261 連測試）— 移除自有 `useLeafletMap` + `L.marker` + `L.polyline` + `createPinIcon` + 部分 SCOPED_STYLES。保留 sticky layout + IntersectionObserver scroll spy + 點 pin 跳 `/trip/:id/stop/:eid` 的 navigation 邏輯。

## [2.1.0.1] - 2026-04-23

**字體一致性稽核修復** — 跨桌機 + 手機所有頁面字體統一為 Inter。使用者體感：/manage、/admin 的 button chip 不再用 Arial，地圖 pin 標號不再用 Helvetica Neue / system-ui，Leaflet +/− zoom 按鈕不再用 Lucida Console，整個 app 視覺更統一。

### Fixed
- **Tailwind 4 `text-*` utility class 靜默失效** — `@theme` 沒註冊 `--text-*` token，導致 `text-caption` / `text-caption2` / `text-callout` / `text-body` 等 class 不生效；所有寫這些 class 的 button / span 退回瀏覽器 UA default（Windows `button` = Arial 13.33px）。新增 12 個 `--text-*` alias 從 `--font-size-*` 對映，全部 utility class 一次啟用。
- **`<button>` / `<input>` 字體繼承斷裂** — Tailwind 4 的 `@import "tailwindcss/theme"` 不含 preflight reset；新增全域 `button, input, select, textarea { font-family: inherit; font-size: inherit; }` 讓所有 form element 拿到 body 的 Inter。
- **地圖 pin marker 字體錯誤** — `TripMapRail.tsx` `createPinIcon` 的 inline style 硬寫 `font-family: system-ui`；`OceanMap.tsx` `.ocean-map-pin` 用 `font-family: inherit`（從 Leaflet `.leaflet-container` 繼承 Helvetica Neue）。三處都改用 `var(--font-family-system)` token。
- **Leaflet 預設控件字體** — `+` / `−` zoom 按鈕用 Leaflet stylesheet 預設的 Lucida Console；attribution 用 Helvetica Neue。新增 `.ocean-map-container` 與 `.trip-map-rail` scope 內的 `.leaflet-bar a` / `.leaflet-control-attribution` font-family override。

## [2.1.0.0] - 2026-04-23

**MapPage 多天總覽** — 地圖頁 (`/trip/:tripId/map`) 新增「總覽」模式：最左側 tab 切換到 `?day=all` 後，地圖一次顯示全行程所有景點 pin，每天用不同顏色 polyline 連接路線（與桌機側邊 TripMapRail 一致的 10 色 Day palette）。單日模式 polyline 也改用當天顏色，兩個入口視覺語言統一。點卡片可跨天 flyTo 定位，切 tab 秒速且不重抓路線。

### Added
- **MapPage「總覽」tab** — 日期 tabs 最左側新增「總覽」選項，顯示「{N} 天」副標。URL `/trip/:tripId/map?day=all` 進入總覽模式；既有 `?day=N` 行為保留。
- **多天多色 polyline** — 總覽模式下每天 polyline 用 `dayColor(N)` 著色（10 色循環：sky/teal/amber/rose/violet/lime/orange/cyan/fuchsia/emerald -500）。跨天不畫連線，每天路線獨立。
- **單日模式 polyline 改用 dayColor(N)** — 之前固定 accent 色，現在與 TripMapRail 對齊。同一趟 Day 3 在桌機 rail 和 MapPage 都看到 amber-500。
- **Entry card 跨天定位** — 總覽模式下卡片前綴 `D{N}` 著上當天色。點任一天的卡片可直接 flyTo 該景點座標，不自動切 tab（保留多天視野）。
- **`extractPinsFromAllDays(allDays)` util** — 新 export 於 `src/hooks/useMapData.ts`，回傳 `{ pins, pinsByDay: Map<number, MapPin[]>, missingCount }`。TripMapRail 和 MapPage 共用資料結構。
- **OceanMap `pinsByDay` / `dayNum` props** — 共用 Leaflet 元件支援多天多色 polyline；`buildSegments(params)` 抽為 pure helper 供單元測試。
- **11 個新 runtime 測試** — `extract-pins-all-days.test.ts`（5）、`ocean-map-build-segments.test.ts`（6，含 hotel 過濾 + 跨天不連線契約）、`map-page-overview-runtime.test.tsx`（5，含 `?day=all` 下 fitBounds 不 flyTo、tab 切換 URL/props 同步）。另有 5 個 source-level regression guards。
- **DESIGN.md「地圖 chrome 子例外」** — 記錄 Day 指示 tab active state 可用 `dayColor(N)` 著色（其餘 chrome 仍守 Ocean accent）。

### Changed
- **Day tab 觸控目標 ≥ 44px** — `.map-page-day-tab` `min-height` 從 40px 改 `var(--spacing-tap-min, 44px)`（padding 10px/12px → 12px/14px），符合 Apple HIG。
- **OceanMap viewport follow 優化** — `pins.find()` O(n) 換成 `pinIndexById.get()` O(1)（焦點切換時每次省掉一次線性掃描，overview 模式 30+ pins 尤其有感）。
- **Segment React key 穩定化** — per-day key 從 `d${d}:${a.id}->${b.id}` 簡化為 `${a.id}->${b.id}`，切換 overview↔單日 tab 時 Segment 保持 identity，不再整組 remount / 重新 fetch Mapbox 路線。

### Fixed
- **Overview 初始載入被拉到第一站** — `?day=all` 開啟時不再預設 `activeEntryId` 為第一張 card，OceanMap 走 `fitBounds` 顯示全行程而非 `flyTo` 第一站（Codex adversarial + structured review 雙確認的 P1 bug）。
- **Overview 誤畫 hotel→第一站線段** — per-day polyline 過濾 `type === 'entry'`，對齊 TripMapRail 契約（hotel 是夜棲點不參與路線）。
- **Overview 大行程 pins 不 cluster** — `cluster={!isOverview ? false : undefined}` 讓 OceanMap 內建閾值（>10 pins 自動 cluster）在總覽模式生效。

## [2.0.3.0] - 2026-04-23

R19 — 每日首 timeline entry 橋接前日飯店 check-out。使用者體感：Day 2~7 每天都從「前日飯店退房」開始，時間軸連貫不跳段；Day 1 首 entry 為抵達點。同時移除不再需要的「住宿資訊」card 與「每日/全程交通統計」card（資訊已整合至 timeline）。

### Added
- **OpenSpec change `daily-first-stop-hotel-bridge`** — 3 個 spec delta：新增 `daily-first-stop`（定義 Day N timeline[0] 必為 Day N-1 hotel check-out）、修訂 `trip-quality-rules-source`（R19 入列）、移除 `transport-stats-always-open`（card 已刪）。含 proposal.md / design.md / tasks.md。
- **`tp-quality-rules` R19** — 每日首 entry 規則：Day 1 抵達點、Day N≥2 為前日 `day.hotel` check-out entry（title 含「退房」語意、location 同飯店 POI、不複製 hotel.infoBoxes；若 breakfast.included=true 則 description 開頭 inject「🍳 早餐：…」）。與 R0/R8 正交。
- **`tp-rebuild` step 5b**、**`tp-create` step 4 R19 規則**、**`tp-edit` step 7 travel R19 警示** — 所有 data skill 都納入 R19 rebuild / validate / edit 流程。
- **3 個 R19 紅燈測試**：`tests/unit/day-section-no-hotel-driving-card.test.ts`（7 assertions）、`trip-page-no-trip-driving-stats.test.ts`（3）、`trip-export-no-hotel.test.ts`（7）。

### Removed
- **`src/components/trip/Hotel.tsx`**（-81 lines）— 住宿資訊 card 下架。hotel info 由 timeline[0] 的 check-out entry 承載。
- **`src/components/trip/DrivingStats.tsx`**（-193 lines）— 每日交通統計 card + 全行程交通統計 card 下架。交通資訊改以各 entry 的 travel 欄位就地呈現。
- **`src/lib/drivingStats.ts`**（-162 lines）— `calcDrivingStats` / `calcTripDrivingStats` 計算邏輯整包移除。
- **`src/lib/formatUtils.ts`** — 僅剩 `export {}` 空殼（唯一 caller `formatMinutes` 已隨 drivingStats.ts 移除）。
- **`src/lib/mapDay.toHotelData`** + `HotelData` / `RawHotel` / `RawParking` 類型（-95 lines）— toTimelineEntry 取代其資料路徑。
- **`src/lib/constants.ts`**：`DRIVING_WARN_MINUTES` / `DRIVING_WARN_LABEL` / `TRANSPORT_TYPES` / `TRANSPORT_TYPES_ORDER`（-24 lines，僅 DrivingStats 使用）。
- **`TripPage.tsx` tripDrivingStats 計算 + prop 傳遞**（-14 lines）。
- **`TripSheetContent.tsx` `driving` / `prep` / `emergency-group` / `ai-group` 四個 sheet case + ACTION_MENU_GRID `driving` 項**（-45 lines）。
- **`OverflowMenu.tsx` `driving` 選項**、**`MobileBottomNav.tsx` `driving` sheet case**。
- **`tripExport.ts` Markdown 🏨 住宿 / 退房 header + CSV 住宿名 / 退房時間 columns + hotel row**（-49 lines）。
- **E2E `每日交通統計` + `全旅程交通統計` describe blocks**（tests/e2e/trip-page.spec.js -51 lines）。

### Changed
- **`DaySection.tsx`** — 簡化渲染：只保留 Ocean hero card、Weather card、Timeline；Hotel 與 DayDrivingStatsCard 兩個 render block 移除。
- **`map-day.test.js`** — 3 個 `toHotelData` 測試案例改寫為 `toTimelineEntry` restaurants（URL 模式 + name fallback）。
- **`overflow-menu-divider.test.tsx`** — 分隔線位置由 4/5/8 改為 3/5/7（driving item 移除後）。
- **`quick-panel.test.js`** — action-menu item count 從 13 降至 11。

### Process
- **TDD 紅→綠**：commit `e97180d` 先建 3 個紅燈測試，`870018e` 完成 UI 綠階段，`b05a865` 清理死碼。
- **R19 data migration 已於 7 個 trip 驗證**：本 branch 同 session 跑過 `/tp-rebuild okinawa-trip-2026-HuiYun`（D1 直寫，不進 PR diff），產出 7/7 天 R19 合規 timeline。Prod 驗證：Day 2-6 首 entry 為前日飯店 check-out entry。
- **OpenSpec 流程**：propose → apply（本 PR）→ 待 merge 後 archive。
- **Tests**：610 unit + 179 api = **789 tests all green**，無新增 regression。

## [2.0.2.8] - 2026-04-22

PR 11 post-hoc audit 發現的 tech debt 清理。純 refactor + 1 個 silent bug fix（malformed time 格式顯示「NaNm」字串）。使用者體感：當 time 欄位意外格式錯時不再顯示 "NaNm" 垃圾文字。

### Added
- **`src/lib/timelineUtils.ts`** — 抽出 `parseTimeRange` / `formatDuration` / `deriveTypeMeta` / `parseStartMinutes` / `parseEndMinutes` 共用 util。消除 `TimelineEvent.tsx` / `TimelineRail.tsx` / `Timeline.tsx` 三檔 ~80 行重複邏輯。
- **`tests/unit/timelineUtils.test.ts`** — 43 個 assertions 含 edge cases（null / empty / malformed / 跨日 / NaN / Infinity）+ source-match guards（防止本地 function 定義回流）。

### Fixed
- **`formatDuration(NaN)` → `"NaNm"` 顯示 bug**：`/review` 發現 parseTimeRange 遇 malformed time（例 `"10:ab-11:00"`）時 parseInt 回 NaN，duration → NaN，`formatDuration` 計算結果 `"NaNm"` 被 render 到 stop card。加 `Number.isFinite` guard 覆蓋 NaN / Infinity / -Infinity。

### Changed
- **`TimelineRail.tsx` JSDoc** — 移除過時的「mobile-only compact timeline（設計稿 design_mobile.jsx）」描述，改「桌機與手機統一 compact editorial rail（PR 11 / v2.0.2.7 後）」反映實況。
- **`TimelineEvent.tsx` 刪 unused `index` prop** — 介面宣告但 function body 未使用，dead prop 清理。

### Process
- **OpenSpec SDD proper flow**：`openspec/changes/pr12-timeline-utils/` propose → apply（TDD F001-F005 紅→綠）→ archive。補償 PR #213 跳過 pipeline 鐵律（/simplify / /tp-code-verify / /review / /cso --diff 全跑）。
- **/simplify 3-agent parallel** 發現：Timeline.tsx 的 parseStart/EndMinutes 原本漏抽（F005 補齊）、ParsedTime interface 改 internal（YAGNI）。
- **/review** 抓到 NaN 顯示 bug（本次 ship 重點 fix）。
- **Tests**：577 → **595 tests**（+18）。

## [2.0.2.7] - 2026-04-22

Design-review 發現桌機 vs 手機行程一覽用完全不同的 component 渲染（違反「同 DOM tree、CSS 分流 layout」原則），改成統一使用 `TimelineRail`。使用者體感：桌機版時間軸跟手機一樣簡潔 editorial，不再是 4-col stop card。

### Changed
- **`Timeline.tsx` 刪除 `useMediaQuery('(max-width: 760px)')` 分支**：原本 mobile 用 `TimelineRail`、desktop 用 `TimelineEvent` (4-col stop card) 兩個完全不同的 344 行 component。桌機左欄在 PR 3 (v2.0.2.0) 後已 `clamp(375px, 30vw, 400px)` 跟 mobile 同寬，TimelineRail 即為此寬度設計的 editorial compact rail，直接統一即可。
- **`TimelineEvent.tsx` 保留**：僅 `TimelineEntryData` / `TravelData` type export 仍被 `TimelineRail` / `TodayRouteSheet` / `mapDay.ts` 使用。component 本身變成 orphan export（無 JSX 呼叫處），可未來另一個 PR 清理。

### Fixed
- **Desktop/mobile timeline 結構不一致**：同一個 day section 在 desktop 1440 跟 mobile 375 會 render 出不同 DOM tree。現在統一。

## [2.0.2.6] - 2026-04-21

stale PR #179 抽出的 2 個實質 fix，rebased 到 latest master 後重發。API error logging 更詳細、tripExport 從 N+1 改 batch。

### Fixed
- **`tripExport` N+1 → batch days endpoint**：`src/lib/tripExport.ts` 原本迴圈逐天呼叫 API，改 batch 一次拿齊所有 days，export 大行程（10+ 天）時 API round-trip 從 O(N) 降到 O(1)。
- **`api_logs` 記錄 error detail**：`functions/api/_middleware.ts` 原本 error 進 api_logs 只記 code，加 error.message 細節幫助 debug production issue。
- **`trip-pois` PATCH 驗證訊息**：`functions/api/trips/[id]/trip-pois/[tpid].ts` 改善驗證錯誤訊息（具體欄位而非泛用 "invalid input"）。

### Process
- stale PR #179 (2026-04-14) 原 branch 落後 master 180 檔，直接 rebase 不實際。改 cherry-pick 2 個實質 commit 到 fresh branch（`fix/pr10-extracted-from-179`），無 merge conflict。同 cycle 一起 close #192 / #196 / #150 三個完全過時的 PR。

## [2.0.2.5] - 2026-04-21

Lighthouse CI perf baseline infrastructure。autoplan retro 發現沒 baseline 就沒 regression detection，本 PR 建 non-blocking baseline。對使用者無直接變化，但 master push 後 GitHub Actions 會跑 Lighthouse 3 runs × 3 URLs，PR 反而能看到 perf trend。

### Added
- **`lighthouserc.json`** — 3 URL (`/` + TripPage + StopDetailPage) × 3 runs，desktop preset
- **Perf budget (warn-only)**：LCP < 2.5s、TBT < 300ms、CLS < 0.1、perf score ≥ 0.8
- **`.github/workflows/lighthouse.yml`** — push master + workflow_dispatch 觸發、`treosh/lighthouse-ci-action@v12` + artifact upload
- **`docs/lighthouse-ci.md`** — 使用說明 + 如何看 artifact + future roadmap
- **TODOS.md** — 2 週 baseline 穩定後升 P1（warn → error gate）

### Tests
- 539 → **552** (+13): `lighthouse-config.test.ts` + `lighthouse-workflow.test.ts`

## [2.0.2.4] - 2026-04-21

OG link preview MVP。行程連結在 LINE / iMessage / Slack / Twitter 分享時終於有預覽（藍底 + Tripline 品牌 + 副標），不再是白板。autoplan CEO retro 發現的「Tripline 唯一 distribution channel 完全沒開發」的問題。

### Added
- **Static brand OG image** (`public/og/tripline-default.png`)：1200×630 PNG，Tripline Ocean 藍底 + 白字大標「Tripline」+ 副標「和旅伴一起查看精美行程」+ 裝飾 dot pattern。用 `scripts/generate-og-image.mjs` (sharp + inline SVG) 在 build 時或手動產生。
- **`index.html` OG + Twitter card meta**：完整 `og:type / site_name / title / description / image / image:width / image:height / url` + `twitter:card=summary_large_image / title / description / image`。
- **`_headers` `/og/*` Cache-Control**：`public, max-age=86400` + `X-Content-Type-Options: nosniff`，OG image 24h CDN cache。
- **`TODOS.md` dynamic OG roadmap**：Per-trip 動態 OG image (行程名 + 天數 + 目的地) 的 future scope + blockers (Cloudflare Workers 上 @vercel/og 相容性 + 中文字型載入 + KV cache)。

### Tests
- `og-image.test.ts` (PNG 存在 + size guard)、`og-meta.test.ts` (8 og: props + twitter card)、`og-headers.test.ts` (_headers rule)
- 522 → **539** (+17) 測試總數

## [2.0.2.3] - 2026-04-21

autoplan retrospective 發現的 11 項修復：4 個 regression/假對齊 + 7 個 quality/perf。重要體感：
- 桌機切深色模式後地圖也跟著切（原本永遠淺色）
- 切行程後地圖 focus 跟著切（原本停在上一個行程視角）
- 每天的 polyline 顏色 + 虛實交替，色盲族群也能分辨
- Mobile 底部 tab「訊息」改「助理」（使用者不再以為是 LINE 訊息）
- 左欄 scroll 到哪天，右側地圖自動平移到那天路線

### Fixed
- **TripMapRail `dark` prop 缺失** (F001)：TripPage 沒傳 `dark={isDark}`，dark mode 下地圖底圖永遠淺色。補上 + `useLeafletMap` 收到 `dark` 觸發 tile swap。
- **`fitDoneRef` 跨行程不 reset** (F002)：切行程時 TripMapRail 不重掛，`fitBounds` 不再跑，地圖停在上一個行程焦點。加 `key={trip.id}` 強制 remount。
- **Mobile Hero title 假對齊** (F003)：DESIGN.md 宣稱 mobile hero title 24px 但 CSS 只有 22px。補 `@media (max-width: 760px)` override 對齊 DESIGN.md type scale。
- **`color-scheme` 宣告缺失** (F004)：`html` 加 `color-scheme: light dark`，瀏覽器原生 scrollbar / select / date input 在 dark mode 正確轉暗（之前是白色破相）。

### Changed
- **TripMapRail 改 `React.lazy()`** (F005)：150KB Leaflet chunk 不再從 TripPage 初始 load，mobile 使用者 TTI 受益。desktop ≥1024 才 import。
- **Day Polyline dashArray 色盲友善** (F008)：`src/lib/dayPalette.ts` 新增 `dayPolylineStyle(dayNum)` helper，奇數天 solid、偶數天 `dashArray: '6,4'`。10 色 palette + 虛實交替，sky/cyan 跟 rose/fuchsia 對色盲族群也可分辨。
- **MobileBottomNav「訊息」→「助理」** (F009)：tab label 修正語意誤導（使用者原以為是 message inbox），aria-label 同步。
- **`看地圖` chip tap target 44px** (F010)：`min-height: 44px` + `display: inline-flex; align-items: center;`，符合 Apple HIG 最小觸控目標。

### Added
- **TripMapRail scroll fly-to active day** (F007)：IntersectionObserver 監測 timeline 每天 section 進入 viewport，地圖 `panTo(dayCenter)` 跟著。靜態地圖變成 spatial context。
- **TripMapRail marker click integration test** (F006)：原本 `map: null` mock 讓核心 Leaflet click 邏輯零覆蓋，改用 fake marker 模擬 click → assert navigate 被 called。
- **MapPage `?day=N` runtime test** (F011)：原本 string-match test 升級為 mount + assert：`?day=2` → initialDayNum=2、`?day=abc` → fallback day 1、`?day=999` → fallback day 1。

### Process
- **OpenSpec proper SDD flow**：`openspec/changes/pr6-autoplan-findings/` 先 propose 後 apply（merge 後 archive）。對齊 CLAUDE.md「禁止跳過 propose」。

### Tests
- 501 → **522** (+21) 測試總數

## [2.0.2.2] - 2026-04-21

Design review v2 follow-up cleanup。清除 6 項 low tech debt + editorial logo 一致性 + QA 測試邏輯修正。這次走完整 OpenSpec `propose → apply → archive` 流程（補 PR 1-4 跳過的 SDD 規範）。使用者體感：StopDetailPage 點 logo 也可以回首頁了（跟其他頁一致）。其餘是 inline-refactor 無視覺變動。

### Changed
- **StopDetailPage header 改用 `<TriplineLogo>` component**：原本是 inline `Trip/Line` wordmark，editorial「logo → home」慣例 PR 1 只修到 PageNav 內的 logo，現在 StopDetailPage 也對齊（點 logo `navigate('/')`）。
- **`DaySection` 2 處 inline `style={{}}` 搬到 CSS class**（`.ocean-hero-chips` / `.ocean-hero-chips-left`）：避免 React re-render 產生新 object ref (RBP-22)。警告 banner 的 `style` 因含 `var(--color-warning)` 動態值保留。
- **`TripMapRail` scoped style 改 singleton injection**：原本 inline `<style>` 每 render 產生新 node，改 `document.head.querySelector` guard + 一次 inject。`<TripMapRail>` 多實例共用同一 style node。
- **`OverflowMenu.needsDivider` 邏輯簡化**：移除 `|| prev.action !== item.action` 分支（PR 3 後 group structure 已充分表達 divider 語義）。divider 位置不變，由 structural test 守住。

### Removed
- **`src/components/trip/InfoPanel.tsx`**：PR 3 後 sidebar 已刪，InfoPanel orphan（無任何 `import InfoPanel` 存在），本 PR 完整移除。
- **`css/tokens.css` dead classes**：`.ocean-body` / `.ocean-main` / `.ocean-side` / `.info-panel` 及對應 `@media print` fallback、`--info-panel-w` CSS variable。
- **`src/pages/TripPage.tsx` SCOPED_STYLES dead rule**：`.print-mode .info-panel { display: none !important; }` InfoPanel 刪後已無用（/review HIGH finding）。

### Fixed
- **`.playwright-mcp/qa-pr3.mjs` T8 sticky 邏輯**：原本 assert 「scroll 前後 top 相同」誤判（sticky 設計就是要改變）。改 3-step scroll：initial → scroll 400（sticky 啟動 top≈nav-h 48）→ scroll 800（保持 top≈48 不變）。T8 現 pass。

### Added
- **`tests/unit/dead-css-cleanup.test.ts`**：守住 tokens.css 跟 TripPage SCOPED_STYLES 不再含 `.info-panel` 等 dead rules。
- **`tests/unit/stop-detail-topbar-layout.test.tsx`**：375px narrow viewport structural assertion（back-btn + crumb + TriplineLogo 三欄 flex layout 不 overflow）。
- **`openspec/changes/archive/2026-04-21-pr5-cleanup-follow-up/`**：完整 propose + apply + archive 流程文件（proposal / tasks × 7 F / design / plan / progress.jsonl）。這是 design-review-v2 cycle 後首次嚴格走 OpenSpec SDD 的 PR。

### Tests
測試總數：469 → **501**（+32）。新增覆蓋：
- `F001-F007` 每個 feature 的 red test（dead-css、onClearSheet optional、inline style removed、singleton injection、needsDivider grouping、StopDetailPage TriplineLogo、TripPage SCOPED_STYLES、stop-detail-topbar-layout）
- F007 QA script T8 修正後 verify pass

### 意義
本 PR 除了清 tech debt，更重要的是：這是 `design-review-v2` 系列 4 個 feature PR 後**首次嚴格走 OpenSpec SDD 流程**（PR 1-4 都跳了 propose → PR 4 retrofit 補寫、PR 5 pre-implementation 寫）。之後 PR 全部須先 propose 再實作，禁止再跳過。

## [2.0.2.1] - 2026-04-21

OpenSpec retrofit + 文件同步。Design review v2 的 3 個 PR（v2.0.1.1 / v2.0.1.2 / v2.0.2.0）未走 OpenSpec `propose` 流程，違反 CLAUDE.md 規範。本次事後補齊完整 spec trail，並把 CLAUDE.md 過時描述同步到 v2.0.2.0 實際狀態。對使用者無功能變更。

### Docs
- **`openspec/changes/archive/2026-04-21-design-review-v2-retrofit/`** — 完整 retrofit change archive：proposal / tasks (27 item × 3 phase) / design (14 題 Q&A 決策) / plan / progress.jsonl
- **`openspec/specs/mobile-bottom-nav.md`** — 4-tab route-based IA 規格
- **`openspec/specs/trip-map-rail.md`** — sticky desktop map rail 規格（≥1024px 斷點、clamp 左欄、Leaflet NaN guard）
- **`openspec/specs/day-palette.md`** — 10 色 Tailwind -500 qualitative palette（DESIGN.md Data Visualization 例外的落地規格）

### Changed
- **CLAUDE.md**：`ManagePage` 標注 AI 編輯聊天（非「行程列表」）、加入 `TripMapRail` component、新增 Desktop 2-col layout 段落、新增 MobileBottomNav 4-tab 段落、開發規則加「未走 OpenSpec propose 須補 retroactive archive」條文

## [2.0.2.0] - 2026-04-21

IA 重構 + desktop map rail。Design review v2 的最後一波，把行動 nav 從 5 tab 雜訊收斂到 4 個 route、desktop 從 sidebar 塞小卡改成 sticky 大地圖。使用者體感：
- 桌機打開行程頁，右邊常駐一張全行程地圖，scroll 時跟著，點 pin 直接進 stop 詳情
- 手機底部 tab 只剩 4 個且每個都通到一個 route（不再是混 scroll / 開 sheet / 跳頁的雜燴）
- 每天的 hero 有「看地圖」chip，一鍵看當天全部 stops 在地圖上的分布
- 每天的路線在地圖上用不同顏色（10 色輪流），一眼分得出今天路徑跟明天路徑

### Added
- **`TripMapRail` 新 component**：桌機 ≥1024px 右欄 sticky Leaflet 地圖。全行程 pins + 每天不同色 polyline，點 pin 直接 `navigate('/trip/:id/stop/:entryId')`。地圖高度 `calc(100dvh - nav-h)`，左欄 scroll 時地圖固定。
- **Day color palette (`src/lib/dayPalette.ts`)**：Tailwind 10 色 `-500` (sky/teal/amber/rose/violet/lime/orange/cyan/fuchsia/emerald)，day 1-10 輪流；超過 10 天 modulo wrap；0/負數/NaN/Infinity 都 fallback 到 day 1 色（`dayColor()` 有完整 guard）。對應 DESIGN.md 的 Data Visualization 例外。
- **Day Hero「🗺 看地圖」chip**：每天 eyebrow 右側 Ocean 色 link，導到 `/trip/:id/map?day=N`，MapPage 讀 query param `fitBounds` 到當天 pins。
- **`MobileBottomNav` 的 `看地圖` chip icon**：Icon.tsx 補 `map` SVG（line-stroke 1.75px pinpoint + 方格）。
- **`useMediaQuery` hook (`src/hooks/useMediaQuery.ts`)**：SSR safe，同步讀 `window.matchMedia`。
- **11 個 new unit tests**：`dayPalette`（10 色 + guard）、`mobile-bottom-nav-route`（active 判斷不誤觸 `/manage/map-xxx`）、`trip-map-rail-visibility`、`trip-map-rail-focus`、`day-section-map-link`、`map-page-day-query`、`no-inline-day-map`、`useLeafletMap` NaN zoom guard。測試總數：424 → **469**。

### Changed
- **`MobileBottomNav` 5 tab → 4 tab route-based**：
  - 行程 → `navigate('/trip/:id')` + scroll-to-top
  - 地圖 → `navigate('/trip/:id/map')` ← 新
  - 訊息 → `navigate('/manage')`（原本叫「編輯」）
  - 更多 → 開 `action-menu` sheet
  - Active 狀態改讀 `useLocation().pathname` + regex `/\/trip\/[^/]+\/map/` 嚴格比對。
  - CSS `grid-template-columns: repeat(5, 1fr)` → `repeat(4, 1fr)`。
- **Desktop 2-col layout**：
  - `<1024px`：單欄（mobile-first）+ bottom nav 地圖 tab 看地圖
  - `≥1024px`：`grid-template-columns: clamp(375px, 30vw, 400px) 1fr` 左行程右 map rail
  - 斷點依據：iPad Pro 13" portrait (1024px) 才啟用雙欄；11" 以下 portrait 維持單欄（map rail 擠，直接 map tab 全畫面體驗更好）。
- **`DaySection` 拿掉 inline `<OceanMap mode="overview">`**：每天不再內嵌一張小地圖。全行程地圖由桌機右欄 map rail + 行動端 `/trip/:id/map` tab 承擔。
- **Desktop `OverflowMenu` 補 3 個 sheet 入口**：今日路線 / AI 建議 / 航班（PR 1 砍 topbar dead tab 後 desktop 失去這三個入口的 tech debt 在這補齊）。
- **`TripPage.tsx` 清理**：topbar 中央 tab bar shell 整個拿掉（PR 1 砍 button，PR 3 拿 container）；body render 不再依賴 `activeTripId` selector race，直接用 `trip.id`。

### Fixed
- **`useLeafletMap.fitBounds` single-pin NaN zoom**：map 尚未完全 init 時 `getZoom()` 可能回 NaN，`Math.max(NaN, 14)` 會讓 setView 變 NaN 靜默失敗。加 `Number.isFinite(z)` guard。

### Design System
- **Desktop sidebar 刪除**（progress / 今日行程 / 住宿 3 張小卡）：editorial direction 認這些是 chrome 而非核心內容，main timeline 跟 map rail 已充分覆蓋。配合 user 選項 Q1=A。
- **IA 從混血（tab bar + action bar）回歸純 tab bar**：4 tab 全部是 route-based section 切換，每個 tab 是獨立 view，對齊 iOS HIG 原則。
- **10 色 day palette 是 DESIGN.md Color section Data Visualization 例外的第一個落地**：UI chrome 仍嚴守 Ocean 單 accent。

## [2.0.1.2] - 2026-04-21

設計系統對齊：mobile 字體不再用 em 繼承縮小、三種 glass blur 收斂成一個、警語改 warning 色、AI 編輯 pill 回歸 Ocean 單一 accent。使用者體感：手機讀行程字變整齊、注意事項不再像錯誤訊息、整體視覺語彙一致。

### Added
- **Mobile Type Scale (DESIGN.md)**：新增 `## Type Scale (Mobile ≤760px)` 完整表格，body 在 mobile 下降到 16px、callout 15px、subheadline 14px，其他維持 desktop 尺寸。760px 斷點刻意設在 iPad mini portrait (744px) 以下 + iPad 10/11 portrait (810/820px) 以下，所有 tablet ≥768px 維持 desktop scale。
- **Data Visualization 例外**（DESIGN.md Color section）：明文允許地圖 polyline、chart series 用 10 色 qualitative palette（Tailwind `{sky,teal,amber,rose,violet,lime,orange,cyan,fuchsia,emerald}-500`），UI chrome 仍嚴守 Ocean 單 accent。為 PR 3 的 day palette 先鋪路。
- **Token `--font-size-eyebrow: 0.625rem` (10px)**：補齊 DAY 01 / STOPS 等大寫 section header 專用字級。`caption2 (11px)` 保留給 NIGHT 1 等最小 meta label。
- **Token `--blur-glass: 14px`**：所有 glass 材質（topbar / bottom-nav / sheet）統一使用。

### Changed
- **Glass 統一 14px**：`.ocean-topbar`、`.ocean-bottom-nav`、`InfoSheet` 全部 `backdrop-filter: blur(var(--blur-glass))`。原本 12 / 14 / 28 三種 blur 強度收斂到一個。
- **Sheet 拿掉 `saturate(1.8)`**：對齊 editorial clean direction，sheet 不再做 HDR-like 飽和度拉升。配合 bg opacity 88%→94% 維持邊緣可見度。
- **AI 編輯 pill 改 Ocean fill**：從黑底 + cyan dot 改成 Ocean accent 填色 + 白字。補齊 hover (`brightness(0.92)`) / focus-visible (白色 ring) / active (`brightness(0.85)`) 三個 state。單一 Ocean accent 原則回歸。
- **注意事項卡 destructive → warning amber**：`#C13515` 紅 → `#F48C06` 橘黃。警語不再跟錯誤訊息同色，semantic 準確。
- **Stop card title 確認 17px (headline)**：DESIGN.md 定義 stop name = headline 17px，PR 1 已對齊，本 PR 加測試守住。
- **Hardcode 10/11px 全面 token 化**：tokens.css、DayNav、InfoBox、Shop、Restaurant、ManagePage、MapPage、StopDetailPage 所有 font-size 10px/11px 改用 `var(--font-size-eyebrow)` / `var(--font-size-caption2)`。
- **DESIGN.md `caption2` 與 `eyebrow` 命名分離**：明文寫清楚用途不同，避免未來誤用。

### Fixed
- **`.ocean-bottom-nav-btn` tap target**：padding 10px → 13px + `min-height: 44px` 防呆，符合 Apple HIG 44×44 觸控目標最小值。
- **`.color-mode-preview .cmp-input`**：`border-radius: 4px` hardcode → `var(--radius-xs)` token，消除設計系統破口。
- **`[data-tl-card]` 拿掉 `blur(6px)`**：DESIGN.md 明確寫「不再給 timeline card 用 glass」，實作對齊。

### Tests
- 新增 36 個單元測試（pr2-tokens、pr2-mobile-scale、design-md-sections）：
  - DESIGN.md 要有 Mobile Type Scale section + DV 例外條文
  - tokens.css 要有 `--font-size-eyebrow` + `--blur-glass` 宣告
  - CSS 不得再出現 `blur(12px)` / `blur(28px)` / `saturate(1.8)`
  - `.ocean-bottom-nav-btn` padding + min-height 守住 tap target
  - AI pill `:hover` / `:focus-visible` / `:active` state 存在
- 測試總數：388 → **424**。

## [2.0.1.1] - 2026-04-21

Design review 後的 Tier 0 bug fix：補缺 icon、清死連結、修字體破洞、修 user-trap。使用者體感：底部 5 個 tab 每個都有 icon、topbar 不再有點了沒反應的按鈕、權限管理頁點 logo 可回首頁。

### Fixed
- **MobileBottomNav「編輯」「更多」終於有 icon**：原本這兩個 tab 只有文字（10px 極小），另外三個（行程/建議/航班）有 icon。現在整排一致。
- **Topbar 三個死連結拿掉**：「路線 / 航班 / AI 建議」點下去沒反應（router 沒掛對應路由），整個拿掉避免誤導。原本開啟的 sheet 仍可從底部 bar 觸發。
- **AdminPage 不再 dead-end**：`/admin` 原本右上有 × 關閉但那是獨立頁不是 modal，按瀏覽器返回可能跳外站。改：`TriplineLogo` 包 `<Link to="/">`，點 logo 可回首頁（所有頁面通用）；AdminPage 右上 × 移除，避免 modal/page 混淆。
- **非整數字體破洞**：DayNav eyebrow 9.5px、day-chip area 11.5px、hero eyebrow 10.5px、InfoBox heading 10.5px、Manage hero eyebrow 10.5px 改為整數 10/11px 對齊 DESIGN.md type scale。原本因 `em` 繼承失控產生的 subpixel render 不一致消失。

### Changed
- **`TriplineLogo` 統一變成 `<Link to="/">`**：所有頁面（ManagePage / AdminPage / TripPage / MapPage / StopDetailPage）左上 logo 都可點回首頁。對齊 Airbnb / NYTimes 等 editorial 網站慣例。
- **`PageNav.onClose` 改 optional**：modal-like 頁面傳 `onClose` 才會 render × 按鈕，standalone page 省略即可避免語意混淆。
- **`Icon.tsx`**：補 `edit`（鉛筆）與 `menu`（三橫線）SVG；刪除重複且未使用的 `pencil` entry。

### Added
- **18 個新單元測試**：`tripline-logo-link`（link 導向 `/`）、`icon-edit-menu`（edit/menu SVG 非空）、`mobile-bottom-nav-entries`（5 個 tab 全 render）、`no-fractional-fontsize`（CSS 非整數 px guard）、`trip-page-sheet-default`（RTL mount 驗 sheet 預設關）、`admin-page`（TriplineLogo link 可達）。測試總數 370 → 388。

### Dev infra
- **`vite.config.ts` 加 `optimizeDeps.include: ['leaflet']`**：解決 pull 後 dev server 無法 resolve `leaflet` 卡住 OceanMap 的問題。leaflet 是 CJS/ESM 混用包，vite 8 的 on-demand 自動 prebundle 觸發 race；`supercluster` 是純 ESM 不需手動 include。

### Known limitations（留 PR 3）
- **Desktop 失去 `today-route` / `suggestions` / `flights` 3 sheet 入口**：目前只有 MobileBottomNav 能開啟（mobile 仍正常）。PR 3 IA 重構會改成 4-tab route (`行程 / 地圖 / 訊息 / 更多`)，完整補 desktop 入口。
- **font-size 目前仍 hardcode px**：對齊 DESIGN.md type scale 但還沒全部用 CSS token。PR 2 Typography pass 會補 `--font-size-eyebrow` 等 token，`tokens.css:304` 的 `border-radius: 4px` pre-existing 未用 `var(--radius-xs)` 也一併處理。
- **`.ocean-bottom-nav-btn` padding 41px < 44px Apple HIG**：pre-existing，PR 2/3 會一起修到 ≥44px。

## [2.0.1.0] - 2026-04-20

Ocean v2 發布後的 `/simplify` code health 循環：消除重複、收斂 helper、優化地圖效能、補足單元測試。使用者體感：地圖切換景點反應更快、無視覺變化。

### Changed
- **OceanMap marker cache 重構**：拆成 create effect（pins 變動時建 marker）+ diff 式 update effect（focus 變動時只 `setIcon` 受影響的 2~5 個 marker）。原本每次 focus 切換全量重建整層 `L.LayerGroup`，10 pins × 5 次切換 = 50 次 marker 重建；現在只剩 ~10 次 setIcon。
- **OceanMap cluster path 拆 create/update**：Supercluster index 建一次，focus 變動用 `clusterRefreshRef` 觸發 `refresh()`，不再重建 index。TripPage overview >10 pins 的 cluster 模式大量級也受益。
- **Segment polyline 改 `setStyle`**：`isActive` 切換不再 `remove()` + `L.polyline()` 重畫，直接改屬性。
- **`pinIndexById` Map 取代 `pins.findIndex`**：marker 迴圈內每個 pin 都查 O(N) → 一次性建 Map 後 O(1) 查。

### Added
- **`BreadcrumbCrumbs` 共用組件**：StopDetailPage/MapPage 的 crumb 分段渲染抽出來，用 `classPrefix` 支援各頁 scoped style。
- **`mapDay.ts` 三個共用 helper**：`findEntryInDays`（跨日查 entry）、`parseLocalDate`（YYYY-MM-DD 嚴格解析，拒絕 `2026-02-30` rollover）、`formatDateLabel`（M/D 無補零）。StopDetailPage、MapPage、DayNav 三處重複定義收斂。
- **21 個新單元測試**：涵蓋三個新 helper 全部分支（null / invalid / happy / 邊界）、`BreadcrumbCrumbs` 6 項行為、`formatPillLabel` fallback 路徑。測試總數 340 → 364。

### Fixed
- **focus state 同步修正**：OceanMap update effect 的 deps 加 `map` / `onMarkerClick`，避免 create 重建後 focus state 被 reset 成 idle。
- **`parseLocalDate` 拒絕溢位日期**：`2026-02-30` 原本會被 JS Date 靜默解讀為 3/2，現在加 round-trip 檢查正確回傳 null。
- **`markersRef` cleanup 條件式 reset**：Strict Mode 雙 mount 之間避免新 map 被舊 cleanup 清空。
- **`focusStateRef` 移進 useEffect**：原本在 render phase 直接賦值違反 React 純度，concurrent render abort 會讓 ref reflect aborted state。
- **`findEntryInDays` 加 `Number.isFinite` 守衛**：`entryId=NaN` 直接 return null。

### Removed
- **`height: 100% !important` CSS hack**：改用 `fillParent` prop + `[data-fill-parent="true"]` selector。
- **重複的 `findEntryInDays` / `formatDateLabel` 定義**：StopDetailPage、MapPage 兩處拷貝刪除。
- **DayNav 三處 `new Date(date + 'T00:00:00')` 手寫 idiom**：統一用 `parseLocalDate`。

## [2.0.0.0] - 2026-04-20 — Ocean 大改版里程碑

這版宣告 Ocean 重設計（PR1 Leaflet 基建 + PR2 景點詳情頁 + PR3 全圖地圖頁）完整發布。
所有主要頁面視覺語言統一為 Airbnb editorial 風（白底 + hairline + rounded-xl + 單一 Ocean accent）。

### Added
- **全圖地圖頁 `/trip/:id/map` + `/trip/:id/stop/:id/map`**：行程一覽頁與景點明細頁的地圖現在都能切到全螢幕模式。入口是地圖右上的 `⤢` expand icon。
- **Funliday 風互動地圖導覽**：全圖頁由上到下是 breadcrumb topbar + 全螢幕 OceanMap + 日期 tabs（underlined style）+ 橫向 swipe entry cards（snap-scroll）。日期 tab 切換當日、card swipe/click 讓 map flyTo 該景點。IntersectionObserver 偵測中央卡片自動同步 focus。
- **Deep link 支援**：從 StopDetailPage 的 `⤢` 進入會自動切到該景點所屬日期並 focus；從 DaySection map 進入會鎖定那一天；從 trip overview 進入預設 Day 1。

### Changed
- **Padding trick centred swipe cards**：`.map-page-cards padding-inline: max(16px, calc(50% - 110px))` 讓第一張和最後一張 card 都能 snap 到 centre，不會卡左/右邊。

## [1.3.4.0] - 2026-04-20

### Added
- **ManagePage `/manage` 整頁重新設計**：跟景點詳情頁統一視覺語言 — breadcrumb topbar（sticky glass blur + 52px + ← back button + eyebrow「AI 編輯」+ trip selector pill + Trip/Line online logo）+ hero「訊息紀錄」title + subtitle「修改行程內容或向 Tripline 請教建議，處理時間約 30 秒」。chat bubble 去 AI slop（border-l-[3px] border-accent quote 改 hairline box）、mode toggle「修改/提問」改 outline-only pill、input bar 去 shadow-md 改 hairline + focus-within accent。
- **401/403 AuthRequiredCard**：`/manage` 認證失敗從「無法存取，請重新整理頁面」模糊訊息改 editorial card，本機顯示 `.dev.vars` + `DEV_MOCK_EMAIL` 設定步驟 + code snippet，生產顯示「前往 Cloudflare Access 登入」accent button。

### Fixed
- **Markdown parser 處理 legacy DB 資料**：renderMarkdown 兜底 unescape literal `\n`（兩字元）→ 真換行、`\t` → tab、`\|` → |；保留 fenced code blocks 內字元不動。解決 AI 回覆的 `## 標題\n\n內容\n- item` 表格 / 標題 / bullet list 顯示破掉的問題。
- **Icon registry 補 chevron-left / chevron-right**：ManagePage + StopDetailPage 的返回按鈕以前因為 Icon 元件對未知 name 回 null，`<Icon name="chevron-left" />` render 成空 button，使用者看不到 affordance。現已補進 Material Symbols path data。
- **本機 mock auth 文件修正**：CLAUDE.md 原寫「`.env.local` 的 `DEV_MOCK_EMAIL`」實際上 wrangler 只讀 `.dev.vars`。新人 onboard 設錯地方導致 `/manage` 一直 401。`.dev.vars.example` 補 `DEV_MOCK_EMAIL` + `ADMIN_EMAIL` 範例 + 註解、CLAUDE.md 指向正確檔案 + 附 `cp .dev.vars.example .dev.vars` 指令 + 重啟 dev 提示。

## [1.3.3.0] - 2026-04-20

### Changed
- **景點詳情頁重新設計（Airbnb editorial 風）**：StopDetailPage layout 整頁重寫 — breadcrumb topbar 取代重複標題、hero title 放大 26-30px、地圖套 rounded 16px 卡片 + aspect-ratio 16:9 + 雙層 shadow、desktop CTA 改 inline（不再 sticky 蓋住內容）、subtitle/note 字級升到 16px body。Mobile topbar breadcrumb 不再換行，trip title 桌機才顯示。
- **餐廳正備選視覺層級分明**：`Restaurant` 元件改白底 + 1px hairline border + rounded-xl，新增 `variant="hero"` 給正餐廳（accent outline + 淺藍漸層底），`variant="standard"` 給備選。InfoBox `RestaurantsBox` 整片 `bg-accent-bg` 藍底拿掉，改 eyebrow heading（10px uppercase + accent icon），備選改精簡 row（name + category + rating + chevron），展開後 render standard Restaurant 卡片。
- **購物必買 chip 化**：`Shop` 元件必買從「沖繩甜王草莓、山芋片、金枕紅心西瓜」inline 一串文字改成每項獨立 accent pill chip（dashed top border 區隔），category 從 `<strong>xxx：</strong>` 改成 rounded-full chip，白底 + hairline 卡片。
- **DayNav 瘦身 ×2**：chip 從 4 行堆疊（DAY + 日期 + 區名 + 6 dots）改成單行水平排版「DAY 01 · 7/29 Wed · 北谷」，高度 147 → 55px（-63%）。桌機再改 GitHub/Apple HIG underlined tab style（無 border、accent 文字色 + 2px underline active），55 → 37px。總 chrome（topbar + daystrip）13% → 11%。Mobile 維持 pill card style（橫滑 snap-scroll）。
- **InfoBox 家族整體同步**：Hotel 展開的 parking / shopping panels 也獲益於 InfoBox wrapper redesign（去藍底 + eyebrow + hairline）。

## [1.3.2.0] - 2026-04-19

### Added
- **POI 景點詳情頁 `/trip/:tripId/stop/:entryId`**：點任一景點跳新頁，顯示 Ocean 地圖（單點聚焦 280px）+ DAY/日期/時間 eyebrow + 大標 + 備註 + 相關資訊（infoBoxes：餐廳備選/停車/預約等）+ 底部 accent 圓角按鈕「在 Google Maps 開啟導航」。手機/桌機共用同一 layout，桌機 maxWidth 720px 置中。
- **`TripLayout` + `TripContext`**：`/trip/:tripId/*` 子路由共用同一份 trip+days fetch，StopDetailPage 不再重抓。
- **`useScrollRestoreOnBack` hook**：從詳情頁按返回時，TripPage 自動捲回原 entry（`useLayoutEffect` + `requestAnimationFrame` + `[data-scroll-anchor]` 查找），用完 state 自動清空避免重捲。

### Changed
- **Timeline row 整行可點**：手機 `TimelineRail` + 桌機 `TimelineEvent` 整個景點 row 現在都是 tap target（Enter / Space / click 皆觸發），跳到詳情頁。桌機 row `role="button"` + focus-visible outline，hover 時右側 chevron 前推 3px。
- **拿掉 inline expand**：原 TimelineRail 展開段（note / description / locations / infoBoxes）移到 StopDetailPage 承接。精簡 row 視覺，只留 name/time/type/rating/note。

### Migration
- Router 結構從平坦 `<Route path="/trip/:tripId" element={<TripPage />} />` 改為 nested layout：
  ```
  /trip/:tripId        TripLayout
    ├── (index)        TripPage
    └── stop/:entryId  StopDetailPage
  ```
- `TripLayout` 只做 `useTrip(urlTripId)` + provide context；TripPage 繼續用自己的 `resolveState`（處理 unpublished / default fallback）不動。SW cache 吸收 2× fetch。

## [1.3.1.0] - 2026-04-19

### Changed
- **地圖全面遷移 Google Maps → OpenStreetMap (Leaflet)**：拔除 `@googlemaps/js-api-loader` 依賴，改用 `leaflet` + OSM tile（light = OSM 主站、dark = CartoDB Dark Matter）。省 API billing、載入時間改善、支援未來 Service Worker offline tile cache。
- **新 `<OceanMap>` 元件統一兩個地圖入口**：取代 `<DayMap>`（單日）和 `<TripMap>`（全行程）。props: `mode: 'detail' | 'overview'` + `focusId` + `routes` + `cluster`。overview 模式 >10 站自動 supercluster。
- **路線資料層改 Mapbox Directions free tier（100k/月）透過 CF Worker `/api/route` proxy**：token 永不暴露前端（存 CF Pages secret）、IndexedDB LRU cache 100 條、fetch 失敗自動 fallback Haversine 直線 + 虛線 + `approx: true` 標記。

### Added
- **`useLeafletMap` hook**：管理 Leaflet map instance 生命週期，Strict Mode idempotent guard（檢查 `container._leaflet_id`），`flyTo` 支援 `prefers-reduced-motion`，暗色模式動態切換 tile provider 不 remount。
- **`useRoute(from, to, opts?)` hook**：單 segment 懶載入 polyline，IndexedDB cache（`idb` wrapper）+ LRU eviction，支援 `fromUpdatedAt`/`toUpdatedAt` cache invalidation（POI 座標變更時失效）。
- **Ocean 編號 pin marker**：數字圓形 marker（focused accent 36px / idle 28px / past 灰），跟手機 timeline rail dot 設計同源。

### Removed
- `src/components/trip/DayMap.tsx`（340 行，Google Maps 單日地圖）
- `src/components/trip/TripMap.tsx`（364 行，Google Maps 多天總覽 + Day 色盤 legend）
- `src/components/trip/MapMarker.tsx`（256 行，Google Maps 自訂 InfoWindow overlay）
- `src/components/trip/MapRoute.tsx`（268 行，Google Maps DirectionsRenderer + travel label overlay）
- `src/hooks/useGoogleMaps.ts`（92 行，Maps JS API loader）
- `src/hooks/useDirectionsRoute.ts`（176 行，Google Directions Service hook，batch+cache 邏輯移植到 `useRoute`）
- 6 個舊 Google Maps tests（`day-map`/`trip-map`/`map-marker`/`map-route`/`use-directions-route`/`day-map.spec.ts`）
- `GOOGLE_MAPS_URL_BASE` 常數改名為 `EXTERNAL_NAVIGATION_URL_BASE`（避免誤導為 Platform API）

### Migration
- 新增 CF Pages env var：`MAPBOX_TOKEN`（public `pk.*` token，domain-restricted）
- 既有 `useMapData` / `extractPinsFromDay` 純資料邏輯保留不動，供新舊兩套共用。
- Day 色盤 legend 不再沿用（Ocean 單一 accent），overview 模式以 cluster 數字取代。

## [1.3.0.0] - 2026-04-19

### Added
- **Ocean 單主題設計系統**：依 Claude Design 產出的 Okinawa Trip Redesign / Mobile mockup 做整體視覺重設計。純白底 + 海洋藍 `#0077B6` accent + Airbnb 風格三層陰影 + hairline border + Inter/Noto Sans TC 字型。
- **Ocean 版 Topbar**：sticky glass blur + 32×32 logo 方塊 + Trip/Line brand + nav tabs（行程/路線/航班/AI 建議）+ 右側 action buttons（緊急/列印/更多 dropdown/AI 編輯 dark pill）。
- **OverflowMenu 元件**：topbar 右側「更多」按鈕下拉，9 個功能項 + 分隔線（出發清單/雨天備案/交通統計/切換行程/外觀設定/匯出 PDF/MD/JSON/CSV）。React portal + position:fixed，任何 ancestor overflow 都切不到。
- **Day chip 160px rich 版**：DAY XX eyebrow + 26px 大日期 + dow + area + 真實 stops 數畫 progress marks（超過 6 顯示 +N）。
- **Ocean Hero card**：每日 Ocean primary 藍底白字 + eyebrow chips + 32px title + Stops/Start/End stats 3 格。
- **4-col Stop card**（桌機）：`68px time | 48px icon | content | actions` grid，sight/food Ocean accent，其他 ink。
- **Compact Timeline Rail**（≤760px 手機）：54px 時間欄 + 1px 豎線 + 10px dot + 可點展開 note。
- **Mobile bottom tab bar**：5 tab（行程/編輯/建議/航班/更多）with Ocean active highlight + safe-area。
- **Action menu sheet**：手機「更多」tab 開 3×3 功能 grid + 匯出 row（替代桌機 dropdown）。
- **FlightSheet 元件**：把航班 DocEntry 解析成雙大字 `TPE 18:30 → OKA 20:50` 卡片，含座位、登機門、確認狀態 dot。Fallback 到原 description 當 parser 認不出結構。
- **SuggestionSheet 元件**：把 AI 建議按關鍵字分 3 層（高/中/低）優先級，左側 4px accent border 項目卡。
- **Sidebar SideCards**（桌機）：整體進度（7 格 progress bar + 第 X 天）/ 今日行程 / 住宿安排（全程合併夜數）/ 當日交通 / 航班（Outbound/Return monospace）。
- **TripLineLogo 三線 lego mark**：32×32 Ocean 方塊 + 3 條遞減 opacity 橫線 + 3 個 stud dots。
- **useMediaQuery hook**：SSR-safe React hook 訂閱 media query change event，供 Timeline 依螢幕寬切 rail/card。

### Fixed
- **手機 Timeline Rail 展開列補回 InfoBox + NavLinks**：修復 Ocean 重設計後手機餐廳備選、停車資訊、預約連結等 infoBoxes 不顯示的 regression。TimelineRail 展開段原只渲染 note + description，現補 locations (NavLinks) + infoBoxes (含 restaurants / parking / reservation 等 6 種 box)。同時把 item 根節點從 `<button>` 改成 `<div>` + 裡面單獨 `<button class="ocean-rail-head">`，避免 button 裡嵌 button/a 的 HTML 違規。
- **手機 Timeline Rail 對齊 + 編號 + 字級**：原本時間/圓圈用 absolute 定位算錯 3-4px，改成 `grid-template-columns: 44px 24px 1fr`（time/dot/head 三欄 + column-gap 10px）自然置中對齊。圓圈放大到 24×24 裝入景點編號（accent 色 / now 態藍底白字）。rail-name 13→15px、rail-sub 10→12px、rail-time 12→13px、expand 12.5→14px，eyebrow/meta 10→11px。豎線 left 對準 dot 中心 x=66。

### Changed
- **DayNav 日期總覽列改為 sticky**：`.ocean-day-strip` 加 `position: sticky; top: 64px`（手機 56px）+ backdrop-blur + hairline border，捲動時釘在 topbar 下方。負 margin bleed 到 viewport 邊緣讓毛玻璃底色蓋滿。`.ocean-day` scroll-margin-top `84px → 210px`（手機 190px）、`.ocean-side` top `84px → 200px` 避免 sticky 堆疊重疊。chip 視覺格式 100% 保留。
- **theme 系統簡化為單一 Ocean**：刪除 `sun/sky/zen/forest/sakura/night` 六套主題，`useDarkMode` 移除 `ColorTheme` / `setTheme` / `THEME_CLASSES`，只管 `light/auto/dark`。`appearance.ts` 移除 `COLOR_THEMES` + `THEME_ACCENTS`。TripSheetContent 的外觀 sheet 只剩色彩模式選擇器（3 個 card）。
- **tokens.css 全面改寫**：砍 1800+ 行六主題覆寫，新增 Ocean light + dark (deep navy `#0D1B2A`) + print 三 variants。radius 對齊 Airbnb（sm:6/md:8/lg:12/xl:16）、shadow 三層中性黑。
- **字型**：system font stack + Caveat 手寫 → Inter + Noto Sans TC（設計稿指定）。
- **meta theme-color**：`#F47B5E` → `#0077B6`。
- **DayNav 整個重寫**：從細 pill + 左右箭頭按鈕改為 160px rich chip 橫向 scroll（不需要箭頭）。
- **TimelineEvent 重寫**：從 polygon time flag + dashed 豎線改為 4-col grid stop card；≤760px 切換到 TimelineRail。
- **InfoPanel 擴充**：原 3 卡變 5 卡（加整體進度 + 住宿安排 + 航班）。

### Removed
- **QuickPanel FAB**：全刪（14 項功能按鈕 + FAB + sheet overlay）。所有功能搬到 topbar nav tabs / action buttons / OverflowMenu dropdown / Mobile bottom nav / action-menu sheet。
- **Edit FAB**（右下角 + 圓形按鈕）：topbar 的 AI 編輯 dark pill 取代。
- **Theme picker UI**：外觀 sheet 裡的色彩主題選擇器（6 個 card）移除，只剩色彩模式 light/auto/dark。
- **ThemeArt 六主題 SVG**：1038 行砍成 53 行，只保留 Ocean wave FooterArt，其餘 null。

### Fixed
- **FlightSheet parser**：容納「出發 → 抵達」格式（時間被文字切開）、label 讀 section 先、機場代碼白名單、航空公司 code 支援虎航 IT / 樂桃 MM / 台灣虎航 IT / 酷航 TR / 越捷 VJ 等。
- **OverflowMenu 下拉被切**：因 topbar overflow 導致 popover clip。改 React portal + position:fixed 徹底避開所有 ancestor stacking/clipping context。

### Migration
- 已存 `colorTheme` localStorage 值（sun/sky/zen/forest/sakura/night/ocean）對 Ocean-only 版本無害：`useDarkMode` 直接忽略該 key，不會 crash。

## [1.2.4.0] - 2026-04-17

### Changed
- **DayNav 日期 pill 等寬**：原本不同字元數的日期（`7/30` 4 chars vs `8/1` 3 chars）pill 寬度不同（63 vs 52px），視覺上一排大小不一、跳動不整齊。改用 `min-w-[4.5em]` 相對單位（mobile 60px / desktop 90px），**所有 pill 等寬**，跟著字體 size responsive 縮放。也加上 `tabular-nums` 讓日期數字等寬顯示，避免 `1` vs `9` 字形寬度差異造成視覺錯位。

## [1.2.3.9] - 2026-04-17

### Removed
- **DayNav sliding indicator**：PR #187 改了 transition curve 想淡化 ghost trail，但使用者實測仍不滿意（切換時視覺上還是「有東西滑過不相干的 pill」）。直接移除整個半透明 indicator layer（`{indicatorStyle && <div>...</div>}` + `useLayoutEffect` + state）。active pill 本身已是實心橘色背景 + 高對比文字（`bg-accent text-accent-foreground`），辨識當前日期完全夠用。移掉這層 additive 效果讓 DayNav 變得乾淨直接。

### For contributors
- `DayNav.tsx` 少了 25 行（state、useLayoutEffect、indicator JSX、相關 transition 註解），也不再 import `useLayoutEffect`。

## [1.2.3.8] - 2026-04-17

### Fixed
- **DayNav 滑動指示器捲動時「底圖變大」到隔壁日期格**：切換日期時指示器用的 spring easing（`cubic-bezier(0.32, 1.28, 0.60, 1.00)`, y1=1.28）會 overshoot 28%，讓指示器衝過目標 pill 到隔壁格短暫停留再彈回；加上 `width` 也同時 spring 造成視覺上像「隔壁 pill 有個比它還大的背景框」。改用純 ease-out curve `--transition-timing-function-apple`（已在 tokens.css 有定義，y2 不超過 1，無 overshoot），指示器現在乾淨滑動到目標 pill，不再污染鄰居。

### Notes
- `--ease-spring` token 保留給 `InfoSheet` / `QuickPanel` 的 bottom sheet 彈出動畫用（那裡 overshoot 是對的 Apple HIG 彈性動畫），未動到共用 token。

## [1.2.3.7] - 2026-04-17

### Changed
- **`scripts/lib/local-date.js`（新）**：把 `daily-check.js` 內聯的 `todayISO()` 抽成共用模組，支援注入時間（`todayISO(now)`）方便測試。`daily-check.js` 改用 `require('./lib/local-date')`。
- **`tests/unit/local-date.test.js`（新）**：6 條單元測試，包含 PR #171 的 regression（凌晨本地 06:13 屬「今天」而非 UTC 前一天）、月日補 0、月初年尾邊界、無參數 smoke。**時區無關**（用 `new Date(y, m, d, h, m)` 本地建構式）在任何 CI runner TZ 下皆穩定。

### For contributors
- 以後修排程 / 時區相關 bug 時請新增對應 regression test 到 `tests/unit/local-date.test.js` 或兄弟檔。

## [1.2.3.6] - 2026-04-17

### Fixed
- **Mobile URL bar 捲動時 active 日期框抖動**：mobile Chrome/Safari 捲動時 `window.innerHeight` 會隨 URL bar 收縮抖動，邊界情境 DayNav active pill 可能 toggle 一次。改用 `document.documentElement.clientHeight`（layout viewport，mobile 穩定）。
- **列印模式 scroll listener 沒清除**：進入列印模式後頁面 scroll listener 繼續觸發 state update。onScroll effect 加 `isPrintMode` 依賴，進入列印模式時 early return 並由 React cleanup detach。
- **切換行程後 URL hash 可能殘留舊值**：scroll-spy 的 dedup ref 跨行程沒 reset，若兩行程首日 dayNum 相同會漏掉第一次 hash 更新。`handleTripChange` 加 ref reset。
- **單天行程或短頁面分享時沒日期錨點**：頁面短於 viewport 時 onScroll 從不觸發，URL 停在無 hash 狀態。新增 `computeInitialHash()` pure function，初次載入完若無合法 hash 自動推入 `#day{today}` 或 `#day{first}` fallback。

### Changed
- **`src/lib/scrollSpy.ts`**：新增 `getStableViewportH()` 與 `computeInitialHash()` 兩個 pure function，抽離自 TripPage 內聯邏輯，好測也避免重複。
- **`tests/unit/scroll-spy.test.ts`**：新增 8 條單元測試覆蓋 mobile viewport 穩定性、今日匹配、單天行程 fallback、非法 hash fallback、空陣列。

## [1.2.3.5] - 2026-04-17

### Fixed
- **右上角日期框捲動時標錯日**：DayNav active pill 在捲動過頁時延遲切換，Day N header 已完整顯示在 sticky nav 下方時仍停在 Day N−1；連帶右側 sidebar「今日行程 / 當日交通 / 今日住宿」顯示錯誤日期的資料。`src/pages/TripPage.tsx` 的 scroll-spy 閾值由 `navH + 10`（header 貼到 nav 下緣才切）改為 `navH + (innerHeight − navH) / 3`（header 進入可視區上 1/3 就切），與 Apple HIG scroll-spy 慣例一致。

### Changed
- **`src/lib/scrollSpy.ts`（新）**：把 onScroll 內的演算法抽成 pure function `computeActiveDayIndex`，null-safe、依單調遞增假設做 early-break，hot path 減少 `getBoundingClientRect` 呼叫。
- **`tests/unit/scroll-spy.test.ts`（新）**：10 條單元測試覆蓋 bug 場景、邊界、mobile viewport 抖動穩定性、null header。

## [1.2.3.4] - 2026-04-16

### Fixed
- **防止 GET /days/undefined 404 錯誤**：`fetchDay` 加入 `Number.isInteger` + 最小值檢查，阻擋 undefined / NaN / 浮點數等無效 dayNum 發出 API 請求

## [1.2.3.3] - 2026-04-13

### Added
- **CI 自動套用 D1 migrations**：新增 `.github/workflows/deploy.yml`，每次 master push 若 `migrations/**` 有變更就自動跑 `wrangler d1 migrations apply --remote`，關閉原本「CF Pages 部署 code 但 schema 還沒更新」的 race window
- **Concurrency lock**：`concurrency: d1-migrations-production` + `cancel-in-progress: false`，防止連續 master push 讓兩個 migration workflow 同時撞 `d1_migrations` tracking table（會造成重複套用或 half-applied 狀態）
- **Fail-loud Telegram 告警**：`if: failure()` step 會在 migration 失敗時立刻推 🚨 到 Telegram，含 commit SHA 和 workflow run URL。不用等到隔天 daily-check 才發現

### Notes
- **起因**：Tier 1 (PR #169) 部署時踩到這個坑 — 新 middleware 預期 `api_logs.source` 欄位存在，但 CF Pages 不會自動 apply D1 migrations，造成 ~2 分鐘的 schema gap，期間所有 4xx/5xx 的 INSERT 靜默失敗（被 `context.waitUntil()` 吞掉，不回 500 但 log 遺失）
- **並行性**：Workflow 並行於 CF Pages build 執行，migration apply 通常 10-30s 完成，CF Pages build 通常 60-120s，因此 migration 在正常情況下會先落地
- **Paths filter**：只在 `migrations/**` 或 workflow 自身變更時觸發，一般 code-only PR 不會浪費 CI 分鐘
- **Manual fallback**：`workflow_dispatch` 允許 GitHub UI 上一鍵重跑（例如失敗後重試）
- **Idempotent**：`wrangler d1 migrations apply` 會追蹤已套用的 migration，no-op case 約 3 秒完成
- **Lockfile-pinned wrangler**：用 `npm ci + npx wrangler`（不是 `npx -y wrangler@4`），吃 `package.json` devDep 的 `^4.80.0` 版本，避免任意 4.x 版本漂移
- **Migration 作者 contract**：D1 不支援跨 statement transaction；若 migration 被 timeout 殺掉，DB 會 half-applied。所有 migration 必須 idempotent（用 `IF NOT EXISTS` / `IF EXISTS`），保證重跑安全
- **Follow-up 未做**：`environment: production` + 環境 scope secrets（supply-chain hardening），需搭配手動 GH settings 變更，未來再做

## [1.2.3.2] - 2026-04-13

### Changed
- `.gitignore` 擴充：排除 `.DS_Store`、`.wrangler/state/`、`.wrangler/tmp/`、`.context/daily-check-*.log`、`.claude/skills/tp-workspace/trigger-results/` 等本地噪音檔，`git status` 不再被 cache/log 淹沒
- 清除誤 commit 的 `.wrangler/tmp/` build cache（af696df 遺留的 7 個 stale 檔）

## [1.2.3.1] - 2026-04-13

### Changed
- 測試覆蓋率強化：`?all=1` batch endpoint 新增 7 個測試（hotel+parking / shopping / travel / location 解析 / 空行程 / batch vs single-day regression guard）
- helpers.ts `seedEntry` 支援 travel + location 欄位，`seedTripPoi` 支援 hotel/shopping context + nullable entry_id

## [1.2.3.0] - 2026-04-13

### Changed
- **行程載入 N+1 修復**：useTrip 從「每天發一個 API 請求」改為「一次批次請求取得所有天」。7 天行程從 9 次 API call 降為 2 次，後端 DB query 從 N×3 降為 4 次固定。
- 新增 `GET /api/trips/:id/days?all=1` 批次端點，一次回傳完整行程資料（含 hotel + timeline + POI 歸類）。既有 `?all=0`（預設）行為不變。
- 共用 POI 組裝邏輯抽到 `functions/api/trips/[id]/days/_merge.ts`（`mergePoi` / `assembleDay` / `fetchPoiMap`），`days/:num` 與 `days?all=1` 兩個 endpoint 共用。

## [1.2.2.0] - 2026-04-13

### Changed
- Weather API 從逐座標 N+1 查詢改為批次查詢 Open-Meteo，一天多個景點只發一次 API call，降低外部請求量

## [1.2.1.3] - 2026-04-13

### Changed
- daily-check Telegram 修復摘要格式：`總數:N 修復:M 不處理:L` → `總計:N 已處理:M 不處理:L`。「已處理」更精準涵蓋實際修復 + skipped（含合理不修的項目均算已處理過）

## [1.2.1.2] - 2026-04-13

### Fixed
- `scheduler-common.sh` 新增 `CLAUDE_BIN` 常數（絕對路徑 `$HOME/.local/bin/claude`），解決 launchd PATH 找不到 `claude` 指令導致 Phase 2 autofix 失敗
- `daily-check-scheduler.sh` 和 `tp-request-scheduler.sh` 改用 `$CLAUDE_BIN`

## [1.2.1.1] - 2026-04-13

### Fixed
- daily-check 日期使用本地時區，修正 06:13 CST 執行時產出檔名標成昨天（UTC）的 bug。原本 `todayISO()` 用 `toISOString().slice(0,10)` 取 UTC 日期，在 CST 凌晨 6 點時 UTC 仍是前一天。

## [1.2.1.0] - 2026-04-13

### Added
- **api_logs 來源標籤**：middleware 在寫入 4xx/5xx log 時分類 request 來源（scheduler / companion / service_token / user_jwt / anonymous），為後續 daily-check 的錯誤來源分析與 scheduler 問題升級鋪路
- `migrations/0024_api_logs_source.sql`：新增 `api_logs.source TEXT DEFAULT NULL`，nullable + 向後相容
- `functions/api/_middleware.ts` `detectSource()` helper：lazy-compute，2xx 成功路徑完全跳過（僅在錯誤路徑寫 log 時才讀 headers）

### Notes
- Tier 1 純基礎建設：source 欄位尚未被 `daily-check.js` 消費，使用者看不到行為變化。消費端會在後續 PR（Tier 2）實作
- 已知 trust boundary：`X-Tripline-Source` / `X-Request-Scope` 為 self-reported，僅作 telemetry 分類，不得用於 auth 決策

## [1.2.0.0] - 2026-04-12

### Changed
- **API 統一 camelCase 回應**：`json()` 內建 `deepCamel` 轉換，所有 API response key 自動從 snake_case 轉為 camelCase（如 `sort_order` → `sortOrder`、`day_num` → `dayNum`）
- 前端 `mapDay.ts` Raw interfaces 全面改用 camelCase，移除所有 snake_case 欄位
- `useTrip`、`useRequests`、`ManagePage` 等同步更新

## [1.1.8.1] - 2026-04-12

### Fixed
- 餐廳首選/備案排序改用 sortOrder 判斷，不再依賴 API 回傳陣列順序（修正 sort_order=0 的首選餐廳被顯示為備案的問題）

## [1.1.8.0] - 2026-04-12

### Added
- PATCH trip-pois 支援 entry_id 欄位：可透過 API 搬移 POI 到不同 entry，含同行程驗證
- mergePoi 回傳餐廳 lat/lng 座標：前端可取得 POI 地理位置

### Changed
- 地圖 pin 優先使用首選餐廳座標：餐廳 entry 若無自身 location，自動 fallback 到 sort_order=0 餐廳的 lat/lng
- tp-create 範本每天必建早餐(08:00)、午餐(12:00)、晚餐(18:00) entry，travel 以首選餐廳位置計算車程

## [1.1.7.0] - 2026-04-12

### Changed
- 餐廳推薦改為首選/備案分層渲染：第一順位完整顯示（hero card），其他順位以精簡列表呈現，點擊展開詳情

## [1.1.6.0] - 2026-04-12

### Added
- POST /api/trips/{id}/days/{dayNum}/entries endpoint：旅伴請求可建立不存在的 entry（如早餐），不再塞到不相關的 entry 下
- companion scope whitelist 加入 POST entries，tp-request/tp-edit skill 同步更新指引

### Changed
- daily-check Telegram 修復摘要格式改為「總數:N 修復:M 不處理:L」，取代原先易混淆的「修復 0/2 項」
- tp-request skill 三條鐵律：POI 語意歸屬檢查、誠實回覆禁止假裝成功
- reply request ID 改由前端渲染（ManagePage 顯示 #N，不存入 reply 資料）

### Fixed
- request-job log 路徑修正到 scripts/logs/tp-request/（含 plist stdout/stderr 路徑 + launchd 重載）
- API server log 補 Claude 處理結果（success/failed）

## [1.1.5.0] - 2026-04-07

### Added
- 事件驅動請求處理：CF Workers POST 後 webhook 觸發 Mac Mini API server 即時處理（取代 cron 輪詢）
- SSE 即時狀態推送：`/api/requests/:id/events` endpoint，前端自動收到 open → processing → completed/failed 狀態更新
- `useRequestSSE` React hook：EventSource 連線 + 自動降級 10 秒短輪詢
- Mac Mini API server (`scripts/tripline-api-server.ts`)：Bun HTTP server，D1 即佇列，mutex 處理迴圈，15 分鐘 Claude CLI timeout
- launchd job (`scripts/tripline-job.sh`)：每 15 分鐘卡住偵測（20 分鐘 stale threshold）+ 遺漏處理
- 處理者追蹤：`processed_by` 欄位記錄 `'api'`（即時）或 `'job'`（排程），前端顯示對應 icon
- iOS 原生風格狀態 badge：pill 形 rounded-full，4 態 + spinner + elapsed time + checkmark/X SVG
- 聊天式請求列表：最新在底部，sentinel 頂部向上捲載入更舊，optimistic append 取代 reload

### Changed
- 請求狀態機簡化為 4 態：open → processing → completed/failed（移除 received）
- PATCH handler：自動更新 `updated_at`，支援 `processed_by` 欄位，`failed` 狀態繞過 forward-only
- GET /api/requests 支援 `sort=asc` + `after/afterId` cursor（ASC 分頁）
- Badge 顏色改用 CSS 變數，支援 6 主題 x light/dark mode
- SSE endpoint 加 `hasPermission` 權限檢查

### Fixed
- Node.js 25 localStorage polyfill（修復 78 個 pre-existing 測試失敗）
- `mapRow` 測試：JSON_FIELDS 同步 V2 cleanup
- SSE hook：移除 `status` 從 useEffect deps（防止重複連線）
- SSE endpoint：加 `cancel()` 清理 timer（防止 client 斷線後 timer 洩漏）
- API server：`TRIPLINE_API_SECRET` 空字串改為 reject（fail-closed）
- .env.local 解析：修正 base64 `=` 截斷問題

## [1.1.4.3] - 2026-04-06

### Changed
- `trip_docs_v2` 表重命名為 `trip_docs`（migration 0022），移除 V2 後綴
- 所有 API handlers / scripts / docs 中的 `trip_docs_v2` 參照更新為 `trip_docs`
- "POI Schema V2" 標記改為 "POI Schema"

## [1.1.4.2] - 2026-04-06

### Fixed
- CI tsc functions 紅燈：修正 _middleware.ts / _poi.ts / rollback.ts / [num].ts / [type].ts 共 35 個 pre-existing strictness errors

## [1.1.4.1] - 2026-04-06

### Removed
- Legacy V1 表 hotels / restaurants / shopping / trip_docs（migration 0021 DROP）
- rollback.ts 移除 trip_docs 白名單
- dump-d1.js / init-local-db.js 移除 4 張 legacy 表
- mapRow JSON_FIELDS 移除 'location'（改由 API handler parse）

### Fixed
- 天氣功能不顯示：API handler 解析 trip_entries.location JSON string 為物件

### Changed
- Location interface 擴充完整欄位（name, googleQuery, appleQuery, mapcode, geocode_status）

## [1.1.4.0] - 2026-04-01

### Changed
- DayMap 路線從直線 Polyline 改為 Google Maps Directions API 實際道路路線
- 路線載入完成前不渲染連線（不再顯示直線 fallback）
- 車程 label 位置改用 Directions API leg 路徑中點

### Added
- `useDirectionsRoute` hook — Directions API 整合、快取、自動 fallback
- `sortPinsByOrder` 共用排序工具函式
- 路線快取（LRU 20 entry 上限）、routes library 按需載入
- Directions API 回傳空路線防護 + console.warn 錯誤日誌
- waypoints 上限 25（Google API 硬限制防護）

## [1.1.3.0] - 2026-03-30

### Changed
- ManagePage 重設計為 iMessage chat 氣泡風格 — 用戶訊息右側 coral 氣泡，AI 回覆左側 sand 氣泡含引用條
- 輸入框改為 pill 形狀，1→5 行自動撐高，修改/提問 toggle 移到輸入框上方
- 訊息排序改為最新在下，開啟時自動捲到底部，往上捲載入舊訊息
- Status 顯示從 stepper 進度條改為氣泡下方小 badge
- `[data-reply-content]` CSS 從 inline `<style>` 遷移到 `tokens.css`

### Removed
- `RequestStepper` 不再由 ManagePage 使用（元件保留供未來使用）
- `SCOPED_STYLES` inline style block

## [1.1.2.0] - 2026-03-30

### Added
- `trip_docs_v2` + `trip_doc_entries` 正規化表 — 取代 JSON blob 的 `trip_docs.content`
- `DocCard` 統一文件渲染元件 — 按 section 分組，支援 markdown content
- Migration 0019 `normalize_docs.sql` — 建立新 relational schema
- `migrate-docs-to-v2.js` 遷移腳本 — 直接操作 D1（wrangler d1 execute）
- API backward compat：PUT 仍接受舊 JSON 格式，自動展開為 entries
- entries 數量上限 200 防護

### Changed
- `GET/PUT /api/trips/:id/docs/:type` 改讀寫 `trip_docs_v2 + trip_doc_entries`
- `useTrip` 移除 JSON double-unwrap，直接使用 API 回傳的 `{ title, entries }`
- `TripPage` 5 個 doc switch case 統一用 `DocCard` 渲染
- `rollback.ts` ALLOWED_TABLES 加入新表
- `dump-d1 / init-local-db / import-to-staging / gen-seed-sql` 同步新表

### Removed
- `Flights.tsx` / `Checklist.tsx` / `Backup.tsx` / `Suggestions.tsx` / `Emergency.tsx` 舊元件
- `TripDoc` type interface（已無用）

## [1.1.1.0] - 2026-03-28

### Added
- POI 正規化：新增 `pois` master 表 + `trip_pois` fork 引用表
- MarkdownText `inline` 模式 — `marked.parseInline()` 避免破壞 TEL/URL 格式
- `buildWeatherDay()` — 從 entries 座標即時推導天氣查詢位置（取代 DB 存儲）
- `migrate-pois.js` / `migrate-trip-docs.js` 資料遷移腳本
- `gen-seed-sql.js` seed SQL 生成工具 + 本地/staging seed 資料

### Changed
- **DB 表名統一**：`days`→`trip_days`、`entries`→`trip_entries`、`requests`→`trip_requests`、`permissions`→`trip_permissions`
- **DB 欄位統一**：`body`→`description`、`rating`→`google_rating`、`details`→`description`、移除 `_json` 後綴
- **mapRow 接入 pipeline**：useTrip + TripPage 套用 `mapRow()` 確保 snake_case→camelCase 轉換
- mapDay 加入 `google_rating` snake_case fallback 確保 API 回傳正確映射
- Hotel/InfoBox/Shop/Restaurant 統一使用 MarkdownText 渲染
- TripPage export（MD/CSV）使用 snake_case 欄位名讀取 raw API data
- API 端點全面更新（17 檔案 — 表名 + 欄位名 + rollback column list）
- Rollback TABLE_COLUMNS 修正（hotels: details→description + 加 location）
- 清除所有舊欄位名 fallback（body/rating/details/address）

### Removed
- `FIELD_MAP` 手動映射常數
- `Weather` interface — 天氣改為即時推導
- `weather_json` DB 欄位 + API response ghost weather field

## [1.0.2.1] - 2026-03-28

### Fixed
- 文字反白（::selection）背景色與頁面底色太接近，改用 `color-mix(accent, 30%)` 確保所有主題可見

## [1.0.2.0] - 2026-03-27

### Added
- Requests API cursor-based 分頁 — `limit`/`before`/`beforeId` 參數，回傳 `{ items, hasMore }`
- ManagePage infinite scroll — IntersectionObserver 觸底自動載入下一頁
- Request message Markdown 渲染 — marked.js + sanitizeHtml（原本為純文字）
- Hotel details Markdown 渲染 — marked.parseInline + sanitizeHtml
- `renderMarkdown()` 共用 helper（ManagePage reply + message 共用）

## [1.0.1.1] - 2026-03-27

### Changed
- TripPage SCOPED_STYLES 從 143 行精簡到 29 行 — 基礎樣式搬到 tokens.css `@layer base`
- tokens.css 新增 page-level base styles（day-header、skeleton、timeline glass、info-panel、appearance cards 等）
- 樣式查找位置從 3 處（tokens.css + SCOPED_STYLES + inline）減為 2 處（tokens.css + inline）

## [1.0.1.0] - 2026-03-26

V2 Cutover — 移除所有 V1 程式碼，V2 成為唯一正式版。

### Changed
- SPA 單一入口 — main.tsx 移除 V1/V2 switching，直接載入 BrowserRouter
- Vite 單入口建置 — 移除 v2.html 雙入口，統一由 index.html 出發
- CSS 統一 — tokens.css 成為唯一 CSS 檔案（Tailwind CSS 4 @theme）
- apiFetchRaw 抽至 useApi.ts 共用模組，加入 reportFetchResult 離線偵測
- toTimelineEntry/toHotelData 改接 object 型別，消除 5 個 `as unknown as` 型別斷言
- TripPage 清除 15 組 `-v2` CSS class 後綴

### Removed
- V1 入口：mainV1.tsx、mainV2.tsx、v2.html
- V1 頁面：TripPage(V1)、ManagePage(V1)、AdminPageV2（冗餘）
- V1 元件：Toast(V1)、RequestStepper(V1)
- V1 CSS：style.css、shared.css、map.css、manage.css、admin.css、setting.css
- 過渡程式：v2routing.ts、features.json、progress.jsonl
- V1/V2 比較測試和 CSS 依賴測試

### Fixed
- scroll-to-now 選擇器從 `.tl-now` 修正為 `[data-now]`
- ManagePage 回覆分隔線 `border-none` 與 `border-t` 衝突
- map-highlight 動畫遷移至 tokens.css（從已刪除的 map.css）

## [1.0.0.0] - 2026-03-25

React SPA 架構完成里程碑 — 從 vanilla JS 全面遷移至 React + TypeScript。

### Added
- React SPA 架構 — Vite 多入口 + React Router + 4 頁 lazy loading（TripPage、ManagePage、AdminPage、SettingPage）
- 6 套色彩主題（陽光/晴空/和風/森林/櫻花/星夜）× 深淺模式切換
- PWA 離線模式 — Service Worker + NetworkFirst 快取 + 離線 Toast 通知
- Day Map 互動地圖 — Google Maps 嵌入 + 動線連線 + 多天總覽（`?showmap=1`）
- Tailwind CSS v4 Blue-Green 升級基礎建設 — tokens.css + V1/V2 路由切換
- Admin V2 cutover — 第一個全 Tailwind inline 頁面上線
- QuickPanel Bottom Sheet — 替代 Speed Dial 的快捷面板
- InfoSheet 手機版 multi-detent — 半版/滿版手勢切換
- Tripline 品牌重塑 — 手寫風 SVG logo + `/trip/{id}` URL routing
- Loading Skeleton 骨架屏 — shimmer 動畫 + fade-in 過渡
- 毛玻璃材質 — StickyNav + InfoSheet + QuickPanel backdrop blur
- 旅伴請求四態 stepper（open → received → processing → completed）
- 每日問題報告系統（daily-check + Telegram 通知）
- Staging CI/CD — PR CI pipeline + SW 驗證
- D1 備份腳本（dump-d1.js）+ 備份納入版控

### Changed
- Manage/Admin 頁面加入 Cloudflare Access 401/403 redirect
- `?trip=` query string 相容舊版 URL，自動轉為 React Router 路由
- 匯出功能重寫 — 完整行程資料 + 5 個附屬文件
- 「建議」改名為「解籤」+「問事情」廟宇問事風格

### Fixed
- PUT /days/:num 遺漏 source、mapcode、location_json 欄位
- Admin V2 cutover 修復 10 項 — stale closure、AbortController、Content-Type、401 redirect 防護
- SPA manage/admin CSS hotfix 循環（22 個 PR）→ Blue-Green 策略根治
- shared.css 刪除 187 行 dead admin-* CSS
- workbox build Browserslist 錯誤（根目錄 shell wrapper 誤讀）
- entries PATCH/DELETE D1 error handling
- 四層 UTF-8 encoding 防堵 — curl 亂碼根治
- SW navigateFallbackDenylist 排除 Access 保護頁面

### Removed
- Vanilla JS 入口（app.js、manage.js、admin.js）— 改由 React 接管
- dist/ 從版控移除 — 由 Cloudflare Pages build
- Tunnel/Agent Server 殘留程式碼
- V1 AdminPage + V1/V2 比對 E2E tests

## [0.x] - 2026-02 ~ 2026-03-17

### Added
- Cloudflare D1 資料庫 — trips/days/entries/restaurants/shopping/trip_docs/audit_log/requests/permissions
- Cloudflare Pages Functions API — 完整 CRUD + audit trail + rollback
- 旅伴請求系統（requests API + ManagePage）
- 權限管理系統（permissions API + AdminPage）
- 設定頁（SettingPage）— 主題切換 + 深淺模式 + 字體大小
- 全站 inline SVG icon（Material Symbols Rounded）
- CSS HIG 設計規範（12 條）+ 自動測試守護
- Markdown 行程檔 → D1 遷移腳本

## [0.0] - 2026-02-01

### Added
- Initial commit — 靜態 HTML 沖繩五日自駕遊行程表
- Markdown 行程檔格式
