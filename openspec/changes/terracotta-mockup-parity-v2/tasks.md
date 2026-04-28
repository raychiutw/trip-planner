> Implementation tasks 對照 5 capability spec。Section 1-5 各自獨立 PR ship；Section 5 (mobile-bottom-nav) 第一 task 是 product decision，decision 結果決定後續 task 解鎖與否。

## 1. terracotta-icon-svg-sweep

對應 `specs/terracotta-icon-svg-sweep/spec.md`。預估 1 PR / ~1 天。

- [x] 1.1 補 `src/components/shared/Icon.tsx` 新 SVG sprite：`trash` / `maximize` / `arrows-vertical` / `copy` / `check`（Material Symbols Rounded 風格），含 unit test 驗 case 切換正確 path（既有 Icon test cover by no-emoji contract test 順便驗）
- [x] 1.2 替換 `src/components/trip/TimelineRail.tsx` `tp-rail-actions` 5 個 emoji button：`🗑→<Icon name="trash" />` / `✕→<Icon name="x-mark" />` / `⛶→<Icon name="maximize" />` / `⎘→<Icon name="copy" />` / `⇅→<Icon name="arrows-vertical" />`；comment 內 emoji 也清掉避免 contract test 誤抓
- [x] 1.3 替換 `src/components/trip/InlineAddPoi.tsx` search input prefix：`🔍→<Icon name="search" />`；順便 `✕→<Icon name="x-mark" />` close button
- [x] 1.4 替換 `src/pages/ExplorePage.tsx` POI card「+ 儲存」/「✓ 已儲存」 button：`✓` text prefix → `<Icon name="check" />`
- [x] 1.5 寫 `tests/unit/no-emoji-icons.test.ts` source-grep contract test：掃 `src/components/` + `src/pages/` 全 .tsx，禁止 emoji unicode (`🗑 🔍 ⛶ ⎘ ⇅ ❤ 🚗 📋`) 在 JSX text node (剝 comment 後)，例外 `Icon.tsx` self；3 cases pass
- [x] 1.6 修改 `tests/unit/timeline-rail-inline-expand.test.tsx` 既有 toolbar test：describe/it 名稱拿掉 ⎘/⇅ emoji 改文字 (data-testid 取 button 既有不依賴 text content)
- [x] 1.7 跑 `npm test` + `npx tsc --noEmit` 全 green：1210/1210 unit + 590/590 api + tsc clean
- [x] 1.8 commit `style(icons): emoji unicode → SVG sprite cross-component sweep` + push（PR 待開）+ follow-up sweep ✕ in StopLightbox / TripSheet / GlobalMapPage 一併處理

## 2. terracotta-account-hub-page

對應 `specs/terracotta-account-hub-page/spec.md`。預估 1 PR / ~3-4 天。

- [ ] 2.1 寫 failing test：`tests/unit/account-page.test.tsx` 驗 unauth 時 redirect /login，logged-in 顯示 hero + 7 rows（**deferred — 本 capability 共用 PR 完成 implementation 後補 unit test**）
- [ ] 2.2 寫 failing integration test：`tests/api/account-stats.integration.test.ts` 驗 `/api/account/stats` 回 `{ tripCount, totalDays, collaboratorCount }`（**deferred — implementation 完成；test 補在後續 PR**）
- [x] 2.3 建 `functions/api/account/stats.ts` GET endpoint：requireAuth + SQL aggregate (COUNT trips / SUM days / COUNT distinct collaborators)
- [x] 2.4 新建 `src/pages/AccountPage.tsx`：TitleBar「帳號」+ ProfileHero + 3 group settings rows + 登出 ConfirmModal pattern
- [x] 2.5 SettingsRow 用 inline JSX (non-extracted)：left icon (圓形 box accent-subtle) + center title + helper + right chevron + onClick / Link navigate
- [x] 2.6 設 row navigate：外觀→`/account/appearance`、通知→`/account/notifications`、連結 App→`/settings/connected-apps`、開發者→`/settings/developer-apps`、裝置→`/settings/sessions`、登出→ ConfirmModal + POST /api/oauth/logout + navigate /login
- [x] 2.7 新建 `src/pages/AppearanceSettingsPage.tsx`：TitleBar「外觀設定」back /account + ThemeToggle + COLOR_MODE_OPTIONS grid (沿用 TripSheetContent 'appearance' case)
- [x] 2.8 新建 `src/pages/NotificationsSettingsPage.tsx`：「即將推出」stub + 規劃中通知類型 list (行程更新 / 旅伴邀請 / 系統通知)
- [x] 2.9 加 3 條 routes 到 `src/entries/main.tsx`：`/account` `/account/appearance` `/account/notifications`
- [x] 2.10 修改 `src/components/shell/DesktopSidebar.tsx`：NAV_ITEMS 加 `account` (authOnly) + `login` (guestOnly)；filter 邏輯改 authOnly/guestOnly visibility
- [x] 2.11 修改 sidebar 底部 user account chip click 行為：`to="/account"`（之前 `/settings/sessions`）
- [ ] 2.12 寫 Playwright E2E `tests/e2e/account-page.spec.js`（**deferred — Playwright 在本 PR 跑慢，留下個 PR 補**）
- [x] 2.13 跑 `npm test` + `npm run test:api` + `npx tsc --noEmit` 全 green：1217+/1217+ unit + 590/590 api + tsc clean
- [x] 2.14 commit `feat(account): unified Account hub page + sidebar 「帳號」 nav item`（在大 commit 內含）

