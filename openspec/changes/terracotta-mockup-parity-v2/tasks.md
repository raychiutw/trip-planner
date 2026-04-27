> Implementation tasks 對照 5 capability spec。Section 1-5 各自獨立 PR ship；Section 5 (mobile-bottom-nav) 第一 task 是 product decision，decision 結果決定後續 task 解鎖與否。

## 1. terracotta-icon-svg-sweep

對應 `specs/terracotta-icon-svg-sweep/spec.md`。預估 1 PR / ~1 天。

- [ ] 1.1 補 `src/components/shared/Icon.tsx` 新 SVG sprite：`trash` / `maximize` / `arrows-vertical`（lucide / heroicons style 1.5px stroke），含 unit test 驗 case 切換正確 path
- [ ] 1.2 替換 `src/components/trip/TimelineRail.tsx` `tp-rail-actions` 5 個 emoji button：`🗑→<Icon name="trash" />` / `✕→<Icon name="x" />` / `⛶→<Icon name="maximize" />` / `⎘→<Icon name="copy" />` / `⇅→<Icon name="arrows-vertical" />`
- [ ] 1.3 替換 `src/components/trip/InlineAddPoi.tsx` search input prefix：`🔍→<Icon name="search" />`
- [ ] 1.4 替換 `src/pages/ExplorePage.tsx` POI card「+ 儲存」/「✓ 已儲存」 button：`✓` text prefix → `<Icon name="check" />`
- [ ] 1.5 寫 `tests/unit/no-emoji-icons.test.ts` source-grep contract test：掃 `src/components/` + `src/pages/` 全 .tsx，禁止 emoji unicode (`🗑 🔍 ⛶ ⎘ ⇅ ❤ 🚗 📋`) 在 JSX text node，例外 `Icon.tsx` self
- [ ] 1.6 修改 `tests/unit/timeline-rail-inline-expand.test.tsx` 既有 toolbar test：改用 `data-testid` 取 button 不依賴 emoji text content
- [ ] 1.7 跑 `npm test` + `npx tsc --noEmit` 全 green
- [ ] 1.8 commit `style(icons): emoji unicode → SVG sprite cross-component sweep` + push + 開 PR + ship

## 2. terracotta-account-hub-page

對應 `specs/terracotta-account-hub-page/spec.md`。預估 1 PR / ~3-4 天。

- [ ] 2.1 寫 failing test：`tests/unit/account-page.test.tsx` 驗 unauth 時 redirect /login，logged-in 顯示 hero + 7 rows
- [ ] 2.2 寫 failing integration test：`tests/api/account-stats.integration.test.ts` 驗 `/api/account/stats` 回 `{ tripCount, totalDays, collaboratorCount }`，含 0 trip 跟 multi-trip case
- [ ] 2.3 建 `functions/api/account/stats.ts` GET endpoint：requireAuth + SQL aggregate (COUNT trips / SUM days / COUNT distinct collaborators)
- [ ] 2.4 新建 `src/pages/AccountPage.tsx`：TitleBar「帳號」+ ProfileHero (avatar + name + email + 3 stats fetch from /api/account/stats) + 3 group settings rows
- [ ] 2.5 建 `<SettingsRow>` 共用 component：left icon (圓形 box accent-subtle) + center title + helper + right chevron + onClick navigate
- [ ] 2.6 設 row navigate：外觀→`/account/appearance`、通知→`/account/notifications`、連結 App→`/settings/connected-apps`、開發者→`/settings/developer-apps`、裝置→`/settings/sessions`、登出→ConfirmModal + POST /api/oauth/logout + navigate /login
- [ ] 2.7 新建 `src/pages/AppearanceSettingsPage.tsx` minimal：page header + 既有 `<ThemeToggle>` + 主題選擇 grid（沿用 TripSheetContent 'appearance' case 內容）
- [ ] 2.8 新建 `src/pages/NotificationsSettingsPage.tsx` stub：page header + 文案「通知設定 coming soon」+ link 回 /account
- [ ] 2.9 加 4 條 routes 到 `src/entries/main.tsx`：`/account` `/account/appearance` `/account/notifications`（`/settings/*` 既有）
- [ ] 2.10 修改 `src/components/shell/DesktopSidebar.tsx`：logged-in 隱藏「登入」slot 改為「帳號」item (icon=user, target=/account, active=startsWith('/account'))；logged-out 仍顯「登入」
- [ ] 2.11 修改 sidebar 底部 user account chip click 行為：navigate('/account')（之前無 onClick）
- [ ] 2.12 寫 Playwright E2E `tests/e2e/account-page.spec.js`：login → /account → 驗 hero 3 stats + 7 rows visible + 點「已登入裝置」navigate /settings/sessions
- [ ] 2.13 跑 `npm test` + `npm run test:api` + `npx tsc --noEmit` 全 green
- [ ] 2.14 commit `feat(account): unified Account hub page + sidebar 「帳號」 nav item` + push + 開 PR + ship

## 3. terracotta-add-stop-modal

對應 `specs/terracotta-add-stop-modal/spec.md`。預估 1 PR / ~5 天。

- [ ] 3.1 寫 failing test：`tests/unit/add-stop-modal.test.tsx` 驗 modal open/close + tab switch + footer counter + 點完成 batch POST
- [ ] 3.2 寫 failing test：「自訂」tab form validation（缺 title 顯示 inline error）
- [ ] 3.3 新建 `src/components/trip/AddStopModal.tsx`：Modal layout (backdrop + center card + Esc/click-backdrop 關) + Header (標題 + day meta + close) + region selector + 3 tabs + content + Footer
- [ ] 3.4 「搜尋」tab：subtab chips 5 項 (為你推薦/景點/美食/住宿/購物) + 2-col POI grid 用 `<AddPoiCard>` (cover photo + name + rating + checkbox)
- [ ] 3.5 「為你推薦」default subtab 內容：fetch trending POI by region（暫用既有 `/api/poi-search?q=`+region 名稱 trending hack，或新建 `/api/poi-search/trending?region=` endpoint，看 backend lift）
- [ ] 3.6 「收藏」tab：fetch `/api/saved-pois` (既有 endpoint) + render 同 grid + checkbox 多選；empty state「還沒收藏任何 POI」+ link /explore
- [ ] 3.7 「自訂」tab：form (title required / address typeahead Nominatim / time pickers / type select / duration min input / note textarea) + 提交 POST /api/trips/:id/days/:num/entries
- [ ] 3.8 Footer 邏輯：counter「已選 N 個 · 將加入 Day X · MM/DD」+ 完成 button (disabled when 0 selected) + 取消 button
- [ ] 3.9 完成 commit：並行 N POST /api/trips/:id/days/:num/entries（搜尋 + 收藏 tab）；自訂 tab 單筆；任一失敗 inline error toast 並保留 selection
- [ ] 3.10 修改 `src/pages/TripPage.tsx`：trip detail content top 加 sticky「+ 加入景點」 chip 或 TitleBar actions 加，open AddStopModal 帶當前 activeDayNum
- [ ] 3.11 修改 `src/components/trip/DaySection.tsx`：移除 `<InlineAddPoi>` import + 渲染（保留 component file 為 follow-up cleanup）
- [ ] 3.12 既有 `src/components/trip/InlineAddPoi.tsx` mark deprecated（comment header 標 + 不刪 file 為避免 PR 過大，下個 PR cleanup）
- [ ] 3.13 寫 Playwright E2E `tests/e2e/add-stop-modal.spec.js`：login → trip → 點「+ 加入景點」 trigger → modal 開 → 切 3 tab + 「自訂」tab 提交 form → 驗 timeline 出現新 entry
- [ ] 3.14 跑 `npm test` + `npx tsc --noEmit` 全 green
- [ ] 3.15 commit `feat(add-stop): modal 4-tab pattern (搜尋/收藏/自訂) + batch select + trip-level trigger` + push + 開 PR + ship