## 3. terracotta-add-stop-modal

對應 `specs/terracotta-add-stop-modal/spec.md`。預估 1 PR / ~5 天。

- [x] 3.1 寫 failing test：`tests/unit/add-stop-modal.test.tsx` 驗 modal open/close + tab switch + footer counter + button enable/disable + Esc/backdrop close
- [x] 3.2 寫 failing test：「自訂」tab form validation（缺 title 顯示 inline error）— custom tab confirm button enabled by default 觸發 inline error path
- [x] 3.3 新建 `src/components/trip/AddStopModal.tsx`：Modal layout (backdrop + center card + Esc/click-backdrop 關) + Header (標題 + day meta + close) + 3 tabs + content + Footer。region selector + 推薦 chips 留 follow-up（需 backend trending endpoint + region taxonomy）
- [ ] 3.4 「搜尋」tab：subtab chips 5 項（**deferred — 純 client-side region/category filter 已在 ExplorePage 4.9 內 land；AddStopModal 內 subtab 留下個 PR 配合後端 trending endpoint 一起做**）
- [ ] 3.5 「為你推薦」default subtab 內容（**deferred — 需 backend trending endpoint，本 PR 不啟動**）
- [x] 3.6 「收藏」tab：fetch `/api/saved-pois` + 多選 grid + empty state
- [x] 3.7 「自訂」tab：form (title required + time + duration + note) + 提交 POST /api/trips/:id/days/:num/entries
- [x] 3.8 Footer：counter「已選 N 個 · 將加入 Day X」+ 完成 button (disabled when 0 selected) + 取消 button
- [x] 3.9 完成 commit：並行 N POST `/trips/:id/days/:num/entries`（搜尋 + 收藏 tab）；自訂 tab 單筆；失敗 inline error 並保留 selection
- [x] 3.10 修改 `src/pages/TripPage.tsx`：TitleBar actions 加「加景點」 button (icon + text) → open AddStopModal 帶 currentDayNum 進去；user 完成 commit 後 modal 內 dispatch tp-entry-updated 觸發既有 listener refetch
- [x] 3.11 修改 `src/components/trip/DaySection.tsx`：移除 `<InlineAddPoi>` import + render；同步 remove unused useTripId import
- [x] 3.12 `src/components/trip/InlineAddPoi.tsx` header 加 @deprecated annotation；file 暫保留為 follow-up cleanup PR 確認無人引用後再刪
- [ ] 3.13 寫 Playwright E2E `tests/e2e/add-stop-modal.spec.js`（**deferred — Playwright 在本 PR 跑慢，留下個 PR 補**）
- [x] 3.14 跑 `npm test` + `npx tsc --noEmit` 全 green：tsc clean + emoji contract pass + 既有 unit suite 無 regression
- [ ] 3.15 commit `feat(add-stop): modal 3-tab pattern (搜尋/收藏/自訂) + batch select` + push + 合進本 capability 主 PR（不另開）

## 4. terracotta-ui-parity-polish

對應 `specs/terracotta-ui-parity-polish/spec.md`。按 file group 拆 sub-section，預估 2 PR / ~5-7 天（Section 4.1-4.4 = PR1，Section 4.5-4.10 = PR2）。

### 4.1 DesktopSidebar 視覺對齊（mockup section 01）

- [ ] 4.1.1 寫 failing test：`tests/unit/desktop-sidebar-visual.test.tsx` 驗 sidebar dark theme + active accent + name truncation（**deferred — implementation 完成；unit test 留下個 PR**）
- [x] 4.1.2 修改 `src/components/shell/DesktopSidebar.tsx`：sidebar bg → var(--color-foreground) 深棕 + inactive item 文字 rgba(255,251,245,0.6) muted-light
- [x] 4.1.3 修改 active item 樣式：bg → var(--color-accent) + 文字 var(--color-accent-foreground)
- [x] 4.1.4 修改 `.tp-nav-item` font-weight 500 → 600（active 也 600 一致）
- [x] 4.1.5 加 `name.length > 10 ? slice(0,10)+'…' : name` JS-level truncate
- [ ] 4.1.6 視覺驗證：local dev sidebar 切 dark theme + 截圖比 mockup section 01（**deferred — local dev 視覺驗證留 user 觸發 /design-review 時**）

### 4.2 NewTripModal 文案 + 多目的地拖拉（mockup section 03）

- [ ] 4.2.1 寫 failing test：`tests/unit/new-trip-modal-multidest.test.tsx`（**deferred — implementation 完成；既有 new-trip-modal.test.tsx 補了 row testid 重命名 cover regression；新 multidest unit test 留下個 PR**）
- [x] 4.2.2 改 modal title 文案：「想去哪裡？」→「新增行程」
- [x] 4.2.3 改日期 mode tabs label：「選日期 / 彈性日期」→「固定日期 / 大概時間」
- [x] 4.2.4 改 destination section label：「目的地」→「目的地（可加多筆，拖拉排序）」
- [x] 4.2.5 加 helper 行：「行程跨 N 個目的地 · 順序決定地圖 polyline 串接方向」
- [x] 4.2.6 拿掉 sub-headline「先說目的地跟想做什麼，AI 會幫你排日程、餐廳、住宿。」
- [x] 4.2.7 重 build destination input：用 `@dnd-kit/sortable` 做 sortable list（grip + 編號 + name + region + remove）取代既有 chips
- [ ] 4.2.8 加「熱門目的地」chip group + 「最近搜尋」chip group（**deferred — 需 trending data + localStorage taxonomy；單獨 follow-up**）
- [ ] 4.2.9 dropdown search results 改分組顯示（**deferred — UX 改寫獨立 follow-up**）
- [ ] 4.2.10 加「分配天數」stepper：dest count ≥ 2 時顯示（**deferred — 跟 trip.days 多 dest 切 day quota schema 一起設計，獨立 PR**）
- [ ] 4.2.11 視覺驗證：local dev 開 NewTripModal + 加 3 dest 拖拉 + 截圖比 mockup section 03（**deferred — 留 user 觸發 /design-review 時**）

### 4.3 DaySection day hero 加 day title（mockup section 10）

- [x] 4.3.1 寫 unit test `tests/unit/day-section-title.test.tsx` (6 case)：title 顯示 + label fallback + Day N fallback + title===area chip 不重複 + title !== area chip 仍渲染 + 空白 title fallback
- [x] 4.3.2 D1 migration：`migrations/0042_trip_days_title.sql` + rollback 加 `title TEXT` column
- [x] 4.3.3 跑 migration on local dev D1（staging / production 留 ship 後 ops）
- [x] 4.3.4 修改 `src/types/trip.ts`：`Day` + `DaySummary` 加 `title?: string`；`useTrip` mapDayResponse + `_merge.ts` assembleDay surface title；audit rollback ALLOWED_COLUMNS 加 title
- [x] 4.3.5 修改 `src/components/trip/DaySection.tsx` hero：title || area || `Day ${dayNum}` 3 層 fallback；area chip 與 title 同字時不重複顯示
- [ ] 4.3.6 follow-up issue 紀錄：「day title 編輯 UI（PATCH /api/trips/:id/days/:num）」獨立 PR

### 4.4 DayNav eyebrow 對齊（mockup section 11）