## 4. terracotta-ui-parity-polish

對應 `specs/terracotta-ui-parity-polish/spec.md`。按 file group 拆 sub-section，預估 2 PR / ~5-7 天（Section 4.1-4.4 = PR1，Section 4.5-4.10 = PR2）。

### 4.1 DesktopSidebar 視覺對齊（mockup section 01）

- [ ] 4.1.1 寫 failing test：`tests/unit/desktop-sidebar-visual.test.tsx` 驗 sidebar 背景 var(--color-foreground) + active item 背景 var(--color-accent) + name truncation > 10 字加 ellipsis
- [ ] 4.1.2 修改 `src/components/shell/DesktopSidebar.tsx`：sidebar bg → var(--color-foreground) 深棕 + inactive item 文字 muted-light
- [ ] 4.1.3 修改 active item 樣式：bg → var(--color-accent) + 文字 var(--color-accent-foreground)
- [ ] 4.1.4 修改 `.tp-sidebar-item` font-weight 500 → 600
- [ ] 4.1.5 加 `truncate(name, 10)` JS-level：account chip name 超過 10 字 slice + ellipsis
- [ ] 4.1.6 視覺驗證：local dev sidebar 切 dark theme + 截圖比 mockup section 01

### 4.2 NewTripModal 文案 + 多目的地拖拉（mockup section 03）

- [ ] 4.2.1 寫 failing test：`tests/unit/new-trip-modal-multidest.test.tsx` 驗多目的地拖拉重排 + 編號更新 + region 顯示 + helper 行渲染
- [ ] 4.2.2 改 modal title 文案：「想去哪裡？」→「新增行程」
- [ ] 4.2.3 改日期 mode tabs label：「選日期 / 彈性日期」→「固定日期 / 大概時間」
- [ ] 4.2.4 改 destination section label：「目的地」→「目的地（可加多筆，拖拉排序）」
- [ ] 4.2.5 加 helper 行：「行程跨 N 個目的地 · 順序決定地圖 polyline 串接方向」
- [ ] 4.2.6 拿掉 sub-headline「先說目的地跟想做什麼，AI 會幫你排日程、餐廳、住宿。」
- [ ] 4.2.7 重 build destination input：用 `@dnd-kit/sortable` 做 sortable list，每 row = grip + 編號 + name + region + remove；取代既有 chips list
- [ ] 4.2.8 加「熱門目的地」chip group + 「最近搜尋」chip group（localStorage 取前 5）
- [ ] 4.2.9 dropdown search results 改分組顯示
- [ ] 4.2.10 加「分配天數」stepper：dest count ≥ 2 時顯示，每 dest +/- N 天，總和 = trip.days
- [ ] 4.2.11 視覺驗證：local dev 開 NewTripModal + 加 3 dest 拖拉 + 截圖比 mockup section 03

### 4.3 DaySection day hero 加 day title（mockup section 10）

- [ ] 4.3.1 寫 failing test：`tests/unit/day-section-title.test.tsx` 驗 day hero title fallback 邏輯（title → area → 「Day N」）
- [ ] 4.3.2 D1 migration：建 `migrations/00XX_add_trip_days_title.sql` 加 `title TEXT` column
- [ ] 4.3.3 跑 migration: dev → staging → production（按 CLAUDE.md 三環境順序）
- [ ] 4.3.4 修改 `src/lib/mapDay.ts`：`Day` interface 加 `title?: string`
- [ ] 4.3.5 修改 `src/components/trip/DaySection.tsx` hero：title || area || `Day ${dayNum}` 三層 fallback
- [ ] 4.3.6 follow-up issue 紀錄：「day title 編輯 UI（PATCH /api/trips/:id/days/:num）」留下個 PR