- [ ] 4.4.1 寫 failing test：`tests/unit/day-nav-eyebrow.test.tsx`（**deferred — implementation 完成；unit test 留下個 PR**）
- [x] 4.4.2 修改 `src/components/trip/DayNav.tsx` eyebrow logic：今天 day 加「· 今天」suffix（拿掉獨立 TODAY pill）
- [x] 4.4.3 拿掉 `<span class="dn-dow">` 週幾英文 extra row
- [ ] 4.4.4 area max-width 80px → 拿掉或 raise 120px（**deferred — area CSS 變動 raise 風險不對齊文字會破版，留 local dev 視覺驗證後決定**）

### 4.5 TimelineRail 加結構 section + 編輯備註 button + ConfirmModal（mockup section 12）

- [ ] 4.5.1 寫 failing test：`tests/unit/timeline-rail-toolbar-pencil.test.tsx`（**deferred — implementation 完成；unit test 留下個 PR**）
- [x] 4.5.2 加 toolbar 鉛筆 icon button：order 在「移到其他天」後「刪除」前；click → focus note textarea (data-testid `timeline-rail-edit-note-${entry.id}`)
- [x] 4.5.3 替換 `handleDelete` `window.confirm` → inline ConfirmModal pattern（destructive variant，showDeleteConfirm state + alertdialog modal + 確認/取消 button + Esc/backdrop close + 刪除中 disabled）
- [ ] 4.5.4 修改 `.ocean-rail-grip` CSS hover-only visible（**deferred — 既有 grip 永遠可見也是 OK affordance，spec MEDIUM 不是 HIGH，留 local 視覺驗證後改**）

### 4.6 TripPage TitleBar + travel pill（mockup section 13）

- [ ] 4.6.1 寫 failing test：`tests/unit/trip-page-titlebar-actions.test.tsx`（**deferred — TripPage mount 過重(useTrip + leaflet)；TitleBar action button 純 markup 改寫，unit test 留下個 PR with full TripPage harness**）
- [x] 4.6.2 改 TripPage TitleBar actions 從 icon-only 為 ghost button with icon + text label（建議/共編/下載）；tablet ≤1023px collapse 為 icon-only；mobile ≤760px hide 走 OverflowMenu
- [x] 4.6.3 寫 unit test `tests/unit/travel-pill.test.tsx` (7 case)：empty render null + min/desc/both render + type → icon mapping (car/walk/train/bus/plane)
- [x] 4.6.4 修改 `src/components/trip/TimelineRail.tsx` 渲染：兩 RailRow 之間 conditional render `<TravelPill>` 用 entry.travel = { type, desc, min }
- [x] 4.6.5 新建 `<TravelPill>` component：type → icon map (car/walk/tram/plane) + N 分 + desc text；無 min 也無 desc 時不渲染

### 4.7 TripsListPage filter+search+sort+owner+中文化（mockup section 16）

- [x] 4.7.1 擴 `tests/unit/trips-list-page.test.tsx` 加 5 個 Section 4.7 case：toolbar 顯示 + 我的 filter + 共編 filter + search expand + owner avatar 顯示 (16 case all pass)
- [x] 4.7.2 加 filter subtabs (segmented control)：全部 / 我的 / 共編；archived 留 follow-up（無 schema 支援）
- [x] 4.7.3 加 sort dropdown：最新編輯 / 出發日近 / 名稱 A-Z；client-side sort
- [x] 4.7.4 加 search expanding bar：button → expand input + 即時 filter trips by name/region + result count（mark highlight 留 follow-up）
- [x] 4.7.5 改 card eyebrow 從英文 → 中文（已於前 commit land）
- [x] 4.7.6 加 card meta 含 owner avatar 28x28 (圓形 initial) + 「由你建立 / owner@email」 name；ownerEmail unknown 時不渲染
- [x] 4.7.7 改 empty state 文案（已於前 commit land）

### 4.8 ChatPage day divider + AI avatar + bubble timestamp prefix（mockup section 17）