### 4.4 DayNav eyebrow 對齊（mockup section 11）

- [ ] 4.4.1 寫 failing test：`tests/unit/day-nav-eyebrow.test.tsx` 驗今天 chip eyebrow「DAY 03 · 今天」+ 一般 chip 不含週幾英文 extra row
- [ ] 4.4.2 修改 `src/components/trip/DayNav.tsx` eyebrow logic：今天 day 加「· 今天」suffix（拿掉獨立 TODAY pill）
- [ ] 4.4.3 拿掉 `<span class="dn-dow">` 週幾英文 extra row
- [ ] 4.4.4 area max-width 80px → 拿掉或 raise 120px

### 4.5 TimelineRail 加結構 section + 編輯備註 button + ConfirmModal（mockup section 12）

- [ ] 4.5.1 寫 failing test：`tests/unit/timeline-rail-toolbar-pencil.test.tsx` 驗 toolbar 含 pencil button click → focus note textarea
- [ ] 4.5.2 加 toolbar 鉛筆 icon button：order 在「移到其他天」後「刪除」前；click → focus note textarea (`tp-rail-note-input` autoFocus)
- [ ] 4.5.3 替換 `handleDelete` `window.confirm` → ConfirmModal pattern（destructive variant，沿用 DemoteConfirmModal 結構）
- [ ] 4.5.4 修改 `.ocean-rail-grip` CSS：default `opacity: 0`，row hover 變 `opacity: 1`，keyboard focus 也 visible

### 4.6 TripPage TitleBar + travel pill（mockup section 13）

- [ ] 4.6.1 寫 failing test：`tests/unit/trip-page-titlebar-actions.test.tsx` 驗 TitleBar 顯示「建議 / 共編 / 下載」3 個 ghost button (icon + text) + OverflowMenu kebab
- [ ] 4.6.2 改 TripPage TitleBar actions 從 icon-only 為 ghost button with icon + text label；mobile (≤760px) collapse 為 icon-only
- [ ] 4.6.3 寫 failing test：`tests/unit/timeline-rail-travel-pill.test.tsx` 驗兩 entry 間有 travel data 時 render `tp-travel-pill`「🚗 N min · X km」
- [ ] 4.6.4 修改 `src/components/trip/TimelineRail.tsx` 渲染：兩 RailRow 之間 conditional render `<TravelPill>` (data: entry.travel_type / travel_min / travel_desc)
- [ ] 4.6.5 新建 `<TravelPill>` 共用 component：travel_type → icon (車/走路/船...) + min + desc text

### 4.7 TripsListPage filter+search+sort+owner+中文化（mockup section 16）

- [ ] 4.7.1 寫 failing test：`tests/unit/trips-list-page-filters.test.tsx` 驗 filter subtabs (4 個) + sort dropdown (3 option) + search expanding bar
- [ ] 4.7.2 加 filter subtabs (segmented control)：全部 / 我的行程 / 共編行程 / 已歸檔；用 client-side filter 既有 trips list（archived 需 D1 schema 支援，archived 為 follow-up）
- [ ] 4.7.3 加 sort dropdown：最新編輯 / 出發日近 / 名稱 a-z；client-side sort
- [ ] 4.7.4 加 search expanding bar：button → expand input + 即時 filter trips by name + result count + `<mark>` highlight matched 字
- [ ] 4.7.5 改 card eyebrow 從「JAPAN · 12 DAYS」全英文 → 中文「日本 · 12 天」（country code → 中文 map）
- [ ] 4.7.6 加 card meta 含 owner avatar 32x32 + name (`tp-list-card-avatar` + `tp-list-card-meta-text`)
- [ ] 4.7.7 改 empty state 文案「還沒開始任何行程 / 建立第一個行程，AI 會幫你排...」→「還沒有行程 / 建立第一個行程，開始規劃你的下一趟旅程。也可以從探索頁尋找靈感。」

### 4.8 ChatPage day divider + AI avatar + bubble timestamp prefix（mockup section 17）

- [ ] 4.8.1 寫 failing test：`tests/unit/chat-page-day-divider.test.tsx` 驗跨日訊息間 render `tp-chat-day-divider`
- [ ] 4.8.2 寫 failing test：`tests/unit/chat-page-ai-avatar.test.tsx` 驗 assistant message bubble 含 avatar「AI」+ timestamp 「Tripline AI · 14:02」prefix
- [ ] 4.8.3 修改 `rowToMessages` 加 day boundary detection：兩條 message 跨日時 inject `{ id: 'day-divider-YYYY-MM-DD', type: 'day-divider', date }` 假 message
- [ ] 4.8.4 ChatPage render loop 處理 day-divider type：render `<div class="tp-chat-day-divider">{date}（{weekday}）</div>` 不渲染 bubble
- [ ] 4.8.5 加 `tp-chat-avatar.is-ai`「AI」avatar 32x32 在 assistant bubble 左側（user message 不加）
- [ ] 4.8.6 修改 `tp-chat-msg-time` for assistant：prefix「Tripline AI · 」（user message 不加）
- [ ] 4.8.7 改 ChatPage TitleBar 主標題從固定「聊天」→ 當前 trip.name；trip switcher 改進 TitleBar OverflowMenu
- [ ] 4.8.8 改「送出」 text button → icon-only `<Icon name="send" />` button (保留 aria-label「送出」)

### 4.9 ExplorePage POI card cover + heart + rating + region + subtabs（mockup section 18）

- [ ] 4.9.1 寫 failing test：`tests/unit/explore-page-card-cover.test.tsx` 驗 POI card 含 cover photo + heart toggle + rating meta
- [ ] 4.9.2 重 build `explore-poi-card`：top 100% 16:9 cover image (POI photo URL || `data-tone` 8 種顏色 placeholder) + 右上 heart icon button (toggle saved) + meta「★ 4.6 · ¥2,180」
- [ ] 4.9.3 改 TitleBar action icon：star → heart 對齊 mockup
- [ ] 4.9.4 加 region selector pill：「沖繩 ▾」default = user 最近 trip's countries；click open dropdown 列其他 region
- [ ] 4.9.5 加 subtab chips「為你推薦 / 景點 / 美食 / 住宿 / 購物」5 個；click 切 POI search filter by category
- [ ] 4.9.6 加 card hover：accent border + `transform: translateY(-2px)` + shadow-md transition
- [ ] 4.9.7 重新評估 ExplorePage 「儲存池 multi-select + 加入行程 modal」流程在 add-stop-modal 完成後是否還必要（可能下個 PR cleanup）

### 4.10 MapPage FAB + day tab overview + AlertPanel（mockup section 20 + section 04）

- [ ] 4.10.1 加 `src/components/trip/MapFabs.tsx`：右下 FAB stack 「圖層」+「定位」 button
- [ ] 4.10.2 圖層 FAB：popover 顯示街道 / 衛星 / 地形 3 選項；select 切 Leaflet tile layer
- [ ] 4.10.3 定位 FAB：navigator.geolocation.getCurrentPosition → flyTo + 顯示 user marker
- [ ] 4.10.4 修改 `src/components/trip/MapDayTab.tsx` active 樣式：`border-bottom: 2px solid var(--day-color)` underline
- [ ] 4.10.5 建 `src/components/shared/AlertPanel.tsx`：variant (error/warning/info) + icon + title + message + actionLabel + onAction + onDismiss
- [ ] 4.10.6 寫 unit test `tests/unit/alert-panel.test.tsx` 驗 3 variants render + dismiss + action callback
- [ ] 4.10.7 接入 `useOnlineStatus`：offline 時 render warning AlertPanel；online 切回 info「已恢復連線，正在同步」5s 後 dismiss
- [ ] 4.10.8 接入 TripPage 載入失敗：error AlertPanel + retry action