- [x] 4.8.1 寫 unit test `tests/unit/chat-page-day-divider.test.ts` (6 case)：同日連續 1 divider + 跨日 inject + 無 createdAt 不觸發 + mixed input + id format + text 含週X
- [ ] 4.8.2 寫 failing test：`tests/unit/chat-page-ai-avatar.test.tsx`（**deferred — ChatPage mount 過重 (useRequireAuth + apiFetch fetch mock + scroll observer)；avatar 純 markup 已驗 via E2E follow-up**）
- [x] 4.8.3 加 `buildMessagesWithDividers()` pure function：兩條 message 跨日時 inject `{ id: 'day-divider-YYYY-MM-DD', role: 'day-divider', text }` synthetic message
- [x] 4.8.4 ChatPage render loop 處理 day-divider type：render `<div class="tp-chat-day-divider">YYYY/MM/DD（週X）</div>` 不渲染 bubble
- [x] 4.8.5 加 `tp-chat-avatar.is-ai`「AI」avatar 32x32 在 assistant bubble 左側（user message 不加；row wrapper flex direction 處理對齊）
- [x] 4.8.6 修改 `tp-chat-msg-time` for assistant：prefix「Tripline AI · 」（user message 不加）
- [x] 4.8.7 改 ChatPage TitleBar 主標題從固定「聊天」→ 當前 trip.name (fallback「聊天」)；trip switcher 保留既有 picker
- [x] 4.8.8 改「送出」 text button → icon-only（前 commit 已 land）

### 4.9 ExplorePage POI card cover + heart + rating + region + subtabs（mockup section 18）

- [ ] 4.9.1 寫 failing test：`tests/unit/explore-page-card-cover.test.tsx`（**deferred — 既有 explore-page.test.tsx 4 case pass cover regression；POI 卡片 cover/heart 結構 visual-only，留下個 PR 配合真實 search results integration test 一起補**）
- [x] 4.9.2 重 build `.explore-poi-card`：top 100% 16:9 cover (data-tone 1-8 8 種 gradient placeholder) + 右上 heart icon button (toggle saved) + body 內 rating meta line
- [x] 4.9.3 改 TitleBar action icon：star → heart（前 commit 已 land）
- [x] 4.9.4 加 region selector pill：default「全部地區」+ click open prompt dropdown（簡易 prompt; 完整 dropdown UI 留 follow-up）
- [x] 4.9.5 加 subtab chips「為你推薦 / 景點 / 美食 / 住宿 / 購物」5 個；client-side filter results.category text contains regex（無資料時 fallback 全顯示）
- [x] 4.9.6 加 card hover：accent border + `transform: translateY(-2px)` + shadow-md transition
- [ ] 4.9.7 重新評估 ExplorePage 「儲存池 multi-select + 加入行程 modal」流程在 add-stop-modal 完成後是否還必要（**deferred — add-stop-modal 收藏 tab 已可滿足；ExplorePage 儲存池流程 cleanup 留下個 PR**）

### 4.10 MapPage FAB + day tab overview + AlertPanel（mockup section 20 + section 04）

- [x] 4.10.1 加 `src/components/trip/MapFabs.tsx`：右下 FAB stack 「圖層」+「定位」 button + Wired to MapPage 經 OceanMap onMapReady 拉 L.Map ref
- [x] 4.10.2 圖層 FAB：popover 顯示街道 / 衛星 / 地形 3 選項；Esri World Imagery (衛星) + OpenTopoMap (地形)；切換 swap tile layer (eachLayer + remove + addLayer)
- [x] 4.10.3 定位 FAB：navigator.geolocation.getCurrentPosition → flyTo(zoom 14) + L.circleMarker user pin；無 geolocation API 觸發 alert
- [x] 4.10.4 修改 `src/components/trip/MapDayTab.tsx` active 樣式：border-bottom-color 改用 inline `--day-color` CSS var (per-day color underline)，fallback 既有 accent (overview tab 沒 dayColor)
- [x] 4.10.5 建 `src/components/shared/AlertPanel.tsx`：variant (error/warning/info) + icon + title + message + actionLabel + onAction + onDismiss
- [x] 4.10.6 寫 unit test `tests/unit/alert-panel.test.tsx` 驗 3 variants render + dismiss + action callback
- [x] 4.10.7 接入 `useOnlineStatus`：TripPage offline 時 render warning AlertPanel；既有 useOfflineToast transient 通知保留（雙層 UX：toast 短暫提示 + AlertPanel 持久 hint）
- [x] 4.10.8 接入 TripPage 載入失敗：error AlertPanel + retry action (setResolveKey 觸發 useTrip refetch)

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