### 4.11 Polish PR ship gate

- [ ] 4.11.1 跑 `npm test` + `npm run test:api` + `npx tsc --noEmit` 全 green
- [ ] 4.11.2 跑 `/design-review` 對 polish 後 page 視覺校對 mockup
- [ ] 4.11.3 commit + push + 開 1 個 PR (Section 4.1-4.6) + ship；之後 1 個 PR (Section 4.7-4.10) + ship

## 5. mobile-bottom-nav decision + conditional implement

對應 `specs/mobile-bottom-nav/spec.md`。預估 decision 1 task / 實作 conditional ~3 天。

### 5.1 Product decision gate

- [ ] 5.1.1 invoke `/office-hours` 或 `/plan-ceo-review` 跑 forcing question discussion：5-tab global vs 4-tab trip-scoped vs hybrid 哪個 align trip-planner 的 product strategy？
- [ ] 5.1.2 紀錄 decision 到 `openspec/changes/terracotta-mockup-parity-v2/notes/bottom-nav-ia-decision.md`：選擇方向 + rationale + impact on existing trip-scoped UX + migration risk

### 5.2 Conditional implementation (only if decision = 5-tab adopt)

- [ ] 5.2.1 寫 failing test：`tests/unit/bottom-nav-5-tab.test.tsx` 驗 5 tab render + active 判斷 regex + 觸控目標 ≥44px
- [ ] 5.2.2 修改 `src/components/shell/BottomNavBar.tsx`：5 tab list (聊天/行程/地圖/探索/帳號)，CSS grid `repeat(5, 1fr)`
- [ ] 5.2.3 加 active state 2px top indicator + accent-subtle 底
- [ ] 5.2.4 拿掉「更多」action sheet pattern + 對應 sheet handler
- [ ] 5.2.5 「更多」內含的功能遷移：collab → trip detail TitleBar、trip-select →「行程」tab 內 picker、appearance → AccountPage「外觀設定」row、export → trip detail TitleBar OverflowMenu
- [ ] 5.2.6 驗證 active tab regex 不誤觸：`/manage/map-xxx` 不該觸發「地圖」tab active
- [ ] 5.2.7 跑 Playwright E2E 驗 5 tab navigation
- [ ] 5.2.8 寫 archive note：本 capability ship 後 archive 既有 `mobile-bottom-nav.md` 4-tab spec

### 5.3 Conditional skip (if decision = keep 4-tab)

- [ ] 5.3.1 mockup section 02 標 deviation accepted：在本 change `notes/` 下寫 `bottom-nav-ia-deviation.md` 紀錄為何不對齊 + 影響評估
- [ ] 5.3.2 既有 mobile-bottom-nav.md spec 不變
- [ ] 5.3.3 本 capability 收尾為 decision-only（無實作 commit）

### 5.4 Conditional hybrid (if decision = hybrid)

- [ ] 5.4.1 設計 hybrid 切換邏輯：context-aware nav (登入後 5-tab，trip 內 4-tab)
- [ ] 5.4.2 加 path-based detect + 視覺切換 indicator
- [ ] 5.4.3 寫 unit test 驗 path 切換 nav 正確
- [ ] 5.4.4 ship 同 5.2.7-5.2.8

## 6. Change archive

- [ ] 6.1 全 5 capability 各自 ship 完成 + post-merge 24h Sentry / daily-check 監控無 regression
- [ ] 6.2 invoke `/opsx:archive terracotta-mockup-parity-v2` 走 archive flow
- [ ] 6.3 確認 mockup parity audit 重跑（agent 跑 audit 驗證 finding 數降到 0 或剩 acceptable deviation）
- [ ] 6.4 紀錄 archive 結果於 `openspec/changes/archive/YYYY-MM-DD-terracotta-mockup-parity-v2/`
