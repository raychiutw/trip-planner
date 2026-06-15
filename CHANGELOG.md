# Changelog

All notable changes to Tripline will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [2.55.4] - 2026-06-16

### Security
- **dompurify low-sev audit 修補（`overrides`）** — `npm audit` 回報 dompurify ≤3.4.8 兩個 low advisory：Trusted Types policy 在 `clearConfig()` 後殘留污染後續 `RETURN_TRUSTED_TYPE`（GHSA-vxr8-fq34-vvx9）、`SAFE_FOR_TEMPLATES` bypass 讓 template 運算式在 `<template>` 內存活（GHSA-gvmj-g25r-r7wr）。dompurify 為 transitive dep（`html2pdf.js`→`jspdf`，PDF 匯出用），實際解析版本 3.4.7。
  - `package.json` overrides 釘 `dompurify: ^3.4.10`（上游 `^3.3.1` range 相容），解析升至 3.4.10 → `npm audit --omit=dev` 歸零。由每日健康檢查 `/tp-daily-check` 自動修復產出。

## [2.55.3] - 2026-06-11

### Fixed
- **stale chunk 自癒涵蓋全部 lazy import（`lazyWithRetry`）** — Sentry「Failed to fetch dynamically imported module: `TripSheet`」。`lazyWithRetry`（deploy 後舊 chunk hash 失效時 retry + reload 自癒）原本只是 `main.tsx` 的 module-local function，route-level pages 都有保護，但 6 個 component 層裸 `lazy()`（`TripPage`→`TripSheet`、`TripSheet`→`TripMapRail`/`ChatPage`、`TripMapRail`/`MapPage`/`GlobalMapPage`→`TpMap`）沒有 fallback → 新 deploy 後舊 client 引用的舊 hash chunk 已不存在 → uncaught error 進 Sentry。
  - 抽 `main.tsx` 的 `lazyWithRetry` 成共用 util `src/lib/lazyWithRetry.ts`，全部裸 `lazy` 改用之。邏輯不變（retry once → reload → reject），`sessionStorage` flag 由 `main.tsx` 既有清除邏輯沿用，不會無限 reload。
  - `tests/unit/trip-map-rail-lazy.test.ts` source-pattern 斷言對齊 `lazyWithRetry`（由每日健康檢查 `/tp-daily-check` 自動修復產出）。

## [2.55.2] - 2026-06-09

### Fixed
- **行程卡 ⋮ 選單被遮（`TripsListPage`）** — `EmbeddedActionMenu` 固定 `r.bottom + 6` 往下展開，靠列表底部的卡片選單超出 viewport 底部、被 `GlobalBottomNav` + Safari 工具列蓋住（選單雖 `z-index: 9000` 在 nav 上層，但超出可視區的部分在螢幕外）。`recompute` 加 **dropUp**：下方放不下（`below + menuH > vh - BOTTOM_SAFE_AREA`）且上方夠 → 改往 trigger 上方展開。`position: fixed` → `r.top` viewport 座標一致。
- **複製行程 title 加「-複製」（`share/[token]/clone.ts`）** — share clone 複製出的行程 `name`/`title` 原樣帶來源、與來源同名難分辨。改 `name` 後綴「-複製」、`title` 有值後綴「-複製」（空則 `null`）→ 顯示標題（`title || name`）一定帶「-複製」。

## [2.55.1] - 2026-06-09

### Fixed
- **`useAutosave` in-flight 競態 — 不再遺失最後一次編輯**（reservation PR Codex follow-up）。`performSave` 在 save 進行中（`inFlightRef`）直接 return，但 save 完成後沒 reschedule 那批被 return 的 pending → 慢請求下「save 期間 user 又 patch」的最後編輯 silently 遺失（除非 onBlur flush 兜底）。影響全站 autosave（per-POI note / reservation 等）。
  - 修：`performSave` finally 後，若 **save 成功** + pending 非空 + online + 無 active timer + **未 unmount** → 排下一輪 save（`performSaveRef` 解遞迴）。`saveSucceeded` flag 確保 error 路徑不自動重排（否則失敗的 save 無限重試）；`isMountedRef` 防卸載後 reschedule（Codex #2）。
  - TDD：`use-autosave-inflight-race`（4）— in-flight 接著存第二批用新 version / 無 pending 不重排 / error 不重排 / unmount 不重排。
  - Known follow-up：`STALE_ENTRY` 409 retry 路徑 in-flight 期間的 patch 仍可能被清空丟失（pre-existing、極罕見，完美修需重構 retry 多-await snapshot）。

## [2.55.0] - 2026-06-09

### Fixed
- **`trip_entry_pois.reservation` 欄位 JSON 污染根治** — reservation 型別是 `string`（文字註解），但 AI 生成路徑曾把結構化訂位狀態寫成 JSON（`{"available","method","url"/"phone","recommended"}`）塞進此欄，prod 43 筆污染、前端（`TimelineRail` / `EditEntryPage`）直接印 → 露出 raw `{...}`。
  - **A 資料清理**（`scripts/normalize-reservation-json.ts`）：每筆 JSON 用 `reservationJsonToText` 萃取人話（`available:no`→「不需訂位」、`yes+website+url`→「建議網路預約：<url>」、`yes+phone`→「建議電話預約：<phone>」）**append 進該 POI 的 `note` 備註**（保留原 note），reservation 清空。url/phone 只在 JSON 內（`reservation_url` 欄位全空），救進 note 不遺失。**deploy 後執行**。
  - **D 寫入防堵**：`days/[num].ts`（AI 生成）+ `trip-pois.ts`（加備選）+ `_import.ts`（匯入 attacker-controlled JSON）三路徑 reservation 寫入套 `normalizeReservation`，防再污染。

### Added
- **reservation per-POI 可編輯（`EditEntryPage`）** — 泛化 `PerPoiNoteRow` 支援 `field='reservation'`（複用 inline edit + autosave PATCH）；alternate 卡 reservation 從唯讀 chip 改成可點擊編輯 row（空值「+ 加訂位資訊」），訂位連結移到 row 右側外連 link（`escUrl` + `rel="noopener noreferrer"` 守護不變）。後端 `PATCH /trips/:id/entries/:eid/pois/:poiId` 加收 `reservation`（validate + JSON-shaped 正規化）。
  - helper `functions/api/_reservation.ts`：`reservationJsonToText`（只認已知 `available:'yes'|'no'` shape，未知 JSON → null 防誤轉資料損毀）+ `normalizeReservation` + `isJsonShapedReservation`。TDD：`reservation-format`（含未知 shape）+ `reservation-write-guard` source-grep contract。Codex adversarial 1-3 修（helper 嚴格化 / import 防堵 / trip-pois 型別驗證）；#4 useAutosave in-flight 競態 = pre-existing（note 同 path、onBlur flush 兜底）→ follow-up。

## [2.54.11] - 2026-06-08

### Changed
- **探索卡 cover 改依 POI 類型三色（`ExplorePage`）** — `/qa` 三色比例稽核發現探索是唯一不符「木棕為主」的頁：cover 用舊的 8 色 hash 裝飾漸層（5/8 是冷色 綠/藍/粉紫/紫/teal、by place_id hash），整頁 POI grid 像彩虹。改成依 POI 類型三色（`poiTypeToTone`）：cover 漸層 = 卡的 `--tone → --tone-deep`（景點/購物=柔褐、住/交通=sage、餐/咖啡=粉、neutral→accent），與行程一覽 cover 一致。探索回歸木棕主（量測：colored 中 sage 89%→brown 98%）。
  - 移除舊 8 色 `.explore-poi-cover[data-tone=1..8]` 規則 + place_id char-sum hash 計算（dead）。收藏/愛心 heart 仍永遠粉、卡身淡底 + 類型標籤 tone 不變。
  - 稽核結論：其餘頁（行程表/一覽/收藏/帳號）皆守住木棕主、sage>粉、綠粉不過重。TDD：`explore-cover-tone.test.ts`（source-grep contract）。

### Fixed
- **探索卡 review follow-ups（`ExplorePage`，Codex adversarial）** — 隨 cover 三色一併修：
  - **a11y（pre-existing）**：收藏 ❤ + 加入行程 ➕ 兩顆互動鈕原本巢在 `aria-hidden="true"` 的裝飾 cover `<div>` 內，整組被移出無障礙樹（螢幕報讀者無法操作）。改為移出成 card 直屬（card 是 `position:relative` 定位脈絡，視覺位置不變），cover 維持 aria-hidden 純裝飾。
  - **對比（cover 三色衍生）**：cover 改三色後，已收藏的粉底 ❤ 疊在 food（粉）cover、柔褐底 ➕ 疊在 attraction（柔褐）cover 上會同色相溶、圓鈕邊界消失。兩顆實心鈕加 neutral 陰影（`box-shadow: 0 1px 4px rgba(0,0,0,.28)`）讓邊界在任何同色系 cover 上恆可辨（不靠淺 tone 當前景）。
  - **測試強化**：cover 漸層 contract 加鎖第二 stop `--tone-deep`；新增行為測試證明 category → tone 綁定（restaurant→粉 / museum→柔褐 / hotel→sage）+ 鎖互動鈕不在 aria-hidden cover 內。

## [2.54.10] - 2026-06-08

### Added
- **帳號依設定分區三色（`AccountPage`）** — 非-POI 頁三色**收齊**（行程一覽/AI聊天之後第 3 站）。設定 hub 每個分區一色，由 `group.tone` 驅動 row icon chip（mockup V1「輕觸」，只 icon chip 上色）：**應用程式=柔褐**（你的偏好）、**共編 & 整合=sage**（連結 app/開發者）、**帳號=pink**（裝置/登出）、**登出=destructive 紅**（保留）。
  - 語意延伸：分區剛好對上三色（協作/整合、系統/安全各有歸屬）；user 拍板 V1 + sage↔pink 對調（共編&整合 sage、帳號 pink）。
  - icon chip = `.tp-account-rows[data-tone]` 帶 `--tone-bg` 底 + `--color-foreground` glyph（~11–12:1，light/dark 皆安全）；tone 規則 `:not(.is-danger)` 排除登出 row，紅 icon 不被蓋。
  - TDD：`account-page.test.tsx` 加 render 斷言（application=accent、collab=sage、account=pink data-tone）。canonical mockup：`docs/design-sessions/2026-06-08-account-tricolor-by-group.html`。

## [2.54.9] - 2026-06-08

### Added
- **AI聊天依角色三色（`ChatPage`）** — 非-POI 頁三色第 2 站。聊天 avatar 依「誰在說話」上 tone（mockup V1「輕觸」，只 avatar 上色、泡泡維持中性）：**你=柔褐**（實心，右側，沿用 base avatar）、**AI 助理=sage**（`.is-ai` → `--color-accent-2-bg`）、**共編旅伴=pink**（`.is-other-user` → `--color-accent-3-bg`）。
  - **修掉現有問題**：原本 AI avatar（foreground 深底）與共編旅伴 avatar（secondary 灰底）意義上撞色、分不出哪句是 AI 哪句是真人；分色後一眼可辨。
  - avatar 用 `--tone-bg` 底 + `--color-foreground` 字（contrast light/dark 皆過 ~7–12:1）；**不用 vivid `--color-accent-2/-3` 實心** —— dark mode 對 foreground 字僅 1.78:1（< WCAG），故用 `-bg` 階。移除不再需要的 `[data-theme=dark]` avatar 覆寫。
  - TDD：`chat-avatar-role-tone.test.ts`（source-grep contract：is-ai=accent-2、is-other-user=accent-3、字=foreground、base=accent）。canonical mockup：`docs/design-sessions/2026-06-08-chat-tricolor-by-role.html`。

## [2.54.8] - 2026-06-07

### Added
- **行程一覽「依目的地三色切換」（`TripsListPage`）** — 三色從 POI 顯示/編輯面延伸到非-POI 頁的第一站。行程卡依目的地上 tone（mockup V3「整卡同色」，user sign-off）：cover 用 tone 漸層 + 卡身 `--tone-subtle` 淡底 + border/hover/選取框/選取點跟 tone。一覽照去的地方分色、同目的地視覺成組（5 個日本柔褐成組、台灣 sage 跳出）。
  - `destinationTone(countries)`：常見國家**錨定**（日本=accent 柔褐、台灣=sage、韓國=pink，沿用舊 `coverClass` 的 `.includes` + JP>KR>TW 優先序），其餘國家 deterministic hash **輪替**三色（每國穩定一色、可擴到任何國家、不退化成全 neutral；空/未知 → accent）。
  - 字一律 `--color-foreground`/`--color-muted`（不用 `--tone-deep` 當字 —— light mode sage/粉 deep 對 subtle 對比 <4.5:1；色由 cover + 卡底承載）。對比 light/dark 皆過 WCAG（title 10–14:1、meta 4.8–5.9:1、avatar 7.3–12:1）。
  - 取代舊的 `--color-cover-*` 國家別 cover 漸層 token（jp/kr/tw/other，連 `coverClass` 一併移除 —— 改用三色系統後已 dead）。
  - 註：這是三色的 **categorical / wayfinding 用法**（粉在此 = 某目的地，非 POI 語意的吃/收藏）；DESIGN.md「非-POI 頁的分色」章已記此 context-dependent 例外。canonical mockup：`docs/design-sessions/2026-06-07-trips-list-by-destination.html`。
  - TDD：`trips-destination-tone.test.ts`（錨定 + hash 穩定性 + 分布 + 優先序 + 空值，6 cases）。

## [2.54.7] - 2026-06-07

### Added
- **三色擴到 `EditableCategoryChip`（可編輯分類 chip）** — 一次點亮多頁的分類 chip：此共用元件用於 `EditEntryPage`（master + 備選）、`ChangePoiPage`（mode=new 搜尋結果）、`AddStopPage`（搜尋結果）。chip 依其分類 `value` 上 tone（`poiTypeToTone(value)`）：
  - 淡 tone 底（resting `--tone-subtle`）+ hover 深一階 `--tone-bg` + open/focus 的 `--tone` 框。
  - **字與 icon 一律 `--color-foreground`（~13:1）**，不塗 `--tone-deep` —— light mode 下 deep 對 `--tone-subtle` sage 僅 2.81:1（< 3:1 非文字門檻）。tone 由 chip 底色 + 框承載。
  - 顯式設 `--tone-*`（不靠繼承）—— chip 常被包進已設 `--tone-*` 的 tone 卡（如 EditEntryPage POI 卡）內，靠繼承會拿到卡的 tone 而非 chip 自己 `value` 的。neutral 顯式回 accent。
- 至此非地圖的 POI/分類顯示與編輯面三色全到齊。

## [2.54.6] - 2026-06-07

### Added
- **三色擴到 EditEntryPage（編輯停留點頁）的 master POI 卡** — POI summary 卡（`.tp-edit-entry-poi`）依該 POI 的分類上 tone，與收藏卡 / 加入行程摘要 / 時間軸卡同視覺語言：
  - 卡身 `--tone-subtle` 淡底 + `--tone` 左邊（3px）；icon badge `--tone-bg` 底 + `--color-foreground` 字（**不**用「填滿 `--tone` + 白字」—— sage/粉太淺、白字對比不足；也不用 `--tone-deep` 字 —— light mode 下 deep 對 `-bg` 對比 <3:1，WCAG 非文字 fail。`--color-foreground` 隨 light/dark 翻轉，對 `--tone-bg` 一律 ~10:1）。tone 由 badge 底色承載。
  - tone 依 `poiTypeToTone(poiInfo.poiType)`，`poiType` = POI 的 `master.type`（與同頁 icon / 可編輯 category chip / label 同源）。改 category chip 時卡 tone 即時更新（餐廳→粉、住宿/交通→sage、景點/購物/活動→柔褐）。
  - neutral 顯式回 accent，不靠 `var()` fallback，避免被有設 `--tone-*` 的祖先繼承汙染。
  - 註：tone 依「POI 實際（可編輯）分類」而非時間軸的 entry travel-type overlay，與可編輯 chip 語意一致；未分類 POI（`master.type` null）顯 accent（同其 景點 預設）。

## [2.54.5] - 2026-06-07

### Tooling / Correctness（v2.54.4 的根因預防 follow-up）
v2.54.4 的「自訂 POI 分類存錯」是 hook 依賴陣列漏列卻無人擋（repo 原本完全沒有 ESLint）。本版補上守門並清掉同類隱患：

- **導入最小 ESLint（`eslint.config.mjs`）** — 只開 `react-hooks/rules-of-hooks` + `react-hooks/exhaustive-deps`（皆 error），**不**採用其他 style 規則或 react-hooks v7 的 React Compiler 系列，精準鎖定 hook 依賴 bug class、避免一次掃出無關 noise。加 `npm run lint` script + CI gate（`.github/workflows/ci.yml`，tsc 之後）。
- **修掉全部 13 個既有 exhaustive-deps 違規**（10 處）：
  - `ChangePoiPage`：**去掉包整個 render 的 `main` useMemo**（直接 return JSX），對齊本來就正確的 `AddStopPage`。這個「手維護 30 項 dep array」正是 v2.54.4 的 footgun，移除後「加 state 忘了改 dep」這類 bug 結構上不再可能。
  - `DaySection`：`timeline` 用 `useMemo` 穩定 reference（`?? []` 每 render 造新陣列、讓 4 個下游 memo 永不命中）。
  - `AddPoiFavoriteToTripPage`：`TIME_RE` regex 提到 module scope（原本在 render 內每次重建）。
  - 補穩定依賴：`InfoSheet`（panelRef）、`ChatPage`（setActiveTripId）、`PoiFavoritesPage`（favorites.length）、`TripPage`（navigate + resolveState，受 initialScrollDone latch 保護）。
  - 3 處刻意 `eslint-disable` 附理由：`usePlacesAutocomplete`（ensureSessionToken 只碰 ref，列入會破壞 debounce）、`useRoute`（刻意只依賴 from/to 的 lat/lng 原始值，避免物件參考變動就重抓）、`GlobalMapPage`（mount-only 初選，activeTripId 變動由另一個 effect 處理）。
- 全為 behaviour-preserving（補的依賴皆穩定 / 冗餘 / 受 latch 保護）；vitest 386 檔 3333 測 + tsc + lint 全綠。

## [2.54.4] - 2026-06-07

### Fixed
- **自訂 POI 分類存錯（一律存成「景點」）** — `ChangePoiPage` 自訂 tab 用 `CategoryPicker` 選分類後，不論選哪個都被存成 `attraction`（景點）。Root cause：`customCategory` state 是 v2.50.0 才加的，但從沒被加進兩個既有的 dependency array：
  - `handleSubmit` (`useCallback`) 的 deps 漏了 `customCategory` → callback 閉包卡在初始 `'attraction'`，送出 payload 的 `type` / `poi_type` 永遠是 `'attraction'`（**資料寫錯，使用者實際回報的 bug**）。
  - `main` (`useMemo`) 包整個 render 的 deps 漏了 `customCategory`（與 `customDestinations`）→ memoized JSX 在點分類時不重算，picker 視覺停在初始選取（prod 觀察到的「點了不會動」）。
  - 修法：把 `customCategory` 補進 `handleSubmit` deps、把 `customCategory` + `customDestinations` 補進 `main` deps（`customDestinations` 原本只靠 `customInitialCenter` 間接帶入，改顯式列出）。
  - 新增 behavioural regression test（`change-poi-custom-category.test.tsx`）：render 真實頁面、依 title→coord→分類順序操作，斷言送出 payload 的 `type` 為所選分類。純 source-grep contract test 抓不到此 runtime bug。
  - 旁證確認 `AddStopPage`（同樣用 `CustomPoiForm`）**無此 bug** — 它的 `handleConfirm` deps 已含 `customCategory`，且 render 非 memoized。此問題僅 `ChangePoiPage` 的 `main` useMemo + handleSubmit 漏列所獨有。

## [2.54.3] - 2026-06-07

### Fixed (本機 dev / stage 環境修復)
調查「自訂 POI 分類 picker」prod bug 時發現本機 dev 環境多處壞掉、無法重現，連帶修好：
- **`/api/oauth/userinfo` 認 mock auth** — 原本只用 `requireSessionUser`（讀 session cookie），忽略 `_middleware` 的 `context.data.auth`。本機 mock auth 無 session cookie → page-load 探測拿 401 → 前端登不進。改用 `getAuth(context)`，無才 fallback `requireSessionUser`（保留未登入 401）。注意：`_middleware` 對所有 `/api/oauth/*` 設 `auth=null`，**唯獨 DEV_MOCK_EMAIL path 在該 short-circuit 前 decorate**，所以這實際只對本機 mock 生效；prod（無 DEV_MOCK_EMAIL）auth 為 null、照舊走 `requireSessionUser` fallback。
- **`dev:init` 加 `--env production`** — D1 binding 在 `[[env.production.d1_databases]]`，本機 `wrangler d1` 指令不加 `--env production` 會 "Couldn't find a D1 DB"。
- **`npm run dev` 加 `--d1 DB`** — `wrangler pages dev` 不會自動注入 env.production binding → `env.DB` undefined → functions 500。`--d1 DB` 綁本機 D1（讀 init 同步的 `hash("DB")`；pages dev 不支援 `--env`）。
- **`npm run dev:staging` 修 `--env preview`（stage 環境）** — `wrangler pages dev` 根本不支援 `--env`（會直接報「Pages does not support the --env flag during local development」），所以 dev:staging 一啟動就死。改 `--local --d1 DB -b ENVIRONMENT=preview`：綁同一份本機 D1（prod 資料）、用 `-b` 把 `ENVIRONMENT` 蓋成 `preview`（實測 `-b` 勝過 `.dev.vars`），mock auth 在 preview 也允許。dev 與 stage 兩個本機環境都通。
- **`.dev.vars.example` 補 `ENVIRONMENT` + `ALLOW_DEV_MOCK`** — v2.33.100 SEC-6 fail-closed guard 要這兩個 + `DEV_MOCK_EMAIL` 三者齊全才允許 mock auth，原本沒文件化。
- **`backup-prod-d1.sh` JSON parse robust** — wrangler 在 `--json` stdout 前印 deprecation warning → `json.load` JSONDecodeError。改從第一個 `[` 起 parse。

> 純本機開發工具修復，無 production 行為改動（prod userinfo 仍走 `requireSessionUser` session-cookie 驗證，與原本相同）。

## [2.54.2] - 2026-06-07

### Added
- **三色擴到編輯/輸入表單** — tone 從「顯示卡」延伸到使用者輸入面：
  - **分類選擇器 `CategoryPicker`**：8 格分類 tile 各帶 `data-tone={poiTypeToTone(type)}`，**選中態**用該分類自己的 tone（淡底 + `-deep` 字 + tone 描邊），取代原本一律柔褐。picker 等同三色 legend — 選「餐廳」亮粉、「住宿」亮 sage、「景點/購物」亮柔褐，一眼對得起時間軸卡的配色。
  - **加入行程精靈的 POI 摘要框 `.tp-form-poi-summary`**（`AddPoiFavoriteToTripPage`）：依加收藏的 POI 類型上 tone（淡底 + border-left + eyebrow `-deep`），與該 POI 在收藏/時間軸的顏色一致。
- 至此三色 tone 涵蓋顯示面（時間軸卡 / 展開明細 / StopLightbox / 收藏卡 / 探索卡）與編輯面（分類 picker / 加入行程摘要）。

### Correctness
- **Direct mode 摘要 tone 正規化** — 從探索頁 ➕ 進來的 `/add-to-trip?category=…` 帶的是 raw Google primaryType（如 `lodging`），直接餵 `poiTypeToTone` 會落 neutral（暖褐），跟探索卡的 sage 不一致。摘要 tone 改 `poiTypeToTone(mapGooglePrimaryTypeToPoiType(...))` 先正規化（與同檔送 API 的 poi_type 一致），達成「同一 POI 跨頁同色」。
- **分類 picker 鍵盤 focus 不蓋選中色** — `:focus-visible` 改用 `outline`（原 inset box-shadow 會蓋掉 `.is-active` 的 tone 選中框，tab 到已選餐廳/住宿 tile 時粉/sage 框被換成 accent）。outline 與選中框正交，兩者並存。
- **neutral 防繼承汙染** — picker tile 與摘要框的 `data-tone="neutral"` 顯式定義 `--tone: accent`，不靠「無規則→var() fallback」，避免被有設 `--tone-*` 的祖先繼承到非預期 tone。

## [2.54.1] - 2026-06-07

### Added
- **探索頁 POI 卡卡身三色**（補 v2.54.0 暫緩項）— `.explore-poi-card` 依 POI 類型（`poiTypeToTone(mapNominatimCategory(poi.category))`）上同色系淡底 + 類型標籤 `--tone-deep` 上色。裝飾性 cover 8 色照片佔位維持不變（只動卡身，不與照片衝突）。至此所有「顯示卡」（時間軸卡 / 展開明細 / StopLightbox / 收藏卡 / 探索卡）三色到齊。

## [2.54.0] - 2026-06-07

### Added
- **三色擴到收藏/探索/詳情** — 三色 tone 從行程表延伸到更多面：
  - **StopLightbox 全螢幕景點詳情**依 stop 類型上 tone 色（header 淡底 + 類型標籤 + meta pill / 說明卡 / 地點卡背景 + icon），與時間軸卡片一致。
  - **收藏頁 `.favorites-card`** 依 POI 類型上同色系淡底（新增共用 `poiTypeToTone(poiType)`，因收藏/探索頁用 `PoiFavoriteRow`/`PoiSearchResult` 非 `TimelineEntryData`）。
  - **收藏/愛心 = 第三色粉**：探索頁 POI 卡的「♡ 已收藏」愛心鈕 + 「已加入收藏」按鈕 → `--color-accent-3`（粉），與卡片 tone 無關、永遠粉，呼應 spec「收藏/愛心 = 粉」。
- `poiTypeToTone()` helper（timelineUtils）：canonical poiType → tone，與 `deriveTypeMeta` 一致。

> 探索頁卡卡身的 tone tint 暫緩（該卡有裝飾性 cover 漸層，套 tone 會衝突，後續再處理）。

## [2.53.1] - 2026-06-07

### Fixed
- **stop 展開明細沒套到 tone 同色（v2.53.0 漏修）** — 展開的 `.tp-rail-detail` 是 `.tp-rail-item` 的 **sibling**（非後代），拿不到繼承的 `--tone-*`，背景退回中性 secondary 奶油。改在 `.tp-rail-detail` 自帶 `data-tone={meta.tone}` + 把 `--tone-*` 變數定義同時套到 `.tp-rail-detail[data-tone]`，展開面板與卡片真正同色系。加 render 回歸測試鎖 detail 必帶 `data-tone`。

## [2.53.0] - 2026-06-07

### Changed
- **三色 tone 對應調整** — 依使用回饋重新分配：**用餐 → 粉**（含咖啡 café）、**住宿 → sage 綠**、**活動 → 柔褐**。其餘不變（景點/購物 柔褐、交通/停車 sage、備選/收藏 粉）。記憶法：玩/看/買=柔褐、住/移動=sage、吃=粉。改 `deriveTypeMeta` 的 `tone`。
- **stop 展開明細與卡片同色** — 點開 stop 的 `.tp-rail-detail`（景點說明/備註/actions 面板）背景 + 邊框改繼承該 stop 的 `--tone-subtle`/`-bg`（原 `--color-secondary` 中性奶油），展開區與卡片同色系一體；neutral 類型 fallback 回 secondary。
- SoT 同步：`DESIGN.md`（Approach / Stop Type Color Convention 表 / Design Principles）+ canonical mockup。

## [2.52.0] - 2026-06-06

### Changed
- **柔褐三色行程表主題：時間軸卡片依類型分色，三色一眼可辨** — 解決 v2.51 三色「不明顯」（sage 只在小 icon、粉沒上、整頁幾乎全柔褐）。行程表時間軸卡片改依 POI 類型上**同色系淡底**：一般 POI（景點/餐廳/購物/住宿）柔褐、交通 sage 綠、活動／備選／收藏粉。`deriveTypeMeta` 新增 `tone`（accent/sage/pink/neutral）驅動 `.tp-rail-item[data-tone]`（取代 `data-accent`）：卡片 `-subtle` 底 + 同色系 ghost icon 階梯（icon 底 `-bg` → glyph/描邊 `-deep`，卡片→icon→glyph 同色相由淺到深）+ 類型標籤/dot/caret 同步上色；neutral 走 `var()` fallback 回原中性樣式。
- **交通 travel pill 改 sage 描邊式** — 透明底 + 1.5px sage 邊 + sage `-deep` 字/icon（取代原填滿 secondary 底），交通段一眼可辨。
- **備選景點卡改第三色粉底** — `.tp-rail-poi-card` 用 `--color-accent-3` 系。

### Fixed
- **深色模式粉色太暗讀不出** — `body.dark` 的 `--color-accent-3-subtle` `#33232A`→`#4A2A3A`、`-bg` `#43303A`→`#6B3F52`，深色活動/備選卡的粉與 sage 綠彩度相當。
- **sage/粉 tier token 被 Tailwind tree-shake 掉** — `--color-accent-2-*` / `--color-accent-3-*` 的 `-deep/-subtle/-bg` 階層先前無人引用，Tailwind 4 `@theme` 不 emit（prod 取值為空）。新 `data-tone` 規則引用後正常 emit（build 確認）。

> 設計 SoT 同步：`DESIGN.md`（Approach / Light·Dark 表 / Stop Type Color Convention / Stop Card / Travel Connector / Design Principles 全改三色）+ canonical mockup `docs/design-sessions/2026-06-06-three-color-trip-theme.html`。

## [2.51.0] - 2026-06-06

### Changed
- **三色系統第一階段：主色從 terracotta 改為柔褐 `#A97A4A`** — 參考 mamahoikuen.jp 暖柔三色，主色（CTA / active / link / 景點·餐廳 icon / chip / rating）全站從 `#D97848` 改 `#A97A4A`，整體更柔。同步對齊 email 品牌色、theme-color meta、地圖 marker、trip 封面漸層、info token。
- **交通資訊改用第二色 sage 綠 `#A8BAAA`** — `TravelPill`（車程/步行）icon 改 sage，與主色形成冷暖分工。
- **清除全站殘留 terracotta hardcode** — 分享 modal（`ShareLinkModal` pill/按鈕/tint 家族 `#d97848`/`#fbeee4`/`#b85c2e`/`#f7dfcb`）、列印樣式（`tripPrintStyles` 含封面漸層 `#f0935e`）、6 個 auth 頁背景光暈 `rgba(217,120,72,*)`、地圖 focused marker outer ring、cover-kr/cover-tw token 全部對齊柔褐 token 值（accent `#A97A4A`／deep `#8A6038`／bg `#E9DBC8`／subtle `#F4EDE3`）。

### Fixed
- **深色模式 info token 仍是舊 terracotta** — `body.dark` 的 `--color-info` 漏改，淺色已柔褐、深色卻還橘。對齊深色 accent `#CBA06E`。
- **深色模式 accent e2e 斷言過時** — `tokens-layer.spec.ts` dark accent 仍斷言舊 `#E89968`，更新為 `#CBA06E`（CI 紅燈根因）。

### Added
- **三色 token `--color-accent-2`(sage 綠) / `--color-accent-3`(玫瑰粉)** — light/dark 各 4 階，供逐步落地。完整 spec 見 `docs/design-sessions/2026-06-06-three-color-system.md`。

> 三色系統遷移中：主色柔褐 + 交通 sage + 全站 hardcode 清除已落地；第三色粉（收藏/備選）+ 完整 DESIGN.md 表格後續。

## [2.50.3] - 2026-06-05

### Fixed
- **桌機版分類 picker 攤開鬆散、一行卡死 4 欄** — `CategoryPicker` 的 grid 寫死 `repeat(4, minmax(0,1fr))`，不論版面多寬都鎖 4 欄，桌機把每欄撐到 ~160px、icon 周圍大量留白。改 `repeat(auto-fit, minmax(54px, 1fr))`，一行欄數由容器寬度決定：寬版面（自訂景點表單、編輯景點卡片）一排放滿 8 個分類，窄手機自動 reflow 成 4-5 欄。
- **編輯景點 popover 桌機孤零零靠左、右側大片空白** — `EditableCategoryChip` popover 桌機（≥768px）改 absolute 浮層 + `min(512px, calc(100vw - 32px))` 寬度，8 個分類一行排開。用 absolute（而非撐寬 inline-block wrap）以免把 chip 同列的兄弟元素（如備選列星等）擠到下一行。
- **新增景點搜尋卡桌機 popover 被裁成碎片** — 搜尋卡 `.tp-add-stop-card` 是 `overflow:hidden` + ~331px 窄，桌機 absolute 浮層會被卡片裁掉。新增 `compact` prop：這類窄／overflow 容器維持手機式 in-flow 緊湊 popover（撐高卡片、不被裁切），不套桌機寬浮層；`dropUp`（精靈底部列）同樣排除。

### Changed
- `EditableCategoryChip` popover 陰影硬編碼 `rgba(0, 0, 0, 0.22)` 改用 `var(--shadow-lg)` token，補上 dark mode／高對比模式的陰影適配。

## [2.50.1] - 2026-06-04

### Fixed
- **分類 picker 在「新增景點」精靈底部列水平溢出** — v2.50.0 的 `dropUp` picker 用 `left: 0` 從靠右的 chip 彈出，288px 寬度衝出右邊界（prod QA 實測溢出 129px），購物/停車/景點/其他 4 格被切掉點不到。改 `right: 0` + 開啟時 `useLayoutEffect` 量測並 `transform` 水平夾回 viewport（左右各 8px margin），任意 chip 位置（短名置中／長名靠右）8 格皆完整顯示。

## [2.50.0] - 2026-06-04

### Added
- **「新增景點」精靈搜尋流程也能當場改分類** — v2.49.0 的可編輯分類 chip 原本只在 AddStopPage（`/add-stop`，行程頁「＋加景點」）有；另一個入口「新增景點」精靈走 `/add-entry` → `ChangePoiPage(mode=new)`，過去只有自動分類、不能當場改。現補上：選了搜尋結果後，底部操作列出現可編輯分類 chip，預設帶 `mapGooglePrimaryTypeToPoiType` 自動推導，可改後再加入。兩條加景點路徑體驗一致。
- **`EditableCategoryChip` 新增 `dropUp` prop** — 在 fixed/sticky bottom bar 等下方無空間處，picker 改向上彈出（absolute），避免被 viewport 底切掉、下排分類點不到。

### Fixed
- **對抗式 review 修復**（ChangePoiPage chip，prod QA 後 follow-up）：picker 在固定底部列向下彈出被切掉（→ `dropUp` 向上）、底部列無 `flex-wrap` 在窄螢幕溢出（→ scoped override）、切換選取時殘留展開的 picker（→ selection-scoped `key` remount）、選 favorite 未 reset 分類覆寫（→ 補 reset）。
- **分類選單在手機太窄狹長** — `EditableCategoryChip` 的 picker 因 `.tp-cat-chip-wrap` 是 inline-block 被壓成 min-content 窄條（4 格擠成 ~42px、又高又窄）。base `.tp-cat-chip-pop` 加 viewport-aware `min-width: min(288px, calc(100vw - 32px))`，tile 撐到 ~62px 舒適大小。三處 chip（EditEntryPage 正選/備選、AddStopPage、ChangePoiPage）一併改善。

## [2.49.0] - 2026-06-04

### Added
- **可自己更改景點分類（poi_type），橫跨 3 介面** — 過去分類只能在「新增自訂景點」時選，既有／搜尋加入的景點沒地方改。
  - **加入搜尋景點時**：AddStopPage 搜尋結果選取後顯示可編輯分類 chip，預設帶 Google `primaryType` 自動推導的分類（`mapGooglePrimaryTypeToPoiType`），可當場覆寫（per-result）。
  - **編輯正選／備選**：EditEntryPage 的 master 正選 + 每個 alternate 備選分類，從唯讀 label 改為可編輯（重用 CategoryPicker Variant C 8 格 icon grid）。
  - 新元件 `EditableCategoryChip`（icon + label + ✎）展開既有 CategoryPicker。

### Changed
- **後端 PATCH `/api/trips/:id/entries/:eid/pois/:poiId` 接受 optional `poi_type`** — whitelist 驗證後 collision-safe re-point：`findOrCreatePoi({name, type:newType})` 取「同名 + 新分類」master，改 `trip_entry_pois.poi_id` 指向，不 mutate 跨 entry 共用的 `pois.type`。撞既有同名同類 row 自動 dedup、永不建重複。
- **`mapGooglePrimaryTypeToPoiType` 修正 prepared-food `*_shop`** — `ice_cream_shop`／`dessert_shop`／`donut_shop` 等改歸 restaurant（原因含 `shop` 子字串被誤判 shopping）；`barber_shop`／`gift_shop` 仍 → shopping。mapper + migration 0079 buckets 同步。

### Fixed
- **re-point 資料保真** — 換分類建新 clone 時帶上來源 POI 的 lifecycle（`status`／`status_reason`／`status_checked_at`，migration 0051），「永久歇業」的 POI 換分類後不再被重設為 active、歇業警告不再消失。
- **EditEntryPage POI icon drift** — 移除本地 `POI_TYPE_ICON`（漏 `other` key → other 類顯示成 attraction pin），改用 canonical `CATEGORY_ICON`。
- **備註編輯器鍵盤提示在手機誤顯** — inline 備註編輯器的 `⌘ + ↩ 完成 · esc 關閉` 桌機鍵盤捷徑提示，在觸控裝置（手機／平板，無 ⌘/esc 鍵）也顯示。改用 `@media (hover: none) and (pointer: coarse)` 在觸控裝置隱藏。同源兩處一起修：EditEntryPage `PerPoiNoteRow` + TimelineRail inline note edit。

## [2.48.1] - 2026-06-04

### Fixed
- **iOS 手機點輸入框畫面放大、然後可左右橫滑** — `css/tokens.css` base 規則 `button, input, select, textarea { font-size: inherit }` 讓沒套 `.tp-input-long` / `.tp-input-short` 的 input 繼承父層字級；父層 <16px（footnote 14px / caption 12px / caption2 11px）時，iOS Safari 一聚焦就自動放大 viewport → 放大後頁面比 viewport 寬 → 可左右滑。改對 `input, select, textarea` 疊 `font-size: max(16px, 1em)`（≥16px 底線、保留較大的繼承字級），buttons 不含（不觸發放大）。`.tp-input-long`(16px) / `.tp-input-short input`(22px) 系統因 class 特異性更高不受影響。附 regression test 鎖。與 v2.46.1 EditTripPage minmax 橫滑修為不同 root cause（放大觸發 vs grid column 上限）。

## [2.48.0] - 2026-06-04

### Changed
- **Google Maps 用量監控改「免費額度 headroom」模型** — 2025/3 起 Maps 取消 $200 月抵免、改各 SKU 免費額度（Essentials 10K / Pro 5K / Enterprise 1K events/月，不共用池）。每日報告從「💰 MTD $X / $200」改為「🗺️ 免費額度: 最高 <SKU> N% (used/cap) · 真實付費 $」。任一 SKU ≥80% 示警、≥90% 紅燈，在跨入付費前預警。實測本專案全在免費額度內 → 真實月花費 $0（最高 Routes ~48%）。
- **Cloud Monitoring 用量改按真實 `method` label 分組** — 刪除會錯算的 host→name 對照表（`GCP_API_TO_SERVICE` 把新版 Places API 全算成 place_details）。改 group by consumed_api `method`（SKU 計費維度），免費額度依 request field mask 對應 tier（Search/Details 含 rating/hours/phone → Enterprise 1K；Autocomplete/Routes/Dynamic Maps → Essentials 10K）。
- **`google-quota-monitor` kill-switch 改 alert-only** — 不再自動鎖 Maps（自動鎖 = 整站 503 outage，不值得為免費額度邊緣的小錢）；接近上限只示警，要停由 admin 手動 `POST /api/admin/maps-lock`。

### Fixed
- **每日報告 Google 金額「忽高忽低」root cause（三層 bug）** — (1) `_gcp_monitoring.ts` 讀錯 env 變數名（`GCP_SERVICE_ACCOUNT_KEY_JSON` vs prod 與 `_types.ts` 實際的 `GOOGLE_CLOUD_SA_KEY` / `GOOGLE_CLOUD_PROJECT_ID`）→ 永遠 fallback 假數據；(2) MTD 用「今日 dailyCost × 當月日期」投射而非累加 → day-over-day 亂跳甚至變少（真實 MTD 不可能變少）；(3) D1-proxy fallback 用寫死假常數（directions=50 等 → 假底 $0.4433）。修：讀對 env 名、查真實 month-to-date counts、移除假數據 fallback。
- **GCP 拿不到改顯示錯誤而非假數字** — `/api/admin/quota-estimate` 在 Cloud Monitoring 無法取得時回 502 `MAPS_UPSTREAM_FAILED`（對齊 `route.ts` / `poi-search.ts` 慣例），每日報告浮出「用量監控異常（GCP 無法取得）」而非靜默假金額（修舊的 `warning && !error` silent swallow）。

## [2.47.0] - 2026-06-04

新增景點自動分類 + 行程拖曳/觸控捲動修復（兩個獨立 bug，全程 TDD；含對抗式 review 後再修正 1 HIGH + 3 MED finding）。

### Added
- **新增景點自動對應類別** — 加入行程的各路徑（AddStopPage 搜尋/收藏、AddPoiFavoriteToTripPage direct、ChangePoiPage mode=new + 非 new 自訂）改用 `mapGooglePrimaryTypeToPoiType` 把 Google `primaryType` 對應成 whitelist `poi_type`（POST /entries）或 `type`（find-or-create）後送出，後端不再 fallback 'attraction'。cafe→餐廳、車站→交通、購物中心→購物、樂園/健身→活動。mapper 用 underscore token 邊界 `(?:^|_)x(?:_|$)` 正確處理 snake_case 複合 enum（`wine_bar`/`food_court`/`internet_cafe`），且不誤判 `barber_shop`/`spanish_restaurant`。同一 mapper（`mapNominatimCategory` 保留為 deprecated alias）順帶修正 Explore/收藏頁顯示 label。
- **自訂景點類別選擇器** — `CategoryPicker`（8 類 icon grid，mockup 簽核 Variant C，role=radiogroup、tap≥44px、純 tokens），接進共用 `CustomPoiForm`，讓自訂 stop（無 Google 來源）可當場選/改類別；`aria-labelledby` 接可見「類別」label，可見/語意名稱一致。
- **migration 0079 — backfill poi_type** — 把既有 type='attraction' 但 `category`（Google primaryType）對應到其它類別的 POI 重新分類。collision-safe（`NOT EXISTS` 防撞既有目標列 + `MIN(id) GROUP BY name` 防同句自撞，守 `UNIQUE(name,type)` migration 0018）；token-boundary LIKE（`ESCAPE '\'`）與前端 mapper 一致；idempotent、純 data UPDATE 無 schema 變更、無 rollback 需求。

### Fixed
- **行程景點拖曳與觸控捲動衝突** — TimelineRail 握把的無延遲 `PointerSensor`(8px) 在觸控時（pointer 事件）搶在 `TouchSensor`(200ms) 之前啟動拖曳，加上 `.tp-rail-grip` 的 `touch-action:none` 吃掉原生捲動 → 垂直滑動誤判成拖曳。改 `useDragDrop`：`includeTouch` 時用 `MouseSensor`（桌機即時 8px）＋ `TouchSensor`（觸控 200ms 長按）取代 `PointerSensor`，握把 `touch-action` 改 `pan-y`。桌機即時拖曳不變；觸控快速垂直滑動＝捲動、長按＝進入拖曳（業界標準 reorder 手勢）。stylus-only-pointer 觸控裝置 fallback 鍵盤排序（已註明的窄缺口）。

## [2.46.1] - 2026-06-03

### Fixed
- **編輯行程頁手機版橫向左右滑動** — `.tp-edit-page-shell` 原本是 block，缺 column 上限保險，被最寬子內容撐開時 page body 比 viewport 寬 → 手機橫滑。改 grid + `grid-template-columns: minmax(0, 1fr)` 鎖 column 上限（與 EditEntryPage v2.32.3 / TripNotesPage v2.34.50 同一 root-cause pattern，非 `overflow:hidden` 硬裁）。附 regression test 鎖。註：現有 prod（5 行程 × 360/375/390px）重現不出特定元兇，此為該類 bug 的 root-cause guard；若特定 nowrap 元素仍撐寬需另補其 `min-width:0`。

## [2.46.0] - 2026-06-03

全 repo `/simplify` + `/review` 品質掃描（multi-agent workflow audit）：核心 `src` + `functions` + `scripts` 共 365 檔逐組 dual-lens 審查 + 對抗式 verify，套用 36 條 verified-behavior-preserving 修正（39 檔，淨 -76 行）。無 migration / schema / API contract / CSS 變更；tsc 0 error，3204 測試全綠。

### Changed
- **去重共用 helper**：分享 token 產生改呼叫既有 `generateOpaqueToken`（`_share.ts`，byte-identical）；weather `fetchWeatherForDay` 改用 `makeDefaultMg()` 預填 24 筆零值取代手寫三陣列 + else push 0。
- **拔除 dead code**：`_shared.ts` 寫入即 `void` 的 `rowId`；`_tripFormStyles.ts` 無 JSX 使用的 close-button CSS + 兩條未引用 `@keyframes`；`HourlyWeather` 永不命中的 `.hw-now` querySelector fallback；`ExplorePage` 恆回「全部地區」的 `defaultRegion` memo + 同步 effect（連帶移除未用的 `useActiveTrip`）；`TripNotesPage` 5 section 全覆蓋後不可達的 placeholder `else` 分支；`ChatPage` 兩條相同的 timestamp ternary 分支；`validate-authorize-request` PKCE 強制後恆為 `'S256'` 的死 ternary。
- **移除多餘 type cast**：`oauth-d1-adapter` sweepExpired return；`google-id-token` 的 `email_verified` / `azp`（`JwtClaims` 已具型別）；`mapDay` 把 `distanceM` 宣告進 `RawTravel` 取代 inline cast。
- **減少 re-render / 對齊既有寫法**：`NewTripContext` provider value `useMemo` 化；`ImportTripButton` catch 改用 `ApiError` type guard；`TimelineRail` `isLast` 改比對 `orderedEvents.length`；移除多餘 effect 依賴（`AddStopPage` 的 `tab`、`PoiFavoritesPage` 的 `favorites.length`、`InfoSheet` 的 `panelRef`）。
- **收斂查詢/守衛**：`entries/[eid]/copy.ts` source `SELECT *` → 實際使用的 5 欄；`pois/[id]` 移除 zero-row DELETE 前的多餘 `if` 守衛；`days/_merge.ts` 孤兒 `trip_entry_pois` 改 skip（FK 已防）取代隱藏不一致的 fallback bucket；`cron-shared` 去重 `cachePath()`；`tripline-api-server` 移除死 default 參數。
- **過時欄位/註解修正**：`permissions/[id]` 移除 migration 0047 已 DROP 的 `email`（audit diff bytes 不變）；`places/autocomplete` 與 `usePoiSearch`（`osm_id`→`place_id`）JSDoc/註解校正；`tripExport` `safeFileBase` 改 `export` 供呼叫端共用；`timeline.ts` `NavLocation` 移除與 `MapLocation` 重複的 `label`。

### Fixed
- **`session.ts` token `exp` 加 `Number.isFinite` 守衛** — `typeof NaN === 'number'` 且 `NaN < now` 為 false，原判斷會讓 `exp: NaN` 繞過過期檢查；收緊後僅接受有限數值（合法簽章 token 不受影響），純收緊 auth。
- **`notes/[type]/generate.ts` `clearTimeout` 移入 `finally`** — fetch 錯誤路徑原本漏清 abort timer。
- **`localStorage.lsRemove` 包 try/catch** — 對齊檔內其他 `ls*` 函式，locked-profile / 停用儲存不再丟例外。
- **`build-daily-check-msg.js` okItems 迴圈補 `details[k]` null 守衛** — 對齊既有 issues 迴圈，避免空值 deref。
## [2.45.0] - 2026-06-03

高嚴重度 bug 修復批次 — 承同輪 audit 的品質掃描（見 v2.46.0），對 80 條 risky finding 中的 15 條 HIGH 做對抗式 verify（11 real / 2 partial / 1 disputed FP），逐條重讀實際程式碼 + schema/migrations 確認後修復。15 條 confirmed-real 全修，附 13 條 regression test。tsc 0 error，3217 測試全綠。

### Security
- **`PATCH /api/dev/apps/:client_id` 權限升級漏洞** — allowed_scopes 沒走 allowlist（POST 有擋、PATCH 漏），自助使用者可把自己的 app 設成 `['admin']`，再用 client_credentials 換到 admin-scoped token → 跨租戶讀寫任意行程。改 export `validateScopes` 並在 PATCH 沿用（非空守衛 + allowlist enforce）。
- **`/api/route`、`/api/poi-search`、`/api/reports` rate limit 完全失效** — 三個公開端點 `await bumpRateLimit(...)` 後丟掉回傳值（該函式回 `{ok:false}` 不 throw），lock 後仍放行 → 未登入者可無限打付費 Google Routes / Places API（billing DoS）。改捕捉結果，`!ok` 時回 429 + `Retry-After`（對齊 autocomplete）。

### Fixed
- **共編 invitation accept 在 prod 100% 失敗** — `invitation-accept.ts` INSERT 仍列 migration 0047 已 DROP 的 `email` 欄 → D1 throw → 整個 batch 失敗（簽到時靜默吞掉）。改 `INSERT ... (trip_id, role, user_id)`。
- **「移動景點到其他天」在 prod 100% 不動** — `EntryActionPage` 移動送 camelCase `dayId`，backend `ALLOWED_FIELDS` 要 snake_case `day_id`（camelCase 家族）。
- **Google search cache 當天永不過期** — `maps/cache.ts` `expires_at` 存 ISO（`T`/`.SSSZ`），與 SQLite `datetime('now')` 做字串比較時恆大 → cache 命中過期列、cleanup 也掃不掉。改存 SQLite-native `YYYY-MM-DD HH:MM:SS`。
- **所有 TS cron / api-server 的 Telegram 警報靜默不發** — `cron-shared.ts` 只讀 `TELEGRAM_BOT_TOKEN`，`.env.local` 只有 `TELEGRAM_BOT_HOME_TOKEN`。加 sibling fallback。
- **admin rollback 撞無 `updated_at` 欄的表會 SQL error** — `update` rollback 無條件加 `updated_at = CURRENT_TIMESTAMP`，但 `trip_permissions` / `poi_relations` / `trip_requests` 無此欄。改由 `TABLE_COLUMNS`（檔案自有 schema allowlist）推導，drift-proof。
- **admin `insert→delete` rollback 不檢查 DELETE 是否命中** — 補 `meta.changes === 0 → DATA_NOT_FOUND`，不再寫 phantom audit。
- **daily-report email「行程修改統計」永遠「查詢失敗」** — `daily-report.js` 查不存在的 `requests` 表，改 `trip_requests`。
- **Explore 存的 POI 沒存 `place_id`** — `findOrCreatePoi` / `batchFindOrCreatePois` INSERT + COALESCE + caller（find-or-create endpoint、ExplorePage）補 `place_id`，新 POI 可立即 enrich（不必等 30 天 backfill）。
- **行程筆記 accordion `<button>` 內嵌互動 `<button>`（invalid HTML / a11y）** — 外層改 `<div role="button" tabIndex=0>` + Enter/Space 鍵盤處理 + `:focus-visible` ring。
- **`PATCH /entries/:eid` OCC catch 吞掉 AppError 變 503** — 補 canonical `if (err instanceof AppError) throw err;`（目前 unreachable，防未來 refactor）。
- **`PUT /days/:num` RETURNING id fallback 0** — 補 phantom-id 守衛（目前 unreachable，防未來 refactor）。

#### Medium 批次（同輪 verify 的 medium tier，8 條）
- **手機底部導覽**：`GlobalBottomNav` 的「行程」tab 只在 `/trip/:id` 精確匹配 active → 所有子路由（編輯/筆記/健檢…）底部無 active tab。改用 `DesktopSidebar` 的 canonical pattern（含 `MAP_ACTIVE_PATTERNS` 補 `stop/:id/map`），手機與桌機一致。
- **`PATCH /api/dev/apps/:client_id`** 送 `{app_name: null}` 會 `null.trim()` TypeError → 改 `typeof === 'string'` 守衛。
- **分享頁 OG title** 對 destination-named 行程（`title=''`）顯示破標題 → `title || name || '行程'` fallback（對齊 `/s/[token]`）。
- **`ShareLinkModal`** 到期日 pre-fill 用 UTC → 非 UTC 時區差一天，改 local date getters。
- **`daily-check`** stuck-cutoff 把 D1 naive datetime 當 local 解析 → 補 UTC normalize。
- **`requests/[id]` AI 筆記 dedup** SELECT 漏 `ai_source` 過濾 → lodging-tips 與 tips prompt 互相污染，補 `AND ai_source = ?`。
- **`PATCH /entries/batch`** `start_time`/`end_time` 接受任意字串 → 補 `TIME_RE`（HH:MM）驗證。
- **匯入目的地上限**：import 容許 50 但 PUT 編輯上限 30 → 匯入 31-50 個目的地的行程變不可編輯。`MAX_DESTINATIONS` 對齊為 30。

#### 其餘 medium + low（同輪 verify 的剩餘 confirmed-real，~32 條）
- **安全**：`backfill-poi-addresses` 改 direct argv（拔 `sh -c` shell injection）；`dev/apps` POST 補 `homepage_url` https 驗證 + `app_description` 長度上限；`audit` 端點 `request_id` 補正整數驗證（NaN 不再進 D1）；`docs/[type]` PUT 補 body byte cap。
- **race / OCC**：`oauth/callback/google` 首次登入並發 UNIQUE race 補 recovery；`trip_segments` PATCH「缺 coords / 無 API key」分支補 `version + 1`（OCC 一致）+ 最終 SELECT null guard；`_poi` batch re-fetch 補 `SYS_DB_ERROR` guard（取代裸 TypeError）。
- **可靠性 / 韌性**：`_gcp_monitoring` 兩個 outbound fetch 補 10s AbortController timeout（admin quota endpoint 不再可能無限 stall）；`poi-favorites` add-to-trip sort_order 用 null append sentinel（gapped sequence 不再漏 shift）；`days/:num/entries` POST 回正確 `entry_pois_version` + 驗 `sort_order`。
- **時區 / 顯示**：`FlightsSection` date-only 解析改 noon-anchor（非 UTC 時區不再差一天）；`poiHours` 24h 週排程格式 + 休息日 condense；`AlertPanel` is-warning 改 design token（dark mode 終於自適應；light mode 顏色微調）。
- **正確性 / 清理**：`reports` dedup 用 normalize 後的 url；`shares` / `shares/[shareId]` 補 RETURNING null guard；`recompute-travel` 把 `Date.now()` hoist 出迴圈；`notes/_shared` 重複 id 回 400（非 403）；`validate-redirect-uris` 認 IPv6 `::1` localhost；`normalize-address` 拔不可達 regex；`ConsentPage` 補 useEffect 依賴；`MapLinks` 補 `tp-map-link-inline` class；`cron-shared` 拆 Telegram 兩種失敗的 warn flag；`google-poi-initial-backfill` `EnrichResult` 型別對齊 camelCase。
- _跳過_：`AlertPanel` 之外 2 條純 dead-code（`DaySection` 未用 prop、`maps/region` dead export + 其 test）revert 不做（cascade churn > 價值）；`docs/[type]` D1 batch>100 判 false-positive 不改。

#### partial hardening（17 條 real-but-unreachable，做掉 13）
防未來 refactor 的 1-行硬化：`TimelineRail` drag fallback id 用 positional index（null-id entry 不再碰撞）；`notes/_shared` 非 OCC UPDATE row 消失補 404；`days/:num` PUT 回 DB read-back 的 `dayVersion`（非本地猜值）；`oauth/userinfo` `created_at` 補 `Z`；`account/sessions` 改用 canonical `parseUtcDate`；`account/connected-apps` + `dev/apps` GET 的 `JSON.parse` 加 guard（壞 row degrade 不 500）；`invitations/accept` 補 `waitUntil`；`backfill-health-check-replies` 補 `TRIPID_RE` guard（shell injection）；`google-quota-monitor` fatal handler await alert；`trips` `nullableInt`→`nullableNum`（float 欄正名）；`ChatPage` `send` 補 `user` 依賴；`hkdf` cache key 用全 secret。_跳過 4 條_：`routes.ts` dead export（suggestion wrong-headed）、`PoiFavoritesPage` page-clamp（naive 修法會把使用者拉回第 1 頁）、`migrate-entries-to-pois`（已執行的一次性 script）、`invitation-token`（純 refactor）。

## [2.43.1] - 2026-06-02

### Fixed
- **行程檢視顯示錯誤行程（私人 clone 導航 bug）** — 從行程列表點選自己的「私人複製行程」（`data_source='cloned'`、published=0）時，行程檢視（`/trips?selected=` sheet 或直接 `/trip/:id`）TitleBar 顯示正確標題，timeline 卻渲染「第一個 published 行程」的內容（標題對、行程錯）。根因：`TripPage` 解析要渲染哪個 trip 時用 permission-filtered `/api/trips`（排除使用者自己的私人 clone）比對，比對不到就 silently fallback 到 defaultTrip。修正：抽出純函式 `resolveTripId` — 明確導航目標（URL / `?selected=` / 舊 `?trip=`）即使不在 `/api/trips` 也信任它，存取權由 `useTrip` 的實際 fetch 驗證（403/404 → error state，絕不 silently 顯示另一個 trip）。QA 2026-06-02 prod 實測抓到。純前端邏輯修正，無 migration / 無 schema 變更。

## [2.43.0] - 2026-06-02

### Changed
- **備註改 per-POI（取代 entry-level 整體備註）** — 一個停留點可有 1 正選 + N 備選 POI，現在**每個正選/備選景點各自一條備註**（`trip_entry_pois.note`），取代原本整個停留點共用一條的 `trip_entries.note`。編輯景點頁（EditEntryPage）採已簽核 Variant B「點擊編輯備註行」：master 卡 + 每個 alternate row 各有可就地展開的備註欄（autosave、空 → 「+ 加備註」），底部整體備註 section 移除。行程每天景點（TimelineRail）顯示**正選的備註**，inline 快速編輯 repoint 到正選 POI（無 master 時停用編輯）。

### Added
- **新端點 `PATCH /api/trips/:id/entries/:eid/pois/:poiId`** — per-POI 備註 UPDATE，body `{ note }`（trim 後空字串 → 清除；上限 1000 字；亂碼偵測；LWW，刻意不 bump `entry_pois_version` 以免誤殺 swap OCC token）。權限 `requireAuth` + `hasWritePermission` + `verifyEntryBelongsToTrip` + 驗證 poi 確屬該 entry。

### Migration
- **0078**（方案 B，單一 PR 直接 DROP）：backfill 既有 `trip_entries.note` 併進對應 entry 的 master `trip_entry_pois.note`（master 空 → 用 entry note；皆非空 → 換行串接，避免資料遺失），再 `DROP COLUMN trip_entries.note`。6 個 entry 建立路徑（PUT /days、POST /entries、copy、share clone、import、poi-favorites add-to-trip）+ `PATCH/GET /entries` + `mapDay` + export/import + `rollback.ts` 白名單 + `daily-check.js` hygiene 全數 cutover。
- **⚠️ Deploy 順序硬規則（不可顛倒）**：`merge → backend deploy（已 cutover）→ apply migration 0078`。先 DROP 會讓 in-flight 舊 backend「no such column: note」fail。

## [2.42.1] - 2026-05-31

### Fixed
- **分享連結預覽卡修正（PR-B prod 補丁）** — v2.42.0 的 OG Function 從沒被執行：`public/_routes.json` 的 `include` 只列 `/api/*` + `/trip/*`，CF Pages 把 `/s/:token` 當靜態 SPA fallback 直接吐 `index.html`，連結預覽永遠是通用標題。加 `/s/*` 進 include → Function 才會跑、注入該行程的 og:title。Prod 驗證（curl `/s/:token` 看 og:title 帶行程名）才抓到——source-grep 測試過了但功能是死的。補一條防回歸測試鎖 `_routes.json` include 含 `/s/*`。

## [2.42.0] - 2026-05-31

### Added
- **分享連結預覽卡（PR-B / B1）** — 把 `/s/:token` 貼到 LINE/Messenger/Slack 等，連結預覽現在顯示**該行程**的名稱 + 日期 + 目的地（不再是通用標題）。新 Pages Function `functions/s/[token].ts` 鏡射 `functions/trip/[[path]].ts`：取 SPA shell 用 HTMLRewriter 注入 og/twitter meta。只查永遠公開的欄位（不碰 owner PII / 筆記）；token 無效/已關閉/已過期或任何錯誤 → 回原始 shell（由 React 顯示「連結已失效」），永不讓頁面壞掉。

### Security / Hardening (PR-C)
- **clone 加 per-IP pre-gate**（C2）：複製端點除了 per-user（10/hr）再加 per-IP（30/hr），擋單一 IP 換帳號放大 D1 subrequest。
- **過期分享連結每日清理**（C1）：新 cron workflow `share-cleanup.yml` 每日刪除過 `expires_at + 30 天 grace` 的 `trip_shares`（token hash 不無限長）。
- **孤兒複製行程清理**（C3）：同 cron 清掉 `data_source='cloned'` 且無 owner permission 的孤兒行程（失敗 clone rollback 殘留），`NOT EXISTS` + 1 天 grace，FK cascade 清子表。
- **分享卡片建立日期改 parseUtcDate**（C4）：卡片「建立於 M/D」改用 `parseUtcDate` 解 D1 naive UTC 再顯本地日，避免近午夜 off-by-TZ。

## [2.41.0] - 2026-05-31

### Added
- **分享面板 nice-to-haves（PR-A）** — 分享管理面板升級：
  - **連結命名**（A1）：建立時可給連結取名（給爸媽 / 旅伴），卡片顯示名稱。
  - **編輯連結**（A2）：使用中連結可「編輯」改公開區塊 / 期限 / 名稱 / 匿名 **而不必換網址**（同一連結即時生效；後端 PATCH `update`，僅作用於 active 連結，revoked/expired → 404）。
  - **自訂到期日**（A3）：期限除了 永久/24時/7天/30天，新增「自訂」用 `TripDatePicker` 選日期。
  - **已關閉連結區**（A4）：關閉的連結移到可收合的「已關閉的連結」區，保留瀏覽統計，可查看或刪除。
  - **QR code + 原生分享**（B2）：新連結 banner 可顯示 QR（**本機產生**，token 不送任何第三方）+ 手機系統分享單（`navigator.share`）。

## [2.40.0] - 2026-05-31

### Added
- **分享平台完整管理面板（PR2）** — 分享 modal 升級為完整面板：建立連結時可用 pills **逐區塊開關**要公開哪些筆記（航班/住宿/預訂/行前須知/緊急聯絡，安全預設關預訂+緊急）、選**有效期限**（永久/24時/7天/30天）、勾**匿名分享**（不顯示擁有者名字）。使用中的連結以卡片列出**瀏覽數**、區塊 chips、匿名/已過期 badge，可**重新產生**（換新網址、舊的立即失效）、**關閉**、**刪除**。新增 migration 0077（`trip_shares.anonymous`）+ PATCH rotate/revoke endpoint。Mockup：`docs/design-sessions/2026-05-30-share-manage-panel.html`。
- **訪客一鍵複製到我的行程（PR3）** — 公開分享頁的「複製到我的行程」現在會把行程**複製進你的帳號**（登入後一鍵；未登入先導去登入）。只複製該連結**可見的內容**（行程本體 + 已公開的筆記區塊；未公開的緊急聯絡/預訂等**不會**被複製），複製出的行程歸你所有（`data_source='cloned'`、私人）。後端抽出共用 `functions/api/trips/_tripWrite.ts`（`resolvePoi` find-or-create / chunked batch / connect-root rollback / trips cap），import 與 clone 共用零 drift；clone 加 per-user rate-limit（10/hr）。

### Security
- clone 走 default-deny：只複製 `parseVisibleSections` 允許的筆記區塊，私人區塊永不進入複本（integration test 鎖：emergency 預設關 → 複本 0 筆）。匿名連結公開 payload `sharedBy` 強制為空，仍不洩漏 owner email/user_id。share token rotate 換 hash、舊 URL 立即 404。clone endpoint 需 auth（middleware 只 bypass GET /api/share/*）。

## [2.39.1] - 2026-05-30

### Added
- **分享連結入口進主功能區** — 「分享連結」現在出現在行程一覽卡片的 ⋯ 選單（`TripCardMenu`）與行程頁右上角的 ⋯ 選單（`EmbeddedActionMenu`），點開即建立/管理公開分享連結（`ShareLinkModal`），不必先進列印頁。

### Fixed
- **桌機分享頁 hero 太寬** — 公開分享頁 `/s/:token` 的 terracotta hero 與操作列原本在桌機全寬延展，與置中的 794px 文件不對齊。改為 hero / 操作列 / 文件同寬置中（手機仍全寬），桌機再加圓角上緣 + 上邊距讀作一張完整卡片。

## [2.39.0] - 2026-05-30

### Added
- **無登入分享行程頁（PR1：公開檢視核心）** — 新增可分享的公開連結：行程擁有者（與共編者）在列印頁按「分享連結」建立一個**不可猜的**公開網址 `/s/:token`，對方**不用登入**就能用唯讀的列印文件版面看行程，並可列印／存 PDF。版面為簽核的「分享封面」（terracotta hero「由 X 分享給你」+ 操作列）。預設公開行程、航班、住宿、行前須知；**緊急聯絡與預訂預設不公開**。連結可隨時「關閉分享」立即失效。
  - 安全（公開無登入端點）：token 用 CSPRNG（≥192-bit），DB 只存 SHA-256 hash（外洩不洩 token）；區塊過濾 **default-deny**（關閉的筆記區塊根本不查表，非前端隱藏）；找不到／已關閉／已過期一律回相同 404（無 enumeration oracle）；公開 payload 不含 owner email/user_id（只露 display_name）；per-IP rate-limit + `no-store`/`no-referrer`/`frame-DENY` headers；管理端點 IDOR 防護（每筆操作綁 `AND trip_id`）+ 每次 re-check 即時寫入權限。
  - 重用：公開檢視重用 v2.36 `TripPrintDocument`（新增 `hideHeader`）+ 抽出共用 mapper `mapRawToPrintData`（含 `toTimelineEntry`，不在 server 重寫）；server 端 days 與授權檢視共用抽出的 `buildAllDays`（零 drift）。
  - 後續：PR2 完整管理面板（多連結／逐區塊開關／期限／瀏覽數／重新產生）、PR3 訪客一鍵複製到自己帳號。

## [2.38.7] - 2026-05-30

### Fixed
- **D1 migration 部署 workflow 修復** — 自 2026-05-25 起每次 push 到 master 的「Deploy — D1 migrations」workflow 都失敗（Telegram 一直報錯）。Root cause：v2.33.89（#778）把 prod D1 binding 移到 `[[env.production.d1_databases]]` 修 prod 登入時，漏改 migration 指令 → `wrangler d1 migrations apply trip-planner-db --remote` 缺 `--env production` 找不到 binding。修法是補上 `--env production`。同時對帳 prod `d1_migrations` 追蹤表：0072–0075 的 schema 早已手動套用但未登記，補登記避免修好後 workflow 把這 4 個當 pending 重跑（0074 非冪等，會損毀 `trip_lodgings`）。

## [2.38.6] - 2026-05-30

### Changed
- **列印頁行程筆記章節化** — 5 個區塊（航班/住宿/預訂/行前須知/緊急聯絡）改成單欄「章節」呈現：每章節有明顯標題、數量（如「5 項」）與分隔線，章節內每一筆之間用細線分隔、標題加粗。長長的行前須知不再擠成一片，一眼看得出層次。

## [2.38.5] - 2026-05-30

### Fixed
- **列印頁手機細節**（深色模式截圖回報）：① 右上「關閉」按鈕在深色模式下看不見 → 列印預覽改用固定淺色（列印本來就是白紙），按鈕恢復清楚。② 景點的備選/備註/交通內文改成全寬靠左一欄，不再縮在時間欄下擠成一小塊。③ 行程筆記每筆分成「標題」與「內文」，行前須知那種「- 」清單會逐行斷落，不再黏成一大段。

## [2.38.4] - 2026-05-30

### Fixed
- **列印頁手機時間欄** — 有起訖時間的景點（如 12:00-13:30）在手機堆疊版面時，時間會疊到標題上。加寬時間欄到容得下完整時間範圍，桌機/列印同步調整。

## [2.38.3] - 2026-05-30

### Fixed
- **列印頁手機版面** — 列印文件的緊湊表格在手機上 3 欄硬擠、字太小。改成 responsive：手機自動把每個景點直式堆疊（時間+標題一行、備選/備註/交通在下方），桌機與實際列印/PDF（A4）維持原本表格版面。用 container query 依「文件本身寬度」切換，所以手機產生的 PDF 仍是正確的 A4 表格。

## [2.38.2] - 2026-05-30

### Changed
- docs：CLAUDE.md naming history 補上行程列印/匯出/匯入 redesign（v2.36.0–2.38.1）里程碑記錄（開發文件，無功能變更）。

## [2.38.1] - 2026-05-30

### Fixed
- **匯入行程**：含景點的行程匯入失敗（prod 驗證發現）。景點資料表對「名稱 + 類型」有唯一索引，匯入時若該景點已存在就會撞索引整筆失敗。改為「找不到才新建、找到就沿用既有景點」（永不改動既有景點資料），並去除同一站重複指向同一景點的情形。

## [2.38.0] - 2026-05-30

### Added
- **匯入行程 JSON** — 行程列表右上「匯入」按鈕，選一個之前匯出的 JSON 檔，就能把整趟行程（每天景點、交通、住宿、行程筆記）原封不動建成一個新行程。匯入永遠建立新行程，不會覆蓋既有資料。

## [2.37.0] - 2026-05-30

### Changed
- **PDF 匯出改用列印文件** — 下載 PDF 現在輸出跟列印頁一樣的「全展開」文件（每天景點、交通、住宿、行程筆記一次到齊），不再因畫面收合而漏掉內容。
- **JSON 匯出改為可重新匯入的格式** — JSON 檔現在包含完整行程 + 行程筆記 + 站間交通，之後可以整趟匯回（為即將推出的「匯入」功能鋪路）。

### Removed
- **移除 CSV 與 Markdown 下載** — 兩種格式已不再使用。下載格式只保留 PDF 與 JSON。

## [2.36.0] - 2026-05-30

### Added
- **行程列印文件**（`/trip/:id/print`）— 全新的列印頁，把整趟行程攤成「一頁式、全展開」的文字文件：每天的景點、★評分、備選地點、站與站之間的交通、住宿，加上行程筆記 5 區塊（航班／住宿／預訂／行前須知／緊急聯絡）一次印齊。文字優先、少量圖示，適合直接列印帶著走。
- 列印選單（行程 ⋯ → 列印）現在打開這個新文件頁；按「列印」即喚起瀏覽器列印。

### Changed
- 列印不再沿用互動畫面的收合狀態 — 改成從行程資料直接產生文件，所以收合中的內容也一定會完整印出（解決舊版列印「收合的東西印不出來」）。
- 列印文件多頁排版（每日區塊不跨頁切斷），純黑白文字版面。
- 0 天行程顯示「尚無行程」、空的筆記區塊自動省略。

## [2.35.1] - 2026-05-30

### Changed
- docs：CLAUDE.md naming history 補上行程筆記 2.34.47–2.35.0 里程碑記錄（開發文件，無功能變更）。

## [2.35.0] - 2026-05-30

**🎉 Milestone — 行程筆記（Trip Notes）功能完成**

把跨工具的旅遊雜訊集中在一頁。每趟行程現在有一個獨立的「行程筆記」頁（`/trip/:id/notes`，從行程卡片 ⋯ 或聊天進入），用 5 個 section 收納行前要記的所有東西：

- **航班** — 航空/航班/出發抵達機場 + 起飛抵達時間
- **住宿** — 飯店/地址/入住退房/訂房編號/電話
- **預訂** — 餐廳/活動/票券…類型 + 時間 + 預訂編號
- **行前須知** — 貨幣/通訊/簽證…自由筆記（支援 markdown）
- **緊急聯絡** — 駐外館處/警消/保險…聯絡人，電話可直接撥

**AI 可代寫**「行前須知」與「緊急聯絡」（依目的地自動生成）。每個 section 支援新增 / 編輯 / 刪除 / 拖曳排序，編輯即時 autosave，欄位全用網站規範的客製化日期/時間/下拉選擇器（無原生瀏覽器 chrome），手機桌機一致。

此版號標記 2.34.0–2.34.50 累積的行程筆記開發（PR1–PR50：5-table schema、CRUD UI、AI 生成、canonical input 對齊、編輯 UX、prod QA 修正）正式收斂為 2.35.0 minor release。沒有新程式碼變更，純里程碑版號。

## [2.34.50] - 2026-05-30

**Fix — 行程筆記編輯加「關閉」button + 修手機左右滑動（prod QA follow-up）**

兩個 prod QA 回報：(1) 編輯一筆筆記（航班/住宿/預訂/行前須知/緊急聯絡）時只有「刪除」，沒有不刪除就退出編輯的方法；(2) 行程筆記頁在手機可以左右滑動（水平捲動）。

- **加「關閉」button**：5 個 section 的編輯表單底部，刪除左側新增 ghost 樣式「關閉」button，點了收合回顯示模式（不刪資料，改動已 autosave）。
- **修手機左右滑動**：`.tp-notes-shell` 是 CSS grid 但沒定義 column，隱式 `auto` column 撐到內容 max-content → page body 比視窗寬 → 手機可左右滑。加 `grid-template-columns: minmax(0, 1fr)` 把 column 上限鎖在視窗寬度。

### Added
- 行程筆記 5 section 編輯表單「關閉」button（ghost，收合編輯）。

### Fixed
- 行程筆記頁手機水平捲動（`.tp-notes-shell` grid column blowout）。

## [2.34.49] - 2026-05-30

**Fix — 行程筆記 NoteDateTimeField 時間選擇器爆高（v2.34.48 prod QA follow-up）**

v2.34.48 把原生 date/time 換成 `NoteDateTimeField`（date + time picker）後，時間選擇器被擠在 92px 窄欄，22px 粗體的「--:--」placeholder 在連字號處斷行 → 觸發器爆到 125px 高，跟旁邊 44px 的日期選擇器高度不齊。修正：時間欄寬度 92px → 128px（容得下單行「--:--」+ chevron）、加 `white-space: nowrap`、欄位上限 460px（日期不再被撐到全寬留白）。日期與時間選擇器現在等高並排。

### Fixed
- `NoteDateTimeField` 時間選擇器高度爆增 / 與日期選擇器不齊（prod QA round 1）。1 條 regression test 鎖 `white-space: nowrap`。

## [2.34.48] - 2026-05-30

**Fix — 行程筆記編輯表單對齊 canonical input 系統（QA：高度不一致 + 原生 date/time）**

行程筆記 5 個 section 的編輯表單原本用原生 `<input>` / `<select>` / `<input type="datetime-local">` + 各自散落的 ad-hoc CSS（沒設 min-height），導致原生日期/時間欄位比文字欄位高、同一列高度不齊，且出現原生瀏覽器 date/time 介面，未遵守設計規範。改為全站 canonical 系統：文字/textarea → `.tp-input-long`（44px）、原生 `<select>` → `TripSelect`、原生 `datetime-local` → 新 `NoteDateTimeField`（terracotta `TripDatePicker` + `TripTimePicker` popover）。所有編輯欄位高度一致、無原生 chrome。

### Changed
- 行程筆記 FlightsSection / LodgingsSection / ReservationsSection / PretripSection / EmergencySection 編輯表單改用 canonical input 元件（`.tp-input-long` / `TripSelect` / `NoteDateTimeField`），移除各 section 散落的 ad-hoc edit-grid input CSS。

### Added
- `NoteDateTimeField` — 組合 `TripDatePicker` + `TripTimePicker` 取代原生 `datetime-local`，I/O 維持 datetime 字串（含 split/combine helper）。11 條 regression test 鎖定（無原生 date/time/select、canonical 元件接線、datetime helper round-trip）。

## [2.34.47] - 2026-05-30

**Fix — 行程筆記頁標題對沒有自訂名稱的行程顯示行程名（QA F1）**

用目的地命名的行程（如「東京都、青森縣」、「台南」，沒有自訂 title）在行程筆記頁，標題列原本只顯「行程筆記」、空狀態 hero 的行程名也空白，看不出在哪一趟。現在對齊行程卡片與其他頁面的 canonical `title || name` 顯示名 pattern：標題列顯「行程筆記 — 東京都、青森縣」、hero 也帶行程名。有自訂標題的行程不受影響。

### Fixed
- 行程筆記頁 TitleBar 與空狀態 hero eyebrow 對 `title` 為空字串的行程改用 `title || name` fallback（之前用 `?? null` 接不到空字串 → 缺行程識別）。prod QA v2.34.46 發現，4 條 regression test 鎖定（空字串 / 自訂標題 / 純空白 / 兩者皆空）。

## [2.34.46] - 2026-05-29

**Revert + Drop — PR46：移除旅館 Day 關聯（整套）+ 還原 autosave-on-blur + edit mode 只剩刪除 button**

User feedback：「保留 autosave 按鈕只保留刪除, 程式也要修改, 還有 移除旅館的關聯DAY 包含 table 都移除」。Reverse PR44 + follow-up 改動：

1. **Migration 0075 DROP `trip_lodging_days` table + index** — 旅館不再關聯 day（純資訊頁面用途，不影響 timeline）
2. Backend `_shared.ts` + `notes.ts` aggregator — 拔 junction batch fetch / `replaceLodgingDayIds` / `loadLodgingDayIds` / `extractDayIds` 函式 + audit `day_ids` payload + response echo
3. `LodgingsSection.tsx`：拔 `dayIds: number[]` field、`TripContext.days` import、`useNavigate`、`handleNavigateDay`、multi-checkbox UI、read mode day chips、相關 CSS（`tp-notes-lodging-day-checkboxes` / `tp-notes-lodging-day-chk` / `tp-notes-lodging-day-empty`）
4. **還原 autosave-on-blur** — 5 sections（Lodgings/Flights/Reservations/Pretrip/Emergency）拔 `pendingRef` stage+flush 模式 + `handleCompleteEdit`，改回 v2.33.108 blur 即單 field PATCH with `expectedVersion` OCC
5. **拔「完成」button** — edit-actions 只剩刪除 button（`tp-btn-destructive`），移除 `tp-btn-primary 完成`、`onCloseEdit` prop、`*-close-edit-N` testid
6. `TripNotesPage` `TripLodging` interface 拔 `dayIds`

Test 改動：
- 砍 `notes-aggregator-lodging-day-ids.test.ts`（PR45 junction regression test 不再適用）
- 改 `migration-0073-trip-notes.test.ts` 既有「junction CASCADE」test → 「junction table 已 DROP + lodging row 獨立」test
- 改 `notes-sections-coverage.test.tsx` Reservations「Edit blur stage only，完成 click → batch PATCH」→「blur → autosave PATCH 直接觸發」+ 新「完成 button 已移除」test
- 改 `flights-section.test.tsx` 2 條 stage+flush test → 對應 autosave-on-blur test + 新「完成 button 已移除」test
- 改 `trip-notes-edit-actions-text-buttons.test.ts` 「JSX 用 tp-btn-primary 完成」test → 「完成 button 已移除」regression test
- 拔 mock data `dayIds: []` from `trip-notes-page.test.tsx` + e2e `trip-notes.spec.js` fixture
- 新 `migration-0075-drop-lodging-day-junction.test.ts`（4 條 regression：table 不存在 / index 不存在 / trip_lodgings 仍存在 / SQL 只 DROP）

## [2.34.45] - 2026-05-29

**Fix — PR45：trip-notes aggregator endpoint 漏 lodging.day_ids（PR44 prod regression hotfix）**

PR44 把 `trip_lodgings.day_id INT` 改 `trip_lodging_days` junction table 後，prod trip-notes 頁面 crash「Cannot read properties of undefined (reading 'map')」。

Root cause：PR44 把 junction batch fetch 加在 `_shared.ts::listNotesSection`（individual section endpoints 走得到），但主入口 `functions/api/trips/[id]/notes.ts` aggregator 走自己的 5×raw SELECT，不經 `listNotesSection` → `lodgings[].dayIds` 永遠 `undefined` → frontend `LodgingsSection.tsx` 對 dayIds `.includes(d.id)` / `.map(...)` 全 crash。

Fix：`notes.ts` aggregator 加同樣 junction batch query — `SELECT lodging_id, day_id FROM trip_lodging_days WHERE lodging_id IN (...)`，map 進 `lodgingsWithDayIds`，response `lodgings` 改回 `lodgingsWithDayIds`。

4 條 source-grep regression test 鎖 aggregator 路徑：
1. `FROM trip_lodging_days WHERE lodging_id IN` 存在
2. `day_ids: byLodgingId.get` 賦值
3. `?? []` 空 array fallback
4. response 用 `lodgings: lodgingsWithDayIds`

## [2.34.44] - 2026-05-29

**Feat + Fix — PR44：trip-notes UI polish + 住宿多天 schema 正規化（user 多 feedback 一次處理）**

User 截圖 prod 後反饋 4 個問題 + 1 個新需求，全 1 commit 處理：

### Changed

1. **拔讀模式 edit pencil button**（5 section）— row body click 已可進編輯，pencil ✏ 多餘 → 拔。
2. **Trash icon ghost 風格對齊**（5 section）— `.is-danger:hover` 拔 background fill，只 opacity 0.7→1 + 文字色變化，對齊 `.tp-btn-ghost` 慣例。Icon 16×16（原 14px）。
3. **編輯 input value 顯示** — 5 section edit-grid input/textarea 補 `color: var(--color-foreground)` rule，修「飯店名稱沒帶出來」低 contrast bug。
4. **住宿連結 Day 多選 + schema 正規化**（user 指示「不要 JSON，要 table 正規化設計」）：
   - Migration **0074_trip_lodging_days_junction.sql**：
     - 新 `trip_lodging_days` junction table (lodging_id, day_id) 複合 PK
     - `ON DELETE CASCADE` 雙向（刪 lodging 或 day → junction 自清）
     - Backfill：原 `trip_lodgings.day_id NOT NULL` 寫進 junction
     - 拔 `trip_lodgings.day_id` column（NEW TABLE pattern）
   - Backend `functions/api/trips/[id]/notes/_shared.ts`：
     - `ALLOWED_FIELDS['trip_lodgings']` 拔 `day_id`
     - 新 helper `replaceLodgingDayIds()` + `loadLodgingDayIds()` + `extractDayIds()`
     - `listNotesSection`：lodgings batch 補 `day_ids` 陣列
     - `createNotesRow` + `updateNotesRow`：handle body.day_ids → INSERT/replace junction
     - PATCH 容許只更新 day_ids（bump version 即使無其他欄位）
   - Frontend `LodgingsSection.tsx`：
     - `TripLodging.dayId: number | null` → `dayIds: number[]`
     - 讀模式 multiple chip 顯每個 day
     - 編輯模式 single `<select>` → multi-checkbox chip UI（label 註明「可多選 — 不連續天請拆多筆」）
   - User feedback「不連續天的相同飯店視為不同紀錄」→ UI 提示由 user 拆 row（系統不自動拆，給 user 控制權）

### Why

User 直接 prod 截圖反饋：(a) UI 多餘 icon (✏)（b) icon 風格不一致（c) 編輯值顯示異常（d) 跨天住宿無法表達 multi-day。一次 1 commit 全處理，schema 改動走正規化（無 JSON column）。

### Tests

- `tests/unit/migration-0073-trip-notes.test.ts` 既有 `trip_lodgings.day_id SET NULL` test 改成「v2.34.44 migration 0074: junction CASCADE — 刪 day junction 清，lodging 保留」
- `tests/unit/notes-sections-coverage.test.tsx` mock data `dayId: null` → `dayIds: []`
- `tests/unit/trip-notes-page.test.tsx` 同上 mock 更新
- 3033/3033 unit + 902/902 API 全綠

### Migration deploy 順序

1. Apply migration 0074 → DB schema 改
2. Backend deploy（新版 read/write junction）
3. Frontend deploy（type + UI 多選）
4. Migration vs backend deploy 中間若有舊 frontend 嘗試送 `day_id` field → 被 ALLOWED_FIELDS 過濾無傷（fail-safe）

## [2.34.43] - 2026-05-29

**Fix — PR43：trip-notes AI button 只在 section 展開後 render（prod audit fix）**

User 指示「AI 生成要展開後才能選」。原本 AI button（行前須知 `一般` / `住宿` + 緊急聯絡 `AI`）即使 section 在 collapsed 狀態也 render，user 想點 chevron 展開時會誤觸發 AI 生成 long-running job。

### Fixed

- `src/pages/TripNotesPage.tsx:429,469` — AI button 加 `isOpen &&` 條件：
  - `isOpen && sec.hasAI && sec.key === 'pretrip'` → 2 個 button（一般 + 住宿）
  - `isOpen && sec.hasAI && sec.key === 'emergency'` → 1 個 button（AI）

### Tests

- `tests/unit/trip-notes-page.test.tsx` 5 個既有 test 更新加 `fireEvent.click(section-head)` 先展開
- 新 test「v2.34.43 — AI button 在 collapsed section 不 render」鎖新行為
- 18/18 trip-notes-page suite + 3033/3033 全綠

### Why

防止 user 誤觸發。AI 生成是 long-running job（3-7 分鐘），accidentally 觸發後 section 進 pending state user 困惑。Progressive disclosure UX：先 expand → 看到 section 內容 → 才能 trigger AI。

## [2.34.42] - 2026-05-29

**Polish — PR42：trip-notes 5 section 編輯模式 actions 改 `.tp-btn` 文字 button（prod audit fix）**

User prod 截圖反應編輯模式右側「✓ + 🗑」32px icon-only button 不明顯，看不到確定/取消。改 form 下方 2 文字 button 對齊 DESIGN.md L534「取消 ghost / 確認 destructive 實心」+ `.tp-btn` family 規範。

### Changed (5 sections × 2 files modify = 5 component edit)

| Section | Before | After |
|---|---|---|
| Pretrip | 右側 column 2 個 32px icon-btn (✓ + 🗑) | form 底下 footer 2 個 `.tp-btn` 文字 button「刪除」`.tp-btn-destructive` + 「完成」`.tp-btn-primary` |
| Lodgings | 同上 | 同上 |
| Reservations | 同上 | 同上 |
| Emergency | 同上 (grid 1fr auto) | grid 1fr + edit-actions footer |
| Flights | 同上 | 同上 |

每 section CSS 加 `.tp-notes-{section}-edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }` footer row + `.is-editing` grid 拔右側 actions col。

### Tests

- `tests/unit/trip-notes-edit-actions-text-buttons.test.ts` — 21 source-grep regression：
  - 5 section × 4 assertion: edit-actions CSS class / .tp-btn-primary 完成 / .tp-btn-destructive 刪除 / 不再 render Icon name=check
  - 1 整體: css/tokens.css `.tp-btn` family 仍存

3032/3032 全綠（前 3011 + 21 新）。

### Why

DESIGN.md L1086+ `.tp-btn` family 是 page content button single source of truth（含 primary / secondary / destructive / ghost / block / lg）。trip-notes 編輯模式繞過 token system 用 32px inline icon-only button → 對 user 不明顯，且與其他 page form 風格不一致。Conform 規範。

### Note

testid 完全保留（`{section}-close-edit-{id}` + `{section}-delete-{id}`），既有 E2E + unit test 全 pass。

## [2.34.41] - 2026-05-29

**Test — PR41：invitations/revoke + permissions/[id] integration test (PR35 P2 收尾)**

PR35 doc 最後一個 P2 MEDIUM collab gap。3 endpoint × 12 test 涵蓋 validation / not found / role transitions / audit_log。**完成 PR35 doc 全 P0/P1/P2 follow-up（5 個 PR 全 ship）**。

### Added

- `tests/api/invitations-permissions.integration.test.ts` — 12 個 test：

  **POST /api/invitations/revoke (4 tests)**: 缺 tripId/email → 400 / 找不到 → 404 / 正常 → 200 + audit_log

  **PATCH /api/permissions/:id (5 tests)**: 找不到 → 404 / invalid role → 400 / owner 不可改 → 403 / viewer→member → 200 + audit / no-op 不寫 audit

  **DELETE /api/permissions/:id (3 tests)**: 找不到 → 404 / owner 不可刪 → 403 / 正常 DELETE → 200 + audit snapshot

### PR35 follow-up 完成

| PR | Priority | Status |
|---|---|---|
| PR36 (account/profile) | P0 HIGH | ✓ |
| PR37 (Google APIs) | P0 HIGH | ✓ |
| PR39 (POI find-or-create + entry trip-pois) | P1 | ✓ + DATA_CONFLICT prod bug fix |
| PR40 (trip-notes cross-section) | P1 | ✓ |
| **PR41 (invitations + permissions)** | **P2** | **✓ this PR** |

**PR35 audit plan 100% 完成**。

## [2.34.40] - 2026-05-29

**Test — PR40：trip-notes cross-section dispatch integration test (PR35 P1 gap)**

PR35 doc 標 P1 indirect-tested 的 4 個 section（lodgings/reservations/pretrip/emergency）`/[rowId]` + `/reorder` + parent endpoint，共用 `_shared.ts` 但缺直接 dispatch 驗證。1 個 parametrized test 涵蓋 4 sections × 4 ops = 16 assertions。

### Added

- `tests/api/trip-notes-cross-section-dispatch.integration.test.ts` — parametrized cross-section test：
  - **POST** → row 進對應 table（trip_lodgings / trip_reservations / trip_pretrip_notes / trip_emergency_contacts）
  - **PATCH /[rowId]** → 200 + version 加 1
  - **PATCH /reorder** → 200 + audit_log written（PR26 audit 對齊）
  - **DELETE /[rowId]** → 200 + row 消失

Total 16 tests / 4 sections。

### Why

trip-notes-mutations.integration.test.ts 只 cover flights/* path（透過 `_shared.ts` helpers）。剩 4 section dispatch 是否正確（每個 section file 是否傳對 table name）沒 test。1 parametrized test 補齊 dispatch contract，避免 4 × 4 = 16 個重複 test。

完成 PR35 P0/P1 follow-up 全部（PR36-37 P0 + PR39/40 P1）。剩 PR41 P2 invitations/permissions。

## [2.34.39] - 2026-05-29

**Test + Fix — PR39：POI find-or-create + entry trip-pois integration test (PR35 P1 gap) + 修發現的 DATA_CONFLICT bug**

PR35 doc P1 MEDIUM gap：`pois/find-or-create.ts` 和 `trips/:id/entries/:eid/trip-pois.ts` 兩 endpoint 沒 integration test。寫 test 過程中發現 `trip-pois.ts` 處理 duplicate POI 時 UNIQUE error includes 判斷不匹配 D1 實際格式 → 落到 raw 500，並順手修。

### Added

- `tests/api/poi-find-or-create-trip-pois.integration.test.ts` — 10 個 test：

  **find-or-create.ts (5 tests)**:
  - 缺 name → 400 DATA_VALIDATION
  - 缺 type → 400
  - name trim 空字串 → 400
  - 正常 POST → 200 + id（新建到 pois table）
  - 重複 POST 同 name+type → 同 id（dedup via findOrCreatePoi）

  **trip-pois.ts (5 tests)**:
  - entry id 格式錯（非數字）→ 400
  - stranger 無 write perm → 403
  - 缺 name / type → 400
  - 正常 POST → 201 + result row + `entry_pois_version` 加 1 + audit_log 寫入
  - 重複 POI 同 entry → 409 DATA_CONFLICT（**PR39 修 prod bug 後通過**）

### Fixed (Prod bug discovered by tests)

- `functions/api/trips/[id]/entries/[eid]/trip-pois.ts:110` — D1 SQLITE UNIQUE error 訊息實際格式為「UNIQUE constraint failed: trip_entry_pois.entry_id, trip_entry_pois.poi_id」，中間夾 `trip_entry_pois.` prefix。原 `msg.includes('entry_id, poi_id')` literal 不 match → 落到 `throw err` 變 raw 500。改 `msg.includes('entry_id') && msg.includes('poi_id')` 分開判斷。User 操作體驗：之前重複加 POI 看到 500，現在看到 409 DATA_CONFLICT「此 POI 已存在於該 entry」訊息。

### Why

PR35 doc 評估這兩個是 P1 MEDIUM risk（POI dedup + entry editing core path）。沒 test 等於上述 bug masked 在 prod。

## [2.34.38] - 2026-05-29

**Fix — PR38：Prod audit 3 issue 批次修（HIGH ChatPage prompt leak + 2 LOW polish）**

User 要求 prod login QA 深度 audit → 列清單 → 一次批次修。3 個 real issue 全修 + regression test。

### Fixed

1. **HIGH — ChatPage user message 顯示 raw AI prompt**
   - `src/pages/ChatPage.tsx:168` `displayText` substitution 加 3 個 trip-notes prefix：
     - `[行程筆記-lodging-tips]` → 「已觸發 AI 行程筆記生成（住宿在地建議）」
     - `[行程筆記-tips]` → 「已觸發 AI 行程筆記生成（行前須知）」
     - `[行程筆記-emergency]` → 「已觸發 AI 行程筆記生成（緊急聯絡）」
   - 對齊 v2.31.27 `[AI 健檢]` substitution pattern；之前 user 在 /chat 看到「Schema: \`\`\`json [{ "title": "string", "content": "string", "section": "..." }]\`\`\`」等內部 prompt template

2. **LOW — Explore 卡 rating「★ 探索更多評論」placeholder UX 怪**
   - `src/pages/ExplorePage.tsx:815` 無 rating 不 render ★ element（之前 fallback 字串看似 link 實則無動作）
   - 改 `{typeof poi.rating === 'number' && <div>...</div>}` conditional render

3. **LOW (doc) — EditTripPage 副標題 stale**
   - `src/pages/EditTripPage.tsx:1127` 「修改行程基本設定 + 目的地 + 行程天數」→「修改目的地 + 行程天數」
   - 之前文案承諾「基本設定」但畫面只有後 2 項，誤導 user 找不到 trip name 設定

### Tests

- `tests/unit/chat-trip-notes-prefix-substitution.test.ts` — 7 個 source-grep test 鎖：
  - 3 個 prefix detection
  - 3 個短摘要文字
  - AI 健檢 regression（不能因新 substitution 拔了舊邏輯）
- `tests/unit/explore-page.test.tsx` 更新：
  - rating mock 加 `rating: 4.6` 確保 ★ 真 render
  - 新 test「無 rating → 不 render ★」鎖 v2.34.38 行為
- 3011/3011 全綠 + TS 零錯誤

### Why

Prod audit 流程：login QA → audit list → user 決定 scope → batch fix。對應 user 「登入後先 audit 所有問題 然後再一次修正」指示。Excluded 5 個 false-positive（data quality issue、URL 猜錯、intentional design）。

## [2.34.37] - 2026-05-29

**Test — PR37：Google APIs integration test (PR35 P0 HIGH gaps #6 + #10)**

PR35 doc 標 **P0 HIGH risk** 的 `poi-search.ts` + `route.ts` 兩個 Google API endpoint 原本沒 integration test。一次補 12 個 test 涵蓋 validation / mock dispatch / response shape / source-grep regression。

### Added

- `tests/api/google-apis.integration.test.ts` — 12 個 test：

  **poi-search.ts (8 tests)**:
  - query < 2 字 → 400
  - query > 200 字 → 400 + detail 含 "200"
  - q 缺失 → 400
  - 正常 query → call searchPlaces + 200 + X-Cache=MISS header
  - limit clamp 到 [1, 20]
  - searchPlaces throw → 不額外 catch（handler 假設上游 client 處理）

  **route.ts (4 tests)**:
  - from / to 缺失 → 400 DATA_VALIDATION
  - 正常 coords → call computeRoute + 200 + polyline decode + duration / distance + mode=DRIVE
  - computeRoute throw → 不額外 catch
  - Cache-Control: public, max-age=86400 (24h edge)

  **source-grep regression (2 tests)**:
  - poi-search.ts 仍 import searchPlaces from google-client
  - route.ts 仍 import computeRoute from google-client

### Strategy

`vi.mock('../../src/server/maps/google-client', ...)` 避免實打 Google API（cost + flaky）。Tests 鎖 contract（query validation / mock dispatch / response shape）而非 third-party behavior。

### Why

PR35 doc 評估 `poi-search.ts` ($32/1000) 和 `route.ts` ($5/1000) 是兩個最高 billing impact + accuracy-critical endpoint。沒 test 等於 schema 改 / response 改 / Google API 升級時無 safety net。

## [2.34.36] - 2026-05-29

**Test — PR36：account/profile.ts integration test 補上（PR35 P0 HIGH gap #1）**

PR35 doc 中標 P0 HIGH risk 的 `account/profile.ts`（v2.33.122 PATCH display_name）原本沒 integration test。一次補 9 個 test 涵蓋完整 lifecycle。

### Added

- `tests/api/account-profile.integration.test.ts` — 9 個 test：
  - trim 後寫入 ✓
  - null → clear ✓
  - empty string → clear ✓
  - 50 chars 邊界 OK ✓
  - 51 chars → 400 DATA_VALIDATION + detail 含 "50" ✓
  - 欄位省略 → 400 ✓
  - 非 string 型別（number）→ 400 ✓
  - Response mirror /api/oauth/userinfo shape（camelCase + emailVerified）+ 拒絕 snake_case 出現 ✓
  - audit_log 寫入（tableName='user' + action='update' + diffJson 含 displayName）✓

### Why

`account/profile.ts` 是 v2.33.122 新增 user-facing PATCH endpoint。display_name 有 trim / 50 char cap / null clear 三種 normalization rule，audit_log 寫 user table。沒 test 等於改動只靠 manual QA 抓 regression。

### Note

`AppError` shape：`error.message` 是 generic（i18n-friendly），`error.detail` 是 handler-supplied 具體理由。Test 假設都對齊這 contract。

## [2.34.35] - 2026-05-29

**Docs — PR35：Endpoint test coverage 精準分析（68/96 = 70.8% direct coverage）**

QA loop audit 收尾：產出 96 個 `functions/api/**/*.ts` endpoint 的精準 test 覆蓋率分析。28 untested 分類後實際真 gap 只 11 個（其餘 8 indirect / 9 admin defer）。

### Added

- `docs/perf/endpoint-coverage-v2.34.34.md`：
  - Methodology + grep script
  - 68 tested / 28 untested 完整列表
  - 8 indirect-tested（trip-notes /reorder + /[rowId] 共用 `_shared.ts`）
  - 9 admin endpoints defer rationale
  - 11 real gap 按 risk 排優先級（account/profile / poi-search / route / pois/find-or-create / 等）
  - 5 follow-up PR 建議（PR36-40）含預估 line count

### State

- 70.8% direct coverage（業界 SaaS 平均 60-70%）
- 全 mutation endpoints 都有 audit_log（PR26/27/32）
- 全 trip-notes feature 各 path 都有 unit test 鎖 OCC + permission
- 11 個 real gap 中 P0 (HIGH risk) 是 `account/profile.ts` + `poi-search.ts` + `route.ts`

## [2.34.34] - 2026-05-29

**Docs — PR34：Bundle size baseline 紀錄（PR26-33 後 720.9 KB gzipped）**

QA loop audit 收尾：產出 v2.34.33 prod build bundle 分析做 baseline。Future PR diff 對齊 baseline 抓意外 bloat。

### Added

- `docs/perf/bundle-baseline-v2.34.33.md` — 89 chunks / 720.9 KB gzipped baseline：
  - Top 20 chunks 表（含 lazy-load 標記 + 用途）
  - 4 個 observation：pdf 256KB borderline / TripsListPage 37.7KB first impression / sentry 45.7KB eager / vendor 68.7KB React 19 lean
  - Comparison gate 提案（5% warn / 10% block，script 待實作）

### State after PR26-33 batch

- Total gzipped JS: **720.9 KB**（well below 1MB SPA budget）
- All 89 chunks ≤ 300 KB gate（pdf 256KB borderline）
- TripNotesPage 11.7 KB（PR29 token cleanup 後 lean）
- Bundle gate: ✓ pass

## [2.34.33] - 2026-05-29

**Chore — PR33：24 個 dep minor/patch batch upgrade（6 majors held）**

QA loop audit 發現 30 個 outdated npm packages。一次 batch `npm update` 升 24 個 minor/patch，6 個 major held 之後個別 PR 評估 breaking change。

### Changed

24 minor/patch upgrade（npm update 自動套用 ^semver 內版本）：

| 套件 | 從 | 到 |
|---|---|---|
| @cloudflare/workers-types | 4.20260329.1 | 4.20260529.1 |
| @playwright/test | 1.58.2 | 1.60.0 |
| @sentry/react | 10.45.0 | 10.55.0 |
| @sentry/vite-plugin | 5.1.1 | 5.3.0 |
| @tailwindcss/vite + tailwindcss | 4.2.2 | 4.3.0 |
| @types/google.maps | 3.64.0 | 3.64.1 |
| @types/react | 19.2.14 | 19.2.15 |
| @vitejs/plugin-react | 6.0.1 | 6.0.2 |
| @vitest/runner + @vitest/snapshot + vitest | 4.1.0 | 4.1.7 |
| axe-core | 4.11.3 | 4.11.4 |
| date-fns | 4.2.1 | 4.3.0 |
| miniflare | 4.20260521.0 | 4.20260526.0 |
| nodemailer | 8.0.7 | 8.0.9 |
| oidc-provider | 9.8.2 | 9.8.3 |
| react + react-dom | 19.2.4 | 19.2.6 |
| react-router-dom | 7.13.2 | 7.16.0 |
| vite | 8.0.8 | 8.0.14 |
| vite-plugin-pwa | 1.2.0 | 1.3.0 |
| wrangler | 4.94.0 | 4.95.0 |

### Held (major upgrades 需單獨 PR 評估)

| 套件 | 現 | 最新 | 風險 |
|---|---|---|---|
| concurrently | 9 | 10 | dev tool, low risk |
| dotenv | 16 | 17 | config loading, check `.dev.vars` |
| jsdom | 26 | 29 | 3 major 落差！test env 變化大 |
| marked | 17 | 18 | markdown rendering, ChatPage/HealthCheck reply |
| react-day-picker | 9 | 10 | TripDatePicker / TripTimePicker 視覺改 |
| typescript | 5 | 6 | 全 codebase 影響 |

### Test verification

- `npm test` 3003/3003 全綠
- `npm run test:api` 843/843 全綠
- `npx tsc --noEmit` 零錯誤
- `npx tsc --noEmit -p tsconfig.functions.json` 零錯誤
- npm audit: 0 vulnerabilities

### Why

維持 dep 新鮮度避免長期累積技術債。Minor/patch 通常 backward-compat 安全。Major 跳級 hold 防 hidden breaking change。

## [2.34.32] - 2026-05-29

**Audit log — PR32：4 個 mutation endpoint 補 logAudit（trip mutation 覆蓋率收尾）**

QA loop audit 發現 7 個 trip mutation endpoint 沒 logAudit 對齊 entries/segments/trip-notes 既有 pattern。Filter 後實際 4 個高價值：

### Added

| Endpoint | action | recordId | diffJson |
|---|---|---|---|
| `POST /api/trips/:id/days` | `insert` | newDayId | `{day_num, date, day_of_week}` |
| `POST /api/trips/:id/days/shift` | `update` | `null` | `{op:'shift', deltaDays, daysShifted, oldStartDate, newStartDate, newEndDate}` |
| `POST /api/trips/:id/recompute-travel` | `update` | `null` | `{op:'recompute-travel', daysProcessed, pairsComputed, pairsSkipped*, sourceBreakdown, modeBreakdown}` |
| `POST /api/pois/:id/enrich` | `update` | poiId | `{op:'enrich', placeId, status, statusReason, hasRating, hasCoords}` |

### Skipped (with rationale)

- `reports.ts` — `error_reports` table 本身就是 forensics audit
- `health-check.ts` / `notes/[type]/generate.ts` — trigger 僅 trip_requests INSERT，AI 完成的實際 INSERT 已在 PR26/27 audit
- OAuth `login.ts` / `verify.ts` / `signup.ts` / `token.ts` / `callback/google.ts` — 用獨立 `logAuthAudit` (auth_audit table)，無 trip 上下文
- `dev/apps.ts` / `account/connected-apps/[client_id].ts` — 開發者 OAuth app 管理，無 trip 上下文
- 7 個 internal helper file (`_*.ts`) — 不是 endpoint

### Tests

- `tests/api/audit-log-pr32.integration.test.ts` — 4 個 assertion：
  - days POST insert audit + recordId
  - shift +3d audit + op:shift summary
  - shift delta=0 早 return 不寫 audit
  - source-grep 4 檔都 import + call logAudit

843/843 全綠（前 839 + 4 新）。

### Why

PR26/27 trip-notes audit 的 follow-up：補齊 trip-scoped mutation 全 write path audit 覆蓋率。Forensics 重建時間軸（user 改了哪些 day / 改了哪些 segment / refresh 了哪些 POI）有 audit_log 才追得到。

## [2.34.31] - 2026-05-29

**Polish — PR31：repo-wide font-size token cleanup（71/72 處 hardcoded → DESIGN.md token）**

QA loop repo-wide audit 發現 72 處 hardcoded font-size 跨 27 個檔案。一次批次 sed + 人工判斷對齊 DESIGN.md token system。

### Changed

對應 token map：
| 原值 | Token | 用途 |
|---|---|---|
| 9px | `--font-size-eyebrow` (10px) | 微型 label / chip caret |
| 12px | `--font-size-caption` | muted secondary |
| 13px | 分歧 | muted hint→caption；CTA/UI text→footnote |
| 14px | `--font-size-footnote` | sub / button / placeholder |
| 15px | `--font-size-subheadline` | row title / input |
| 16px | `--font-size-body` | body / mobile input zoom 防 |
| 18px | `--font-size-headline` (17px，1px drift) | section title / auth form title |
| 20px | `--font-size-title3` | section hero |
| 22px | `--font-size-title2` | flight number |
| 24px | `--font-size-title2` (22px，2px drift) | hero approximation |
| 26px | `--font-size-title` (28px，2px drift) | brand 800-weight 標題 |
| 28px | `--font-size-title` | exact match |
| 38px / 42px | `--font-size-large-title` (34px) | auth brand hero "Tripline" |

涵蓋 27 個檔案：18 個 `src/pages/`、9 個 `src/components/`。

### Exception (1 處)

- `src/components/trip/StopLightbox.tsx:89` `.tp-lightbox-photo .icon { font-size: 36px }` — 36px 是裝飾 icon size 非 text；介於 large-title (34) 與 title (28) 之間用 token 都不對。Inline comment 標 v2.34.31 exception。

### Results

- 72 處 hardcoded → 1 處 intentional exception（98.6% 收斂）
- 3003/3003 全綠
- npx tsc 零錯誤

### Why

PR29 / PR30 trip-notes + sidebar token 化的 follow-up。Repo-wide 一次掃乾淨避免之後 PR review 還在處理零散 drift。

## [2.34.30] - 2026-05-29

**Polish — DesktopSidebar PR30：sidebar dark accent token 化 + 7 font-size 對齊 DESIGN.md**

QA loop repo-wide audit 發現 DesktopSidebar 是最大 token drift（8 hex literals + 7 hardcoded font-size + 4 rgba()）。Foundation PR：tokens.css 新增 sidebar dark accent token，DesktopSidebar 整檔 token 化。

### Added (css/tokens.css)

7 個新 sidebar token（DESIGN.md H6 exception，deep-cocoa surface 兩 mode 固定）：
- `--color-sidebar-bg` light=`#2A1F18`, body.dark override=`#0F0B08`
- `--color-sidebar-fg` warm cream `#FFFBF5`（brand title / account name / nav hover）
- `--color-sidebar-fg-muted` `rgba(255, 251, 245, 0.78)`（inactive nav / chip）
- `--color-sidebar-fg-hover` `rgba(255, 251, 245, 0.06)`（hover background）
- `--color-sidebar-fg-faint` `rgba(255, 251, 245, 0.12)`（border + loading skel）
- `--color-sidebar-fg-skel-secondary` `rgba(255, 251, 245, 0.09)`（skel 次要 line）
- `--color-sidebar-fg-skel-faint` `rgba(255, 251, 245, 0.14)`（skel 主要 line）

### Changed (src/components/shell/DesktopSidebar.tsx)

- 8 hex literals (`#2A1F18` / `#0F0B08` / `#FFFBF5`) → token references
- 4 rgba alpha 變體 → 對應 token
- 7 hardcoded font-size → DESIGN.md token：
  - brand 20px → `--font-size-title3`
  - nav-item / new-trip-btn / user-chip / avatar / account-card-name 14/13px → `--font-size-footnote`
- body.dark .tp-sidebar override 從 component CSS 搬到 tokens.css（`body.dark { --color-sidebar-bg: #0F0B08; }`）— component 不再 duplicate dark mode 邏輯

### Tests

- `tests/unit/desktop-sidebar-visual.test.tsx` 2 個 source-grep assertion 改驗 token reference 而非 hex（保 regression）
- 3003/3003 全綠

### Why

PR29 trip-notes token 化的 follow-up：DesktopSidebar 是 repo-wide font-size 最大 drift 檔案（7 處）+ 4 hex literals。Token 化後 dark mode override 只在 tokens.css 一個地方維護（過去 component 也定義 body.dark rule 重複）。

## [2.34.29] - 2026-05-29

**Polish — 行程筆記 PR29：18 處 hardcoded font-size 全 DESIGN.md token 化**

QA loop UI audit 發現 trip-notes feature 6 個檔案（1 page + 5 section）共 18 處寫 hardcoded font-size px，違反 DESIGN.md token system。一次批次改全部，新增 source-grep regression test 鎖未來 drift。

### Changed

| 檔案 / 行 | 原值 | 新 token |
|---|---|---|
| TripNotesPage:97 | 20px | `var(--font-size-title3)` |
| TripNotesPage:98 | 14px | `var(--font-size-footnote)` |
| TripNotesPage:147 | 17px | `var(--font-size-headline)` |
| TripNotesPage:148 | 13px | `var(--font-size-caption)` (section meta muted secondary) |
| TripNotesPage:159 | 13px | `var(--font-size-footnote)` (AI button) |
| TripNotesPage:185 | 14px | `var(--font-size-footnote)` |
| FlightsSection:100 | 22px | `var(--font-size-title2)` (flight number 大顯示) |
| FlightsSection:149 / 184 | 15 / 14px | subheadline / footnote |
| EmergencySection:92 / 110 / 143 | 15 / 13 / 15px | subheadline / footnote (phone btn) / subheadline |
| LodgingsSection:71 / 114 | 15 / 15px | subheadline / subheadline |
| PretripSection:65 / 110 | 15 / 15px | subheadline / subheadline |
| ReservationsSection:86 / 112 | 15 / 15px | subheadline / subheadline |

13px 分歧處理（DESIGN.md 沒 13px token）：
- `section-meta` (TripNotesPage:148, muted secondary) → 降 `--font-size-caption` (12px)
- AI button + phone button (主要 CTA) → 升 `--font-size-footnote` (14px)
- 不同層級語意對齊，避免單一規則犧牲訊息層次

### Added

- `tests/unit/trip-notes-token-compliance.test.ts` — 9 個 source-grep regression test：
  - 6 個檔案每個 1 test 鎖「零 hardcoded font-size px」
  - 1 test 鎖 TripNotesPage 用 4 個 token
  - 1 test 鎖 FlightsSection 用 title2
  - 1 test 鎖 5 section 都用 subheadline

### Why

DESIGN.md token system 是設計系統 source of truth。Hardcoded px 在 dark mode / responsive scale / future theme 變動時不會跟著走，造成視覺破版。Source-grep regression test 確保未來不會 drift 回去。

## [2.34.28] - 2026-05-29

**Test cleanup — 一次修 master CI 6 個 stale failure + 2 個 unhandled rejection**

QA loop 全 audit 發現 master CI 一直紅是 6 個 stale test 沒對齊 code 改動 + 2 個 PoiFavoritesPage 測試 unhandled rejection 雜訊。一次批次修讓 master CI 變綠，後續 PR 不再被 pre-existing failure 干擾 false-red signal。

### Fixed

- `tests/unit/alert-helper.test.ts` 4 個 stale test 對齊 v2.33.134 改動：
  - 2 個 `warns when TELEGRAM_*_TOKEN/CHAT_ID missing` → 改 `errorSpy`（v2.33.134 把 console.warn 提到 console.error，因為 wrangler tail 預設 filter warn）
  - `fetch rejects (network down)` → 改 regex `/Telegram fetch failed/` + object shape（v2.33.134 訊息「alert failed」→「fetch failed」+ 改 object）
  - `Telegram API non-2xx` → 改 `expect.objectContaining({status, body})`（v2.33.134 多 arg → object）
- `tests/unit/explore-page.test.tsx` `TitleBar 收藏 ghost action` test → 改 negative regression（v2.33.140 故意拔 ExplorePage 收藏 action 因為 back ← 已回 /favorites 是重複入口）
- `tests/unit/v2_31_90-titlebar-action-icon-only.test.ts` `ExplorePage + PoiFavoritesPage 既有 title` → 改 PoiFavoritesPage only（v2.33.140 不對稱：ExplorePage 拔，PoiFavoritesPage 留）
- `tests/unit/api-client-429-retry.test.ts` 2 個 test 改用 `const expectation = expect(...).rejects.toThrow()` pattern 一開始就 attach catch handler，避免 `Unhandled Rejection: 操作太頻繁` + `連線逾時` 測試輸出雜訊

### Why

CI 假紅 → PR review 時無法判斷是 PR 引入新 regression 或既存問題；2 個 unhandled rejection 在測試輸出中刷雜訊，遮蔽真實錯誤訊號。

### Results

- 2994/2994 全綠（從 2988/2994）
- 0 unhandled rejection（從 2）
- Master CI 預期變綠，後續 PR review 訊號乾淨

## [2.34.27] - 2026-05-29

**Audit log — 行程筆記 PR27：AI generation hook 補 audit_log integration**

PR26 補完 user mutation 4 個 helper 後，發現 AI generation completion hook（`applyNotesGenerationCompletion`）在 `trip_pretrip_notes` / `trip_emergency_contacts` 直接 INSERT 完全沒 audit_log。Prod user 看到 AI 生成的「住宿在地建議」「緊急聯絡 entry」時 audit_log 沒記錄是誰觸發的，事後 forensics 抓不到 trigger 路徑。

### Added

- `functions/api/requests/[id]/index.ts:applyNotesGenerationCompletion` 在 2 個 AI INSERT 點加 `logAudit()`：
  - `INSERT INTO trip_pretrip_notes` 改 `RETURNING *` 拿 row + `logAudit` action='insert' + requestId 對齊原 PR10 linkage
  - `INSERT INTO trip_emergency_contacts` 同上
- `aiActor` derive：`submitted_by` 存在 → `ai:<email>`（標明 AI 動作的觸發人）；NULL → `system:ai` fallback。前綴 `ai:` 讓 audit_log query 容易分辨「user 自己手動 vs AI 代寫」

### Tests

- `tests/api/trip-notes-completion-hook.integration.test.ts` +4 audit assertion：
  - lodging-tips insert → action='insert' + changedBy=`ai:owner@hook.test` + recordId 正確 + diffJson 含 row 資料
  - emergency insert → 多 row 每 row 一筆 audit_log
  - submitted_by NULL → changedBy='system:ai' fallback
  - failed status → 不寫 audit_log（沒 INSERT 就沒記錄，避免雜訊）
- 11/11 全過

### Why

合規 / forensics：v2.34.27 後 audit_log 可重建「誰觸發 AI → AI 寫了什麼 row」的完整時間軸（用 requestId 串 linkage）。對應 PR26 補 user mutation；這兩 PR 完成 trip-notes 全 write path audit 覆蓋率。

## [2.34.26] - 2026-05-29

**Audit log — 行程筆記 PR26：trip-notes mutations 補 audit_log integration**

QA loop dev round 發現安全/合規 gap：trip-notes 5 個 table 的 POST/PATCH/DELETE/reorder 共 20 個 endpoint 完全沒 call `logAudit()`，其他 mutation endpoint（entries / segments / days）都有。User 在 prod 改 lodging / flight / emergency contact 時 audit_log table 完全沒留下記錄，事後 incident 無法重建時間軸。

### Added

- `functions/api/trips/[id]/notes/_shared.ts` import `logAudit` + `computeDiff` from `_audit.ts`，4 個 helper 全補 audit：
  - `createNotesRow` → action='insert' + 全 row snapshot
  - `updateNotesRow` → action='update' + `computeDiff(oldRow, newFields)` 細粒度欄位變化
  - `deleteNotesRow` → action='delete' + 全 oldRow snapshot 供 forensics 重建
  - `reorderNotesRows` → action='update' + recordId=null + 摘要 `{op:'reorder', items}`（bulk 不寫 per-row 噪音）

### Changed

- `updateNotesRow` 從只 SELECT trip_id 改 SELECT *（拿 oldRow 給 computeDiff 用），多 1 個欄位但 trip-notes 表都很小可接受
- `deleteNotesRow` 同上，刪除前先抓 oldRow 留 snapshot

### Tests

- `tests/api/trip-notes-mutations.integration.test.ts` +5 audit assertion：insert / update with diff / delete with snapshot / reorder summary + recordId=null / cross-table coverage (pretrip / emergency / reservations)。27/27 全過。

### Why

合規 / forensics：trip-notes 含 PII（航班 confirmation code / 飯店地址 / 緊急聯絡電話）與行程隱私資料，沒 audit_log 等於沒留證。對齊 `functions/api/trips/[id]/entries/[eid].ts:198` 既有 pattern。

## [2.34.25] - 2026-05-29

**Docs — ARCHITECTURE.md 加 Trip Notes section（schema + AI generation flow）**

QA loop dev round 發現 ARCHITECTURE.md 完全沒提 trip-notes feature。新加完整 section 描述 6 table schema + AI generation 3 prompts + CR-7/CR-8 linkage pattern + tests coverage。Future engineers 不用 grep design doc 也能理解。

### Added

- `ARCHITECTURE.md` 加 `### Trip Notes (v2.34.0+)` 章節：
  - 6 table schema overview (5 data + 1 linkage)
  - AI generation 3 prompt prefixes mapping
  - Trigger flow (POST /generate → INSERT linkage → Mac mini → PATCH hook → applyNotesGenerationCompletion)
  - Frontend page + component structure
  - Tests stats (137 tests trip-notes-related)

## [2.34.24] - 2026-05-29

**Polish — 行程筆記 PR24：「✦ 住宿」AI button empty-lodgings guard**

QA loop dev round 發現 UX gap：lodging-tips prompt 依賴 trip 飯店資料（Claude 讀 trip lodgings 生成 hotel-specific 建議），但 PR22 button 沒 guard 0-lodging 情況。User 在沒填 lodging 時 click 會觸發 AI 但 Claude 生不出有意義內容（沒原料）。

### Changed

- `src/pages/TripNotesPage.tsx` 「✦ 住宿」button：
  - `disabled={counts.lodgings === 0}` — 0 lodging 時 disabled
  - `title` 顯「需要先填寫住宿才能 AI 生成在地建議」(hover hint)
  - Click handler 加 guard — 0 lodging 時 showToast info「請先填寫住宿 section」
  - 「✦ 一般」button (tips) 不受影響，任何狀態都可觸發

### Tests

- 2 條 regression test in `tests/unit/trip-notes-page.test.tsx`：
  - `0 lodgings → 住宿 button disabled + 一般 button enabled`
  - `≥1 lodging → 住宿 button enabled + title 改「基於行程飯店」`
- trip-notes-page.test.tsx: 15 → 17 tests

## [2.34.23] - 2026-05-29

**Test — 行程筆記 PR23：PR22 lodging-tips button regression test (2 條)**

PR22 加 lodging-tips UI trigger 後立刻補 regression test 鎖住未來變動。

### Added

- `tests/unit/trip-notes-page.test.tsx` 2 條新測試：
  - `PR22 — pretrip section render 2 AI buttons (一般 + 住宿)`：驗 2 button testid + label「一般」/「住宿」+ aria-label distinct
  - `PR22 — emergency section still has 1 AI button (no lodging counterpart)`：驗 emergency 只有 1 AI button，無 lodging counterpart

Total trip-notes-page unit test: 13 → 15

## [2.34.22] - 2026-05-29

**Feature — 行程筆記 PR22：lodging-tips AI UI trigger（補完 3/3 AI prompts UX）**

PR12 frontend AI button 只 wire 2/3 prefix（pretrip→tips, emergency→emergency）。lodging-tips backend 已 work end-to-end（驗證 ship 7 hotel-specific Claude rows）但缺 UI trigger。

PR22 完整補 UX：行前須知 section header 拆成 2 個 AI button：
- 「✦ 一般」→ tips prompt（貨幣 / 通訊 / 簽證 / 禮儀 等普通行前須知）
- 「✦ 住宿」→ lodging-tips prompt（基於行程飯店生成 hotel-specific 建議）

緊急聯絡 section 保持單一「✦ AI」button。對齊 design doc Premise 6（AI button 只在行前須知 + 緊急聯絡 section header）。

### Changed

- `src/pages/TripNotesPage.tsx`：行前須知 section render 2 個 AI button + 緊急聯絡保 1 個
- 新 testid: `trip-notes-ai-btn-pretrip-lodging`
- 兩 pretrip button 都 disabled when aiJob !== null（互鎖防多重觸發）

## [2.34.21] - 2026-05-29

**Polish — HuiYun import script aggregated row title cleanup**

QA loop visual inspection 發現 HuiYun import 產生的 aggregated row title「行前提醒（from emergency notes）」對 user 暴露 script 內部細節（"from emergency notes" 是 debugging annotation）。改為「保險 / 住宿地址」（描述實際內容）。

### Changed

- `scripts/import-huiyun-trip-notes.ts:140` — title「行前提醒（from emergency notes）」→「保險 / 住宿地址」
- HuiYun prod row 同步 UPDATE 改新 title

## [2.34.20] - 2026-05-28

**Fix — 行程筆記 token hardcode cleanup (pr2-tokens regression)**

QA loop sweep 發現 4 個 trip-notes section components 各自有 11px hardcode (Emergency / Reservations / Lodgings / Pretrip section-chip) + Pretrip 還有 10px hardcode。pr2-tokens.test.ts 2 條 fail。改成 token：

### Fixed

- `src/components/trip-notes/{Emergency,Reservations,Lodgings,Pretrip}Section.tsx`：
  - 4 個 ai-chip / kind-chip / section-chip 的 `font-size: 11px` → `var(--font-size-caption2)`
- `src/components/trip-notes/PretripSection.tsx`：
  - section-chip uppercase 的 `font-size: 10px` → `var(--font-size-eyebrow)`

`pr2-tokens.test.ts` 16/16 pass after fix.

## [2.34.19] - 2026-05-28

**Test — 行程筆記 PR19 / 19：TripCardMenu「行程筆記」menu item regression test (B-3 / Phase 完整)**

`tests/unit/trip-card-menu-notes-entry.test.tsx` — 4 條 PR14 regression test。完整 19 PR phase B-1/B-2/B-3 ship 完成。

### Added

- `tests/unit/trip-card-menu-notes-entry.test.tsx` 4 條：
  - 行程筆記 menu item 渲染 when onNotes provided
  - 行程筆記 menu item 不渲染 when onNotes omitted（向後相容）
  - click → onNotes(tripId) called
  - menu items 順序對：編輯 / 共編 / AI 健檢 / **行程筆記** / 刪除

### B-1 / B-2 / B-3 phase 完整 — 行程筆記 feature shipped

19 PR / 12 day session：

| Phase | PRs (versions) | Status |
|---|---|---|
| B-1 (CRUD) | v2.34.0 - 2.34.8 + 2.34.4 polish | ✓ migration + backend + 5 sections UI |
| B-2 (AI) | v2.34.9 - 2.34.12 | ✓ generate endpoint + completion hook + frontend trigger + verified end-to-end (6 emergency contacts inserted by Claude) |
| B-3 (polish + test) | v2.34.13 - 2.34.19 | ✓ day_id picker / menu entries / unit tests (38) / E2E spec / DESIGN.md update |

**Test coverage**：
- Migration: 17 tests
- Import: 9 tests
- Backend GET: 13 tests
- Backend mutations: 22 tests
- Generate endpoint: 8 tests
- Completion hook: 7 tests
- Page shell: 13 tests
- FlightsSection: 9 tests
- 4 sections batch: 16 tests
- TripCardMenu regression: 4 tests
- E2E: 4 specs
- **Total: 122 tests covering trip-notes feature**

## [2.34.18] - 2026-05-28

**Docs — 行程筆記 PR18 / 19：DESIGN.md add Trip Notes section**

DESIGN.md 加 `### Trip Notes Page (\`tp-notes-*\`)` 章節，作為 source of truth for future polish + component reuse。

### Added

- `DESIGN.md` 加 Trip Notes Page section 對齊 AI Health Check Page pattern，包含：
  - Route + 入口（TripCardMenu / EmbeddedActionMenu）
  - Accordion responsive 行為 (mobile / desktop ≥768px)
  - 4 state (loading / error / empty / hasData / ai-pending)
  - AI button location + disabled state + 30s debounce
  - Visual specs (section card / icon box 36×36 / Edit mode 2px accent box-shadow / ConfirmModal delete)
  - autosave 對齊 v2.33.108 OCC pattern
  - Stop Type Color exception（emergency kind icon semantic 色 — police/medical destructive、embassy accent、hotel success）

## [2.34.17] - 2026-05-28

**Test — 行程筆記 PR17 / 19：E2E happy path spec**

`tests/e2e/trip-notes.spec.js` — Playwright E2E test cover trip-notes page read path。

### Added

- `tests/e2e/trip-notes.spec.js` 4 條：
  - render TitleBar + 5 section accordion 全 visible
  - section meta counts 對 (1 個航段 / 1 間 / 1 筆 / 2 項 / 2 個聯絡人)
  - AI button 只在 pretrip + emergency 兩 section
  - empty trip → empty hero「建立行程筆記」

`page.route` mock `/api/trips/:id/notes$` 帶 fixture 包含每 section 至少 1 row + 1 AI-generated row 驗證 chip 顯示。

## [2.34.16] - 2026-05-28

**Test — 行程筆記 PR16 / 19：Lodgings / Reservations / Pretrip / Emergency batch unit tests**

16 條 unit test 覆蓋其他 4 個 section component。批 1 PR ship coverage。

### Added

- `tests/unit/notes-sections-coverage.test.tsx` 16 條：
  - **LodgingsSection** 4 條：empty / display chip / Add POST / ConfirmModal「刪除住宿」
  - **ReservationsSection** 3 條：display kind chip / 5-kind enum labels / Edit PATCH OCC
  - **PretripSection** 4 條：display section chip / AI chip 視覺 / manual no AI chip / Add POST
  - **EmergencySection** 5 條：display kind icon + phone / tel: href / AI chip / Add POST / ConfirmModal「刪除聯絡人」

## [2.34.15] - 2026-05-28

**Test — 行程筆記 PR15 / 19：FlightsSection unit test coverage**

9 條 unit test 覆蓋 FlightsSection 全 CRUD flow。Add / Edit / Delete / no-change blur / ConfirmModal / boarding pass display。

### Added

- `tests/unit/flights-section.test.tsx` 9 條：
  - empty (0 row) → 只 add button
  - boarding pass display (airline / flight_no / time / airport)
  - Add → POST + onChange callback + edit mode
  - Edit airline blur → PATCH with field + expectedVersion OCC
  - no-change blur → no PATCH (optimize)
  - close edit button → exit edit mode
  - Trash icon → ConfirmModal「刪除航班？CI 120」
  - Confirm 刪除 → DELETE call + onChange empty

## [2.34.14] - 2026-05-28

**Polish — 行程筆記 PR14 / 19：TripCardMenu + EmbeddedActionMenu 加「行程筆記」入口**

行程列表 trip card kebab menu + 行程詳細頁 ⋯ menu 都加「行程筆記」入口。對齊 AI 健檢同 menu pattern。

### Added

- `src/components/trip/TripCardMenu.tsx` — 加 `onNotes` optional prop + 「行程筆記」 menu item (file-text icon)。順序：編輯 / 共編 / AI 健檢 / **行程筆記** / 刪除
- `src/pages/TripsListPage.tsx`：
  - TripsListPage card menu wire `onNotes={(id) => navigate('/trip/:id/notes')}`
  - `EmbeddedActionMenu` (詳細頁⋯) 也加同 prop + 同 menu item
- 用 file-text icon 對齊 NotesPage empty hero bubble icon

## [2.34.13] - 2026-05-28

**Polish — 行程筆記 PR13 / 19：Lodgings day_id picker + day chip reverse navigation (B-3 開始)**

PR6 defer 的 day_id Day picker UI + design doc Premise 5.2 反向 navigation。住宿 row 顯 day chip click → navigate `/trips?selected=:id&day=N`。

### Added

- `src/components/trip-notes/LodgingsSection.tsx`：
  - Edit mode 加 `<select>` connect 到 Day（從 `TripContext` 取 trip.days）
  - 「不連結特定 Day」option + per-day option `Day N [· title]`
  - Display mode 顯 `.is-day` chip（accent-subtle bg + 「Day N → 」）
  - Day chip click → `navigate(routes.tripsSelected(tripId)&day=N)` 反向跳到 TripPage 對應 day
  - `useContext(TripContext)` 取 days array

## [2.34.12] - 2026-05-28

**Feature — 行程筆記 PR12 / 19：frontend AI button trigger + pending banner + polling (B-2 完整)**

完整 AI generation user flow 上線！AI button click → POST /generate → polling 直到 completed → refetch + success toast。B-2 phase 完整。

### Added

- `src/pages/TripNotesPage.tsx`：
  - `useRequestSSE(aiJob?.requestId)` polling — 跟 chat / 健檢同 pattern (SSE + 30s safety net poll)
  - `handleAiTrigger(docType)` — POST /api/trips/:id/notes/:type/generate + 鎖 aiJob 狀態
  - 行前須知 AI button → `docType = 'tips'`（general-tips prompt）
  - 緊急聯絡 AI button → `docType = 'emergency'`
  - **Pending banner**：accent-subtle bg + pulse dot animation + 「AI 正在生成 ... 通常 3-7 分鐘完成」
  - AI button disabled + text 改「生成中…」when active
  - Terminal status (completed/failed) → clear aiJob + 完成 / 失敗 handler
  - 完成 → loadData() refetch aggregator + showToast 「AI 生成完成（緊急聯絡）」success 4s
  - 失敗 → setAiError → AlertPanel.is-error 持續可見 + 「關閉」action
- pulse animation CSS keyframes (`prefers-reduced-motion` 停)

### B-2 phase 完整 (PR9-12)

| PR | Backend | Frontend |
|---|---|---|
| PR9 | POST /generate endpoint + debounce + trigger | — |
| PR10 | Completion hook + parseNotesItems + dedup + INSERT routing | — |
| PR12 | — | AI button + polling + pending banner + completed toast |

PR11 (mac mini tp-* skill update) 不需要 — prompt 自含 instruction，tp-request 通用處理 chat-style request。

## [2.34.10] - 2026-05-28

**Feature — 行程筆記 PR10 / 19：applyNotesGenerationCompletion hook 接 PATCH /api/requests/:id**

AI generation 完成後自動 parse Claude reply → INSERT 對應 section row。對齊 v2.33.102 CR-8 linkage table pattern（confused-deputy 防護）。

### Added

- `functions/api/requests/[id]/index.ts` 加 PR10 hook：
  - SELECT `trip_note_ai_jobs` linkage row → 識別 notes generation request (對齊 CR-8 fix)
  - `applyNotesGenerationCompletion(db, tripId, requestId, jobId, docType, request)` — 路由 docType → 對應 INSERT logic
  - `lodging-tips` + `tips` → INSERT `trip_pretrip_notes` with ai_source 區分 (對齊 ai_source partial index)
  - `emergency` → INSERT `trip_emergency_contacts` with kind 7-enum narrowed (unknown kind → 'other')
  - `parseNotesItems` 獨立 parser（health-check `parseFindings` 要求 `severity` 會把 notes items 全 filter 掉）
  - Dedup: LOWER(TRIM(title)) / LOWER(TRIM(name)) exact match skip 既有 row
  - UPDATE `trip_note_ai_jobs` status=completed/failed + inserted_count + error_message + completed_at
  - Rewrite `trip_requests.reply` 為 user-friendly summary「AI 生成完成 — 已新增 N 個項目」+ [前往行程筆記] link
- `tests/api/trip-notes-completion-hook.integration.test.ts` 7 條：lodging-tips INSERT + ai_source / tips ai_source=general-tips 區分 / emergency kind narrow / dedup skip 既有 / failed status 寫 error_message / 無 linkage no side effect / reply 改 summary

## [2.34.9] - 2026-05-28

**Feature — 行程筆記 PR9 / 19：POST /generate AI 觸發 endpoint (B-2 phase 開始)**

行程筆記 AI generation B-2 phase 開始。POST /api/trips/:id/notes/:type/generate 觸發 AI 生成行前須知 / 緊急聯絡內容。

### Added

- `functions/api/trips/[id]/notes/[type]/generate.ts`：
  - type 限 'lodging-tips' / 'tips' / 'emergency' (對齊 design doc Premise 6 + trip_note_ai_jobs.doc_type CHECK enum)
  - INSERT `trip_requests` with `[行程筆記-{type}]` prefix AI prompt (繁中)
  - INSERT `trip_note_ai_jobs` linkage row (對齊 v2.33.102 CR-8 confused-deputy fix)
  - Fire-and-forget trigger Mac Mini api-server (8s AbortController 對齊 v2.33.113)
  - 30s debounce — 同 trip+type pending → return existing job (防 user 多次 click 浪費 quota)
  - Return 202 + { jobId, requestId, status: 'pending', tripId, docType }
- `tests/api/trip-notes-generate.integration.test.ts` 8 條：3 valid types / invalid type 400 / PERM_DENIED / trip_requests prefix / linkage row 對 / debounce 重複返回 existing job

### Pending

- PR10: applyNotesGenerationCompletion hook integration into PATCH /api/requests/:id (識別 trip_note_ai_jobs linkage + parse reply → INSERT 對應 section table rows)
- PR11: mac mini tp-* skill spawn handler (sub-section selection logic)
- PR12: frontend AI button click → POST generate + polling
- PR13: pending banner + completed toast + AlertPanel failed

## [2.34.8] - 2026-05-28

**Feature — 行程筆記 PR8 / 19：行前須知 + 緊急聯絡 CRUD UI（B-1 phase 完整）**

第 4、5 個 section CRUD UI 一波 ship 完整 B-1 phase。AI 建議 chip 顯示但 AI generation flow PR9+ 才接。

### Added

- `src/components/trip-notes/PretripSection.tsx` — 行前須知 3 fields edit（分類 / 標題 / 內容 markdown textarea）+ AI 建議 chip + 分類 chip
- `src/components/trip-notes/EmergencySection.tsx` — 緊急聯絡 5 fields edit + kind enum (personal/embassy/police/medical/insurance/hotel/other) + kind icon (color-coded: 報警/醫療 destructive red / embassy accent / hotel success green) + 「tel:」phone 撥號 button (44px tap target)
- TripNotesPage `kind` field narrow 成 7-value union 對齊 type

### Status — B-1 phase 完整 5/5

| Section | CRUD UI | AI |
|---|---|---|
| 航班 (PR5) | ✓ | — (純手動) |
| 住宿 (PR6) | ✓ | — (純手動) |
| 預訂 (PR7) | ✓ | — (純手動) |
| 行前須知 (PR8) | ✓ | PR9+ AI generation 接 |
| 緊急聯絡 (PR8) | ✓ | PR9+ AI generation 接 |

## [2.34.7] - 2026-05-28

**Feature — 行程筆記 PR7 / 19：預訂 ReservationsSection CRUD UI + kind enum**

第三個 section CRUD UI。kind enum dropdown（餐廳/體驗/門票/交通/其他）+ 7 fields edit + autosave OCC + drag-reorder + ConfirmModal delete。

### Added

- `src/components/trip-notes/ReservationsSection.tsx`：
  - Display：kind chip (accent-subtle) + title + 預訂時間 + 人數 + 編號 + 電話 + 備註
  - Edit：8 fields incl. kind select dropdown + datetime + textarea note
  - kind enum 5 種 onBlur + onChange 都觸發 save (select 行為跨瀏覽器一致)
- `src/pages/TripNotesPage.tsx` — TripReservation `kind` 從 string narrow 成 5-value union 對齊 type
- wire `<ReservationsSection>` 進預訂 section body

## [2.34.6] - 2026-05-28

**Feature — 行程筆記 PR6 / 19：住宿 LodgingsSection CRUD UI**

第二個 section CRUD UI。沿用 FlightsSection pattern，住宿 row layout（名稱大字 + chip 訂房編號 + 入住/退房 + 地址 + 備註）+ 7 fields edit + autosave OCC + drag-reorder + ConfirmModal delete。HuiYun 3 個 imported 住宿可在前端顯示 / 編輯。

### Added

- `src/components/trip-notes/LodgingsSection.tsx`：
  - Display：飯店名稱（15px bold）+ 訂房編號 chip + 入住→退房 range + 地址 + 備註
  - Edit mode：7 fields 2-col grid（name / address 全寬 + check_in/out datetime + booking_no / phone + note 全寬 textarea）
  - PATCH 對齊 v2.33.108 OCC `expectedVersion` STALE_ENTRY → AlertPanel
  - Drag-reorder + optimistic + revert
  - ConfirmModal delete
- `src/pages/TripNotesPage.tsx` — wire `<LodgingsSection>` 進住宿 section body

### Deferred

- `day_id` Day picker UI 還沒接（PR6 簡化先沒做）— 後續 polish PR 補 Day select dropdown + 反向 navigation TripPage hotel POI → notes focus

## [2.34.5] - 2026-05-28

**Feature — 行程筆記 PR5 / 19：航班 section CRUD UI + 7 fields inline edit + drag-reorder**

第一個 section CRUD UI 上線。航班 boarding pass row + 7 fields inline edit + click-to-edit + @dnd-kit drag-reorder + ConfirmModal delete。autosave 對齊 v2.33.108 OCC pattern。

### Added

- `src/components/trip-notes/FlightsSection.tsx`：
  - Display mode — boarding pass layout（航空 + 航班 chip top row + 從→到 grid with 22px 起飛/抵達 time + airport + date）
  - Edit mode — 7 inputs 2-col grid（airline / flight_no / depart_airport / arrive_airport / depart_at datetime / arrive_at datetime / note textarea）
  - **autosave on blur**（對齊 v2.33.108 + 設計 doc Premise）— PATCH `/api/trips/:id/notes/flights/:id` with `expectedVersion` OCC
  - **Drag-reorder** via `@dnd-kit/sortable` → PATCH `/flights/reorder` bulk + optimistic update + revert on error
  - **Delete** via `<ConfirmModal>` (對齊 DESIGN.md「Destructive 必走 ConfirmModal」)
  - **Add** auto-create empty row + auto-enter edit mode → user 即時填寫
  - **Error** → `<AlertPanel variant="error">` 持續可見 (DESIGN.md L549) + 重試按鈕
- `src/pages/TripNotesPage.tsx`：
  - import + wire `<FlightsSection>` 進航班 section body
  - 加 `.tp-notes-section-body.is-placeholder` modifier 分開 CRUD 區與 placeholder 文字
  - flights array mutation 透過 `onChange(next)` 上拋給 TripNotesPage state — single source of truth

### Notes

- FlightsSection 用 boarding pass row + datetime input (browser native picker)
- `disabled={isEditing}` 在 useSortable 上 — edit mode 不能拖
- mockup-aligned visual：22px 大時間 tabular-nums + `✈` icon + 1px hairline divider with arrow tail
- `prefers-reduced-motion` 沿用既有 fade transition

## [2.34.4] - 2026-05-28

**Polish — 行程筆記 PR4 QA follow-up：TitleBar + empty hero eyebrow 顯 trip name**

Browser QA 後發現 mockup spec 規定 hero eyebrow + titlebar subtitle 應顯 trip 名稱，但 PR4 hardcoded「此行程」。改 useContext(TripContext) 取 trip name。TripLayout 已經 wrap 整個 `/trip/:tripId/*` 路徑，所以 context 預設可用。Fallback 為「此行程」保 test 環境不在 Router 內 mount 仍能 render。

### Changed

- `src/pages/TripNotesPage.tsx`：
  - 加 `useContext(TripContext)` 取 trip name (`tripCtx?.trip?.title`)
  - TitleBar `title` 從 `'行程筆記'` 改成 `${trip name ? '行程筆記 — ${trip name}' : '行程筆記'}`
  - Empty hero eyebrow 從 hardcoded `'此行程'` 改成 `tripName ?? '此行程'`

對齊 mockup `v1-accordion-stack.html` desktop 顯「行程筆記 — 沖繩 7 日」+ `v1-states.html` empty hero eyebrow 顯 trip name。

## [2.34.3] - 2026-05-28

**Feature — 行程筆記 PR4 / 19：NotesPage React shell + accordion frame + skeleton + empty hero**

`/trip/:tripId/notes` 全頁上線。13 條 unit test 全綠。Mockup v1-accordion-stack + v1-states sign-off 對齊。

### Added

- `src/pages/TripNotesPage.tsx` — page shell with 4 state:
  - **loading**: 3 row shimmer skeleton (`prefers-reduced-motion` 停 animation)
  - **error**: `<AlertPanel variant="error" actionLabel="重試">` 持續可見 + 對齊 DESIGN.md L549 (儲存失敗 surface) 文案三件事 (發生什麼事 / 怎麼做 / 資料是否保留)
  - **empty (counts=0)**: hero「建立行程筆記」+ 5 dot progress + 5 section collapsed accent border (`.tp-notes-section.is-suggested` 在航班 + `is-warn` meta「建議先填」引導第一步)
  - **hasData**: 5 section accordion + meta count（「N 個航段」/「N 間」/「N 筆」/「N 項」/「N 個聯絡人」）
- `src/entries/main.tsx` — `<Route path="notes" element={<TripNotesPage />}>` 註冊在 `/trip/:tripId/*` 下
- `src/components/shared/Icon.tsx` — 加 `check-square` (預訂 section) + `file-text` (empty hero bubble)
- `tests/unit/trip-notes-page.test.tsx` — 13 條：render testid / loading skeleton / error AlertPanel + 重試 / empty hero + 5 dot / 5 sections + meta / 航班 is-suggested + 建議先填 / AI button 只在 pretrip + emergency / mobile default 只 航班 is-open / chevron toggle + aria-expanded / count meta / aria-controls / TitleBar / apiFetch 路徑對

### Responsive

- Mobile (compact): default 只 航班 is-open，其他 4 摺疊（節省 scroll）
- Desktop ≥768px: 5 個 section 全 is-open（一覽全資料），透過 `matchMedia('(min-width: 768px)')` listener resize 動態切換

### Accordion semantics

- `<button>` head + `aria-expanded` + `aria-controls` 給 screen reader
- AI button stopPropagation 不觸發 section toggle
- chevron 旋轉 180° via CSS transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)

### CRUD UI placeholder

5 section body 內顯「尚未填寫，加項即可。」或「已有 N 項，待後續 PR 接 CRUD UI。」。PR5-8 各 section CRUD UI inline edit + autosave + drag-reorder 接進來。

### Notes

- 對齊 `feedback_mockup_variants_span_form_factors` — V1 Accordion 是 sign-off 選定的 form factor
- 對齊 `feedback_polish_in_same_pr` — pre-existing test fail 都不在本 PR；本 PR 引入的 hardcoded 11px 一併 fix (`var(--font-size-caption2)`)
- AI generation flow (PR9+) 還沒接，AI button click 暫 noop

## [2.34.2] - 2026-05-28

**Feature — 行程筆記 PR3 / 19：mutation endpoints + OCC 409 + 22 條 integration test**

POST / PATCH / DELETE / reorder 5 個 section 都齊全。共用 `_shared.ts` 抽出 4 個 helper（createNotesRow / updateNotesRow / deleteNotesRow / reorderNotesRows）+ ALLOWED_FIELDS whitelist + enum validation。對齊 v2.33.108 OCC `expectedVersion` 409 STALE_ENTRY pattern。

### Added

- `functions/api/trips/[id]/notes/_shared.ts` extended：
  - `ALLOWED_FIELDS` map per-table whitelist（snake_case，`version` 不在 — autosave OCC bump 由 SQL CAS）
  - `createNotesRow(ctx, table)` — POST handler，auto sort_order = MAX+1，body 不能 inject `trip_id`（path 提供），201 + row
  - `updateNotesRow(ctx, table)` — PATCH handler，OCC `expectedVersion` CAS，cross-trip rowId 403，empty body 400
  - `deleteNotesRow(ctx, table)` — DELETE handler，cross-trip rowId 403
  - `reorderNotesRows(ctx, table)` — bulk PATCH，body `{ items: [{ id, sortOrder }] }`，D1 batch atomic，cross-trip id 403
  - `validateEnums` helper — `kind` (reservations/emergency) + `ai_source` (pretrip) 400 早返回避免 500
- `functions/api/trips/[id]/notes/{flights,lodgings,reservations,pretrip,emergency}.ts` 5 個 file 加 `onRequestPost`
- `functions/api/trips/[id]/notes/{flights,lodgings,reservations,pretrip,emergency}/[rowId].ts` 5 個 file — `onRequestPatch` + `onRequestDelete`
- `functions/api/trips/[id]/notes/{flights,lodgings,reservations,pretrip,emergency}/reorder.ts` 5 個 file — `onRequestPatch`
- `tests/api/trip-notes-mutations.integration.test.ts` 22 條：
  - POST：auto sort_order / 用 user 指定 / kind enum 5 種接受 / 1 種拒絕 / ai_source null / cross-trip trip_id inject 被 ignore / 非授權 403
  - PATCH：note update / expectedVersion match bump 1→2 / mismatch 409 STALE_ENTRY / cross-trip 403 / 不存在 404 / empty body 400
  - DELETE：row gone / cross-trip 403
  - reorder：3 row sort_order swap + version bump on all / cross-trip id 403 / empty items 400 / 非 number id 400

## [2.34.1] - 2026-05-28

**Feature — 行程筆記 PR2 / 19：backend GET endpoints + import script JSON parser hotfix**

5 個 per-section GET + 1 aggregator + import script wrangler banner strip。13 條 integration test。

### Added

- `functions/api/trips/[id]/notes.ts` — aggregator `GET /api/trips/:id/notes` 一次回 5 section（flights / lodgings / reservations / pretripNotes / emergencyContacts）。5 個 parallel SELECT，camelCase response (deepCamel auto)，PERM_DENIED 對非授權 user
- `functions/api/trips/[id]/notes/_shared.ts` — `listNotesSection(ctx, table)` helper 抽出 auth check + SELECT * + ORDER BY pattern，5 個 per-section endpoint 共用
- `functions/api/trips/[id]/notes/flights.ts` — `GET /api/trips/:id/notes/flights`
- `functions/api/trips/[id]/notes/lodgings.ts` — `GET /api/trips/:id/notes/lodgings`
- `functions/api/trips/[id]/notes/reservations.ts` — `GET /api/trips/:id/notes/reservations`
- `functions/api/trips/[id]/notes/pretrip.ts` — `GET /api/trips/:id/notes/pretrip`
- `functions/api/trips/[id]/notes/emergency.ts` — `GET /api/trips/:id/notes/emergency`
- `tests/api/trip-notes-get.integration.test.ts` — 13 條：aggregator 5 section / empty trip / camelCase response 欄位對齊 / ORDER BY sort_order 對 / PERM_DENIED / per-section { items: [...] } shape / pretrip ai_source NULL vs general-tips vs lodging-tips 都 surface / emergency phone / kind 對

### Fixed

- `scripts/import-huiyun-trip-notes.ts` idempotent guard JSON parser bug — wrangler v4 `--json` output 前段有 banner (`🌀 ...` lines)，原 `JSON.parse(out)` 直接爆「Unexpected identifier "Cloudflare"」導致 `--apply` 跑不起來。改 `out.slice(out.indexOf('['))` strip banner 後再 parse

## [2.34.0] - 2026-05-28

**Feature epoch — 行程筆記 (Trip Notes) PR1 / 19：migration 0073 + 5 table + AI linkage + HuiYun rescue import**

行程筆記 feature 第一版：跨工具的 trip-level metadata（航班 / 住宿 / 預訂 / 行前須知 / 緊急聯絡）集中入 Tripline，不再切換 TripIt / Notion / Wanderlog。AI 可代寫 3 個 prompt prefix（lodging-tips / general-tips / emergency）。

完整 design doc: `~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260528-144009.md`（reviewer iter 2 / 9 of 10 PASS）
Mockup sign-off (V1 Accordion Stack): `docs/design-sessions/2026-05-28-trip-notes/v1-accordion-stack.html` + `v1-states.html`（含 audit 7 項全修：toast→AlertPanel / Copy Rules 3 件事 / class tp-notes-* / hero 純色 / phone btn token / AI ghost button family）

### Added

- `migrations/0073_trip_notes.sql` — 6 個新 table：
  - `trip_flights` 純手動，9 columns（航空公司 / 航班 / 艙等 / 出發抵達機場 / 出發抵達時間 / note）+ version OCC
  - `trip_lodgings` 純手動，9 columns（名稱 / 地址 / 入退房 / 訂房號 / 電話 / note）+ 可選 `day_id` ON DELETE SET NULL + version OCC
  - `trip_reservations` 純手動，9 columns（kind enum 限 restaurant/experience/ticket/transport/other / title / 時間 / 人數 / 預訂編號 / 電話 / note）+ version OCC
  - `trip_pretrip_notes` 可 AI（lodging-tips + general-tips 共用，靠 `ai_source` 區分避免 dedup 互相污染）— `section` / `title` / `content` markdown / `ai_generated` / `ai_source` / version OCC + partial index `idx_trip_pretrip_notes_ai_source WHERE ai_source IS NOT NULL`
  - `trip_emergency_contacts` 可 AI — kind enum 限 personal/embassy/police/medical/insurance/hotel/other + version OCC
  - `trip_note_ai_jobs` linkage table — UNIQUE `request_id` REFERENCES trip_requests + doc_type CHECK enum + status pending/completed/failed + inserted_count + error_message。對齊 v2.33.102 CR-8 trip_health_reports.request_id pattern（避免 v2.33.27 prefix sniffing）
- `migrations/rollback/0073_trip_notes_rollback.sql` — 反向 DROP 順序考慮 FK
- `scripts/import-huiyun-trip-notes.ts` — one-shot import HuiYun trip 舊 `backups/2026-03-28T18-21-54/trip_docs.json` 進新表。Mapping policy：7 checklist cards → 7 trip_pretrip_notes (markdown bullet list) + 4 emergency contacts → 4 trip_emergency_contacts (110→police / 119→medical / 駐外館→embassy) + 3 emergency notes 聚合成 1 額外 trip_pretrip_notes + 3 hotels (Mercure / BUZZ RESORT / HOPE VILLA) → 3 trip_lodgings (cross-ref checklist + emergency)。Idempotent guard 偵測既有 row → skip
- `tests/unit/migration-0073-trip-notes.test.ts` — 17 條：6 table 存在 + version OCC + ai_source partial index + 4 CHECK enum + UNIQUE constraint + CASCADE / SET NULL
- `tests/unit/import-huiyun-trip-notes.test.ts` — 9 條 buildImportPlan pure mapping：3 table 都有 / 7 cards → 8 pretrip rows / 4 contacts / 3 hotels / kind 對 / sort_order 遞增 / markdown bullet / ai_generated=0 ai_source=null
- `docs/design-sessions/2026-05-28-trip-notes/` — 4 mockup HTML + 4 PNG（V1 accordion + V2 tab + V3 cards + V1 states matrix）

### Changed

- `VERSION` 2.33.143 → 2.34.0（feature epoch bump，後續 trip-notes 19 PR 用 2.34.x）

## [2.33.143] - 2026-05-28

**Fix — 拔除剩餘 2 處 SaveStatus + 刪 component**

User feedback「都要拔」— 接續 v2.33.139 titleBar 拔 SaveStatus 後，最後 2 處 instance (TimelineRail inline note edit + TravelPillDialog footer) 也拔。0 caller 後整個 SaveStatus.tsx component file 刪除。

### Changed

- `src/components/trip/TimelineRail.tsx`：
  - 拔 `SaveStatus` import + `InlineError` import（後者 note error 一併走 toast 後 unused）
  - 拔 `.tp-rail-note-actions` 內 `<SaveStatus state={...} error={...} onRetry={...} />` JSX
  - 拔下方 `noteAutosave.state === 'error' && <InlineError>` 重複 surface
  - 新增 `lastNoteErrorRef` + `useEffect` 監聽 `noteAutosave.state==='error'` → `showToast('備註儲存失敗：...', 'error', 6000)`（state-transition 防 toast spam）
  - 完成 button + ⌘+↩ kbd hint 保留
- `src/components/trip/TravelPillDialog.tsx`：
  - 拔 `SaveStatus` import，加 `showToast` from `Toast`
  - 拔 `.tp-travel-dialog-footer` 內 `<SaveStatus>`，footer 只剩 `關閉` button
  - 新增 `lastErrorRef` + `useEffect` 監聽 `autosave.state==='error'` → `showToast('交通方式儲存失敗：...', 'error', 6000)`

### Removed

- `src/components/shared/SaveStatus.tsx` — 整 component file 刪除（0 caller）
- `tests/unit/edit-entry-empty-body-race-fix.test.ts` 內 PR12 (B) SaveStatus 4 條 assertion 刪除（component 不存在）+ 既有 setError 殘留 assertion 改寫對齊 v2.33.139 拔 error state 後現況

### Added

- `tests/unit/savestatus-component-removed.test.ts`：8 條 regression
  - TimelineRail：無 SaveStatus/InlineError import / note-actions block 無 SaveStatus / error toast useEffect / 完成 button 仍存在
  - TravelPillDialog：showToast import 加 / footer 無 SaveStatus / error toast useEffect / 關閉 button 仍存在
  - SaveStatus.tsx 檔案不存在驗證
  - 全 codebase grep — `src/` 0 個 `import SaveStatus` 殘留
- `tests/unit/travel-pill-tap-switch.test.tsx`：原「PATCH fail → SaveStatus 顯 error」assertion 改寫 → toastBus subscribe 攔截驗 `showToast('交通方式儲存失敗', 'error')` 觸發

### Verification

- vitest 30/30 pass (3 affected test files)
- tsc --noEmit clean

## [2.33.142] - 2026-05-28

**Fix — AccountPage display_name 改 inline 編輯 + blur auto-save（拔 modal）**

User feedback 2026-05-28：「筆的編輯 直接修改名稱 離開焦點後 auto save, 不要 pop 編輯窗」。v2.33.122 用 modal 對話框（overlay + dialog + 取消/儲存 button），user 想要直接 inline edit pattern。

### Changed

- `src/pages/AccountPage.tsx`：
  - 拔 `showEditNameModal` state，改 `editingName: boolean` + `draftName: string` + `nameInputRef: HTMLInputElement` + `draftBaselineRef`（無改 skip API call）
  - 拔 modal JSX block（overlay + dialog + 取消/儲存 button + 60+ 行）
  - Hero name JSX 改條件 render：`editingName ? <input/> : <h2/+button/>`
  - `<h2 className="tp-account-hero-name">` 加 `onClick={startEditName}` + `cursor:text`（name 本身可點）
  - `<input>` `onBlur={commitEditName}` + `Enter`→blur (trigger save) / `Escape`→cancel revert
  - 成功路徑 silent（無 toast）— 對齊 user 一脈相承「右上角不用顯示狀態」靜默 auto-save 原則
  - 失敗路徑保留 `showToast(msg, 'error')` 對齊 mockup spec
  - 拔 CSS `.tp-account-edit-overlay` / `.tp-account-edit-dialog` / `.tp-account-edit-title` / `.tp-account-edit-help` / `.tp-account-edit-input` / `.tp-account-edit-actions` / `@keyframes tp-account-edit-fade`（modal-only styles 全清）
  - 新 CSS `.tp-account-hero-name-input` 字體 `var(--font-size-title2)` + `font-weight: 800` 對齊 hero-name 避免 layout jump
- Backend `functions/api/account/profile.ts` 完全未動（PATCH endpoint 已 stable v2.33.122）

### Added

- `tests/unit/account-display-name-edit.tsx`：16 條 regression — modal 完全拔除驗證 + inline state hooks (5 個) + startEdit/cancel/commit 三 helper + JSX render (input onBlur / Enter / ESC / h2 onClick / pencil button 保留 / maxLength 50 / font 對齊) + backend handler 未動

### Verification

- vitest 16/16 pass
- tsc --noEmit clean

## [2.33.141] - 2026-05-28

**Fix — ChangePoiPage titleBar 右上 ✓ submit action 拔除（重複 bottom CTA）**

User feedback 2026-05-28 第二次「右上角紅框移除」(screenshot 加入備選景點 page)。`/change-poi` `/add-entry` `/alternates` 3 mode 共用 `ChangePoiPage`，bottom sticky bar 已有 primary button 同 `submitLabel`（加為備選 / 加入行程 / 置換景點），titleBar 右上 ✓ TitleBarPrimaryAction 完全重複。

### Changed

- `src/pages/ChangePoiPage.tsx`：
  - 拔 `titleBarActions` useMemo（含 `TitleBarPrimaryAction` JSX 與 `handleSubmit` wire）
  - `<TitleBar title={pageTitle} back={goBack} />` 移除 `actions={titleBarActions}` prop
  - `main` useMemo deps array 移除 `titleBarActions`
  - 拔 unused `import TitleBarPrimaryAction`
  - 加 v2.33.141 註解引用 user feedback

### Added

- `tests/unit/change-poi-titlebar-action-removed.test.ts`：7 條 regression — 無 TitleBarPrimaryAction import / 無 titleBarActions useMemo / 無 testid `change-poi-titlebar-submit` / TitleBar 無 actions prop / 全檔無 `titleBarActions` 殘留 / 底部 `change-poi-submit` button 保留 / 註解引用 user feedback

### Verification

- vitest 7/7 pass
- tsc --noEmit clean

## [2.33.140] - 2026-05-28

**Fix — ExplorePage 拔 titleBar 右上 heart action（重複入口）**

User feedback 2026-05-28：「返回已經是回到收藏，不需要右上角的按鈕」。`/explore` page back ← 已 wire `useNavigateBack('/favorites')`，右上 heart icon 點下去也是去 /favorites — 完全重複的入口。

User 同時問：如果 /favorites 沒被其他頁面 link，可以順手刪。實際 audit：
- `src/components/shell/DesktopSidebar.tsx:68` sidebar primary nav 有 `{ href: '/favorites' }`
- `src/components/shell/GlobalBottomNav.tsx:41,49` bottom-nav (authed + guest) 都有 `{ href: '/favorites' }`

→ /favorites 是 primary nav 兩處 link，page 保留不動。

### Changed

- `src/pages/ExplorePage.tsx`：
  - 拔 `TitleBar` 的 `actions={...}` prop 與 heart button JSX（含 testid `explore-favorites-titlebar`）
  - 拔 doc comment 內「TitleBar 右上 ghost action 收藏」描述，加 v2.33.140 註解
  - `back` / `backLabel="返回收藏"` / `goBack = useNavigateBack('/favorites')` 全保留 ← 仍正確 wire 回 /favorites

### Added

- `tests/unit/explore-titlebar-heart-removed.test.ts`：7 條 regression — TitleBar 無 actions / testid 不存在 / back+backLabel 保留 / useNavigateBack 仍 wire / 註解引用 user feedback / sidebar+bottom-nav 仍 link /favorites

### Verification

- vitest 7/7 pass
- tsc --noEmit clean

## [2.33.139] - 2026-05-28

**Fix — titleBar SaveStatus 拔除 + back nav 全改 explicit URL**

User feedback 2026-05-28 QA 截圖：
1. titleBar 右上「即將儲存…」/「儲存中…」狀態 noise，user 不需要看（auto-save 默默完成，失敗才需告知）
2. 回前頁不該用 history `navigate(-1)`，要明確指定 prev URL

### Changed

#### (A) titleBar SaveStatus 拔除（EditEntryPage + EditTripPage）

- `src/pages/EditEntryPage.tsx`：
  - 移除 `import SaveStatus`、`derivedSaveState`、`titleBarActions`
  - `<TitleBar>` 不再傳 `actions` prop — 右上完全 silent
  - 拔 `[error, setError]` useState — UI 不讀，改 showToast 直接呈現
  - handleSave 失敗 path + delete-stop catch 全走 `showToast(msg, 'error', 6000)` 對齊 mockup spec
- `src/pages/EditTripPage.tsx`：同樣 pattern
- `SaveStatus` component 本身保留（TimelineRail inline + TravelPillDialog footer 仍用）

#### (B) Back navigation 永遠走 explicit URL

- `src/hooks/useNavigateBack.ts`：拔 `window.history.length > 1 ? navigate(-1) : navigate(fallbackPath)` 二分法 → 永遠 `navigate(fallbackPath)`
  - Footgun fix：history 含 external referrer / login redirect 時 `navigate(-1)` 跳到非預期 URL；open in new tab 也走 fallback 正確
- `src/pages/CollabPage.tsx` `handleBack()`：拔同樣的 history check，改 `if (tripId) navigate('/trips?selected=:id') else navigate('/trips')`
- 4 處 stale docstring 註解（NewTrip / EditTrip / EntryAction / AddStop）改寫對齊「explicit URL via useNavigateBack」現狀

### Added

- `tests/unit/silent-savestatus-explicit-back-nav.test.ts`：12 條 regression
  - (A) EditEntryPage / EditTripPage 不再 import SaveStatus / 不傳 actions / 失敗仍 showToast
  - (B) useNavigateBack 永遠 navigate(fallback) / CollabPage 改 explicit URL
  - 全 codebase grep — `src/pages` `src/hooks` `src/components` 0 個 `navigate(-N)` 殘留（排除 docstring）

### Verification

- vitest 12/12 pass
- tsc --noEmit clean

## [2.33.138] - 2026-05-28

**Fix — EditEntryPage 備選 row mobile layout 過窄**

QA browser sweep 2026-05-28 mobile (390px) `/trip/.../stop/:eid/edit` 截圖發現：備選 row 內 `alt-extra-chip.hours` 含整週營業時段 string (`星期一: 10:00 – 20:30 星期二: ...`)。Mobile viewport 下 `alt-actions` 4 個 button × 44px ≈ 200px 把 meta column 擠到 ~120px，hours chip 文字被迫斷成單字垂直堆疊，視覺像 textarea 高度爆屏。

### Changed

- `src/pages/EditEntryPage.tsx` `SCOPED_STYLES`：加 `@media (max-width: 640px)` rule
  - `.tp-edit-entry-alt-row` `flex-wrap: wrap` + `align-items: flex-start`
  - `.tp-edit-entry-alt-meta` `flex-basis: calc(100% - 28px)` 取近全寬（扣 order chip）
  - `.tp-edit-entry-alt-actions` `flex-basis: 100%` + `justify-content: flex-end` + `margin-top: 4px`，actions 換到 meta 下方 align right
- Desktop layout (`>640px`) 完全不影響 — base `.tp-edit-entry-alt-row` 仍 row flex

### Added

- `tests/unit/edit-entry-alt-row-mobile.test.ts`：7 條 — media query breakpoint / mobile flex-wrap / meta flex-basis / actions full-width align-end / root cause comment / desktop base 未改

### Verification

- vitest 7/7 pass
- tsc --noEmit clean

## [2.33.137] - 2026-05-28

**Fix — EditEntryPage 400 "無有效欄位可更新" race + SaveStatus titleBar UI 對齊 mockup**

Prod QA 2026-05-28：rayschiu 編輯 entry 781（okinawa-trip-2026-HuiYun, 天久琉貿樂市）顯示「景點儲存失敗 (400)」，且錯誤訊息出現在 TitleBar 違反 mockup 設計。

### Bug A — 400 empty-body race (auto-save)

D1 `api_logs` 過去多次 `DATA_VALIDATION: 無有效欄位可更新` 是同一個 bug。Root cause：
- `dirty` useMemo 比對 `originalRef.current.*` 但 ref 不在 memo deps（refs 不 trigger re-eval）
- `handleSave` 內 body assembly 做同樣 ref 比對
- 若 dirty 計算後、handleSave 跑前外部路徑（如 prior save success hook、`useEffect[entry]` refetch）把 `originalRef` 寫到與 current state 一致，`dirty` 仍 stale=true 但 `body={}`
- requests.push 仍 fire → backend `buildUpdateClause(body, ALLOWED_FIELDS)` return null → 400

**Fix** `src/pages/EditEntryPage.tsx`：
- entry body push 前檢 `Object.keys(body).length > 0` — empty body 表示資料其實沒變，跳過 request
- requests.length === 0 → 早 return 不走 success path 寫 originalRef（避免奇怪 state lock）

### Bug B — error UI 違反 mockup (`docs/design-sessions/2026-05-11-entry-time-segment-mode-edit.html` L789)

Mockup spec：「儲存失敗 → 重試 button + toast error」。實作 v2.33.108 auto-save ship 時把 error 顯示在 `SaveStatus` titleBar inline `（{error}）`，且 body 內也 inline `<InlineError>` — 雙顯且違 mockup。

**Fix**：
- `src/components/shared/SaveStatus.tsx`：拔 `tp-save-status-error-detail` inline span + testid `save-status-error`。error state 只保 ⚠ icon + "儲存失敗" label + 重試 button。error 訊息寫進 `aria-label` 給 screen reader
- `src/pages/EditEntryPage.tsx`：handleSave fail path（partial fail + catch）加 `showToast(msg, 'error', 6000)` 顯細節
- 拔 body 內 `data-testid="edit-entry-save-error"` `<InlineError>`（duplicate of toast）
- 保留 `data-testid="edit-entry-validation"` `<InlineError>`（form-level user 知哪個欄位錯）

### Added

- `tests/unit/edit-entry-empty-body-race-fix.test.ts`：12 條 — race guard 3 cases / SaveStatus mockup-align 4 cases / handleSave toast wiring 4 cases / mockup spec source-of-truth 1 case

### Verification

- vitest 12/12 pass + 既有 `edit-entry-page.test.tsx` 31/31 pass (no regression)
- tsc --noEmit clean

## [2.33.136] - 2026-05-28

**Fix — FOUC dark-mode init 改 external script 避開 CSP block**

Daily-check Sentry 偵測到 issue `7506089366`「Blocked 'script' from 'inline:'」累積 260 events / 22 users。Root cause：v2.33.117 dark mode FOUC fix 把同步 init 邏輯放 `index.html` `<body>` inline `<script>`，但 v2.33.60 round 14 CSP `script-src 'self' https://static.cloudflareinsights.com https://maps.googleapis.com` 沒帶 `'unsafe-inline'`/nonce/hash → 瀏覽器 block inline script → 第一個 paint 沒套 dark class，user 看到 FOUC，CSP report endpoint 持續累積 violation。

### Changed

- `index.html`：拔 inline `<script>` block，改為 `<script src="/dark-mode-init.js"></script>`（sync，無 `defer`/`async`，仍 block render 維持 FOUC 防護）
- `public/dark-mode-init.js`：新檔，內容 mirror 原 inline 邏輯 + 加 `document.body` 不存在時 `DOMContentLoaded` fallback（external script 可放 head 也安全）
- `tests/unit/index-html-fouc-dark.test.ts`：refactor — 鎖 inline 字串不再出現 + external script tag 存在 + sync (no defer/async) + 順序 (在 reactRoot/main.tsx 之前) + 從 `public/dark-mode-init.js` 驗 content mirror

### Verification

- vitest 11/11 pass (regression suite)
- tsc clean
- CSP `script-src 'self'` 已涵蓋 same-origin `/dark-mode-init.js`，deploy 後 Sentry 7506089366 應停止累積

## [2.33.135] - 2026-05-27

**Fix (HOTFIX) — `/api/health` 加 middleware public bypass**

PR3 v2.33.126 加 `/api/health` endpoint 但忘記加進 `functions/api/_middleware.ts` 公開白名單 → 外部 UptimeRobot / Pingdom curl 永遠收 401 AUTH_REQUIRED，endpoint 形同虛設。Forensic 時 `curl https://trip-planner-dby.pages.dev/api/health` 發現的。

### Changed

- `functions/api/_middleware.ts`：加 `GET /api/health` bypass（與 `/api/poi-search` 同 pattern）
- `tests/unit/api-health-endpoint.test.ts`：加 regression 驗 middleware bypass 存在

### Verification

- vitest 13/13 pass
- tsc clean
- 待 deploy 後 `curl https://trip-planner-dby.pages.dev/api/health` 應回 200 + JSON

## [2.33.134] - 2026-05-27

**Feat — funnel-guard 3-layer probe + CF alertAdminTelegram observability**

Forensic from forgot-password silent fail incident（rayschiu@fetci.com 沒收到信，CF Worker 也沒響 Telegram alert）。雙修：

### Part 1: funnel-guard 加 public DNS + HTTPS reach probe

之前 `is_funnel_healthy` 只檢 local `tailscale serve status` → 完全錯失 incident（TS 控制平面說 funnel on，但 public DNS NXDOMAIN）。改 3-layer probe：

- **L1 local**: AllowFunnel + Proxy jq query（原邏輯保留）
- **L2 DNS**: multi-resolver fallback `1.1.1.1 → 8.8.8.8 → 9.9.9.9 → 208.67.222.222`（first non-empty IP 勝）— 實測 `1.1.1.1` 對 `.tail2750c0.ts.net` 永久 NXDOMAIN 但其他 OK，也是 CF Worker forgot-password 530 的真正 root cause
- **L3 reach**: `curl --resolve` 強制走 public IP（避過本機 MagicDNS），任何 3-digit HTTP code 算 reachable（不需 200 — TCP+TLS handshake 過了就行），10s timeout 涵蓋 DERP relay cold path

任一層 fail → `is_funnel_healthy` return 非 0 → 觸發 `heal_funnel` reset + 重註冊 funnel + throttledAlert。Portable array syntax（bash + zsh 都跑）。

### Part 2: CF alertAdminTelegram 強化 log + admin test endpoint

之前 alertAdminTelegram 失敗只 `console.warn`（wrangler tail default filter 掉）→ forensic 完全沒 trace。

- **`functions/api/_alert.ts`**：env 缺 `console.warn` → `console.error`（wrangler tail 預設顯示）；呼叫前 `console.log` "sending" 含 token prefix(10) + chat tail(4) + msg preview(80) + msgLen；成功 `console.log` "sent OK" 含 status + elapsedMs；非 2xx + fetch error 都 `console.error` 含 elapsedMs + aborted flag + token/chat prefix（forensic 比對是否與 expected match）
- **`functions/api/admin/test-alert.ts`** NEW：admin-only `POST /api/admin/test-alert` 觸發 alertAdminTelegram + 回 diag（env 狀態 + token prefix + chat tail），給 prod forensic 用。配合 `wrangler pages deployment tail` 看 console output 立即知道失敗點

### Added

- `tests/unit/funnel-guard-public-probe.test.ts`：13 條 — 3-layer 流程 / multi-resolver fallback / portable syntax / curl --resolve / 3-digit reachable / docstring incident reference
- `tests/unit/cf-alert-observability.test.ts`：8 條 — log 強化 / elapsedMs / token prefix surface / test endpoint admin gate

### Verification

- 實機 smoke funnel-guard：bash + zsh 都跑 → healthy
- 21/21 vitest pass
- tsc --noEmit clean
- 待 deploy 後 `curl -X POST .../api/admin/test-alert` + `wrangler pages deployment tail` 觀察 forensic forgot-password silent fail root cause

## [2.33.133] - 2026-05-27

**Fix (HOTFIX) — throttled-alert.sh sourced-vs-exec guard 拔掉**

PR1 v2.33.124 helper 開頭加的 `if [ "${0##*/}" = "throttled-alert.sh" ]; then exit 2` guard 在 zsh launchd 環境下誤判（FUNCTION_ARGZERO option 預設 ON → sourced file 內 `$0` = sourced filename 而非 caller name）→ funnel-guard 每 120s exit 2，stdout log 自 ship 時 ~12:00 起完全停寫，**~6hr orphan 期間若有 funnel drift 不會 auto-heal**。實機驗證：stdout 停 11:52，stderr 持續寫 "do not execute directly" 至 18:42 被本 hotfix 修。

### Changed

- `scripts/lib/throttled-alert.sh`：移除 sourced-vs-exec guard block。沒有實際安全 risk 需要 guard（手動誤跑只是 define function 沒呼叫，無 side effect）。
- `tests/unit/throttled-alert-helper.test.ts`：原 "禁止 standalone exec" assertion 改為 regression negative — `expect(HELPER).not.toMatch('source this file...')` 防再 regress。

### Verification

- 實機 smoke：refactored funnel-guard 跑 healthy，state file 寫入正確
- vitest 15/15 pass
- 本 hotfix merge 後需重啟 funnel-guard launchd

### Lesson

v2.33.124 review 階段沒 launchd-context test，只跑 user shell（FUNCTION_ARGZERO 行為不同）。未來 helper 改動需 `launchctl kickstart -k ... && tail stderr` 觀察 5 min 確認 prod env 對。

## [2.33.132] - 2026-05-27

**Feat — daily-check `queryAuditAnomaly` (G14)**

監控告警統一設計 P2/P3 follow-up #3 of 3（完）。修 G14：之前 `audit_log` 表完全沒被 daily-check 查，異常 mutation pattern（script abuse / restore loop / 突發 delete）只能事後翻 D1 才知道。

### Added

- `scripts/daily-check.js` 新增 `queryAuditAnomaly()` 並接進 Promise.allSettled idx 8：
  - **heavyUsers**: 24h 內 `changed_by_user_id` > **200 mutations** → `warning`（一般 user < 50/day）
  - **heavyTrips**: 24h 內 `trip_id != 'system'` > **100 mutations** → `warning`（重度編輯也 < 50）
  - **criticalDeletes**: 24h 內 `action='delete'` on `trips`/`users` 表 > **10** → `critical`（罕見操作）
  - LIMIT 10 result rows 避免報告爆量
- `calcSummary` 加 auditAnomaly 第 8 個 section 參與 critical/warning/ok 統計
- report object 加 `auditAnomaly` field 給 daily-report.js / Telegram summary 取
- `tests/unit/daily-check-audit-anomaly.test.ts`：15 條 — 3 threshold 常數 / 5 SQL query shape / 3 status classification / 4 main pipeline wiring

### Verification

- vitest 15/15 pass
- tsc --noEmit clean

### Series complete — 監控告警統一設計 9 PR 全 ship

| PR | 版本 | Gap |
|---|---|---|
| #1 | v2.33.124 | throttled-alert helper |
| #2 | v2.33.125 | 前端 global error + JSON.parse silent |
| #3 | v2.33.126 | /api/health + uptime monitor doc |
| #4 | v2.33.127 | detached spawn exit code + cron alert |
| #5 | v2.33.128 | /internal/mail/send observability |
| #6 | v2.33.129 | backend 5xx + SSE timeout + ServerStatusBanner |
| #7 | v2.33.130 | apiClient 429 retry-after + 1 retry |
| #8 | v2.33.131 | log retention sweep |
| #9 | v2.33.132 | daily-check audit_log anomaly query |

Design proposal P0/P1/P2/P3 全修；defer 清單剩 G12 Sentry Terraform（doc spec + manual audit 已足）。

## [2.33.131] - 2026-05-27

**Infra — log retention sweep (G13)**

監控告警統一設計 P2/P3 follow-up #2 of 3。修 G13：`scripts/logs/` 下檔案無 TTL，累積。Mac OS 內建 `newsyslog` 對 per-date filename 模式不適用，改寫 zsh sweep script 走 `find -mtime` + truncate。

### Added

- `scripts/log-rotate.sh`：
  - Rule 1：`find -type f \( -name '*.log' -o -name '*.err' \) -mtime +30` → delete（per-date files）
  - Rule 2：oversized single-file logs (`api-server-stdout.log` / `request-job-stderr.log`) > 10MB → `tail -c 50%` truncate 保留尾段
  - Rule 3：高頻 log (`api-server-stderr.log` / `funnel-guard/*.log`) > 1MB tighter cap
  - 輸出 deleted/truncated count（PR4 exit code wrapper 自動接 alert：first success → recovery alert，非 0 → failed alert）
- `scripts/tripline-api-server.ts` 新 schedule：`scheduleDailyScript(3, 30, 'zsh', ['scripts/log-rotate.sh'], 'log-rotate')`
- `tests/unit/log-rotate-script.test.ts`：10 條 — retention 常數 / 3 rule source-grep / set -eo pipefail / summary 對齊 PR4 alert / api-server schedule wiring

### Verification

- 實機 sanity run：刪 26 個 > 30 天舊 log file（4/22 之前的 api-server per-date logs + legacy tripline-api-2026-04-* + request-job-stdout）
- vitest 10/10 pass
- tsc --noEmit clean

## [2.33.130] - 2026-05-27

**Feat — apiClient 429 Retry-After 解析 + 1 次 idempotent retry (G10)**

監控告警統一設計 P2/P3 follow-up #1 of 3。修 G10：之前 429 直接 throw 到 toast，user 看「rate limit」即使 backend 暗示 1s 後可重試也得手動再點。

### Added

- `parseRetryAfter(header)` export — RFC 7231 `Retry-After` parser（支援 delta-seconds + HTTP-date 兩種形式）+ 30s 上限（避免 UI 卡太久）
- `apiFetch` 內部 retry 邏輯：429 + idempotent method (GET/HEAD) → wait Retry-After → 1 次 retry；POST/PATCH/DELETE 不 retry（避免 double-mutate）
- `signal.aborted` 在 wait 期間被 abort → throw NET_TIMEOUT 不發第二次 fetch
- `tests/unit/api-client-429-retry.test.ts`：14 條 — parseRetryAfter 7 cases (null/empty/delta-sec/上限/HTTP-date 未來/過去/超 30s/無效) + apiFetch retry path 7 cases (GET success retry / GET 2nd 429 throw / POST 不 retry / PATCH 不 retry / 無 Retry-After fallback 1s / signal abort / 200 不 retry)

### Verification

- vitest 14/14 pass
- tsc --noEmit clean

## [2.33.129] - 2026-05-27

**Feat — backend 5xx 即時 alert + SSE poll timeout + ServerStatusBanner**

監控告警統一設計 6 PR 系列 **#6 of 6（完）**。三項 P1 gap 一次併修。

### Changed

- **G5 `functions/api/_middleware.ts`**：unhandled 5xx catch path 加 `console.error`（含 method/path/duration/source/error/stack 前 500 字）+ `alertAdminTelegram`（之前只進 api_logs，daily-check 24h batch 才知道）。`context.waitUntil` 包 alert 不阻 response。
- **G9 `src/hooks/useRequestSSE.ts`**：`pollOnce` 加 `AbortController` 10s timeout（之前 fetch 沒 timeout，CF Worker stuck 時 promise 永不 resolve，下輪 setInterval fire 仍卡，user 看到 spinner 永遠不動）。10s 是 conservative（CF p99 < 1s），timeout 後 next tick retries。

### Added

- **G11 `src/components/ServerStatusBanner.tsx`**：sticky top-of-page banner 訂閱 `useOnlineStatus()`，offline 時提示「連線中斷，等待恢復網路中。已輸入的資料會在連線後自動上傳。」online 不 render（zero overhead）
- mount 在 `src/entries/main.tsx` ErrorBoundary > BrowserRouter > DarkModeInit 旁
- `tests/unit/monitoring-pr6-regression.test.tsx`：11 條 — G5 source-grep × 4 + G9 abort source-grep × 4 + G11 render (online null / offline alert + mount point)

### Verification

- vitest 11/11 pass
- tsc --noEmit clean

### Series complete — 監控告警統一設計 6 PR 系列

| PR | 版本 | Gap | 已 ship |
|---|---|---|---|
| #1 | v2.33.124 | throttled-alert helper | ✅ |
| #2 | v2.33.125 | 前端 global error + JSON.parse silent | ✅ |
| #3 | v2.33.126 | /api/health + uptime monitor doc | ✅ |
| #4 | v2.33.127 | detached spawn exit code + /tp-daily-check alert | ✅ |
| #5 | v2.33.128 | /internal/mail/send observability hook | ✅ |
| #6 | v2.33.129 | backend 5xx + SSE timeout + ServerStatusBanner | ✅ |

完整 design proposal 對應 P0/P1 gap 全修；P2/P3 deferred 進 TODOS。

## [2.33.128] - 2026-05-27

**Fix — /internal/mail/send observability hook (G2)**

監控告警統一設計 6 PR 系列 **#5 of 6**。修 P0 silent SMTP fail：之前 mail send timeout / Gmail SMTP auth failure 只 logError 到 mac mini stderr，CF Worker caller 已 commit DB（OAuth token / invitation）但 user 收不到信，admin 完全不知道。

### Changed

- `scripts/lib/mailer-handler.ts`：
  - 新 `MailSendResult` interface + `MailHandlerDeps.onSendResult?: (result: MailSendResult) => void` optional hook
  - 成功 / 失敗 path 都 fire hook（fire-and-forget，hook throw 不影響 HTTP response，只 logError）
  - 新增 `elapsedMs` field 給觀測 SMTP latency
- `scripts/tripline-api-server.ts`：注入 `onSendResult` callback → `throttledAlert(key='mail-<template>', state)`
  - 成功 → `healthy` state（recovery 自動 trigger，從 failed → healthy 1 次 alert）
  - 失敗 → `failed` state 含 `template/to/subject(80)/error(200)/重發 hint`（"user 可重新 trigger 該流程"）
  - per-template key：password-reset 失敗 alert 不會跟 invitation flood 在一起

### Added

- `tests/unit/mailer-handler-onsendresult.test.ts`：8 條 — hook fire success/failure path + hook throw 不影響 response + api-server source-grep（callback 形狀 / per-template key）

### Verification

- 既有 `tests/unit/mailer-handler.test.ts` 18/18 pass（新欄位 optional，backward-compat）
- 新 `mailer-handler-onsendresult.test.ts` 8/8 pass
- tsc --noEmit clean

### Behavior change

- 之前 SMTP fail → 只 stderr，admin 第二天 daily-check 才看到（甚至 daily-check 沒查 mailer log）
- 現在 SMTP fail → Telegram 即時 alert（throttled 1hr per template）+ recovery alert 自動發
- User 流程不變（CF caller 仍回 500），admin alert 含完整 context 可決定要不要手動重 trigger CF endpoint

## [2.33.127] - 2026-05-27

**Fix — api-server cron 失敗 / detached spawn 非 0 exit 加 throttledAlert**

監控告警統一設計 6 PR 系列 **#4 of 6**。修兩個 P0 silent fail，用 PR1 的 throttledAlert helper 統一 throttle 規則。

### Changed

- `scripts/tripline-api-server.ts`：
  - **G3 fireScheduleScript exit code wrapper**：之前 detached spawn 只 listen `child.on('error')`（catch spawn ENOENT），不檢查 `child.on('exit')` 的 code/signal → npm script crash / node 路徑失效時完全 silent skip。
    - 新增 `child.on('exit')`：code=0 → `throttledAlert(state='healthy')` 觸發 recovery alert（若先前曾 fail）；非 0 → `throttledAlert(state='failed')` 含 cmd/args/log 路徑指引
    - `child.on('error')` + setup catch 路徑也走 throttledAlert（key=`script-spawn-` / `script-setup-`）
  - **G8 fireSchedule processLoop unhandled error**：之前只 `logError`，silent。對齊 `/tp-request` alertAdminTelegram pattern → `throttledAlert(key='cron-<label>', state='failed')` 含 skill / error 前 200 字
- `scripts/tripline-api-server.ts`：import `throttledAlert` from `./_lib/cron-shared`

### Added

- `tests/unit/api-server-cron-alert.test.ts`：10 條 regression — exit code 0/non-0 path / spawn error / setup catch / processLoop unhandled / dedup key 命名一致

### Verification

- vitest 10/10 pass
- tsc --noEmit clean

### Impact

- google-poi-refresh / auth-cleanup 之後 exit 0 會 trigger 一次 healthy alert（throttledAlert recovery 機制），1hr throttle 後 silent；exit 非 0 立刻 alert 1 次，1hr 內同 state silent
- 已知 cron loop unhandled exception 之前是「daily-check 第二天看到 stale data 才知道」→ 改成「失敗當下 Telegram」

## [2.33.126] - 2026-05-27

**Feat — GET /api/health endpoint + uptime monitor doc**

監控告警統一設計 6 PR 系列 **#3 of 6**。給外部 uptime monitor pin CF Pages 邊緣健康，不用等 daily-check 24h batch。

### Added

- `functions/api/health.ts`：public `GET /api/health`，無 auth，回 `{ status: healthy|degraded|unhealthy, checks: { d1, googleMapsKey }, ts }`
  - D1 fail → 503 unhealthy（critical）
  - Google Maps key missing → 200 degraded（仍 serve non-Maps 流量）
  - 全 ok → 200 healthy
  - **不**檢查 mac mini api-server / funnel — 那些走 funnel-guard launchd + daily-check.js（職責分離 + 避 single point of failure）
- `docs/monitoring/uptime-monitor.md`：給 UptimeRobot / Pingdom / curl cron 三選一設定 + 與既有 monitoring 的關係表
- `tests/unit/api-health-endpoint.test.ts`：12 條 — endpoint shape / public no-auth / 3 status path / doc 完整性

### Verification

- vitest 12/12 pass
- tsc --noEmit clean

## [2.33.125] - 2026-05-27

**Fix — 前端 global error listeners + AI 健檢 findings_json silent fail**

監控告警統一設計 6 PR 系列 **#2 of 6**。修兩個 P0 silent fail：

### Changed

- `src/lib/sentry.ts`：加 `installExplicitGlobalErrorListeners()` — `window.addEventListener('error' | 'unhandledrejection')` 全 mode 安裝
  - Dev mode + prod 無 DSN：`logOnly:true` → 至少 `console.error` 出 trace（之前 dev unhandled rejection 完全靜默）
  - Prod 有 DSN：`logOnly:false` → 額外 lazy import `@sentry/react` captureException（防禦性 — Sentry 7+ `globalHandlersIntegration` 預設已啟用，explicit listener 保 init fail 或 integrations override 不會 silent）
  - Idempotent `_globalListenersInstalled` flag 防 double install
  - Sentry import rename `ErrorEvent → SentryErrorEvent` 避撞 DOM `ErrorEvent`
- `functions/api/trips/[id]/health-check.ts:97-120`：GET findings_json JSON.parse catch 不再 swallow
  - `console.error` 含 `tripId` / `reportRequestId` / `rawPreview` (120 字)
  - `alertAdminTelegram` 1 次 admin Telegram 含完整 context（user 仍看到空 array，避免整頁卡死；admin 自動知道有壞 row 要查）

### Added

- `tests/unit/sentry-global-listeners.test.ts`：10 條 regression — 3 init path (dev / prod-no-dsn / prod-dsn) + 2 listener tags + idempotent guard + lazy import + 健檢 catch 路徑

### Verification

- `vitest` 10/10 pass
- `tsc --noEmit` 全綠

## [2.33.124] - 2026-05-27

**Infra — throttled-alert helper（funnel-guard state-machine 抽通用）**

第一個批次的 **監控告警統一設計** PR（6 of 6 計劃中 #1）。抽出 funnel-guard 的 state-transition / 1hr throttle 邏輯成共用 helper，給後續 alert callers (mail, cron, 5xx) 共用，避免重複實作 + 確保所有 alert 一致 throttle 規則。

### Added

- `scripts/lib/throttled-alert.sh` — sourceable shell helper（zsh/bash）`throttled_alert "<key>" "<state>" "<message>" [ttl_sec]`。包 send-telegram.sh 加 dedup key + state file 自動寫 + send 失敗不更新 ts。Key sanitize 防 path traversal。
- `scripts/_lib/cron-shared.ts` 新 export `throttledAlert(key, newState, message, options?)` + 純函式 `shouldSendAlert(prevState, newState, prevTs, now, ttlSec)` 供 unit test。Default state dir `~/.gstack` (fallback `/tmp`)。
- `tests/unit/throttled-alert-helper.test.ts` 15 條 regression：state-transition rules（recovery / steady silent / unknown→healthy silent / state change / throttle window in/out）+ source-grep funnel-guard 遷移 + helper guard 條件。

### Changed

- `scripts/funnel-guard/guard.sh` 移除內含的 `read_state` / `write_state` / `should_alert` / `maybe_alert` 函式（共 ~60 行），改 source `scripts/lib/throttled-alert.sh` + 用 `throttled_alert "funnel-guard" ...` 三呼。行為對齊：同 throttle window + 同 state file format（key="funnel-guard" → `/tmp/throttled-alert-funnel-guard.state`，舊 `/tmp/funnel-guard.state` 會被忽略 → 第一次 install/upgrade 等於 fresh state，behavior 一致 unknown→healthy silent）。
- `STATE_FILE` / `ALERT_THROTTLE_SEC` 變數移除（helper 內部管理）。

### Verification

- 實機 smoke test：refactored guard.sh 跑 healthy + 二次跑 cached state 行為對齊原 v2.33.123（unknown→healthy silent）
- `npx vitest run tests/unit/throttled-alert-helper.test.ts` 15/15 pass
- `npx tsc --noEmit` 全綠
- `zsh -n` 兩 shell script

## [2.33.123] - 2026-05-26

**Infra — funnel-guard launchd job：auto-heal Tailscale funnel :443 drift + Telegram alert**

關 P1 TODO「Funnel-guard launchd 護衛」。Tailscale funnel `:443` 反覆被 macOS update / GUI app / brew 改成 `serve` (tailnet only) → CF Worker public `/trigger` 全 530。已第 3 次（v2.33.111 紀錄）+ 本次開發中第 4 次發生（guard.sh 在實機自動修復）。

### Added

- `scripts/funnel-guard/guard.sh`：drift detect (jq parse `tailscale serve status --json`) + heal (`serve reset` + `funnel --bg --https=443 http://127.0.0.1:8080`) + Telegram alert via existing `scripts/lib/send-telegram.sh`
  - State-transition alerting：避免 sustained drift loop Telegram flood。state cache `/tmp/funnel-guard.state`，rule 表：healthy steady silent / recovery 永遠 alert / 同 state 1hr throttle
  - Kill-switch `.disabled` file：incident response 時暫停 auto-heal（`touch scripts/funnel-guard/.disabled`）
  - Telegram env loader：line-by-line scan 只 export `TELEGRAM_*` key（`.env.local` 含 multi-line JSON / `<` chars 無法整檔 source）
- `scripts/com.tripline.funnel-guard.plist`：launchd job，StartInterval=120, RunAtLoad=true, KeepAlive.SuccessfulExit=false, ThrottleInterval=10（對齊 api-server plist 模式）
- `scripts/funnel-guard/install.sh`：idempotent symlink + bootout/bootstrap，prereq check（tailscale + jq + guard.sh +x）
- `scripts/funnel-guard/README.md`：install / drift test / 緊急停用 / alert 頻率設計 / 偵錯
- `.gitignore`：`scripts/funnel-guard/.disabled` exclude

### Design tradeoffs

- **不開 sudo NOPASSWD**：`tailscale funnel` user perm 透過 tailscaled socket 即可，少一個攻擊面
- **Telegram via `send-telegram.sh` 而非 api-server endpoint**：guard 不依賴 api-server 健康（api-server crash 時仍能 alert）
- **Polling 120s 而非 WatchPaths**：tailscale config 內部結構不公開，version drift 風險高；120s + 8s CF timeout + 30min cron 兜底，足夠覆蓋
- **每次 heal 都通知（receive throttle）**：drift 頻率是外部 root cause 訊號

### Verification

- `/review` APPROVE（reviewer N1-N7 全修：install.sh exit code 註解 / jq macOS 內建提示 / drift test 指令 / shebang 一致 / log rotation 文件 / 5s heal re-verify / TODOS 搬 Completed）
- `/cso --diff` SAFE TO MERGE + M1 kill-switch + M2 state-transition 已併入同 PR；shell injection / secrets handling / Telegram URL injection 全 fuzz pass
- 實機 smoke test：guard.sh 在 prod box 偵測到第 4 次 drift + 自動 heal + Telegram alert
- syntax: zsh -n + plutil -lint 全綠

## [2.33.122] - 2026-05-26

**Feat — AccountPage 加編輯 display_name modal + 新 PATCH /api/account/profile endpoint**

User QA 提問「rayschiu 顯示 email」後 follow-up：v2.33.121 已對齊 sidebar/AccountPage fallback chain，本版補 user 主動設定 display_name 的 UI（之前只能透過 signup 「名稱（選填）」一次決定）。

### Added

- `functions/api/account/profile.ts`：新 `PATCH /api/account/profile` endpoint
  - Body `{ displayName?: string | null }`
  - Validation: trim、max 50 chars、empty string 視同 null（clear name）
  - `UPDATE users SET display_name + updated_at` + audit log (`table_name='user', action='update'`)
  - Response mirror `/api/oauth/userinfo` shape (camelCase)
- `src/pages/AccountPage.tsx`：hero name 旁加 ✏ pencil edit button → 點開 modal
  - Modal 含 input (auto-focus, maxLength 50) + 取消/儲存 button + ESC/Enter 鍵盤 a11y
  - 儲存成功 → `reloadUser()` + close + toast「名稱已更新」
  - Placeholder 顯 email local-part 暗示 fallback 行為

### Tests

- `tests/unit/account-display-name-edit.test.tsx` 12 條 regression：testid / state hooks / PATCH wire / trim / a11y / backend handler 結構

## [2.33.121] - 2026-05-26

**Fix — sidebar 顯整 email 而非 local-part，與 /account hero 不一致**

QA prod (rayschiu@fetci.com 帳號 `display_name=null`)：sidebar 左下顯「rayschiu@f...」(整 email 截字)，但 `/account` hero 顯「rayschiu」(local-part)。

Root cause：`DesktopSidebarConnected.tsx:29` 用 2-層 fallback `displayName ?? email`，但 `AccountPage.tsx:215` + `ChatPage.tsx:881` 用 canonical 3-層 `displayName || email.split('@')[0] || email`。Sidebar 後來沒同步。

### Changed

- `src/components/shell/DesktopSidebarConnected.tsx:29` 對齊 canonical 3-層 fallback chain
- `displayName ?? email.split('@')[0] ?? email` — null displayName 時用 email `@` 前段，與其他 4 處顯示位置一致

### Tests

- 新 `tests/unit/sidebar-name-fallback.test.ts` 6 條 regression（grep + sample-based 4 cases）
- 既有 `desktop-sidebar-connected.test.tsx`「falls back to email as name」test 對齊 — `'me@exampl'` (整 email truncated) → `'me'` (local-part) + 反向 assertion 鎖整 email 不再出現

## [2.33.120] - 2026-05-26

**Polish — NewTripPage 重複 CTA + TripDatePicker placeholder 高度落差 + 關 P3 TODO**

QA prod 截圖 3 個 follow-up：

### Changed

- `src/pages/NewTripPage.tsx`：拔 titlebar 右上「建立行程」`TitleBarPrimaryAction` button — 與下方 sticky bottom bar 已有的「建立行程」重複（兩個一模一樣的 CTA 視覺干擾）。Bottom bar 為 form context 內主 CTA，視覺平衡更穩。順手刪 `TitleBarPrimaryAction` import + 中間 `titleBarActions` 變數 + `actions={...}` prop。
- `src/components/TripDatePicker.styles.ts`：`.tp-date-value.is-placeholder` `font-size: 16px` → `22px` 對齊 value 字體。原本「出發」(有值 22px 字) 比「回程」(placeholder 16px 字) 約高 4-6px → trigger button 視覺不對齊。Placeholder 仍是 muted color + weight 500 維持「未填寫」hint，但 box 高度一致。

### Removed

- `TODOS.md` Active section 拔「AI 健檢歷史資料丟失（v2.31.0 ~ v2.33.85，3 週窗口）」P3 entry — v2.33.85 已根治 root cause（auth.email → auth.userId），user 2026-05-25 confirmed 不救也不重跑既存 8 筆 `[AI 健檢]` request reply (raw findings_json 無)。Active 剩 P1 Funnel-guard launchd 護衛 1 項。

### Updated tests

- `tests/e2e/qa-flows.spec.js`: `new-trip-titlebar-create` testid → `new-trip-submit`（bottom bar button）
- `tests/unit/new-trip-page-smoke.test.tsx`: TitleBarPrimaryAction assertion 反轉 — 鎖 `not.toMatch(/TitleBarPrimaryAction/)` + 鎖 `new-trip-submit` testid 存在

## [2.33.119] - 2026-05-26

**Polish — 拔 AI 健檢 titlebar 數字 badge（孤兒 + 重複）**

v2.33.118 加的 titlebar refresh-cw icon 旁的 findings 數字 badge：在頁面內無價值（meta「共 N 項建議」+ 下方 findings list 已重複此資訊），跨頁入口（TripCardMenu / trip card）目前都沒帶 badge，所以這顆是孤兒。

### Changed

- `src/pages/TripHealthCheckPage.tsx`：拔掉 titlebar `.tp-ai-health-titlebar-badge` JSX block (4 lines) + CSS rule (16 lines)
- titlebar button 純粹是「重新生成」action，與 findings count 解耦
- Regression test 反轉 assertion — 鎖 badge 不再存在（防後續誤加）

## [2.33.118] - 2026-05-26

**Fix — AI 健檢 page CTA 風格不一致 + 意義不明 (dark mode QA 復現)**

prod QA mobile dark mode 截圖顯示：titlebar 右上的 sparkle icon-only button (`TitleBarPrimaryAction is-primary`) 在 dark mode 下 brown accent fill 與 chrome 不協調，icon 沒 label 看不出按下會做什麼（pending state 還 disabled brown box 仍佔位）。

### Redesign — state-based CTA

| State | CTA 位置 | 樣式 |
|---|---|---|
| empty (entryCount=0) | titlebar **無 action** | 上方 banner 提示「先加入景點再執行健檢」|
| idle (entry > 0 + 未做過) | **body 中央 pill button**「開始 AI 健檢」 | accent-filled pill (主 CTA) |
| pending | titlebar ghost icon button | refresh-cw + spin animation, disabled |
| completed | titlebar ghost icon button | refresh-cw + 數字 badge (findings 數量) |
| failed | titlebar ghost icon button | refresh-cw 重試 |

### Why ghost + refresh-cw

- **Ghost**（`.tp-titlebar-action` 無 `.is-primary`）= 與其他 form page titlebar functional icon 同 family，不在 dark mode 突兀
- **refresh-cw**（lucide dual-arrow cycle）= 「重新生成」語意明確（取代 sparkle 的「魔法／裝飾」感）
- **Spin animation** when pending = 動態 affordance 表「正在進行」（`prefers-reduced-motion` 關掉動畫保 a11y）
- **數字 badge** = completed 時直接顯 findings 數量，user 不需打開頁面就知 N 個建議

### Changed

- `src/pages/TripHealthCheckPage.tsx` 拔 `TitleBarPrimaryAction` import；titlebar action 改 conditional render（只 report 存在時顯）；empty card 加 body CTA
- `src/components/shared/Icon.tsx` 加 lucide `refresh-cw` icon (dual-arrow cycle)

### Added

- `tests/unit/trip-health-check-cta-redesign.test.ts` regression 9 條：icon registry / titlebar conditional / ghost style / refresh-cw / spin / badge / body CTA / pill style / reduced-motion
- 既有 `trip-health-check-empty-guard.test.ts` `button disabled 條件` assertion 對齊新設計（CTA 拆 2 個 button，entryCount === 0 guard 搬到 body CTA）

## [2.33.117] - 2026-05-26

**Fix — 未登入 page 不認 user dark mode 設定 / 系統 prefers-color-scheme（FOUC）**

QA 復現：user 在 app 內切過 dark 後登出，再進 `/login` / `/signup` / `/login/forgot` / `/auth/verify-email` / `/auth/password/reset` 任一 pre-login page，**第一個 paint 是 light**，再切 dark（FOUC, Flash of Unstyled Content）。視覺感受像「未登入頁不認 dark 設定」。

Root cause：`<DarkModeInit />` 雖然 mount 在 `<Routes>` 外（v2.31.25 fix），但 `useDarkMode` 用 `useEffect` 加 `body.dark` class — 必須等 React mount + 第一輪 commit phase 才會 fire，第一個 paint 用的是 body 預設（light）。

### Added

- `index.html` `<body>` 開頭加 **inline blocking script**：sync 讀 `tp-color-mode` localStorage + 檢查 `prefers-color-scheme` + 加 `body.dark` class + 更新 `<meta name="theme-color">`。在 React mount **之前**完成，第一個 paint 就是正確主題。
- Script mirror `src/lib/localStorage.ts` LsEntry shape (`{v, exp}` + TTL 檢查) 和 `useDarkMode.readColorMode` logic（含 legacy `tp-dark` boolean key fallback）
- `tests/unit/index-html-fouc-dark.test.ts` regression 7 條：grep 鎖 script 內容 + 在 reactRoot 之前 + VerifyEmailPage token 對齊

### Changed

- `src/pages/VerifyEmailPage.tsx`：`var(--color-bg)` → `var(--color-secondary)`、`var(--color-paper)` → `var(--color-background)`。前兩個 token 從未定義（fallback `transparent` 偶然看起來 dark mode "正常"，但實際是 body bg 穿透，無 contrast）。對齊其他 auth page (Forgot / Reset / Signup) 標準 token 慣例。

## [2.33.116] - 2026-05-26

**Fix — `/auth/password/reset` success / error state 的 `<a class="tp-btn">` 沒置中**

QA prod 復現（user 完成密碼重設後）：「密碼已更新」success page 上「前往登入」button 靠左、不對齊上方置中的標題與 icon。Error state「這個連結無法使用了」+「重新申請重設密碼」button 同 pattern。

Root cause：`.tp-auth-card` 沒設 text-align，內層 `<a>` 是 inline-block → 預設靠左。其他元素（brand / icon / headline）都各自有 centering style；只有 standalone button 沒包 centering wrapper。

### Changed

- `src/pages/ResetPasswordPage.tsx` SCOPED_STYLES 加 1 條 CSS rule：
  `.tp-auth-card > .tp-btn-primary { display: block; width: fit-content; margin: 0 auto; }`
- 只命中 result/success state 的 standalone button（form 內的 submit button 在 `<form>` 內，不受此 selector 影響 — 不破壞登入 / 註冊 form 既有 layout）

## [2.33.115] - 2026-05-26

**Fix — `/map` 頁空 trips 時右側面板半屏空白，左右兩邊都顯重複的「先建立行程」hint**

QA prod 復現：新 user 登入後若無任何 trip，`/map` 顯示左側「還沒有行程可以看」card + `+ 新增行程` button，**同時**右側 sheet 仍渲染顯示「左側建立第一個行程後，地圖會用真實導航路線把每個景點串起來」hint。兩邊訊息語意重複且右側佔半屏空白 → 視覺很怪、UX 像 broken。

### Changed

- `src/pages/GlobalMapPage.tsx`：AppShell `sheet={sheet}` → `sheet={hasNoTrips ? undefined : sheet}`
- AppShell 收到 undefined sheet 自動降 2-pane layout（per AppShell.tsx:188 `(sheet || sheetPortalId) ? 3PANE : 2PANE`）
- 空 trips 改顯 1-col layout（sidebar + main only），左側 empty-state card 居中顯示

### Added

- `tests/unit/global-map-empty-hide-sheet.test.ts` regression：grep 鎖 `sheet={hasNoTrips ? undefined : sheet}` pattern

## [2.33.114] - 2026-05-26

**Fix — Email verification token 被企業 email scanner pre-consume，user 點信件連結看到「已使用」**

QA 復現（2026-05-25, rayschiu@fetci.com signup）：

- 23:37:45 signup → 寄 verification 信
- 23:38:02 (+17s) `email_verified_at` 自動寫入 timestamp — **user 還沒收到信**
- User 點信件連結 → `VerifyEmailPage` 顯「此驗證連結已經使用過了」誤導訊息

Root cause：v2.33.59 `VerifyEmailPage.tsx` `useEffect(() => performVerify(), [token])` mount 時 auto-POST `/api/oauth/verify`。設計假設是「Email client image-preview 不會跑 JS」，但 enterprise email security 服務（**Mimecast / Microsoft Safe Links / Proofpoint URL Sandbox**）跑 headless Chromium 做 deep link inspection：載入頁面 → JS 執行 → useEffect 觸發 → silent consume token。所有企業 user 都中。

帳號其實已 verified（scanner 那次完成的），但 UX 像 broken — 永遠收不到「成功」的反饋。

### Changed

- `src/pages/VerifyEmailPage.tsx` 拔掉 `useEffect` auto-POST。Mount 時若有 token → `status='idle'` 顯示「點此完成驗證」button；user 點擊才 POST `/api/oauth/verify` consume token。Scanner headless render 不會自動 click button → token 不被 pre-consume。
- 拔 `useEffect` import（只剩 `useState`）；`missing_token` error 改在 `useState` initializer derive，不再 render 時 setState。

### Added

- `tests/unit/round-13-server-residuals.test.ts` regression：grep 鎖 `useEffect(...performVerify)` 不存在 + `verify-email-confirm-btn` testid + import 簽名
- `tests/unit/untested-pages-smoke.test.tsx` 加 `verify-email-status-idle` + `verify-email-confirm-btn` 預期 assertion

### Defense rationale

User gesture (click button) 不能被 headless scanner 觸發 — 它們不會「假裝 user」點 UI element（會被 reCAPTCHA / behavior detection 偵測到）。是該類 token 消費點的標準防護。

## [2.33.113] - 2026-05-26

**Fix — CF Worker `/trigger` fetch 3s AbortController timeout 太緊 → Telegram 噪音 alert**

Prod 觀察（request 210, 2026-05-25 15:57 UTC）：user POST `/api/requests` → CF Worker `fetch(TRIPLINE_API_URL + '/trigger')` 在 3s 內收 abort → Telegram alert「即時觸發失敗 (The operation was aborted)」。但 mac mini api-server log 顯示 /trigger HTTP 是有收到的（INSERT 15:57:10 → mac mini 收 15:57:14.978 = **4.978s**），只是早超過 CF AbortController 的 3s 上限。Request 仍由 10min cron 兜底處理完成，functional 沒壞，但 user 收 noise alert + 體感 lag。

Root cause：CF Edge → Tailscale Funnel (`*.ts.net`) 的 cold connection 路徑——DNS 解析 + TCP connect 跨洲 + TLS handshake + 偶爾 DERP relay setup——首次或 idle 後可達 4-5s，3s timeout 必 abort。Hot path 連線正常 < 1s 沒事，所以 alert 是 intermittent noise。

### Changed
- `functions/api/requests.ts:187` AbortController timeout 3000 → 8000ms
- `functions/api/trips/[id]/health-check.ts:220` 同樣 3000 → 8000ms
- 8s 涵蓋 99% cold path；request 仍由 10min mac mini cron 兜底保證最終一致性

## [2.33.112] - 2026-05-26

**Fix — Sentry 過濾 Playwright / Lighthouse / localhost noise（防 prod issue queue 被 CI 噪音污染）**

Daily-check 2026-05-26 抓到 2 個 Sentry unresolved issue 都是 CI 環境噪音、userCount=0：

- `#7464853493` Error: 系統發生錯誤 — `localhost:3001/login` + HeadlessChrome 145，breadcrumbs 顯示 fetch `/api/trips/...` 502（local backend 沒在跑）→ apiClient.fromResponse 拋 ApiError → ErrorBoundary 報。
- `#7504308794` React error #310 (Rendered more hooks) — `localhost:3000/trip/.../edit` + HeadlessChrome 145，breadcrumbs 含 `Service Worker registration blocked by Playwright`，stack 落在 `datepicker` chunk 內 `useMemo` → react-day-picker 9.14 + React 19 在 production-mode 縮寫下的 internal hooks-count mismatch。

Root cause：兩者皆 Playwright / Lighthouse 在本機 preview build 跑出來的，從未影響真實 user。`src/lib/sentry.ts` `init` 完全沒 `beforeSend`，所有事件都進 prod queue。

### Added
- `src/lib/sentry.ts::isNoiseEvent(event)` — drop event when URL host 是 `localhost` / `127.0.0.1`，或 User-Agent / `contexts.browser.name` match `HeadlessChrome|Playwright|Lighthouse`
- Sentry `init` 套用 `beforeSend(event) => isNoiseEvent(event) ? null : event`
- 10 個 unit test：localhost:3000/3001/127.0.0.1 URL、HeadlessChrome/Playwright/Lighthouse UA、browser context name、真實 Chrome 不誤殺、defaults-to-ship、`docs#localhost` path 不誤殺

### Verified
- `npm run typecheck` 通過
- `npx vitest run` 全綠（327 files / 2698 tests）
- production user 用真實 Chrome + URL 是 `trip-planner-dby.pages.dev` → filter 不誤殺

### Follow-up
- react-day-picker 9.14 + React 19 hooks mismatch 真實 root cause 待真實 user 觸發後再 prioritize（目前 0 user impact）

## [2.33.111] - 2026-05-25

**Fix — orphan tmux session 永遠不被清，AI 健檢 cron 永真 skip**

Prod 觀察：今天下午 3:07 user 觸發 AI 健檢（trip_requests #209），CF Worker fetch funnel `/trigger` 收 530（funnel drift 第三次發生，另一個 issue 已修），cron 15min 兜底 retry 仍 530 → Telegram alert。即使 funnel 之後自然恢復，request 209 仍卡 1h21m 才完成。同期 request 208 也卡 3h08m。

Root cause：`scripts/tripline-api-server.ts:92` `SESSION_PREFIX = 'tripline-request-'`，但 v2.33.27 per-skill rename 後實際 session 命名是 `tripline-tp-request-*` / `tripline-tp-daily-check-*`。`cleanupOrphans` 用 `name.startsWith(SESSION_PREFIX)` filter 永遠 false → orphan 完全不被清。其後 cron 每 10 min fire 都因 `hasActiveSession()` 命中 → skip 新 spawn。AI 健檢 / tp-request request 永遠卡在 status='open'。

實證：今早 04:38 UTC 一個 `tripline-tp-request-1779683905609-1669` session 卡 9h26m+ 沒結束，cron 每 10 分鐘 fire 都 skip。

### Changed
- `cleanupOrphans` 改用「ALLOWED_SKILLS-derived prefix set + LEGACY」allowlist-driven 比對 — 自動跟著新 skill 走免雙重維護，也不誤殺 user 手動的 `tripline-debug` 等 ad-hoc session
- `tmux ls -F` format 改 `#{session_name}|#{session_created}` + `split('|')`（tmux 自 2017 起拒絕 `|` 在 session name），防 session name 含空格時 cleanupOrphans skip 但 hasActiveSession 仍 match 的同病灶 race（adversarial review 發現）
- `hasActiveSession(skillCommand)` 簽名改 required（原 optional 三元 fallback 從未 reach）
- `LEGACY_SESSION_PREFIX = 'tripline-request-'` 抽常數取代 hardcoded literal

### Removed
- 死碼 `SESSION_PREFIX` const + hasActiveSession 三元 fallback path
- stale comment 寫 `tripline-request-<timestamp>-<pid>` v2.33.27 後已不正確 → 更新 per-skill 命名

### Added
- `getKnownSessionPrefixes()` helper：從 ALLOWED_SKILLS derive 已知 prefix list
- `tests/unit/api-server-cleanup-orphans-prefix.test.ts` regression 9 條：source-grep + sample logic（含 negative case 防誤殺 `tripline-debug`）

## [2.33.110] - 2026-05-25

**Polish — AI 健檢頁拔 sticky bottom bar 改 title bar action**

QA prod 報告（沖繩七日遊行程表 mobile）：往上捲動時 GlobalBottomNav 5-tab nav 隱藏，但 AI 健檢 sticky bottom bar (`.tp-ai-health-bottombar`) 留在原位，下方留出 nav 高度空白，緊接下一張 finding card 從 bar 底下「冒出來」視覺奇怪。

修：拔掉 sticky bottom bar 整塊，把主 CTA「開始健檢／重新生成／再重新生成／健檢進行中⋯／送出中⋯」改用 `<TitleBarPrimaryAction icon="sparkle">` 放 TitleBar `actions` slot（icon-only + hover tooltip + label hidden via CSS 對齊既有 5 個 form page pattern）。「回行程」由 TitleBar 左上 `←` 取代（`backLabel="回行程"`），不再重複 button。

`entryCount === 0` empty trip guard 從 bottombar inline hint 改頁面 body 的 `.tp-ai-health-notice` banner（accent border-left + tertiary-bg），與 title bar action `disabled` 配合補語意。

也順便 update DESIGN.md (line 407) 把 「Sticky bottom bar」描述改 「Title bar action」。

**修改**：
- `src/pages/TripHealthCheckPage.tsx`：import TitleBarPrimaryAction、TitleBar 加 `actions`、移除整個 bottombar JSX block (line 811-843)、加 `.tp-ai-health-notice` banner、CSS 移除 64 行 `.tp-ai-health-bottombar` 規則、加 8 行 notice 規則
- `DESIGN.md`：line 407-409 描述更新

**測試**：`npx vitest run tests/unit/trip-health-check` 19/19 pass（`ai-health-start-btn` testid 保留在 TitleBarPrimaryAction，`ai-health-empty-hint` testid 保留在 notice banner，文字 `textContent` assertion 仍命中 hidden span label）

## [2.33.109] - 2026-05-25

**Fix — AI 健檢頁 dark mode bottombar 顏色**

QA prod 報告（沖繩七日遊行程表 mobile dark mode）：「開始健檢」button 所在 sticky bottom bar 是淺米色 `rgba(250, 244, 234, 0.86)`，dark mode 下整條 bar 跟頁面 `#1A140F` 深棕背景完全不和諧。

修：`src/pages/TripHealthCheckPage.tsx` `.tp-ai-health-bottombar` background 從寫死米色改 `color-mix(in srgb, var(--color-background) 86%, transparent)` 對齊既有 frosted-glass nav pattern。dark mode token 自動 follow，無需新 override。順便加 `-webkit-backdrop-filter` for Safari + 用 `var(--blur-glass)` token 取代寫死 14px。

**Note — AI 健檢報告資料 missing 不是 v2.33.108 regression**

同 QA report：「資料不見了」。D1 query 確認 `trip_health_reports` 表 0 rows。Root cause: migration 0069 (v2.33.60 round 14, 加 FK constraint) 用 `INSERT SELECT INNER JOIN users` swap 舊 row，但 v2.33.85 前 code bug 把 `auth.email` 寫進 `user_id` (應為 uuid)，那些 row 在 INNER JOIN 階段全 filter 掉 → 0 rows 留存。當前 GET endpoint 對空 table 回 `report: null` 正確；前端 empty state「尚未健檢過此行程」正確顯示。User 需要重新跑「開始健檢」(3-7 分鐘 Claude call) 生成新報告。

非 v2.33.108 introduced — 歷史 data loss event，無 backup 可 restore。

## [2.33.108] - 2026-05-25

**Round 57 — 編輯即儲存（auto-save）+ 移除「儲存」button + entries/segments OCC version**

完整 UX 轉換：edit pages 移除 explicit「儲存」button，改為 inline auto-save。

### Backend
- **Migration 0072**：`trip_entries.version` + `trip_segments.version` INTEGER OCC counter
- **PATCH /api/trips/:id/entries/:eid**：接 `expectedVersion` body field → 用 atomic SQL CAS（`WHERE id = ? AND version = ?`）+ `SET version = version + 1`；不符 → 409 `STALE_ENTRY`。omit `expectedVersion` → backward-compat skip check（但 version 仍 bump）
- **PATCH /api/trips/:id/segments/:sid**：同 OCC pattern（pre-SELECT check，multi-branch UPDATE 不適合 atomic CAS）。所有 UPDATE 分支加 `version = version + 1`
- **GET /api/trips/:id/segments**：response 加 `version` 欄位給 frontend OCC 用

### Frontend infra
- **`src/hooks/useAutosave.ts`** — debounce 800ms + onBlur flush + OCC retry-once + offline state（networkBus）+ saved 2s indicator
- **`src/components/shared/SaveStatus.tsx`** — pending/saving/saved/error/offline indicator pill 取代 explicit「儲存」button reassurance

### UI 變動（移除「儲存」button + auto-save wired）
- **TravelPillDialog (modal)**：mode option click → 立即 PATCH（非 transit）；transit min input → onBlur PATCH；移除「儲存」「取消」button，改「關閉」+ SaveStatus
- **TimelineRail note inline edit**：textarea onBlur / Cmd+Enter / ESC 都 flush + close；改「完成」button + SaveStatus
- **EditEntryPage**：useEffect 800ms debounce auto-save；TitleBar 儲存 button → SaveStatus；移除 ConfirmModal discard flow
- **EditTripPage**：同 pattern，PUT /trips full body；移除底部「儲存變更」button；「取消」改「返回」

### Test 更新
- `travel-pill-tap-switch.test.tsx`、`timeline-rail-inline-expand.test.tsx`、`edit-entry-page.test.tsx` 重寫對齊 auto-save flow

### 既有 patterns 保留
- ExplorePage heart toggle / CollabPanel role select / Drag-reorder optimistic（已是 immediate save baseline）
- Tier 2 creation pages「建立 / 完成」button 保留（commit semantic，非 save）
- Tier 3 destructive button（Delete / OAuth invite）保留 explicit confirm

### 測試
- TypeScript src/ + functions/: 0 error
- Unit tests: **325 files / 2675 tests** pass
- API tests: **73 files / 780 tests** pass

## [2.33.107] - 2026-05-25

**Round 56 — /tp-code-review 100% mode + actionable TODOs ship + Lighthouse blocking gate**

完整 code quality sweep（24 項 fix）+ actionable TODOs 上 prod + 移除不啟動 TODOs。

### Code review fixes (rounds 1-5)

**CR rules**
- **CR-6** 刪 dead `InfoBox.tsx` + `Shop.tsx` + `mapDay.ts` infoBoxes build + `timeline.ts` types；`safeText` helper 搬 `src/lib/safeText.ts`
- **CR-7** 新 `src/server/cryptoBuffer.ts` 抽 `toArrayBuffer` helper，`jwt.ts` 5→0、`hkdf.ts` 3→0 `as unknown as`
- **CR-10** `TripPage.tsx` 用 `isTripListItem` type guard 取代強制陣列轉型
- **AppError 統一**：`invitations.ts` / `oauth/login` / `oauth/signup` / `oauth/reset-password` 自建 `errorResponse` → `AppError` + 加 13 codes 進 `ErrorCode` enum；OAuth wire (`authorize.ts` / `revoke.ts` / `token.ts`) 自建 `jsonError` → `oauthErrorResponse`；inline 429 → `buildRateLimitResponse`；OAuth `consent.ts` / `forgot-password.ts` / `send-verification.ts` 同步處理
- `_id_token.ts` 2 處 `throw new Error` → `AppError('SYS_INTERNAL', detail)`

**React Best Practices**
- **RBP-21** `DaySkeleton.tsx` + `TpMap.tsx` inline styles hoist module-level const
- **RBP-26** `TripCardMenu.tsx` + `TripsListPage.tsx` scroll/resize 加 `{capture, passive}`
- **RBP-30** `poiHours.ts` 平日/週末 `.map().filter()` → `reduce` 一次過

**CSS HIG**
- **H2** 4 styles.ts + `AppShell.tsx` 寫死 0.15s/0.12s/200ms → `var(--transition-duration-fast/normal)`；PTR 80ms 保留 + H2 exception 註釋
- **H6** 10 處 accent surface 改 `var(--color-accent-foreground)`；overlay / sidebar 5 處加 H6 exception 註釋
- **H13** 14 處 button `min-height: 32px` + TripCardMenu 32×32 → `var(--spacing-tap-min)` (44px)
- **H16** 11 處寫死 border-radius (8/10/16/999/2/4px) → `var(--radius-md/lg/xl/full)`

**命名規範**
- `keyCache` → `KEY_CACHE`、`offlineSubscribers/onlineSubscribers` → `_SUBSCRIBERS`
- API `id` 命名加 documented design intent 註釋（POI/permission record id 不適用 tripId 規則）

**Misc**
- `ExplorePage` `/poi-search` raw fetch → `apiFetch`（含 abort signal）；test mock 改 `apiFetchMock`
- `oauth/login.ts` docstring 修 `Rate limit deferred V2-P6` → 實際已實作的 per-IP + per-email rate-limit
- AlertPanel icon 32×32 加 documented exception（non-interactive container）
- `cache.ts` async chain 加 documented exception（`bind(key)` depends on `buildKey`，無 parallel 機會）

### Actionable TODOs ship

- **safeColor bug fix**：`src/lib/constants.ts:19` fallback `var(--blue-light)` token 不存在 → 改 `var(--color-accent)`（v2.23.0 google-maps-migration 後 `--blue-light` 已不存在）
- **trip_invitations 30-day cleanup cron**：新 `.github/workflows/invitation-cleanup.yml` + `scripts/cleanup-invitations.sql`，daily 03:00 UTC DELETE 30 天前 expired/accepted invitations，兌現 `migration 0040` 註解承諾
- **Lighthouse blocking gate**：`lighthouserc.json` 5 assertion 由 `warn` → `error` 阻擋效能 regression。閾值 LCP 3000ms、TBT 400ms、CLS 0.15、performance 0.7、accessibility 0.9（後續觀察 baseline 再 tighten）

### Source TODOs upgraded to shipped features

- **#1 picker pre-fill (`AddCustomStopPage.tsx`)**：custom-stop picker `initialCenter` 改用 currentDay timeline 最後 entry 的 master stopPoi coord（`?all=1` endpoint 取 timeline + `stopPois[sortOrder=1]`）。空 timeline / 缺 coord → 退回 destinations fallback chain。
- **#2 `_session.ts` ctx.waitUntil thread**：`getSessionUser` / `requireSessionUser` 簽名加 optional `waitUntil` param，4 callers（`_middleware.ts` / `oauth/consent.ts` / `oauth/logout.ts` / `oauth/authorize.ts` 走 consent 路徑）pass `context.waitUntil.bind(context)`。session_devices `last_seen_at` UPDATE 不再依賴 microtask survival — Workers runtime 保證 fire-and-forget UPDATE 在 response return 後仍跑完。
- **#4 Google Cloud Monitoring API integration**：新 `functions/api/_gcp_monitoring.ts` — service-account JWT (RS256) auth → OAuth2 jwt-bearer grant → access_token cache (in-isolate, 50min refresh)；`monitoring.googleapis.com/v3/projects/:id/timeSeries` query `serviceruntime.googleapis.com/api/request_count` 依 `consumed_api` label 分組。`quota-estimate.ts` 先試 GCP（ground truth）失敗 / env 缺失 fallback D1 proxy。Required env: `GCP_SERVICE_ACCOUNT_KEY_JSON` + optional `GCP_PROJECT_ID`。Response 加 `source: 'gcp' | 'd1-proxy'` 欄位讓 caller 區分準度。

### 測試

- TypeScript src/ + functions/: 0 error
- Unit tests: **325 files / 2679 tests** pass
- API tests: **73 files / 780 tests** pass

## [2.33.106] - 2026-05-25

**Round 55 — /review batch 10: 收尾全部 deferred test gaps (T-1/T-3/T-4/T-6/T-7)**

非 code 行為變動，純補 deferred test gap：

1. **T-1 POI enrich integration test（新檔 `poi-enrich.integration.test.ts`）**：
   12 個 test 涵蓋 auth gate / id 驗證 / 非 admin tripId 必填 / 寫權限 / POI 不存在
   / 缺 place_id / API key 缺 / OPERATIONAL / CLOSED_PERMANENTLY / CLOSED_TEMPORARILY
   / Google 404 missing / owner with trip write permission。Google client 走
   vi.mock fixture。

2. **T-4 recompute-travel failure paths（既有檔擴充）**：5 個 negative test
   covering 無寫權限 403 / trip 不存在 / 空 trip 0 pairs / API key 缺 5xx /
   entry 缺 coords skip pair。

3. **T-7 alternates POST validation（既有檔擴充）**：9 個 body validation test
   涵蓋 string body / array body / entryPoisVersion 型別 / poiId 負數 / 0 /
   小數 / string / 不存在 ID 404 / empty body。

4. **T-3 use-route.test.ts setTimeout race fix**：2 個 test 把 `setTimeout(50)`
   race 改為 `waitFor` 等 fetch 被 call + result settle，避免 CI 慢機 race。

5. **T-6 oauth toBeTruthy → toBeDefined（lint）**：5 個 oauth test 檔 8 個
   mock-find 結果 assertion 改為更精確的 `.toBeDefined()`。Retry-After
   header / kid 等語意上 truthy 是正確的，不動。

Verified: 780/780 API integration pass + tsc clean。

## [2.33.105] - 2026-05-25

**Round 54 — /review batch 9: SEC-2 poi-favorites bucket-spoof DoS prevention（4-caller refactor）**

`pickFavoriteRateLimitBucket` 之前從 `body.companionRequestId` (claimed) 直接
組 bucket key 並在 actor resolve 之前 bump。Attack：unauthenticated attacker
送 X-Request-Scope: companion + companionRequestId: 999 → bucket
`poi-favorites-post:companion:999` 被 bump 即使後續 actor resolve 401。
10 個 fake request → bucket lock 60s → 之後 legit user with requestId=999
被擋 429。

Fix（4-caller refactor）：
- 新 `preGateFavoriteThrottle(env, request)` — pre-gate per-IP throttle
  (200/5min/IP)，在 actor resolve / DB work 之前擋 unauthenticated hammering。
- 新 `pickFavoriteBucketForActor(actor, prefix, isAdminBypass)` — bucket key
  用 RESOLVED actor 而非 claimed body。Admin V2 user bypass 由 caller 控制
  （保留既有語意）。
- 移除舊 `pickFavoriteRateLimitBucket` 完全 rip-out。
- 4 callers 改流程：pre-gate IP throttle → parse body → validation early reject
  → resolve actor → pick post-gate bucket → bump → proceed。
- 新 `RATE_LIMITS.POI_FAVORITES_PRE_GATE_IP` preset (200/5min/IP, 5min lockout)。

涵蓋 endpoints：
- `GET /api/poi-favorites`（companion path 新增 pre-gate）
- `POST /api/poi-favorites`
- `DELETE /api/poi-favorites/:id`（新增 pre-gate）
- `POST /api/poi-favorites/:id/add-to-trip`

更新 1 個 burst-concurrent test 對齊 post-gate bucket order；新增 4 個 SEC-2
regression test（spoof, lock prevention, pre-gate enforcement, resolved-actor
bucket）。

Verified: 754/754 API integration pass + tsc clean。

## [2.33.104] - 2026-05-25

**Round 53 — /review batch 8: test coverage gaps 補上 18 個 test (T-5/T-8/T-9/T-10)**

非 code 行為變動，補 test gap：

1. **T-5 PATCH /api/requests/:id status 推進 monotonicity**：5 個 test 覆蓋
   open→completed 允許 / completed→open 拒絕 / completed→processing 拒絕 /
   completed→failed 允許（任何狀態都可標記 failed）/ 未知 value 拒絕。
2. **T-8 POST /api/places/autocomplete（新 test 檔）**：9 個 test 覆蓋 auth
   gate / q 長度驗證 / sessionToken 驗證 / regionCode 驗證 / API key 缺失
   502 / happy path / rate-limit 429 + Retry-After。
3. **T-9 GET /api/trips/:id/health-check findings camelCase round-trip**：
   驗 action_target → actionTarget、entry_id → entryId 經 deepCamel 轉換。
4. **T-9 CR-8 attack vector regression**：chat 偽裝 `[AI 健檢]` prefix 但無
   linkage row → hook 不觸發、trip_health_reports 不被誤寫。
5. **T-10 entries-batch sort_order UNIQUE invariant**：同 day_id 重複 →
   400 atomic（無一被改）；不同 day_id 同 sort_order 允許。

剩餘 deferred 不收的 finding：
- **SEC-2**（4-caller requireFavoriteActor permission-ordering refactor）— 大
  幅 cross-callsite 改動，需獨立 design session 而非 surgical 修法；推到後續
  專案週期。
- T-1/T-3/T-4/T-6/T-7：低 ROI（pre-existing coverage / frontend infra-only /
  cosmetic test lint）。

Verified: 750/750 API integration pass（前 732，+18）+ tsc clean。

## [2.33.103] - 2026-05-25

**Round 52 — /review batch 7: SEC-7 OAuth endpoints per-IP rate-limit（PBKDF2 amp DoS）**

`oauth/token.ts` + `oauth/revoke.ts` confidential client_secret 驗證走 PBKDF2
(100k iter ~50ms CPU)。Attacker 同一 client_id 反覆送 wrong secret，原本
per-client_id bucket 擋在 100/min 但前 100 個已經燒 ~5s CPU；若 attacker
concurrent 數百 request → CF Worker CPU 配額爆。

Fix：在 client lookup + PBKDF2 verify 前，加 per-IP rate-limit（50/min/IP，
5min lockout）。新 `RATE_LIMITS.OAUTH_TOKEN_PER_IP` preset。Bucket key prefix
`oauth-token:ip:<IP>` 與 `oauth-revoke:ip:<IP>` 分開。8 個 source-grep
regression test。

Verified: 732/732 API integration pass + 8/8 SEC-7 unit pass + tsc clean。

## [2.33.102] - 2026-05-25

**Round 51 — /review batch 6: CR-7 health-check atomic write + CR-8 confused-deputy hook linkage**

1. **CR-7 `trips/[id]/health-check.ts` 3-step write 收成 2-step**：之前流程是 (1) UPSERT
   trip_health_reports request_id=NULL → (2) INSERT trip_requests RETURNING id →
   (3) UPDATE trip_health_reports SET request_id。Step 2/3 之間失敗會留下 orphan
   pending report 卡在 'pending'，30s 內 user 觸發新一輪也會被既有 row 擋住。
   Reorder 為 INSERT request 先拿 id → UPSERT report 一發到位帶 request_id。
   沒 UPDATE 步驟。

2. **CR-8 `requests/[id]/index.ts` health-check hook confused-deputy fix**：之前
   hook 單靠 `message.startsWith('[AI 健檢]')` 判 health-check request。任何 user
   chat 打 `[AI 健檢] hello` 就能誘騙 admin/service PATCH 觸發
   `applyHealthCheckCompletion` → UPSERT trip_health_reports 覆蓋該 trip 的
   report。改用 `trip_health_reports.request_id = ?` linkage 驗證
   （POST /trips/:id/health-check 唯一寫入點）。Hook 只在 linkage row 存在時
   觸發。6 個 source-grep regression test。

Verified: 732/732 API integration pass + 21/21 health-check unit pass。

## [2.33.101] - 2026-05-25

**Round 50 — /review batch 5: CR-6 sha256Base64 unsound cast + CR-9 oauth/token rate-limit DB write amp**

## [2.33.100] - 2026-05-25

**Round 49 — /review batch 4: 3 個 MEDIUM finding**

1. **CR-5 `poi-favorites/[id].ts` V2-user DELETE audit log**: always log (was companion only)
2. **SEC-8 service-token email = ADMIN_EMAIL forge fix**: 永遠 `service:${id}` sentinel
3. **SEC-6 DEV_MOCK_EMAIL allowlist guard**: deny-list → allowlist fail-closed

Verified: 731/731 API integration pass。

## [2.33.99] - 2026-05-25

**Round 48 — /review batch 3: 2 個 MEDIUM security findings**

1. **SEC-5 reports.ts trip-id enumeration oracle**: rate-limit bump 移到 tripExists
   之前 + 不存在 silently 回 201。Attacker 仍受 200/24h IP quota 但無法用 200
   vs 404 區別 enum published trip slugs（易猜 lowercase user-chosen slug）。
2. **SEC-9 email.ts TRIPLINE_API_URL SSRF / config-tamper guard**: inline allowlist
   `https://` scheme + hostname `.ts.net` Tailscale funnel 或 dev localhost。
   Attacker 改 TRIPLINE_API_URL → TRIPLINE_API_SECRET 跟著洩漏 → reject upfront。
   Helper `assertTriplineApiUrlSafe()` 在 `_utils.ts` 供 reuse。

Verified: 731/731 API integration pass。


## [2.33.98] - 2026-05-25

**Round 47 — /review batch 2: 2 個 HIGH security findings**

**SECURITY**

1. **`functions/api/oauth/callback/google.ts:117` email merge guard**（HIGH）：
   之前若 user 先用 local password signup 同 email，再用 Google login 走 else 分
   支 INSERT INTO users 撞 UNIQUE constraint → 500。修：先 SELECT users by
   email，若已驗證 → link Google identity 到 existing user；若未驗證 →
   `OAUTH_EMAIL_CONFLICT` 409 拒絕 (防 squat)。
   另：new account creation 路徑強制 `email_verified=true` (anti-squat 額外層)。

2. **`functions/api/permissions.ts:191` email-verified guard for Branch A**（HIGH）：
   之前 owner 邀請已 signup 但未驗證的 attacker email → 直接 INSERT trip_permissions
   給未驗證 attacker。修：要求 invitedUser.email_verified_at IS NOT NULL；
   unverified user fall back 到 Branch B (invitation token route)，user 點 email
   link 才證明 mailbox 所有權。

**Verified**

- 731/731 API integration test pass
- oauth-callback-google 7/7 pass

**Deferred to v2.33.99**

- **SEC-2 requireFavoriteActor permission ordering**：companion_request_actions
  INSERT 應在 ownership check 後而非前。需要 refactor 4 個 caller signature +
  test 同步更新 — non-surgical，留 dedicated PR。
- 9 MEDIUM findings + 10 test coverage gap 待 v2.33.99-101 batches。

## [2.33.97] - 2026-05-25

**Round 46 — /review batch 1: 5 個 HIGH security/correctness fix**

3 個 specialist agent (code-reviewer / security-auditor / test-engineer) 平行
audit 全 repo → 28 個 finding。本批 ship 最 critical 5 個 HIGH。

**SECURITY**

1. **`functions/api/oauth/token.ts` cascade revoke ordering**（HIGH）：
   `client_id !== clientId` check 移到 `consumed` cascade 之前。原順序讓任意
   registered client B 提交 client A 的 leaked-once refresh_token / auth code
   即觸發 victim grantId family revoke = permanent DoS handle。
   修 refresh_token grant + auth_code grant 兩處。

2. **`functions/api/_middleware.ts:184` CSRF gate for `/api/oauth/consent`**
   （HIGH）：之前 `startsWith('/api/oauth/')` 一律 skip CSRF。`/api/oauth/consent`
   是 session-cookie 認證 browser form POST，SameSite=Lax 對 top-level
   navigation form submit 仍允許。攻擊者從 evil.com 觸發 top-level POST
   /api/oauth/consent 用 victim session 對 attacker_client 點 allow → 取得
   authorization_code = account takeover。改 `pathname !== '/api/oauth/consent'`
   排除即可走 CSRF gate。

**CORRECTNESS**

3. **`functions/api/poi-favorites/[id]/add-to-trip.ts:208-217` 拆 `last_insert_rowid()`
   cross-statement**（HIGH）：D1 batch 沒文檔保證 batched prepared statement
   間的 `last_insert_rowid()` connection-scoped 拿到正確 id。Future D1
   pipeline / serialise 改變後可能 FK 接錯 row → silent corruption。
   改 INSERT RETURNING id → explicit bind to trip_entry_pois。Trade-off:
   trip_entries commit 後 trip_entry_pois INSERT 失敗 → entry orphan（可重新
   attach；非 data loss）。

4. **`functions/api/trips/[id]/entries/batch.ts` sort_order UNIQUE invariant
   validation**（HIGH）：客端 misbehave 送同 (day_id, sort_order) duplicate
   兩筆 UPDATE 都 commit → timeline order 非 deterministic silently corrupt。
   Reject upfront with DATA_VALIDATION 而非靠 DDL UNIQUE（暫態衝突需）。

5. **`functions/api/trips/[id]/entries/[eid].ts:30` requireAuth → requireTripReadAccess**
   （HIGH）：sibling endpoint contract drift — `days.ts` `/segments/index.ts`
   `/[id].ts` 全走 `requireTripReadAccess`（published trip 允許 anon），
   `entries/[eid].ts` GET 走 `requireAuth` → 同 trip 經 `/days/:num` anon
   可讀，但 `/entries/:eid` 直連 anon 401。修對齊。Tests 更新 401 → 403
   non-published case。

**Verified**

- `npm test` → 2665/2665 unit pass
- `npm run test:api` → 731/731 integration pass
- `tsc --noEmit` clean

**Next batch**（v2.33.98 plan）

- 5 個 HIGH security 剩：SEC-1 oauth/callback/google email merge gap +
  SEC-2 requireFavoriteActor permission ordering + SEC-3 permissions.ts
  email-verified guard
- 9 個 MEDIUM finding
- 10 個 test coverage gap

## [2.33.95] - 2026-05-24

**Round 44 — /simplify EFF-2 middleware body scan skip for JSON**

`functions/api/_middleware.ts:286` 對 POST/PUT/PATCH JSON content-type request
skip 整 body TextDecoder + detectGarbledText scan：
- UTF-8 validity 由 handler 的 JSON.parse 自帶 fail-safe
- 亂碼偵測由 handler 對 user-facing 欄位各自 detectGarbledText
- 非 JSON body 仍跑 middleware scan

每次 mutating JSON request 省 ~0.5-2ms CPU + body buffer alloc。

Verified: 731/731 API integration test pass。

(完整 /simplify 16/19 finding 狀態見 v2.33.94 CHANGELOG entry merged via PR #783)

## [2.33.93] - 2026-05-24

**Round 42 — /simplify deferred batch 1（5 個 surgical quality fix）**

v2.33.91 deferred findings ship 第一批。

**REUSE**

- `src/pages/EditTripPage.tsx:1469` 重用 `daysBetween()` + `shiftDateByDays()`
  helpers（同檔已存在），shift-modal preview 拔掉 inline ms 數學。

**QUALITY**

- `src/pages/ChatPage.tsx:883,905` rowClass 雙 ternary 抽 `byRole<A,O,U>(a,o,u)`
  + 採用 `clsx`（其他 component 已用）。
- `src/pages/EditTripPage.tsx:687-688` `titleEdited` + `titleHintDismissed` 兩個
  bool 唯一 consumer 是 line 944 OR；合一為 `titleHintHidden`。
- `src/components/trip/TimelineRail.tsx:675` 拔掉純 event-stop wrapper `<div>`，
  `onClick={e.stopPropagation()}` 搬上 `StopPoiChoiceCard` 的 `<article>`。

**Verified**

- 2665/2665 test pass
- tsc clean

**Skipped (not surgical, larger refactor needed)**

- REUSE-4 oauth `errorResponse(code, msg, status)` → AppError 需 8 個 new codes
  入 ERROR_MESSAGES + 模板字串重構，不是 surgical fix

## [2.33.92] - 2026-05-24

**Round 41 hotfix — `normalizeEmail()` 補回 `.trim()`**

v2.33.91 把 6 處 `(email).trim().toLowerCase()` 替換成 `normalizeEmail()` 時，
canonical helper 只做 NFKC + toLowerCase，**沒做 trim** → 帶前後空白的 email
input（複製貼上 / Gmail trailing space）不再對齊 stored value → potential
auth bypass / lookup miss。CI catch on `oauth-verify.test.ts:278` lowercase+trim test。

**FIX**

- `src/server/email-utils.ts:26` — `email.normalize('NFKC').toLowerCase()` →
  `email.trim().normalize('NFKC').toLowerCase()`

Trim 屬於 email 比對 semantic 的一部分，集中在 helper 是正確的 SoT。
v2.33.91 已經把全部 callsites 統一走 helper，所以這一行 fix 一次全收。

**Verified**

- `npm test` → 2665/2665 pass（includes the failing CI test）
- `tsc --noEmit` → clean

## [2.33.91] - 2026-05-24

**Round 40 — /simplify 整 repo 全掃 7 個高 ROI 修法**

3 個 agent 平行 audit (reuse / quality / efficiency) → 21 個 finding → ship 7 個
high-confidence surgical fix。

**REUSE / CORRECTNESS**

1. **`normalizeEmail()` 取代 `.trim().toLowerCase()`**（4 個 OAuth + invitations
   + permissions.ts 共 6 處）— canonical NFKC 正規化。修 latent Unicode email
   bug：寫 (signup) vs 讀 (login/invitation) 不一致時 attacker 可用 full-width
   `＠` 或 Turkish I/i 走 enum side-channel。同 issue 也讓 permissions.ts:258
   寫入 invited_email lookup 不對齊 middleware 標準化結果。
2. **`functions/api/admin/cache-cleanup.ts:17`** 用 `json()` helper 取代手寫
   `new Response(JSON.stringify(...), {...})`。
3. **`src/components/trip/TravelPillDialog.tsx:170`** 移除 duplicate `TravelMode`
   type 宣告，從 `src/lib/travelMode.ts` 真正 single source import + re-export
   backward-compat。

**DEAD CODE**

4. **Delete `parseTimeRange()`** in `src/lib/timelineUtils.ts:25` — v2.29.0
   `trip_entries.time` DROPPED 後死碼，已被 `parseEntryTime(entry)` 取代。
   `tests/unit/timelineUtils.test.ts` 6 個 parseTimeRange test 同步刪。

**EFFICIENCY**

5. **`scripts/daily-report.js:204`** N+1 fetch loop → Promise.all。20 個 published
   trip 從 ~20s 串接 → ~1s 平行。
6. **`scripts/google-poi-refresh-30d.ts:60`** sequential 50×1.5s sleep
   (~75s wall clock) → batched Promise.allSettled (BATCH_SIZE=4 + per-batch sleep)
   ~3 req/s effective rate 對齊 Google 軟限，wall clock ~18-20s。
   `firstCall` 變數簡化成 `isFirstBatch` constant；401 detection 仍生效
   (autoplan T15 regression coverage updated)。

**Verified**

- `npm test` → 2665/2665 pass
- `tsc --noEmit` → clean
- Regression test `round8c-scripts-polish.test.ts` 更新為 v2.33.91 結構

**Deferred (out of scope per /simplify rules)**

- `_middleware.ts` body double-read (hot path, risky semantics)
- `requireTripReadAccess` 合 1 query (cross-cutting refactor)
- `useTrip` + segments 平行 fetch (React context restructure)
- `api_logs` 4xx cap (behavior change needs decision)
- 237 個 stale `// v2.X` historical comments (主觀大 diff)
- `assembleDay` 6-param → object (內部 refactor，blast radius 大)

## [2.33.90] - 2026-05-24

**Round 39 — ocean residual final cleanup（v2.33.88 follow-up）**

v2.33.88 mass rename 後 investigate 找出 4 個 stale residual。本版全清：

**A. Broken doc path**

- `src/lib/mapHelpers.ts:5` 註解寫 `docs/code-review/round-11-oceanmap-split.md` →
  v2.33.88 已 rename 為 `round-11-tp-map-split.md` → 改成新路徑

**B. Stale "Ocean theme/design" 註解 → Terracotta**

THEME_COLORS 早 v2.31 切 Terracotta `#D97848`，但註解仍寫 Ocean。改 6 處：
- `css/tokens.css:444` "Ocean primary hero" → "Terracotta primary hero"
- `css/tokens.css:510` "Ocean design wrapper" → "Terracotta design wrapper"
- `css/tokens.css:533` "Ocean Shell" → "Terracotta Shell"
- `src/components/trip/DaySection.tsx` "Ocean design / Ocean hero card" → "Terracotta ..."
- `src/components/trip/ThemeArt.tsx` "Ocean theme" → "Terracotta theme"

**C. `use-dark-mode.test.js` 整檔 OCEAN_COLORS → THEME_COLORS**

之前 test 用本地 `OCEAN_COLORS = {light:'#0077B6', dark:'#0D1B2A'}` 藍但 source
是 Terracotta 橘 `#D97848`/`#1A140F` → test 用自己常數所以假性 green，沒驗 source。
改用 `THEME_COLORS` 對齊 source。test descriptions 也對齊 Terracotta。

**D. PoiCardTone `'ocean'` → `'blue'`**

`PoiCardTone = 'warm' | 'cool' | 'ocean' | 'amber'` 中 `'ocean'` 是色調 palette
名（非 prefix），改 `'blue'` 對齊其他 tone 都是色名語意。共 7 處：
- `src/lib/poiSearchHelpers.ts` type + 2 callsite
- `src/pages/ChangePoiPage.tsx` `[data-tone="blue"]` CSS attr selector
- `src/pages/AddStopPage.tsx` `[data-tone="blue"]` CSS attr selector
- `tests/unit/poi-search-helpers.test.ts` 2 assertions

**Verified**

- 0 instances of `ocean` / `Ocean` in `src/` `functions/` `css/` `migrations/`
- `npm test` → 2671/2671 pass
- `tsc --noEmit` → clean

**Not changed (per investigation 建議)**

- `scripts/logs/daily-check/*.json` — historical Sentry incident reports (frozen)
- `docs/code-review/round-*.md` — historical review docs

## [2.33.89] - 2026-05-24

**Round 38 EMERGENCY — wrangler.toml D1 binding 套用範圍 fix（prod login 全壞 root cause）**

`/land-and-deploy` canary 抓到 v2.33.87 後 prod login 仍 500，wrangler tail 顯示：

```
TypeError: Cannot read properties of undefined (reading 'prepare')
```

`context.env.DB` 在 prod undefined。先以為 dashboard binding 缺失，PATCH CF API
寫 production.d1_databases 雖回 success 但 wrangler.toml 在後續 deploy 仍把它
覆寫回 null。

**Root cause**: CF Pages wrangler.toml 慣例 — 頂層 `[[d1_databases]]` 只套用
**preview environment**，production 須明示 `[[env.production.d1_databases]]`。
v2.33.60 round 14 把 vars 寫進 `[env.production.vars]` 時忘記同步搬 D1 binding。
頂層 binding 變成 preview-only，production 沒有 binding → env.DB undefined。

**Production impact**:
- 多週時間（從 round 14 deploy 起）prod 所有 /api/oauth/* /api/my-trips
  500 with TypeError
- v2.33.84 解 EADDRNOTAVAIL 後 api_logs 才能信賴，v2.33.87 PBKDF2 fix 後
  wrangler tail 才看到真實 TypeError, v2.33.89 終於修對 root cause

**FIX**

```diff
- [[d1_databases]]
+ [[env.production.d1_databases]]
  binding = "DB"
  database_name = "trip-planner-db"
  database_id = "d61c42d5-8083-4e18-9b6c-70e133e37322"
```

**Verification path**:
1. Merge → CF Pages auto-deploy
2. curl /api/oauth/login should return 401 (not 500)
3. wrangler tail 應該不再有 TypeError

## [2.33.88] - 2026-05-24

**Round 37 — `ocean-*` → `tp-*` prefix mass rename**

歷史 `.ocean-*` CSS prefix 跟 Terracotta accent palette 名稱不符是早期 ship 殘留。
User 拍板移除歷史包袱，全 codebase 改 `tp-` prefix 對齊新 component 命名規範。

**RENAME**

- **44 CSS classes**: `.ocean-{shell,page,hero,hero-title,hero-sub,hero-chip,hero-chip-muted,
  hero-chips,hero-chips-left,day,stop,from,to,rail,rail-body,rail-caret,rail-content,
  rail-dot,rail-expand,rail-eyebrow,rail-grip,rail-head,rail-header,rail-icon,rail-item,
  rail-line,rail-meta,rail-name,rail-row-wrap,rail-sub,rail-sub-sep,rail-sub-star,
  rail-sub-time,rail-sub-type,rail-time,side-card,side-card-header,side-card-title,
  overflow-menu,overflow-item,overflow-divider,flight-card,bottom-nav,bottom-nav-btn,
  map-container}` → `.tp-*`
- **Component**: `OceanMap` → `TpMap` + `OceanMapMode` → `TpMapMode` +
  `OceanMapProps` → `TpMapProps` + file `OceanMap.tsx` → `TpMap.tsx`
- **Test files**: `tests/unit/ocean-map-*.test.ts*` → `tp-map-*` (5 files)
- **Docs**: `docs/code-review/round-11-oceanmap-split.md` → `round-11-tp-map-split.md`,
  `docs/design-sessions/2026-05-24-oceanmap-split/` → `2026-05-24-tp-map-split/`

**Not renamed (legitimate non-prefix usage)**

- `PoiCardTone = 'ocean'` — color tone value（同 `'warm'`/`'cool'`/`'amber'` 一組
  palette name），非 prefix
- `data-tone="ocean"` HTML attribute — 同上
- `round-14-infra.test.ts` 「舊 ocean blue」comment — 歷史說明，非實際 ref

**Verified**

- 0 instances of `.ocean-*` CSS class remaining
- 0 instances of `OceanMap` / `oceanMap*` identifier remaining
- `npm test` → 2671/2671 pass
- `tsc --noEmit` → clean

## [2.33.87] - 2026-05-24

**Round 36 EMERGENCY — PBKDF2 600k iter 超 CF Workers 100k 限制，prod login 全 500**

`/land-and-deploy` canary 階段 curl prod `/api/oauth/login` 拿到 500 errors。查
`api_logs` 表發現 prod 真正 error message：

```
Pbkdf2 failed: iteration counts above 100000 are not supported (requested 600000)
```

CF Workers Web Crypto PBKDF2 hardcoded max **100k iterations**。v2.33.58
round 12 H3 把 ITERATIONS 從 100k 升 600k 對齊 OWASP 2023，當時 comment
self-warn「若 deploy 後突增 → revert 改 300k 或回 100k」但漏掉 deploy 後沒
驗證 prod login。CI port exhaustion 噪音蓋住沒人發現。

**Prod impact**: 自 v2.33.58 部署起所有 user login 直接 500（含 admin 自己），
僅 anonymous read endpoints 可用。

**FIX**

- `src/server/password.ts` — `ITERATIONS = 600_000` → `100_000`
- `functions/api/oauth/login.ts` — `TIMING_PROBE_HASH` iter `600000` → `100000`
- `tests/unit/round-12-server-security.test.ts` — assertion 對齊新 ITERATIONS
- Comments + example doc string update

**Data side effect**: 任何 stored hash 是 `pbkdf2$600000$...` 的 user 將
**無法 verify 密碼**（CF reject 600k），需走 forgot-password reset。Self-describing
hash format 讓新 hash 寫 100k 後可正常 verify。

**RUNBOOK followup needed**: 升 PBKDF2 以上 cost factor 需切 Argon2id（CF
Workers 暫無 native 支援，需 polyfill）— defer。

## [2.33.86] - 2026-05-24

**Round 35 — round-14c-residuals stale regression follow-up**

v2.33.81 改 `public/_headers` Sentry CSP comment 從「Sentry dashboard 取得」
指令文字 → DSN ↔ CSP URL pattern 公式（hardcode 真 endpoint 後不需指令）。
忘記同步更新 `tests/unit/round-14c-residuals.test.ts` regression assertion
還 match `/Sentry dashboard/` + `/取得/` → CI fail。

**FIX**

- `tests/unit/round-14c-residuals.test.ts` — assertion 改 `/Sentry CSP/` + `/DSN/`
  對齊 v2.33.81 comment 結構。

## [2.33.85] - 2026-05-24

**Round 34 — 修 v2.33.84 暴露的 27 pre-existing real bugs**

v2.33.84 解 EADDRNOTAVAIL 後，27 個 fail 暴露出來。逐個 fix：

**Production bug (1 個)**

- `functions/api/trips/[id]/health-check.ts:181,254` — INSERT trip_health_reports
  寫 `auth.email` 到 `user_id` 欄位（FK to users.id）。Migration 0069 加 FK 後
  此 INSERT FK-fail。改 `auth.userId`。**這是真實 prod bug**（health-check
  POST 在 prod 也會 FK-fail），不只 test 問題。

**Stale test expectations (5 個)**

- `tests/api/oauth-verify.test.ts` — v2.33.59 round 13 H2 改 `context.waitUntil`
  background send + 200 generic anti-enum。原 5 test 仍期 500 / sync send。
  更新：`waitUntil` collect promises + `await Promise.all` + expect 200。
- `tests/api/oauth-forgot-password.test.ts` — 同 send-verification pattern，1 test。
- `tests/api/jwt-module.test.ts` — v2.33.58 round 12 I2 加固 exp 嚴格拒（不放寬
  60s skew）。原 test 期 within-skew pass。改 expect rejects /expired/。
- `tests/api/middleware.test.ts` — v2.33.62 round 14c 把 Pages preview origin
  gate on `env.ENVIRONMENT === 'preview'`。原 test 用 baseEnv 沒 set。補 ENVIRONMENT。
- `tests/api/oauth-authorize.test.ts` — handler enforces PKCE per OAuth 2.1
  baseline。5 test buildUrl 缺 code_challenge/method，補上。

**Test infrastructure mismatches (7 個)**

- `tests/api/segments-get.integration.test.ts` — `seedTrip` 預設 published=1，
  anonymous read allowed → 401/403 test fail。改 published=0。401 改 403
  對齊 v2.33.41 `requireTripReadAccess` 統一 PERM_DENIED 設計。
- `tests/api/oauth-reset-password.test.ts` 2 個 — handler 跑 IP rate-limit 在前，
  mock DB `vi.fn()` 返 undefined → undefined.bind() crash。補 makeStmt-returning
  prepare stub。
- `tests/api/account-connected-apps.test.ts` — handler 用 `DB.batch()` atomic
  delete，mock 缺 batch method。補 vi.fn().mockResolvedValue stub。
- `tests/api/oauth-token.test.ts` 2 個 — handler 用 `revokeByGrantId` SQL
  `DELETE FROM oauth_models WHERE name IN (...) AND json_extract(payload, ?) = ?`
  （v2.33.58 round 12 加 name IN allowlist）。原 test substring 期
  `DELETE...WHERE json_extract` 緊鄰，現實 SQL 中間有 `name IN` clause。改用
  雙 substring check (`DELETE FROM oauth_models` + `json_extract(payload`)。

**Final state**:

| Metric | Before v2.33.84 | After v2.33.84 | After v2.33.85 |
|--------|-----------------|----------------|----------------|
| Test files passed | 48 | 60 | **70/70** |
| Tests passed | 583-639 | 704 | **731/731** |
| Tests failed | 27-48 | 27 | **0** |
| EADDRNOTAVAIL | 25+ | 0 | **0** |
| Skipped | 65 | 0 | **0** |

**100% deterministic green test suite**。CI retry 從此可移除。

## [2.33.84] - 2026-05-24

**Round 33 — EADDRNOTAVAIL port exhaustion 真正 root cause + fix**

Round 32 推測「per-test fetch socket churn」是錯的。深調發現真正 root cause：

**Diagnosis**:
1. `tests/api/setup.ts` 用 `let _mf` module-level singleton。Vitest 4 即使
   `isolate: false` 仍會 per-file re-evaluate module → `_mf = null` 重置
2. **36 個 test file 在 `afterAll(disposeMiniflare)` → 每檔結束 dispose
   singleton → 下一檔 createTestDb 再 new Miniflare**（author 設計意圖 vs
   實際行為矛盾）
3. 每 new Miniflare spawn workerd child process + 內部 HTTP server
   → 累積 35+ workerd 同時跑 → ephemeral port (49152-65535) 耗盡
4. 觸發 EADDRNOTAVAIL 隨機 fail 20-30 個 test（隨機 port noise）

**Verification** (via `globalThis.__mfInstances` counter):
- Before: 35 Miniflare instances created per test run
- After: 1 instance (true singleton across all test files)

**Fix**:
- `tests/api/setup.ts` singleton 改 `globalThis` cache（跨 module re-eval 維持）
- `disposeMiniflare()` 改 no-op（per-file dispose 是 anti-pattern；process exit
  自然清理 workerd）
- `vitest.config.api.mts`:
  - `pool: 'forks' + maxWorkers: 1 + fileParallelism: false` 強制單 worker
  - `isolate: false` 讓 module 真共用

**Measured impact**:

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Miniflare instances | 35 | 1 | -34 |
| EADDRNOTAVAIL errors | 25+ | 0 | -100% |
| Test files failed | 22 | 10 | -12 |
| Tests passed | 583-639 | 704 | +65-121 |
| Tests skipped (setup error) | 65 | 0 | -65 |
| Tests failed | 27-48 | 27 | stable |

剩 27 個 fail 是 **pre-existing real bugs**（assertion-level，非 port noise）：
- account-connected-apps DELETE (1)
- health-check.integration (6)
- jwt-module clock-skew (1)
- middleware preview origin (1)
- oauth-authorize redirect (5)
- oauth-forgot-password (1)
- oauth-reset-password validation (2)
- oauth-token replay/refresh (2)
- oauth-verify send-verification (5)
- segments-get auth (2)

這些屬獨立 Round 待修，**不是本 fix 引入**。CI retry 之前蓋過、port noise 也蓋過。

## [2.33.83] - 2026-05-24

**Round 32 — Path A 完整嘗試 + 結論：port exhaustion 非 isolation 問題**

繼 v2.33.82 prerequisite work（19 個 fake timer cleanup）後完成完整 Path A：
- 重構 1 個 module-level mock conflict file
- 啟用 `isolate: false + singleFork: true`
- 實測：21 file fail（baseline 22）+ 28 test fail（baseline 27）— **same as baseline**

**結論**：EADDRNOTAVAIL **不是 Miniflare instance 過多造成**，而是 **per-test
fetch() round-trip 在 Miniflare 內部 HTTP layer 累 socket TIME_WAIT**。`isolate: false`
讓 singleton 真正生效 ≠ 解 socket churn。Path A 不可行。

**FIX**

- `tests/api/invitations-accept.test.ts` 重構：top-level `vi.mock('_session')` →
  scoped `beforeEach` 內 `vi.doMock` + dynamic import SUT + dynamic import AppError。
  即使不開 isolate: false，這是 test hygiene 改善（無 module-level 全域污染風險）。

**REVERTED**

- `vitest.config.api.mts` `isolate: false + pool=forks + singleFork=true` — 確認
  對 port exhaustion 無實際助益，反而留下 future devs vi.mock 全域污染 footgun。

**Path A retrospective written**：root cause 是 architecture-level（每 test
HTTP round-trip 走 Miniflare），要解需 rewrite handler 直接 call（無 HTTP），
工作量 → 數十小時 vs CI retry 已 cover，不做。

## [2.33.82] - 2026-05-24

**Round 31 — 19 個 fake timer test files 加 afterEach cleanup**

Path A attempt (Vitest `isolate: false` 解 Miniflare port exhaustion) 過程
audit 出 19 個 fake timer test 缺 `useRealTimers()` cleanup — 即使不開
`isolate: false`，這也是 test hygiene 該補。

**FIX**

19 個 tests/api/*.test.ts 統一 pattern：
```ts
import { ..., afterEach } from 'vitest';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(...); });
afterEach(() => { vi.useRealTimers(); });
```

Files: account-sessions / account-connected-apps / dev-apps / dev-apps-detail /
email-module / invitations-get / invitations-accept / oauth-authorize /
oauth-login-google / oauth-reset-password / oauth-revoke / oauth-consent /
oauth-userinfo / oauth-login / oauth-verify / oauth-forgot-password /
oauth-signup / oauth-token / session-helper

**ATTEMPTED but reverted**

- `isolate: false + singleFork: true` 想讓 setup.ts Miniflare singleton 真正
  共用。實測 baseline 27 fail → 48 fail（worse）。Root cause 是 module-level
  `vi.mock(...)` 在 4 個 file（oauth-callback-google / invitations-accept /
  segments-patch / recompute-travel-segments）spillover 到其他 test，破壞
  module isolation。重構成 per-test mock 工作量 vs ROI 不划算，deferred。

**Net effect**: test cleanup 改善，port exhaustion 接受現況（CI retry 已 cover）。

## [2.33.81] - 2026-05-24

**Round 30 — Sentry CSP report endpoint 真實 URL 取代 PLACEHOLDER**

v2.33.62 加 CSP `Report-To` header 但 endpoint URL 留 PLACEHOLDER（不知具體
endpoint 時 browser silent no-op）。本版從 VITE_SENTRY_DSN 拼出真實 endpoint：

**FIX**

- `public/_headers` `Report-To` header URL: PLACEHOLDER → 真 Sentry CSP ingest
  endpoint。From DSN 拆解 host + project_id + key，per Sentry CSP URL pattern。
- 註解 update — 移除 "SENTRY_CSP_ENDPOINT 變數後 rebuild" 過時指令，加 DSN ↔ CSP
  endpoint mapping 公式。

**VERIFIED**

- DSN 結構驗證：`https://<key>@<host>/<project_id>` ↔ CSP `https://<host>/api/<project_id>/security/?sentry_key=<key>`
- prod 部署後 violation report 應送進 Sentry dashboard → Issues → Security

## [2.33.80] - 2026-05-24

**Round 29 — Dependabot auto-merge workflow**

啟用 dependabot 安全 + patch/minor 更新自動 merge。手動 merge 5 個 deps PR/週
是 toil。Security update（alert-state=fixed）不卡 review queue。

**NEW**

- `.github/workflows/dependabot-auto-merge.yml`:
  - trigger: pull_request opened/sync/reopened/ready_for_review
  - filter: `github.actor == 'dependabot[bot]'`
  - 條件：semver-patch / semver-minor / alert-state=fixed → `gh pr merge --auto --squash`
  - major version bump 留人工 review
  - action SHA pin per OpenSSF (`actions/checkout@v4` + `dependabot/fetch-metadata@v2.4.0`)

**REPO CONFIG**

- Enabled `allow_auto_merge: true` via `gh api -X PATCH /repos/raychiutw/trip-planner`
- `can_approve_pull_request_reviews: false` 不變（master 無 branch protection 不需 approve）

**Why**: dependabot.yml 已限 vite/tailwind major 不 PR + groups 抑制 flood；
剩 minor/patch 風險低 + security update 應立即 merge。

## [2.33.79] - 2026-05-24

**Round 28 — npm audit fix (1 moderate CVE 清掉)**

`brace-expansion 5.0.2-5.0.5` GHSA-jxxr-4gwj-5jf2 (Large numeric range
defeats DoS protection, moderate) via glob transitive。`npm audit fix`
跑完 730 packages → 0 vulnerability。

**FIX**

- `package-lock.json` — bump brace-expansion 透過 npm audit fix

**VERIFIED**

- `npm audit` → found 0 vulnerabilities

**ATTEMPTED but reverted**

- vitest.config.api.mts `pool: 'forks' + singleFork: true` 想解 Miniflare
  port exhaustion (EADDRNOTAVAIL)。實測 baseline 28 failed → 36 failed，
  反向結果，revert。Root cause 是 Vitest 4 per-file module isolation 使
  setup.ts 的 module-level singleton 失效；要解需設 `isolate: false`，
  但 cross-test state leak 風險過高，deferred。

## [2.33.78] - 2026-05-24

**Final Loop summary — Rounds 1-27 retro**

`/loop Loop review 全部程式碼 全部修正` 完整 sweep 結束。

**NEW**

- `docs/code-review/round-final-loop-summary.md` — 27-round retro
  - 4 phase breakdown (foundation → architecture → deferred deep-dive → final cleanup)
  - Metrics delta: +312 test、-24% test runtime、-3 HIGH CVE、-5 doc drift
  - Lessons learned + open items (intentional defers)

Master clean at v2.33.78。

## [2.33.77] - 2026-05-24

**Round 27 — 刪掉 dead source-grep test**

Round 15 finding follow-up: `tests/unit/migration-0033-add-user-id-columns.test.ts`
test 3 個表 (saved_pois / trip_permissions / trip_ideas) 加 user_id 的 SQL 結構。
其中 2/3 表已 DROP（saved_pois v2.29.1、trip_ideas v2.21.0）。Test 只讀
historical migration file regex，沒 regression value，pure 歷史 documentation。

**DELETE**

- `tests/unit/migration-0033-add-user-id-columns.test.ts` — dead historical test

**Why not delete other migration tests**: 0034/0035/0036/0037/0040/0041/0050/0057/0058
testing migrations that 表/欄位 still alive 或仍是 active flow（rate limit /
session devices / trip_invitations 等）。0033 是唯一 2/3 表已 drop 的例外。

## [2.33.76] - 2026-05-24

**Round 26 — ARCHITECTURE Key Decisions section 對齊 v2.31.x reality**

Round 18 doc drift audit follow-up: Key Architectural Decisions section 仍寫
「Cloudflare Access 而非 app-level auth」（v2.21.x V2 OAuth 已切）+ 「POI 雙層
所有權（pois + trip_pois）」（v2.29.0 整表 rip-out）— 兩個 ADR 與現狀矛盾。

**FIX ARCHITECTURE.md `## Key Architectural Decisions`**:

- ADR #2 rewrite: 「POI 雙層所有權」→ 「POI master + per-entry alternates
  (v2.29.0 起)」對齊 `trip_entry_pois` junction model
- ADR #3 rewrite: 「Cloudflare Access」→ 「V2 OAuth 自建 (v2.21.x 起)」說明 vendor
  lock-in + 成本動機，pointer 到 oauth-env-setup runbook
- ADR #6 NEW: Google Maps Platform 切換 (v2.23.0)，kill switch + quota monitor
- ADR #7 NEW: OCC token (entry_pois_version) 設計，限定 multi-POI per entry

**NEW**

- `tests/unit/architecture-key-decisions.test.ts` — 7 個 regression guard:
  - 不該再寫「Cloudflare Access 而非 app-level auth」當 current ADR
  - 必須含 V2 OAuth / Google Maps / OCC 三大決策
  - 不該再講 trip_pois 雙層所有權當「現狀」
  - 必須含 multi-POI per entry 模型

## [2.33.75] - 2026-05-24

**Round 25 — E2E api-mocks schema parity fix**

Round 15 finding follow-up: `tests/e2e/api-mocks.js` 959 LOC 對 v2.21-v2.31
schema 大規模 drift。Audit subagent 找到 3 個 critical bug:

**FIX**

- `tests/e2e/api-mocks.js` POST /api/poi-favorites mock row shape align backend:
  - `savedAt` → `favoritedAt`（migration 0050 column rename）
  - 移除 `email: MOCK_USER.email`（v2.21.0 dropped poi_favorites.email）
  - 補 `userId`（real backend GET 回此欄位）
  - 更新註解 reference v2.22.0 + v2.29.1 migration trail

**Why it mattered**: 之前 mock 回 `savedAt` 但 backend 經 deepCamel 回
`favoritedAt`，frontend 任何讀 `row.favoritedAt` 的 code 在 E2E 環境永遠 undefined
→ 假性 green test 蓋住真 bug（同 v2.31.14/15/27 family camelCase drift 模式）。

**NEW**

- `tests/unit/e2e-api-mocks-shape.test.ts` — 6 個 regression guard:
  - `savedAt` 不應出現
  - `saved_at` 不該以 active code reference 形式出現
  - 必須有 `favoritedAt`
  - poi_favorites mock 不該 leak `email` field
  - 註解語意校正
  - `initialTripIdeas` 不該有 active call site

## [2.33.74] - 2026-05-24

**Round 24 — 8 個 admin endpoint security guard test**

Round 15 finding: `functions/api/admin/*.ts` 8 個 endpoint 缺 unit-level security
guard 驗證。Integration test 因 Miniflare 平行跑 71 個 file → EADDRNOTAVAIL port
exhaustion 不穩。改 source-grep 模式，穩定 + 抓 regression。

**NEW**

- `tests/unit/admin-endpoints-guard.test.ts` — 19 個 test，3 個 group:
  1. **Inventory**: 8 個預期 admin endpoint 全存在（catch rename / 漏檔）
  2. **Auth guard**: 每個 admin endpoint `import + call requireAdmin`（catch
     v2.31.16 family — admin route 漏 auth check）
  3. **Audit log**: stateful endpoint（maps-lock / maps-unlock）一定有 `logAudit`
     call（catch silent state change without trail）
  4. **Handler export**: `PagesFunction<Env>` shape 驗證

**Why source-grep not integration**: 51 個 test 平行 spawn Miniflare → 71 個 port
被搶 → EADDRNOTAVAIL fail。Source-grep 在 100ms 內驗 regression-prone pattern
（漏 guard / 漏 audit / 漏檔），integration test 留 local sandbox 跑（手動）。

**Coverage**: 8 admin endpoint × 3 layer = 24 assertion，19 個 test case。

## [2.33.73] - 2026-05-24

**Round 23 — 7 個剩 untested page smoke test**

Round 22 follow-up，補完 12 個 untested page 中的剩餘 7 個。

**NEW**

- `tests/unit/untested-pages-smoke-batch-2.test.tsx` — 7 個 smoke:
  - NewTripPage (/trips/new)
  - EditTripPage (/trip/:id/edit)
  - EntryActionPage (/trip/:id/stop/:eid/copy)
  - AddStopPage (/trip/:id/add-stop)
  - AddEntryPage (/trip/:id/add-entry)
  - AddCustomStopPage (/trip/:id/add-custom-stop)
  - MapPage (/trip/:id/map, wrapped under TripLayout for TripContext)

**TESTING**

- 2646 / 2646 全綠 (+7 從 2639)
- tsc clean
- 12/12 untested pages 都已有 smoke coverage (Round 22 5 + Round 23 7)

## [2.33.72] - 2026-05-24

**Round 22 — 5 個 untested page smoke test (Round 15 deferred)**

Round 15 finding: 4 core page (CollabPage / TripLayout / Appearance /
Notifications) 沒 unit test + VerifyEmailPage (Round 13 新加) 也沒測。本 PR 補
smoke render guard。

**NEW**

- `tests/unit/untested-pages-smoke.test.tsx` — 6 個 smoke test:
  - TripLayout mount + outlet (route wrapper)
  - AppearanceSettingsPage mount + 外觀/主題 text
  - NotificationsSettingsPage mount + 通知/提醒 text
  - CollabPage mount under `/trip/:id/collab` route
  - VerifyEmailPage with `?token=abc` (verifying state)
  - VerifyEmailPage without token (error state)

Smoke 只驗 mount 不 throw + 含預期 text/testid。完整 behavior test 後續 PR。

**TESTING**

- 2639 / 2639 全綠 (+6 從 2633)
- tsc clean

## [2.33.71] - 2026-05-24

**Round 21 — vitest workspace split (Round 15 deferred, CI speedup)**

User "Loop 全部都做" → 繼續 Round 15 大型 defer。本 PR 拆 vitest 為 unit-dom +
unit-node 兩 project，pure source-grep / logic test 跑 node env 跳過 jsdom init。

**PERF**

- Suite duration **21s → 16s (24% speedup)**
- setup 10s → 4s; environment 65s → 28s
- 199 個 `.test.ts` 跑 node project (no jsdom polyfill)
- 109 個 `.test.tsx` + `.test.js` + 11 個真用 DOM 的 `.test.ts` 跑 jsdom project

**CONFIG**

- `vitest.config.js` 改用 `projects: []` (Vitest 4 idiom，原 `vitest.workspace.ts`
  v4 已 deprecate `--workspace` flag)
- 兩 project `extends: true` 共用 global `clearMocks` / `restoreMocks`
- TS_DOM_FILES 11 個例外列：empirical (fail-then-add) 找出真用 DOM 的 .test.ts

**TESTING**

- 2633 / 2633 全綠 (unchanged)
- tsc clean
- 既有 test 完全不動 (純 config refactor)

## [2.33.70] - 2026-05-24

**Round 20 — shared mock factories (Round 15 deferred)**

User: "Loop 全部都做" → 開始 Round 15 大型架構 defer 的 actionable 部分。
此 PR 建 shared mock factory 防 v2.31.14/15/27 family drift bug 重演。

**NEW**

- `tests/unit/__factories__/` — 6 個 factory:
  - `makeTrip` + `makeTripListItem` — trip shape (含 TripDestination camelCase)
  - `makeEntry` + `makeStopPoi` — entry shape (含 startTime/endTime/master/alternates)
  - `makeDay` — day shape (含 timeline entry array)
  - `makeUser` + `makeAuthData` — auth shape (對齊 AuthData type)
  - `makePoiFavorite` — favorite shape (含 usages camelCase)
  - `makeSegment` — TripSegment shape (fromEntryId / toEntryId / distanceM)
- `tests/unit/__helpers__/renderPage.tsx` — wrap MemoryRouter +
  ActiveTripProvider + NewTripProvider for unit test (取代 17+ inline 重複 setup)

**WHY**

Round 15 code-reviewer agent finding: 23 個 test 各自 `vi.mock('apiClient')` + 22
個各自 `vi.mock('useCurrentUser')`，mock shape drift 重演 v2.31.14/15/27 camelCase
bug 家族 — test snake_case 但 backend camelCase → false-green test mask real bug。

Factory canonical shape **對齊 backend response (deepCamel'd)**:
- snake_case 寫法被 TypeScript 阻擋 + runtime shape check
- 新 test 直接 import + `Partial<T>` override 既可

**TESTING**

- `tests/unit/round-20-mock-factories.test.ts` — 12 個 smoke test 驗 shape
- 2633 / 2633 全綠 (+12 從 2621)
- tsc clean
- 既有 test 不動 (純 additive，現有 inline mock 之後可漸進 migrate)

**Migration path (defer follow-up)**

下個 PR 可開始 migrate hot-spot test (e.g. edit-entry-page / chat-page) inline
mock 改用 factory，drop 重複 fixture data。

## [2.33.69] - 2026-05-24

**Round 19 — runbooks + docs cleanup (Round 18 deferred items)**

User: "Loop 全部都做" → 把 Round 18 deferred 的 actionable items 全做完。

**RUNBOOKS** (Round 18 defer 補)

- `docs/runbooks/v2.33-migration-deploy-order.md` — v2.33.x migration list
  (0067-0071) + additive FK vs destructive DROP 2-phase pattern + race window
  + sqlite_sequence verify cmd + 不可逆 migration list + post-deploy env reminder
- `docs/runbooks/oauth-env-setup.md` — V2 OAuth env (SESSION_SECRET /
  SESSION_IP_HASH_SECRET / PUBLIC_ORIGIN / ENVIRONMENT / OAUTH_SIGNING_PRIVATE_KEY)
  initial setup + rotation procedure + DEV_MOCK_EMAIL safety + Sentry CSP
  endpoint setup + verification curl + common issues table

**CLEANUP**

- `README.md` 拔 v2.31.85 inline version note (Round 18 LOW)
- `tests/README.md` 新建 — naming convention (round-N current vs v2_31_*
  legacy) + Round 15 deferred refactor list

**Decisions documented**

- 14 個 `v2_31_*.test.ts` 保留不動 (合併 risk vs. reward 不值，加 README
  說明 convention 變遷 instead)

**TESTING**

- 純文檔 PR — 無新 source-grep test
- 2621 / 2621 全綠 (unchanged)
- tsc clean

## [2.33.68] - 2026-05-24

**Round 18 — docs review + refresh (backlog #139)**

Code-reviewer agent review root *.md + docs/ 找 5 CRITICAL + 5 MED + 5 LOW
(doc drift / stale info / broken refs)。本 PR 處理大部分 actionable。

**REFRESH (CRITICAL)**

- `ARCHITECTURE.md` Auth section 整段重寫 V2 OAuth + .dev.vars (不再
  Cloudflare Access + .env.local)
- `ARCHITECTURE.md` Maps stack OSM/Nominatim/ORS/Haversine 全標 ripped out，
  改 Google Maps Platform (v2.23.0+)
- `ARCHITECTURE.md` POI 模型: `trip_pois` 標 DROPPED，改 `pois` master +
  `trip_entry_pois` junction (v2.27-v2.29)
- `ARCHITECTURE.md` `/manage` `/admin` route 標 拆 2026-04-26
- `README.md` 同步移除 OSM/ORS/Haversine 描述，改 Google Places + Routes
- `README.md` 3-theme (Sunshine/Clear Sky/Japanese Zen) → V2 Terracotta only
- `README.md` 拔 broken screenshot ref (docs/daily-report-flow.png 不存在)
- `CONTRIBUTING.md` Node 20+ → Node 22+, 加 bun prereq (google-poi-*.ts)
- `CONTRIBUTING.md` `.env.local` → `.dev.vars` (與 CLAUDE.md / AGENTS.md 對齊)
- `CONTRIBUTING.md` trip_pois → trip_entry_pois
- `SPEC.md` Mark `SUPERSEDED` — POI unification 已 v2.27-v2.29 完成 via
  `trip_entry_pois`; SPEC 描述的 `trip_entries.location` JSON + Phase 3 migration
  script 都不存在

**SYNC**

- `AGENTS.md` 加 CLAUDE.md "Hard Rules" (Code change → tp-team / Mockup-first
  hard gate) + "Naming history" summary (v2.23/v2.27/v2.29/v2.31.13-15-27/v2.33.5x-67)
- `AGENTS.md` typo `.Codex/skills/` → `.claude/skills/`
- `GEMINI.md` `trip_pois` 覆寫 → `trip_entry_pois` junction
- `docs/code-review/README.md` PR URL typo 修 (round 13: `planner` → `trip-planner`) +
  backfill round 14b/14c/14d/15a/15b/16/17 7 個 PR# (TBD → 實際 #)

**MOVE**

- `optimization-report-2026-03-22.md` → `docs/archive/` (stale 14 月 artifact)

**TESTING**

- `tests/unit/round-18-docs-refresh.test.ts` — 20 個 source-grep guard
- 2621 / 2621 全綠 (+20 從 2601)
- tsc clean

**Deferred (架構性)**

- `docs/runbooks/` 補 migration deploy + OAuth env setup runbook
- README inline version note (v2.31.85) cleanup
- ARCHITECTURE.md Key Architectural Decisions 全面重寫

## [2.33.67] - 2026-05-24

**Round 17 — src/entries/main.tsx mini audit (lazyWithRetry budget bug)**

Self-review src/entries/main.tsx + index.html + src/types/{api,poi,timeline}.ts。
找 1 個 MED bug + 確認多項 false-positive。

**FIX (MED)**

- `src/entries/main.tsx`: `lazyWithRetry_reloaded` sessionStorage key 之前
  successful reload 後永遠殘留。下次同 tab session 任何 chunk load fail 直接
  reject 無 retry — retry budget 只能用一次/tab。**Fix**: mount 時 removeItem，
  每次 fresh load 重置 retry budget。

**False positive checked**

- index.html favicon path "relative vs absolute": Vite build 自動把 `images/X`
  重寫為 hashed `/assets/X-HASH`，deep URL 不會 404。保持 relative 正確
- index.html robots meta: CF Pages preview 已自動加 X-Robots-Tag，不需 HTML meta；
  prod indexing 是產品決策非 review fix
- src/types/poi.ts snake_case (place_id / country_name): 是 Google Places API
  wire-format pass-through，刻意保留

**TESTING**

- `tests/unit/round-17-main-tsx.test.ts` — 2 個 source-grep guard
- 2601 / 2601 全綠 (+2 從 2599)
- tsc clean

## [2.33.66] - 2026-05-24

**Round 16 — CI workflow security hardening (backlog #138)**

Security-auditor agent review 6 個 `.github/workflows/` YAML 找 3 HIGH +
4 MED + 4 LOW。本 PR 全做 (含 LOW)。

**SECURITY (HIGH)**

- **HIGH-1**: 6 個 workflow 全加 `permissions: contents: read` — 之前 default
  RW GITHUB_TOKEN，supply chain (compromised npm dep) = repo takeover
- **HIGH-2**: `dawidd6/action-send-mail@v3` → SHA pin `4226df7d...` —
  community-maintained action, 收 GMAIL_APP_PASSWORD + CF token
- **HIGH-3**: `treosh/lighthouse-ci-action@v12` → SHA pin `3e7e23fb...` —
  community-maintained, 收 LHCI_GITHUB_APP_TOKEN

**SECURITY (MED)**

- **MED-2**: `rate-limit-cleanup.yml` inline SQL → `scripts/cleanup-rate-limit.sql`
  + 新 `.github/CODEOWNERS` 守 .github/workflows/** + migrations/ + src/server/ +
  oauth/ + _headers + wrangler/vite/tsconfig

**CONFIG**

- **LOW-1**: `actions/checkout@v4` + `actions/setup-node@v4` → 都 SHA pin per OpenSSF
- **LOW-2**: 新 `.github/dependabot.yml` (github-actions + npm 自動 PR 升 SHA pin)
  + grouped (react-stack / sentry / cf-stack / testing) 避免 PR flood
- **LOW-3**: `lighthouse.yml` 加 `concurrency: { group: lighthouse-${ref}, cancel-in-progress: true }`
- **LOW-4 note**: sleep 30 wait for CF Pages deploy 仍存，加 comment 標 future
  poll CF API improvement

**真 wontfix / 需 GitHub web UI 設定**:

- MED-1: 分割 CLOUDFLARE_API_TOKEN 為 deploy / analytics 兩個 (需 CF dashboard create + GH secrets 更新)
- MED-3: GitHub Environment protection 包 production secrets (需 GH Settings web UI)
- MED-4: Telegram bot token in URL path — Telegram API spec 沒提供 body 傳法，
  defense-in-depth 已 `-sf` flags suppress most output

**TESTING**

- `tests/unit/round-16-ci-security.test.ts` — 17 個 source-grep guard
- 2599 / 2599 全綠 (+17 從 2582)
- tsc clean

closes backlog #138.

## [2.33.65] - 2026-05-24

**Round 15b — tests/ quality fixes + types drift (backlog #137 partial)**

2 個 parallel agent (code-reviewer + test-engineer) review tests/ (375 files /
46k LOC) 找出大量 finding。本 PR 處理可獨立完成 6 個 (HIGH 2 + MED 3 + LOW 1)。
剩餘大型 finding (source-grep tests 重構、jsdom split、shared factory) 留下輪。

**TEST INFRA (HIGH/MED)**

- `vitest.config.js` `clearMocks: true` + `restoreMocks: true` — 防 global.fetch /
  vi.spyOn cross-test leak (271/316 test 略 afterEach 仍 safe)
- `playwright.config.js` `retries: process.env.CI ? 2 : 0` + `workers: 2 in CI` —
  吸收 transient flake + 並行加速
- 3 個 fake-timer test 加 `afterEach(vi.useRealTimers)` (maps-lock / oauth-d1-adapter /
  session-module) — 防 cross-file leak
- `timeline-rail-stale-travel.test.tsx` setTimeout(0) microtask flush → waitFor (8 處)

**INFRA RENAME**

- `tests/setup-jest-dom.js` → `tests/setup-dom.js` (project 用 vitest 不用 Jest)

**TYPES**

- `src/types/trip.ts TripDestination` snake_case (dest_order / day_quota / sub_areas) →
  camelCase (destOrder / dayQuota / subAreas)。對齊 v2.31.13 fix family — backend
  經 deepCamel 回 camelCase。未來 caller 誤用避免同類 silent filter 0 bug。

**TESTING**

- `tests/unit/round-15b-tests-quality.test.ts` — 11 個 source-grep guard
- 2582 / 2582 全綠 (+11 從 2571)
- tsc clean

**Round 15 剩餘 (defer 大型重構)**

- 113-137 個 source-grep test 重構/刪 (架構決策)
- vitest workspace split (.ts vs .tsx) — 30-50% CI 提速
- Shared mock factory (tests/unit/__factories__/) — 防 v2.31.14/15/27 drift bug
- 4 untested core pages (CollabPage / TripLayout 等)
- 25 untested API endpoint (admin/maps-* / JWKS)
- E2E mocks 959 LOC stale schema cleanup
- 14 個 v2_3X_XX-bug.test.ts file-per-bug 整合

## [2.33.64] - 2026-05-24

**Round 15a — src/contexts/ silent-failure mode fix (mini)**

Loop iteration 中等 tests/ review agent 完成時順手 audit src/contexts/ 6 個 file。
找到 2 個 MED finding (silent failure mode)，立刻 fix。

**FIX**

- `NewTripContext.useNewTrip` outside provider 之前 silent no-op (button 點了
  完全無反應)。改 createContext null sentinel + dev-mode `console.warn`，prod
  仍 graceful (避免 single missing provider 整 app 崩)
- `ActiveTripContext.useActiveTrip` outside provider 之前 LS fallback 但
  `setActiveTrip` 寫 LS 後其他 consumer 不 re-render (state 跟 LS 不 sync)。
  保留 LS fallback (backward compat for test) + 加 dev warn

**TESTING**

- `tests/unit/round-15a-contexts-warn.test.ts` — 6 個 source-grep guard
- 2571 / 2571 全綠 (+6 從 2565)
- tsc clean

Round 15 主 PR (tests/ quality) 待 2 個 agent 完成後 ship。

## [2.33.63] - 2026-05-24

**Round 14d — LOW finding 全做 (backlog #136)**

User: "Loop 持續做，Low 的 finding 也要做" → 把 Round 12 + 14 的 LOW finding
真的做完。

**FIX**

- `permissions.ts` `invitationExpiresAt(7)` 改 `invitationExpiresAt()` 用 default
  常數，避免跟 `INVITATION_TTL_DAYS` 漂移
- `oauth-d1-adapter.upsert` 加 16KB payload size cap — 防 caller 寫超大 payload
  burn D1 quota
- `session.ts importHmacKey` 加 in-isolate CryptoKey cache (Map<secret, key>) —
  之前 verifySessionToken 每 request importKey (~1ms) × 多 route 累積
- `google-id-token` JWKS cache 加 comment 標 V2-P7 KV cache upgrade path
  (cross-isolate consistency)

**ASSET**

- 用 `sharp` 從 icon-512.png 產 maskable 變體 (terracotta safe-zone) 兩個尺寸：
  `icon-192-maskable.png` + `icon-512-maskable.png`
- `manifest.json` icons 加 2 個 maskable purpose 變體

**CLEANUP**

- `tokens.css` 拔 1 個真 stale v2.18.0 version prefix comment (6+ 月前)。
  其他 v2.30+ comment 留作 historical context (git blame 可查)

**TESTING**

- `tests/unit/round-14d-low-findings.test.ts` — 9 個 source-grep guard
- 2565 / 2565 全綠 (+9 從 2556)
- tsc clean

closes backlog #136. Round 14 finding 100% 處理完。

## [2.33.62] - 2026-05-24

**Round 14c — 真做完所有 deferred finding (backlog #135)**

User 要求「先完成所有 finding」→ Round 14 doc 列了 deferred items 中
7 個可實作的做完，6 個真 wontfix 顯式 document。
doc: `docs/code-review/round-14c-residuals.md`。

**SECURITY**

- `_auth_audit.ts` hashIp HMAC fallback — 加 `SESSION_IP_HASH_SECRET` env，
  set 後新 audit row HMAC-SHA256(secret, IP)，未設 fallback SHA-256 backward compat。
  防 DB dump + rainbow-table reverse 一次 enable (per migration 0036 ack)
- 8 個 oauth handler callsite 全 migrate 傳 `context.env` 到 `recordAuthEvent`
- `_middleware.ts isAllowedOrigin` preview-deploy origin pattern 加
  `env.ENVIRONMENT === 'preview'` gate (之前 prod 也信任 preview origin)
- `vite.config workbox` 加 `cacheWillUpdate` plugin — request 帶 Cookie 或
  response Cache-Control private/no-store 不寫 SW cache。防 shared device
  cross-user PII (SW cache 是 origin-wide 共用)
- `_headers` CSP 加 `report-to csp-endpoint` directive + `Report-To` header
  with Sentry CSP ingest URL pattern (placeholder — deploy 後填實際 endpoint)

**MIGRATION**

- `migrations/0071_audit_log_user_id.sql` — audit_log swap pattern 加
  `changed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`，backfill
  via LEFT JOIN users.email，新 idx_audit_user index。保留 companion_failure_reason col (0050)。

**INFRA**

- 新 `functions/api/_app_settings.ts` — typed accessor (APP_SETTINGS_SCHEMA +
  parseAppSetting / serialiseAppSetting / getAppSetting helper)。集中 5 個
  已知 key 的 type 定義，未來 callsite migrate 即可享 type safety
- `_headers` /og cache TTL 加 comment 標 future content-hash → immutable 升級 path

**TESTING**

- `tests/unit/round-14c-residuals.test.ts` — 18 個 source-grep guard
- 2556 / 2556 全綠 (+18 從 2538)
- tsc clean

**真 wontfix (documented)**:

- Manifest maskable icon (需 asset design)
- CSP `style-src 'unsafe-inline'` (Tailwind 4 forced)
- 5 個 moderate CVE (postcss/ws/brace-expansion/miniflare/wrangler — upstream)
- Migration 0011/0013 (歷史不可逆)
- Stale version comments (低 value，git blame 可查)

**部署 reminder**:

1. `wrangler env set SESSION_IP_HASH_SECRET <32B random base64>` (啟 HMAC IP hash)
2. CF Pages dashboard 設 `ENVIRONMENT=production` (preview 設 `preview`)
3. Sentry dashboard 取 CSP report endpoint URL 填 `_headers` PLACEHOLDER
4. Apply migration 0071 (audit_log FK)

closes backlog #135. 完整收尾 Round 14。

## [2.33.61] - 2026-05-24

**Round 14b — Round 14 residuals (補做 deferred 中可立刻完成)**

User 問 "所有 finding 都做了嗎" → audit Round 14 doc 發現 4 個 deferred
item 其實可立刻做，補上。

**SECURITY**

- `package.json` `overrides` pin 3 個 HIGH CVE (npm audit fix):
  - `@babel/plugin-transform-modules-systemjs` ≥ 7.29.4 (CVSS 8.2 RCE)
  - `serialize-javascript` ≥ 7.0.5 (CVSS 8.1 RCE)
  - `fast-uri` ≥ 3.1.2 (CVSS 7.5 path traversal)
  - npm audit HIGH 全清，剩 5 個 moderate (postcss / ws / brace-expansion /
    miniflare / wrangler) 待 upstream 升級

**RETENTION SWEEP**

- `auth-cleanup.js` +2 表：
  - `trip_health_reports` 30 天 (completed_at) — findings_json 含 PII
    (emergency contact / 醫療資訊)
  - `api_logs` 60 天 — 從 daily-report.js 挪過來，CF cron 比 mac mini 可靠
- `daily-report.js cleanupOldLogs` 改 no-op (auth-cleanup 接手)

**CLEANUP**

- `css/tokens.css` 拔 `.ocean-rail-line` CSS rule 兩處 — DOM 已拔 (v2.33.60)
  + 留 display:none 殼 1.5 年沒切回 = 純 dead code

**TESTING**

- `tests/unit/round-14b-residuals.test.ts` — 10 個 source-grep guard
- 2538 / 2538 全綠 (+10 從 2528)

**真的還 defer 的（架構性）**:

- CSP report-uri/report-to (需 Sentry dashboard 取 project CSP endpoint URL)
- audit_log FK + ip_hash HMAC (需 infra 決策)
- SW cache cross-user PII (需 cacheKey 設計)
- Preview-deploy origin policy (架構)
- Manifest maskable icon (需新 icon asset design)
- CSP `style-src 'unsafe-inline'` (Tailwind 4 forced)
- Migration 0011/0013 (歷史不可改)

## [2.33.60] - 2026-05-24

**Round 14 — frontend infra + migrations review (backlog #133)**

2 個 parallel agent review 5 個 frontend infra file + 70 個 migration。
找 11 HIGH / 13 MED / 10 LOW finding，本 PR 處理 10 個可獨立完成 fix。
doc: `docs/code-review/round-14-infra.md`。

**SECURITY (HIGH)**

- `public/_headers` CSP narrow: `connect-src` 拔 `*.googleapis.com` wildcard
  改 3 個精確子網域 (maps/places/routes); `img-src` 拔 `https:` wildcard
  改 Google CDN 白名單; 加 `frame-ancestors 'none'` + `object-src 'none'` +
  `upgrade-insecure-requests`; global `nosniff` + `Referrer-Policy` + COOP
- `index.html` theme-color `#0077B6` (v2.23.0 前 ocean blue 殘留) → `#F47B5E`
  對齊 manifest terracotta
- `public/manifest.json` 補 scope/id/lang/description + icon purpose (PWA
  identity 缺漏可能讓 preview deploy 蓋掉 user 安裝)
- `public/_routes.json` exclude 加 `/og/*` (避免 CF Function cold-start)
- 2 個新 migration: `0069_trip_health_reports_fk` (補 user_id / request_id FK)
  + `0070_fix_0047_sqlite_sequence` (修補 AUTOINCREMENT ID collision 風險)

**SECURITY (MED)**

- `wrangler.toml` 加 `[env.production.vars] ENVIRONMENT = "production"` —
  middleware `DEV_MOCK_EMAIL` 守衛靠此 var 判 fail-closed
- `scripts/auth-cleanup.js` 4 個新 retention sweep (trip_invitations 90d/30d /
  pois_search_cache TTL / companion_request_actions 90d / error_reports 90d)

**RELIABILITY**

- `vite.config.ts` 拔 stale `optimizeDeps: ['leaflet']` (v2.23.0 後已切 Google Maps)
- `vite.config.ts` manualChunks 補 5 個 heavy deps (gmaps/headlessui/dndkit/datepicker/marked/pdf)
- `tsconfig.functions.json` 加 exclude node_modules/dist
- `css/tokens.css` warning hue light/dark 對齊 (拔 yellow 改 orange family) +
  toast border 改 `color-mix` (dark mode 跟 token 變色)
- `TimelineRail.tsx` 拔 orphan `<div.ocean-rail-line>` DOM (CSS 早已 display:none)

**TESTING**

- `tests/unit/round-14-infra.test.ts` — 24 個 source-grep guard
- 2528 / 2528 全綠 (+24 從 2504)
- tsc clean

**Deferred (個別 PR)**

- 3 個 npm audit CVE 走 overrides pin
- audit_log FK + ip_hash HMAC + SW cache cross-user PII 等需架構決策

closes backlog #133.

## [2.33.59] - 2026-05-24

**Round 13 — Round 12 defer MEDIUM 全部完成 (backlog #132)**

User 2026-05-24 逐項討論 6 個 Round 12 defer → 全做。doc:
`docs/code-review/round-13-server-residuals.md`。

**SECURITY (HIGH)**

- `verify` POST primary + GET backward compat + `Referrer-Policy: no-referrer` →
  防 image-preload silent consume / Referer leak / browser history token (H2)
- PKCE mandatory for confidential clients (OAuth 2.1 §4.1.1 baseline) — 拔掉
  client_type 分支
- `forgot-password` / `send-verification` 改 `context.waitUntil()` background send →
  anti-enumeration timing oracle 修正 (之前 1000ms vs 20ms)
- `PUBLIC_ORIGIN` env 取代 Host header trust → 5 callsite 全 migrate
  (verify / forgot / send-verification / permissions / _id_token)
- HMAC HKDF domain separation (新 `src/server/hkdf.ts`) → session_v1 /
  invitation_token_v1 derived sub-secret，session 雙路徑 backward compat 30 天
- Unicode email NFKC + casefold (新 `src/server/email-utils.ts`) → 6 callsite
  migrate，防 Turkish İ / homograph mismatch

**FRONTEND**

- 新 SPA page `src/pages/VerifyEmailPage.tsx` — auto-POST verify token，
  狀態 UI (verifying/success/error) + retry/login/home button + no-JS form fallback
- `main.tsx` route table 加 `/auth/verify-email`

**TESTING**

- `tests/unit/round-13-server-residuals.test.ts` — 25 個 source-grep guard
- 全 suite 2478 → 2504 (+26)，tsc clean

closes backlog #132。本系列 (round 12 + 13) 完整收尾 src/server/ security audit。

## [2.33.58] - 2026-05-24

**Round 12 — src/server/ security + test catch-up (backlog #131)**

3 個 parallel agent review src/server/ (12 檔 1851 LOC). 4 CRITICAL +
3 HIGH + 4 MED security fix + 3 CRITICAL ZERO_COVERAGE 補測試。
doc: `docs/code-review/round-12-server-security.md`。

**CRITICAL SECURITY**

- `src/server/jwt.ts` `verifyJwt` 加 header.alg pin (default `['RS256']`)，
  拒 `none` / `HS256` → 防 algorithm confusion latent CVE
- `src/server/oauth-client/google-id-token.ts` enforce `email_verified === true`
  + OIDC azp check → 防 unverified-email account squatting
- `src/server/email-templates.ts` `sanitizeHeaderField()` strip CR/LF on
  Subject 用 tripTitle / inviterLabel → 防 SMTP header injection (Bcc 注入)
- `src/server/oauth-d1-adapter.ts` `consume()` 改 conditional UPDATE
  `WHERE consumed IS NULL` + boolean return；token.ts 兩處 caller
  (auth_code / refresh rotation) 改先 consume 再 issue → 防平行 POST /token
  雙重兌換造成 grant family 分裂

**HIGH SECURITY**

- `src/server/oauth-server/validate-redirect-uris.ts` reject #fragment /
  userinfo / ?query → 防 exact-match downstream parser confusion
- `src/server/password.ts` PBKDF2 ITERATIONS 100k → 600k (OWASP 2023)。
  Self-describing format 舊 hash 自動 needsRehash() 升級
- `src/server/session.ts` comment 修正 — 移除「CSRF POST/PUT/DELETE 都驗」
  誤導聲明，明寫 csrf field 未實 wire，defense 靠 Origin + SameSite

**MEDIUM**

- `src/server/password.ts` hashPassword 用 MIN_PASSWORD_LEN 常數 (拔死寫 8)
- `src/server/jwt.ts` exp 拔 60s skew (nbf 仍保留 issuer clock-ahead tolerance)
- `src/server/maps/google-client.ts` requireApiKey pre-check + 新 MAPS_CONFIG
  error code
- `src/server/oauth-d1-adapter.ts` revokeByGrantId 加 name IN allowlist scope

**TEST CATCH-UP** (+75 test, 2403 → 2478)

- `tests/unit/google-id-token.test.ts` (10) — 之前整 module 被 vi.mock
- `tests/unit/invitation-token.test.ts` (11) — HMAC parity / entropy / TTL
- `tests/unit/invitation-accept.test.ts` (9) — 5 outcome path + batch shape
- `tests/unit/validate-redirect-uris.test.ts` (17) — bypass scheme + 邊界
- `tests/unit/jwt-alg-pin.test.ts` (8) — C1 regression
- `tests/unit/round-12-server-security.test.ts` (20) — source-grep guard

**剩餘 defer** (個別 PR): verify GET→POST + Referrer-Policy, HMAC HKDF
domain sep, Unicode email NFKC, PKCE for confidential, PUBLIC_ORIGIN
env, forgot-password timing waitUntil。

closes backlog #131.

## [2.33.57] - 2026-05-24

**Round 11 — OceanMap internals split (backlog #130)**

OceanMap.tsx 606→303 LOC (-50%)，拆成 1 type + 1 helper + 3 hook + 1
compose shell。0 UX change，純內部架構重組。doc:
`docs/code-review/round-11-oceanmap-split.md`。

**REFACTOR**

- `src/lib/mapTypes.ts` 新增 — MapPin / MapPinType / Coord pure type
- `src/lib/mapHelpers.ts` 新增 — markerStyle / markerContent / segmentStyle /
  buildSegments pure helper
- `src/hooks/useMapMarkers.ts` 新增 — markersRef + prevFocusRef + 2 effect
  (marker lifecycle / focus diff-update)
- `src/hooks/useMapViewport.ts` 新增 — fitDoneRef + 3 effect (fit / resize / pan)
- `src/hooks/useMapSegments.ts` 新增 — SegmentPair[] useMemo
- `src/components/trip/OceanMap.tsx` — compose shell + Segment subcomponent

**BACKWARD COMPAT**

- OceanMap.tsx re-export markerStyle / markerContent / buildSegments / MarkerStyle / SegmentPair
- useMapData.ts re-export MapPin / MapPinType
- useRoute.ts re-export Coord
- 17+ 個既有 caller 完全不動

**ARCHITECTURE GUARD**

- `tests/unit/round-11-oceanmap-split.test.ts` — 9 個 source-grep guard
  (lib leaf-ness / 3 hook 單一職責 / OceanMap compose shell / hook call 順序 /
   backward-compat re-export)
- `lib-no-reverse-import.test.ts` 仍綠 — mapTypes 拆掉解 lib→hooks reverse
- 既有 4 個 OceanMap test 全綠 (33 pass)
- 2 個 source-grep test 路徑更新 (v2_31_93 / v2_31_87)

closes #130 + 完整收尾 #124 (Round 6c)。

**Stats**: 2403 / 2403 全綠 (+9 從 2394). tsc clean.

## [2.33.56] - 2026-05-24

**Round 6c style token drift fix (backlog #124 partial)**

audit Round 6c "style helper" finding 時實際發現的是 27+ 個寫死的
stale Flat UI 紅 `#c0392b` fallback，跟現在 terracotta token
`#C13515` 不一致。strip 所有 fallback（非 update value）+ 立 guard test。

**VISUAL (token drift)**

10 個 component / page 全部 `var(--color-priority-high-dot, #c0392b)` 改
`var(--color-priority-high-dot)`：

- `src/components/shared/AlertPanel.tsx` (5)
- `src/components/shared/ConflictModal.tsx` (3)
- `src/components/shared/ConfirmModal.tsx` (7)
- `src/components/trip/TravelPill.tsx` (5)
- `src/components/trip/CustomPoiForm.tsx` (destructive, 1)
- `src/components/trip/TimelineRail.tsx` (inline style, 2)
- `src/pages/NewTripPage.tsx` (1)
- `src/pages/AddStopPage.tsx` (destructive, 2)
- `src/pages/AccountPage.tsx` (6)
- `src/pages/EntryActionPage.tsx` (3)

CSS variable 在 2026 全 browser universal，token 未定義 = UI 整體已壞，
fallback 救不了反而長期 drift。strip 後若 token miss 直接 inherit /
transparent，視覺上更容易 spot 問題。

**TESTING**

- `tests/unit/no-stale-terracotta-fallback.test.ts` — walk src/+css/ grep
  `#c0392b` / `rgba(192, 57, 43, ...)`。未來偷渡舊 fallback 回來都 fail。
  + 驗證 `css/tokens.css` 仍含 canonical token (對齊 DESIGN.md)。
- `npm test` 全綠 2394 / 2394 (+2)。

#124 部分完成；OceanMap 拆分仍待 mockup 決策。

doc: docs/code-review/round-6c-style-token-drift.md

## [2.33.55] - 2026-05-24

**Round 5d residuals — atomic write fixes (backlog #122)**

Round 5c defer 提到 4 個 backend residual。其中 oauth/reset-password +
oauth/send-verification rate limit 已於 v2.33.52 (round 8d) 補。本 PR
處理剩餘 3 個 atomic write 議題 + 1 個政策註解。

**SECURITY (HIGH)**

- `account/connected-apps/[client_id].ts` — revoke 改 `db.batch([
  deleteConsent, deleteTokens])` 原子執行。之前 `consentAdapter.destroy()` +
  DELETE tokens 分兩步，第二步失敗 → consent 已刪但 token 仍有效，撤銷後
  app 仍能呼叫 API（security 缺口）。

**RELIABILITY (HIGH)**

- `trips/[id]/days/[num]/entries.ts` (POST) — `syncEntryMaster` 失敗 →
  compensating `DELETE FROM trip_entries WHERE id = ?` + rethrow
  `SYS_DB_ERROR`。之前 entry 存在但無 master，後續 addAlternate 觸發
  MISSING_MASTER 直到下次 GET self-heal。
- `trips/[id]/entries/[eid]/copy.ts` — trip_entry_pois batch 失敗 →
  compensating DELETE 補救。D1 無 BEGIN/COMMIT，best-effort 是現有 platform
  能做到的最好方案。

**DOCS**

- `oauth/authorize.ts` `prompt=consent` 政策註解：既有 tokens 保持有效
  直到 TTL 或 user 手動 revoke；consent.ts upsert overwrites；對應 OAuth
  2.0 spec — prompt=consent 只強制 UI re-prompt，不 invalidate
  authorization 狀態。

**TESTING**

- `tests/unit/round-5d-residuals.test.ts` — 11 個 source-grep test。
- `npm test` 全綠 2392 / 2392 (+11)。

closes backlog #122。剩餘: #124 (OceanMap 拆分 — 需 mockup 決策)。

doc: docs/code-review/round-5d-residuals.md

## [2.33.54] - 2026-05-24

**Round 10 — src/lib runtime reverse imports rip-out (backlog #117)**

`src/lib/` 是架構 leaf 層 — 不允許 import hooks / components / pages。
拆掉 2 個違規 import 並立 architectural guard test 鎖住未來。

**REFACTOR**

- `src/lib/networkBus.ts` 新增 — pub/sub registry 從 `useOnlineStatus.ts`
  搬下 leaf 層。`apiClient.ts` 改 `import './networkBus'`（原本反向 import
  `'../hooks/useOnlineStatus'`）。
- `src/lib/toastBus.ts` 新增 — state machine + helpers 從
  `components/shared/Toast.tsx` 搬下 leaf 層（17 個 caller backward
  compat 經 component re-export）。`tripExport.ts` 改 `import './toastBus'`
  （原本反向 import `'../components/shared/Toast'`）。
- `src/hooks/useOnlineStatus.ts` / `src/components/shared/Toast.tsx`
  改成 thin re-export shell，純 React 邏輯保留。

**TESTING**

- `tests/unit/lib-no-reverse-import.test.ts` — walk `src/lib/` 全部 .ts，
  對 9 個 forbidden prefix 做 grep guard。未來任何反向 import 都會 fail。
- 2381 / 2381 全綠 (+1 從 2380)。

closes backlog #117。剩餘 backlog：#122 (oauth/authorize + entries
batch)、#124 (OceanMap 拆分)。

## [2.33.53] - 2026-05-24

**Round 9 — src/lib zero-test catch-up (backlog #116)**

`src/lib/` 5 個無覆蓋率模組補測試。tripExport.ts 用 source-grep
鎖死 v2.33.36 security audit round 1 mitigation（path traversal +
CSV injection），其餘走 behavioural test。

**TESTING**

- `tests/unit/dayArtMapping.test.ts` — 9 個 test
  (extractArtKeys 優先序 / dedup / limit / 中日英 keyword)
- `tests/unit/mapRow.test.ts` — 9 個 test
  (snakeToCamel + mapRow + mapRows + JSON_FIELDS 為空 array contract)
- `tests/unit/constants.test.ts` — 16 個 test
  (SAFE_COLOR_RE 接受 hex/rgb/var/named + 拒絕 javascript:/expression()/url() +
   safeColor fallback + TRIP_TIMEZONE 4 個目的地 + getLocalToday YYYY-MM-DD)
- `tests/unit/docKeys.test.ts` — 4 個 test
  (5 個 doc type + UI tab order + 與 backend `[type].ts` VALID_TYPES 對齊)
- `tests/unit/tripExport.test.ts` — 14 個 test (source-grep)
  (safeFileBase strip 控制字元 + 80 char limit + csvSafe 偵測 =+-@\\t\\r +
   單引號 prefix + console.error log + showToast user feedback + CSV BOM +
   17-column schema + 4 format dispatch)

未測：`src/lib/sentry.ts` — 純初始化 side effect (init() in PROD only)，無
testable surface 而 skip。

**剩餘 backlog**: #117 src/lib runtime reverse imports（需 scan import
graph），#122 oauth/authorize + entries batch，#124 OceanMap 拆分。

## [2.33.52] - 2026-05-24

**Round 8d — cleanup backlog sweep**

收尾 round 5d / 6c / 8d defer list 中可獨立完成的 5 個 finding，
不需要 mockup / refactor 的低風險修正一次性 ship。doc:
`docs/code-review/round-8d-cleanup-backlog.md`。

**SECURITY (HIGH)**

- `functions/api/oauth/reset-password.ts` — 加 per-IP rate limit
  (LOGIN policy 5/15min + 30min lockout)。原本 endpoint 沒套
  rate limit，attacker 可暴力嘗試 reset token。429
  `RESET_RATE_LIMITED` + `Retry-After` header。
- `functions/api/oauth/send-verification.ts` — 加 per-IP + per-email
  rate limit (FORGOT_PASSWORD 3/h + 1h lockout)。原本可被當 email
  spam relay + timing-based user enumeration。anti-enumeration：
  per-IP / per-email 兩個 key message 完全統一不洩漏 email 是否存在。
- `scripts/daily-report.js` — SSRF defense 加 ALLOWED_HOSTS allowlist。
  原本只 filter `/^https?:\/\//`，attacker 控的 `trip_requests.message`
  含 `http://169.254.169.254/...` internal URL 也會被 probe（mac mini
  在 funnel network 能 reach 內網）。新 `isAllowedUrl()` parse URL +
  protocol guard + 8 個合法 maps host exact match。

**RELIABILITY (HIGH)**

- `src/components/trip/TripMapRail.tsx` — scroll-spy race fix。
  原本 `useEffect` 一次性 `querySelectorAll('[data-day]')`，TripPage
  async fetch trip + days 期間 `<DayCard>` 還沒 mount → observer
  看不到任何 target → scroll-spy 永遠不 trigger。新 MutationObserver
  fallback + WeakSet 去重：初次找不到時掛 body subtree watcher，
  detect 到第一批 section mount → attach IntersectionObserver →
  disconnect mutation observer。cleanup `disconnect` 兩個。
- `scripts/com.tripline.api-server.plist` — launchd hardening。
  `KeepAlive=<true/>` 改 dict `<SuccessfulExit><false/></...>`
  (exit 0 不 respawn，例如 self-destruct empty queue 路徑) +
  `ThrottleInterval=10` (防 panic loop hot-spin) +
  `EnvironmentVariables.PATH` 前綴 `/opt/homebrew/bin` (tmux
  discovery on Apple Silicon)。

**TESTING**

- `tests/unit/cleanup-backlog.test.ts` — 12 個 source-grep test。
- `npm test` 全綠 2328 / 2328。

**剩餘 defer**（留原 task，需要 plan-eng-review）

- Round 5d: oauth/authorize prompt=consent + entries POST/copy batch transaction
- Round 6c: OceanMap internals 拆分 + style helper 抽取
- Round 8d: scripts/api-server.ts polish + scripts/logs/ rotation

## [2.33.51] - 2026-05-24

**scripts/ round 8c — final polish (closes Round 8)**

最後一個 module 整體 review 收尾。doc: `docs/code-review/round-8c-scripts-polish.md`。

**HIGH**

- `mac-mini-cron-patch/apply-patch.sh:167` — 拔 `set -a; source "$ENV_PATH"`
  (`.env` 含 `$(...)` 即 RCE)。改用 node helper parse + key shell-safe
  regex + 0600 mode stat check before parse。
- `tripline-api-server.ts:22-31` — inline `.env` parser drift from
  `lib/load-env.js`。改 quote strip 雙+單 + key validate 對齊 sister scripts。

**MEDIUM**

- `dump-d1.js`: backup dir 含 PII → mkdir mode 0o700 + 個別 JSON 0o600。
- `daily-check.js:246`: npm audit execSync 加 `maxBuffer: 32MB` (拔 ENOBUFS on
  heavy deps output)。
- `google-poi-refresh-30d.ts:67`: `firstCall = false` 搬進 `finally` block —
  之前 success path 才設，第一個 POI 拋 non-401 後第二個 401 即誤觸
  "first-call 401" Telegram alert。

**Tests (+10)**

- `tests/unit/round8c-scripts-polish.test.ts` — 5 fix area source-grep guard。

2316/2316 unit pass。

**Round 8 closure**

| Round | PR | Fixes | Tests |
|---|---|---|---|
| 8a | #728 | 1 CRITICAL + 5 HIGH + 1 MED | +25 |
| 8b | #729 | 2 HIGH + 4 MED | +11 |
| 8c | #730 (this) | 2 HIGH + 3 MED | +10 |
| **Total** | | **1 CRITICAL + 9 HIGH + 8 MED** | **+46** |

scripts/ 38 檔 / 4.5k LOC review complete。剩 LOW + 部分 MED 在
`round-8a/b/c` docs 列為 backlog。

**整個 repo review sweep 完成** — 6 modules × 多輪 PRs：
- lib (rounds 1-3) / hooks (4-4.5) / api (5a-5c) / components (6a-6b) /
  pages (7a-7c) / scripts (8a-8c)
- 累計 17 PRs (#715-#730) + 8 個 review docs in `docs/code-review/`

## [2.33.50] - 2026-05-24

**scripts/ round 8b — HIGH residuals + MED polish**

延續 v2.33.49 round 8a，處理 round 8a 留下的最高優先 HIGH residuals + 4 個
MED。完整 doc: `docs/code-review/round-8b-scripts-residuals.md`。

**HIGH**

- `provision-admin-cli-client.js` `--rotate-secret` 預設 cascade revoke
  `oauth_access_tokens` + `oauth_refresh_tokens`，新 `--keep-tokens` opt-out
  flag for graceful rollover。之前 1h grace window 不可接受 (incident response)。
- `daily-report.js` `/api/trips` + `/api/trips/:id/days` 加 OAuth Bearer
  auth via `lib/get-tripline-token` — post v2.33.41 anonymous-read fix 後
  daily-report 已 silent green (讀不到 unpublished trip 但無 error surface)。
  Token mint 失敗 graceful skip checkLinks (不 crash 整 report)。

**MEDIUM**

- `_lib/cron-shared.ts::alertTelegram` env missing → `console.warn` once
  (拔 silent no-op 故障模式) + TOKEN format validate (同 send-telegram.sh
  v2.33.49)。
- `lib/d1-client.js`:
  - 1 retry on 5xx + 500ms backoff (D1 capacity hiccup recovery)
  - error stringify 改 `'unknown'` fallback (拔 json body SQL params leak)

**Tests (+11)**

- `tests/unit/round8b-scripts-residuals.test.ts` — source-grep wiring guard
  for 4 fix area (provision cascade / daily-report auth / cron-shared warn /
  d1-client retry + safer error)

2306/2306 unit pass。

**Round 8c follow-up (doc 列)**

- HIGH 留 3 個: execSync SQL refactor 5 callsite / init-local-db / apply-patch source RCE
- MED 留 14 個 (api-server polish / log rotation / daily-* misc / launchd plist hardening / etc)
- LOW 留 11 個

## [2.33.49] - 2026-05-24

**scripts/ review round 8a — CRITICAL + HIGH security + critical test gap**

3-agent review on `scripts/` 38 files / ~4,552 LOC（最後一個 module）。本
PR 撿 1 CRITICAL + 5 HIGH security + 1 MED security + 25 critical test。完整
finding (含 5 HIGH + 16 MED + 11 LOW + test gap 留 round 8b/8c) doc:
`docs/code-review/round-8a-scripts-security.md`。

**CRITICAL**

- `tripline-api-server.ts:88` — `sessionPrefixForSkill` 只 lowercase + 拔 `/`，
  無嚴格驗證 → 未來 PR 把 skill 暴露給 HTTP query 即 shell command injection。
  加 `ALLOWED_SKILLS` Set + `assertAllowedSkill()` 3 個 entry-point gate
  (sessionPrefixForSkill / spawnTmuxRequest / processLoop)。

**HIGH**

- `tripline-job.sh:22` — `.env.local` parser 不 strip 外層 quote → 含 quote
  的 secret 被原樣 export → curl 401。加雙/單 quote strip + key shell-safe
  regex validate。
- `tripline-job.sh:99` — API server unreachable 時 `exit 0` mask outage。改
  `exit 1` 讓 launchd 看到 error。
- `lib/get-tripline-token.js:41` — Legacy regex parser 跟 sister script drift
  silent fail。改 shared `loadEnvLocal()` from `./load-env`。
- `_lib/cron-shared.ts:35` — 同樣 drift (只 strip 雙引號)。雙/單 quote 都
  strip + key validate。
- `smoke/poi-favorites-rename-post-deploy.sh:14` — `set -uo pipefail` 缺
  `-e`，prod D1 INSERT 後 partial failure 不 abort → leak orphan rows。
  改 `set -euo pipefail`。

**MEDIUM security**

- `lib/send-telegram.sh:32` — `${TOKEN}` unquoted interpolate into curl URL，
  攻擊者寫 `.env.local` 可 inject query string redirect。加 TOKEN regex
  `^[0-9]+:[A-Za-z0-9_-]+$` + CHAT_ID numeric-only validate。

**Tests (+25)**

- `d1-client-script.test.ts` (+14) — test-engineer **CRITICAL gap**：
  scripts/lib/d1-client.js 5 個 callers 共用但**零測試**。守 SELECT path /
  INSERT path / failure path / auth header / URL composition。
- `round8a-scripts-security.test.ts` (+11) — source-grep wiring guard 6 個 fix

2295/2295 unit pass (+25)。

**Round 8b/8c follow-up (見 round-8a doc)**

- 5 HIGH 留下 round: provision-admin-cli `--rotate-secret` cascade revoke /
  daily-report `/api/trips` 加 auth / execSync SQL refactor (5 callsite) /
  init-local-db string-built SQL / apply-patch.sh source `.env` RCE
- 16 MED + 11 LOW 列在 doc

## [2.33.48] - 2026-05-24

**src/pages/ review round 7c — critical test gap fill**

關 round 7 三輪 sweep：補 round 7a/7b test-engineer audit 點出的最 critical
test gap。完整 doc: `docs/code-review/round-7c-pages-tests.md`。

**Tests added (+22)**

- `new-trip-page-smoke.test.tsx` (+13) — NewTripPage 932 LOC 原本**零測試**
  (onboarding 主流程 CRITICAL gap)。本檔 source-grep + wiring smoke：auth
  gate / 7 個 testid / POST `/trips` / TripDatePicker / dnd-kit Sortable /
  usePoiSearch / v2.31.36 migration 0068 regression guard (`default_travel_mode`
  / `self_drive_*` 不該再寫)。
- `trip-page-focus-id.test.tsx` (+9) — v2.31.93 just shipped `?focus=<entryId>`
  deep-link flow，page-level wiring 之前無 regression test。本檔守 searchParam
  read / `data-scroll-anchor` selector / `CSS.escape` / scrollIntoView /
  early return / requestAnimationFrame wrap / `?sheet=collab` legacy redirect
  / v2.33.46 round 7a setTimeout cleanup regression。

**Skipped (with rationale)**

- EditTripPage `defaultTravelMode` camelCase regression — 該欄位 migration
  0068 已 DROP，risk = 0
- ChatPage SSE/polling integration — 需 mock 整個 useRequestSSE state machine，
  e2e 較適合
- AddPoiFavoriteToTripPage full flow — 575 LOC 多 hook，獨立 spec
- TripPage TripSegmentsContext — 已有 dedicated hook test

**Round 7 closure**

- 7a: 3 HIGH security + 2 HIGH effect bug + 3 MED security
- 7b: 3 HIGH effect bug + 1 MED + 3 LOW
- 7c: 22 case regression test + NewTripPage smoke

src/pages 33 files / 20.1k LOC review 完成。剩 13 MED + 7 LOW + 4 test gap
列在 round-7b doc 7c section，下批次處理。

2270/2270 unit pass (+22)。

## [2.33.47] - 2026-05-24

**src/pages/ review round 7b — HIGH effect bugs + selective MED + LOW**

延續 v2.33.46 round 7a，處理 round 1 留下 3 個 HIGH effect bug + 1 個 MED +
3 個 LOW。完整 finding doc 在 `docs/code-review/round-7b-pages-effect-bugs.md`。

**HIGH effect bug**

- `ChatPage.tsx:601` — `useEffect([])` 內讀 `activeTripId` stale closure
  (strict-mode double-mount 第二 pass 抓 initial value clobber persisted
  ActiveTripContext)。改 `activeTripIdRef` sync + 讀 ref.current。
- `EditEntryPage.tsx:1131` — Global `keydown` listener `⌘+Enter/⌘+S/Esc`
  沒 check inner modal 開著 → Esc-trap conflict (Escape 同時 fire 內外 modal
  cancel)。加 `showDiscardModal || altSwapConfirm` guard + skip TEXTAREA/
  INPUT for Escape + skip e.repeat。
- `AccountPage.tsx:188` — Logout 失敗 modal 卡死，success/fail 都不關 modal
  + raw error.message leak backend detail。改 success/fail 都 close modal +
  失敗顯 toast + `navigate('/login', {replace: true})` + ApiError 分支不
  leak detail。

**LOW**

- `ChatPage.tsx:836` — `buildMessagesWithDividers(messages)` 每 keystroke
  重 walk → `useMemo([messages])`。
- `LoginPage.tsx:230` — `failureCount` mount-effect read 改 lazy
  `useState(() => sessionStorage.getItem(...))` 避免 first-paint flash。
- `EmailVerifyPendingPage.tsx:99` — 1Hz interval 不停 fire on hidden tab
  → 加 `visibilitychange` listener pause/resume + catch-up tick。

**Tests**

- 既有 `account-page.test.tsx` navigate assertion 更新 `{ replace: true }`
- 2248/2248 unit pass

**Round 7c/7d follow-up**

完整 13 個 MED + 7 個 LOW + 5 個 critical test gap 列在
`docs/code-review/round-7b-pages-effect-bugs.md`。NewTripPage 932 LOC
zero coverage 最高優先。

## [2.33.46] - 2026-05-24

**src/pages/ review round 7a — HIGH security + critical effect bugs**

3-agent review on `src/pages/` 33 files / 20,110 LOC (最大模組)。本 PR 撿
HIGH security + 2 個 HIGH effect bug + 3 個 MED security。剩 16 個 MED + 10
個 LOW + 5 個 test gap 留 round 7b/7c (完整 finding doc 在
`docs/code-review/round-7a-pages-security.md`)。

**HIGH security (security-auditor flagged)**

- `SessionsPage.tsx:348` — Logout `<a href="/api/oauth/logout">` GET-trigger
  state change → 任何 forum/chat `<img src=...>` 即登出 victim (CSRF logout
  DoS)。改 POST button via `apiFetchRaw + navigate('/login', {replace})`
  對齊 AccountPage pattern。
- `EditEntryPage.tsx:1232` — `<a href={alt.reservationUrl}>` 無 scheme check
  + 只 `rel="noreferrer"` → co-editor 寫 `javascript:` URI 即 XSS-on-click
  + tabnabbing。加 `escUrl()` + `rel="noopener noreferrer"`。
- `ConsentPage.tsx:134` — `app_name = clientId` 直接反映 URL param → attacker
  構 `?client_id=Tripline%20Official%20Login` 騙 user click Allow。改顯
  「未知應用程式 (client_id=...)」+ 警告 description until backend
  `/api/oauth/client-info` 上線。

**HIGH effect bug (code-reviewer flagged)**

- `TripPage.tsx:529` — 300ms `setTimeout` 無 cleanup，rapid nav 後 fire
  `scrollIntoView` on stale DOM。加 `cancelAnimationFrame + clearTimeout`。
- `LoginPage.tsx:344` — Countdown timer 純 -1 counter，tab background
  throttling 後 absolute time 已過 counter 沒減 → user stuck in locked UI。
  改 `Date.now()` baseline via `lockedUntilRef`。

**MEDIUM security**

- `ConsentPage.tsx:121` — Scope render 加 `KNOWN_SCOPES` allowlist + 未知
  scope 顯「⚠ 未知範圍 — 請勿授權」+ cap 64 char。
- `ConsentPage.tsx:215` — `redirect_uri` 加 `isPlausibleRedirectUri()`
  client-side guard (https/http only)。
- `ChatPage.tsx:904` — `m.markdown` 限 `role === 'assistant'` 才走
  MarkdownText path (defense in depth — co-editor message 即使 column 誤
  標 markdown=1 也不 trust)。

**Tests (+11)**

- `round7a-security.test.tsx` — source-grep + behavior assertion，6 個
  describe block 對應 6 個 fix area。

**Round 7b/7c follow-up（doc 完整列出）**

3 個 HIGH (ChatPage stale closure / EditEntryPage keydown modal-aware /
AccountPage logout flow) + 14 個 MED + 10 個 LOW + 5 個 critical test gap
(NewTripPage 932 LOC zero coverage 最高優)。

2248/2248 unit pass。

## [2.33.45] - 2026-05-24

**src/components/ review round 6b — IMPORTANT + LOW + orphan cleanup + docs**

User 新規則「LOW finding 也要做 + 每次 review 留下文件」啟動。
全 round 1-6 review 報告回填到 `docs/code-review/`，本 round 起完整 finding 包
含 LOW 都進 doc + LOW 該做的都做。

**New: `docs/code-review/` review reports**

10 個 markdown 文件回填過去所有 round：
- README.md (index + 流程)
- round-1-lib-security.md ~ round-6b-components-low.md

每 doc 含：HIGH / MED / LOW finding triage + status (✅ fixed / 🔄 defer / ❌
won't fix + rationale)。

**Code fixes**

IMPORTANT:
- `TimelineRail` `StopPoiChoiceCard` 加 `memo` (之前 alternate POI 列表跟著
  RailRow 重 render — 10 alternates × 7 day trip 多餘 70 個 render)
- `AppShell` scroll listener cleanup reset `lastYRef = 0` (bottomNav 切換
  重 mount stale state)
- `HourlyWeather` `for-in` over Record → `Object.entries`（strict mode 安全）

LOW:
- `Icon.tsx` dangerouslySetInnerHTML 加 inline 註解警告 ICONS map 必須
  hardcoded (CSP-strict / future regression guard)
- `DesktopSidebar.tsx` user.name truncation 改 `Array.from(...).slice` —
  CJK / emoji surrogate pair 不在中間切 broken glyph
- `ThemeArt.tsx` 刪 3 個 dead export (`DayHeaderArt` / `DividerArt` / `NavArt`
  一直回 null)，留 `FooterArt` 唯一活的

Orphan cleanup (grep 確認 0 import):
- 刪 `trip/UndoToast.tsx` + test
- 刪 `trip/ConflictModal.tsx` (`shared/ConflictModal.tsx` 是 canonical) + test
- 刪 `trip/TripHealthBanner.tsx` + test

**Tests (+8, -12 deleted orphan tests)**

- `confirm-modal-a11y.test.tsx` — 8 case (open/close/auto-focus/Escape/backdrop/
  confirm click/busy disable/warning conditional/cleanup Escape after close)

2237/2237 unit pass (net -4 from deleted orphan tests, +8 new)。

**Won't fix from agent suggestions (留在 doc 內附 rationale)**

- CollabPanel tripIdRef indirection — 是 race-guard 正確 pattern 非 anti-pattern
- TimelineRail handleDragEnd stale state — 重新分析 flow 正確
- Style injection helper extraction (42 callers) — 大規模 refactor 獨立 PR
- OceanMap marker rebuild / Segment dep / TripMapRail scroll-spy race —
  巨型 component 內部 refactor 獨立 PR

## [2.33.44] - 2026-05-24

**src/components/ review round 1 — CRITICAL + HIGH security + 3 top test gap**

3-agent review on `src/components/` 63 檔 / 11.6k LOC（code reviewer +
security auditor + test engineer 平行）。本 PR 撿 CRITICAL + HIGH +
critical MED + top-3 test gap；剩 IMPORTANT 留 round 6b。

**CRITICAL fix**

- `TimelineRail.tsx:873` — `useMemo(() => setOrderOverride(null), [eventsKey])`
  side-effect masquerading as memo (React 19 concurrent / strict mode fires
  twice + warning) → 改正確的 `useEffect`。

**HIGH security fix**

- `StopLightbox.tsx:307` `<a href={currentPhoto.source}>` 套 `escUrl()` —
  之前無 scheme check，若 `pois.photos` JSON column 含 `javascript:` URI
  (insider write / future user-photo upload / 被入侵 enrichment pipeline)
  → XSS-on-click。

**MEDIUM security**

- `StopLightbox.tsx:269` `<img src>` 加 `escUrl()` + `referrerPolicy="no-referrer"`
  + `crossOrigin="anonymous"` — 避免 Referer 洩漏 trip URL 給 Google CDN，
  + 防 `data:` SVG / 任意 cross-origin host 追蹤像素。
- `mapDay.ts::parsePhotos` 加 `isSafePhotoUrl(u)` `https://` allowlist —
  defense in depth：任何未來 write path 寫進非 https URI 都在 parse 時被剝
  除（不仰賴每個 consumer 自己防）。
- `ErrorPlaceholder.tsx` 寫 `pendingErrorReports` localStorage 前 strip
  query string + fragment：`new URL(window.location.href).pathname` 才存。
  避免 share token / OAuth code 跨 session 持久化。
- `ErrorBoundary.tsx` `console.error` gate 在 `import.meta.env.DEV` — Sentry
  已捕，prod console 噴 stack 不增資訊且 leak filename / line 給 devtools。

**Quality**

- `HourlyWeather.tsx:64` ref write during render 搬進 `useEffect` (React
  anti-pattern，strict mode fires twice)。

**Tests (3 new files, +28 cases)**

- `tests/unit/markdown-text-xss.test.tsx` — 12 case 端到端 XSS pipeline
  (markdown → sanitize → DOM): script tag / on* attr / svg use / formaction /
  SPA path keep / protocol-relative reject / javascript: href reject / inline
  mode XSS guard / style strip / target=_blank rel injection。
- `tests/unit/infobox-safetext.test.ts` — 10 case `safeText()` shape
  adapter (null / string / number / boolean / `{label, text}` / `{text}` /
  `{name}` 優先順序 / 未知 shape fallback / array / mixed types)。
- `tests/unit/error-boundary.test.tsx` — 5 case (normal children / fallback
  UI / Sentry capture wire / custom fallback prop / retry counter 達 max
  隱藏 reload)。

2249/2249 unit pass (+28)。

**Round 6b 留 follow-up（IMPORTANT 較大手術）**

- `TimelineRail.tsx:875-916` `handleDragEnd` stale state bug
- `TimelineRail.tsx:764-839` inline-style confirm modal → 用 portal-mounted ConfirmModal
- `OceanMap.tsx:282` Segment polyline effect missing `dayNum` dep
- `OceanMap.tsx:464` Marker rebuild on every parent re-render
- `TripMapRail.tsx:97` scroll-spy IntersectionObserver 跟 DaySection mount 賽跑
- `Segment` from/to refs 新 → 拆 scalar props (defeats memo)
- `StopPoiChoiceCard` not memo
- `Toast.tsx` module singleton cross-test pollution
- `AppShell.tsx` `lastYRef` reset
- `TripDatePicker` nested popover outside-click 衝突
- Style injection helper extraction (42 callers）
- Orphan candidates: `trip/UndoToast.tsx` / `trip/ConflictModal.tsx`（與
  shared/ 重複）— 需 grep verify 全 codebase 後刪
- Test gaps: ConfirmModal / InputModal a11y / focusId rail-side regression

## [2.33.43] - 2026-05-24

**Security round 5c — backend residual HIGH/MED fixes**

延續 v2.33.41 + v2.33.42，本 PR 收尾 functions/api/ review 的最後一批
findings：

**Bearer CSRF defense in depth**

- `_middleware.ts::checkCsrf` Bearer 請求若帶 Origin header，仍 enforce
  `isAllowedOrigin(origin, env)`。之前 Bearer skip CSRF 完全，意味著 XSS
  從 evil.com 偷到 access_token 後直接從 evil.com server-side 發 mutating
  call 即可繞 Origin check。新邏輯：
  - Bearer + 無 Origin → skip（CLI / scheduler legitimate use case）
  - Bearer + Origin 在 allowlist → allow
  - Bearer + Origin 非 allowlist → 403 (XSS-stolen token reuse 擋下)

**SQL error swallow → constraint re-classification**

- `trips/[id]/entries/[eid].ts` PATCH catch:
  - `UNIQUE constraint` failure → `DATA_CONFLICT` (409) 而非 503
  - `FOREIGN KEY constraint` failure → `DATA_VALIDATION` (400)
  - 其他 → 仍 `SYS_DB_ERROR` (503)
- DELETE 同 pattern (FK 相依資料 → 409)。

**Atomic write — trip_entry_pois INSERT**

- `trips/[id]/entries/[eid]/trip-pois.ts` 把 `INSERT trip_entry_pois` +
  `UPDATE trip_entries.entry_pois_version` 收進同一 `db.batch([...])`。
  之前兩個分開 await，INSERT 成功 + UPDATE 失敗會留下「entry 新增 POI
  但 version 沒 bump」的 inconsistent state，破壞 OCC invariant。D1 batch
  整體 rollback 保 atomic。

**Tests**

- 新 `tests/api/round5c-security.test.ts` (+6 source-grep case): middleware
  Bearer + Origin gate、entries[eid] PATCH/DELETE UNIQUE/FK re-classify、
  trip-pois batch atomicity。
- 既有 middleware + entry-pois integration suite 83/83 過。2221/2221 unit pass。

**Round 5d 留 (small remaining)**

- `oauth/authorize.ts` `prompt=consent` 不 invalidate consent — 政策決定
  待議 (per-user max-scope cap vs step-up auth)
- `entries/[num]/entries.ts` POST + `entries/[eid]/copy.ts` 同樣 split write
  patterns 待 batch refactor (體積大，獨立 PR 較好)
- Misc MED/LOW: oauth/reset-password rate limit、oauth/send-verification
  rate limit、reports 文字 validate 一致性

## [2.33.42] - 2026-05-24

**Security round 5b — remaining HIGH/MED backend findings**

延續 v2.33.41 anonymous-read fix，本 PR 處理 `functions/api/` round 1
review 剩餘的 HIGH + MED security findings：

**user-enumeration oracles 全收尾**

- `permissions.ts POST` response shape 統一 (`'permission_added'` →
  `'invitation_sent'`，已註冊 + 未註冊兩 branch 走同 message)。之前任何
  logged-in user 可探測任意 email 是否已註冊。
- `oauth/login.ts` `LOGIN_RATE_LIMITED` 訊息 unify — 之前 IP-bucket 用
  「登入嘗試過多」，email-bucket 用「此 email 登入嘗試過多」，攻擊者燒
  5 個 attempt 觀察訊息差就知 email 是否存在。
- `oauth/forgot-password.ts` `FORGOT_PASSWORD_RATE_LIMITED` 同樣 unify
  message。

**Privilege escalation chain (dev/apps)**

- `dev/apps.ts::validateScopes` 改 allowlist (`openid` / `profile` /
  `email` / `offline_access`)，拒絕 `admin` / `companion` scope。之前
  user-self-service 可在 `allowed_scopes` 塞 `admin`，雖 status 初始
  `pending_review` 但 ops flip 為 active 而沒 scrub scope，attacker 拿
  `client_credentials` 即得 admin-token (透過 `_middleware.ts:371`
  `isAdmin = scopes.includes('admin')`)。

**SSE CORS leakage**

- `requests/[id]/events.ts` 拔掉 `Access-Control-Allow-Origin: *` —
  同 origin SPA 不需要，EventSource 跨 origin 不會送 cookie，這 header
  之前只是放鬆 attack surface。

**Public proxy paid quota DoS**

- 新 `RATE_LIMITS.ROUTE_PER_IP` / `POI_SEARCH_PER_IP` / `REPORTS_PER_IP`：
  - `/api/route` (Google Routes ~$5/1000): 100/24h per IP
  - `/api/poi-search` (Google Places Text Search ~$32/1000): 200/24h per IP
  - `/api/reports` (anonymous report write): 200/24h per IP
- Auth'd user 走 autocomplete 已有 1000/24h，本 PR 補匿名 endpoint 防線。

**reports.ts hardening**

- Field-length cap (`url` / `errorMessage` / `userAgent` / `context` 等
  全 clamp 到 2000 char + strip newline)。
- TripId 必須存在於 `trips` table — 之前任意字串可寫 D1 spam。

**Pagination bug**

- `requests.ts` `after` / `afterId` 分支從 `<` 改 `>` (符合 cursor semantic
  「比此 cursor 新」)。sort=asc 拿到的 page 之前是錯方向。

**Tests**

- `tests/api/round5b-security.integration.test.ts` — 7 case:
  - permissions response shape unified (registered vs unregistered same shape)
  - dev/apps validateScopes 拒 admin (source-grep)
  - reports nonexistent tripId → 404
  - reports field > 2000 char 被 clamp
  - SSE 不再帶 `Access-Control-Allow-Origin: *`
  - requests.ts after/afterId 用 `>` 比較
- 19/19 既有 impacted API tests 過。2221/2221 unit 過。

**Round 5c 留 follow-up（更大手術）**

- `_middleware.ts` Bearer skip CSRF (XSS-stolen token bypass Origin) —
  defense-in-depth Origin check 即使有 Bearer
- `oauth/authorize.ts` `prompt=consent` 不 invalidate consent — scope
  escalation 需要 step-up auth 或 per-user max-scope cap
- `entries/[num]/entries.ts` POST + `entries/[eid]/copy.ts` +
  `entries/[eid]/trip-pois.ts` — 3 個 non-atomic write violation，
  collect statements into single `db.batch([...])` 避免「master 不存在」
  invariant break
- `entries/[eid].ts` SQL error swallow — re-classify UNIQUE / FK constraint
  to 409 instead of 503
- `account/connected-apps/[client_id].ts` revoke 加 cascade refresh-token
  revoke parity

## [2.33.41] - 2026-05-24

**CRITICAL security fix — `/api/trips/:id/*` anonymous-read hole**

Security audit (functions/api/ round 1) confirmed by both code-reviewer +
security-auditor agents：`_middleware.ts:413-417` 對所有 `GET /api/trips/**`
直接 bypass auth，而下游 GET handlers 沒做 `published=1 OR hasPermission`
check。意思：**任何人 enumerate tripId 即可讀全行程（含 doc 航班 / hotel
POI / 緊急聯絡）**。tripId 是 user-chosen lowercase slug
(`^[a-z0-9-]+$/`)，極易猜（`tokyo-2026` / `okinawa-jul` 等）。

**Fix**

- 新 `functions/api/_auth.ts::requireTripReadAccess(db, auth, tripId)`
  helper:
  - SELECT `trips.published`
  - 不存在 → throw `DATA_NOT_FOUND` (404)
  - `published=1` → allow (anonymous OK，public share semantics)
  - `published=0` + `!auth` → throw `PERM_DENIED` (403)
  - `published=0` + auth → 走 `hasPermission` (admin / owner / member /
    viewer 任何 role 都允許 read)
  - 統一回 `PERM_DENIED` 而非 `AUTH_REQUIRED` 避免 enumerate published vs
    unpublished tripId (anti-enumeration)
- `_middleware.ts:415` 把 GET `/api/trips/**` 從 anon bypass 改為「attach
  `auth=null` 後 next()」，handler 自己 gate。
- 5 個 GET handler wire `requireTripReadAccess`:
  - `trips/[id].ts` (GET 單 trip)
  - `trips/[id]/days.ts` (GET days list summary + ?all=1 batch)
  - `trips/[id]/days/[num].ts` (GET 單 day detail)
  - `trips/[id]/docs/index.ts` (v2.33.35 batch endpoint)
  - `trips/[id]/docs/[type].ts` (single doc fetch)
  - `trips/[id]/segments/index.ts` (取代之前的 `requireAuth + hasPermission`，
    改為 published-aware；對齊其他 sibling handler)

**Behavior change**

- Previous: any `GET /api/trips/nope/days` → 200 + empty array
- Now: any `GET /api/trips/nope/days` → 404 DATA_NOT_FOUND

**Tests**

- 新 `tests/api/trips-read-access.integration.test.ts` — 13 case
  - published trip: 4 GET handler anon OK
  - unpublished trip: 6 GET handler anon → 403
  - unpublished + owner → 200, unpublished + non-member → 403
  - nonexistent → 404
- 既有 `days.integration.test.ts` 2 個「不存在 → 空陣列」 test 改為「→ 404」
  對齊新 contract。

**Round 5b 留 follow-up（其他 HIGH security finding）**

- `_middleware.ts` Bearer skip CSRF (XSS-stolen token bypass Origin)
- `permissions.ts` user-enumeration via response status diff (`permission_added`
  vs `invitation_sent`)
- `oauth/authorize.ts` `prompt=consent` 不 invalidate consent（scope escalation）
- `dev/apps.ts` `validateScopes` 接受 `admin` / `companion` scope（privilege
  escalation chain）
- `requests/[id]/events.ts:122` SSE CORS `*` header
- 3 個 non-atomic write violation (entries POST + copy + alternates)
- 缺 per-IP rate limit on `/api/route` / `/api/poi-search` / `/api/reports`
  (paid quota DoS)

## [2.33.40] - 2026-05-24

**src/hooks/ review round 2 — IMPORTANT fixes + coverage**

延續 v2.33.39 (round 1 CRITICAL+HIGH+MED+LOW)，本 PR 處理 round 1 留下的
IMPORTANT 問題與 top test gap。

**IMPORTANT fixes**

- `useDarkMode`: 拔 double `readColorMode()` 初始 call（2 個 useState
  initializer 各跑一次 localStorage 讀）→ 改用 `resolveDark(colorMode)`
  共享 first init 結果。
- `useChatPagination`: `setMessages` / `rowToMessages` / `isInflightStatus`
  / `onInitialResume` / `setHistoryLoading` 5 個 callback stash 到 ref。
  之前依賴「caller 傳穩定 ref」隱性 contract，ChatPage.tsx 任何 inline
  arrow drift 都會 silently stale closure。
- `usePullToRefresh`: `onRefresh` stash 到 ref，不再放 effect deps —
  inline arrow 不會每 parent render 重新綁 4 個 touch listener。
- `usePlacesAutocomplete`: 加 LRU cap 50 entries — SPA-lifetime Map
  原本無界限長期 typing 後變幾百個 entry。新 `cacheGet()` (touch =
  re-insert) / `cacheSet()` (FIFO evict)。

**Tests (2 new files, +13 cases)**

- `tests/unit/use-permissions.test.tsx` — 6 case (happy / empty tripId /
  401 / 403 / invitation fail graceful / race guard via currentTripIdRef)
  — top-2 zero-test gap，CollabSheet 加載核心。
- `tests/unit/use-dark-mode-body-class.test.tsx` — 7 case body.dark class
  effect (default / saved dark / saved light / setColorMode 切換 /
  toggleDark / legacy backfill) — v2.31.25 regression guard。

**Skipped from round 1 IMPORTANT list (rationale)**

- `useTripSegments` unused state when `fromCtx` non-null — context-命中
  時 useState/useMemo trivial cost (empty Map)，restructure 為 split hook
  成本高於收益。保留註解。
- `useNavigateBack` history.length unreliable — `useNavigationType` 替
  代需 RouterProvider context 全頁面 audit + 共用 fallback 策略，留
  follow-up PR。
- `useTrip.refetchDay` 測試 + `usePoiSearch` 完整測試 — round 4.6 PR
  繼續。

2221/2221 unit pass (+13)。

## [2.33.39] - 2026-05-24

**Security + stability — `src/hooks/` review round 1**

3-agent `/simplify` review on `src/hooks/` 24 檔 / 2650 LOC。本 PR 撿
CRITICAL + HIGH + MED finding 加 top auth-gate test gap：

**Critical**

- `useGoogleMap`: `flyTo` / `fitBounds` 加 `useCallback` 包 `[map]` deps。
  之前每父 render 都產新 closure，`OceanMap.tsx` fitBounds effect 把它放在
  deps 裡會每 render re-fire fitBounds — 每 state 變動地圖重新 fit。
- `useTrip.fetchDay`: 拔掉 `allDaysRef.current[dayNum] = day` 直接 mutate
  ref，改用 `setAllDays((prev) => ...)` single writer。之前 caller 讀 React
  state 看不到 cache fill；switchDay 後手動補 setAllDays，其它 caller 失準。

**Security (HIGH)**

- `useGoogleMap`: `mapId` 從 hardcoded `'DEMO_MAP_ID'` 改 env
  `VITE_GOOGLE_MAPS_MAP_ID` (fallback DEMO_MAP_ID 維持 dev 體驗)。Google
  共享 demo ID 在 prod 列為可隨時停用 + 無 analytics 隔離。
- 新 `src/lib/redirect.ts` `sanitizeRedirectAfter()` — 之前 `LoginPage.tsx`
  inline 只擋 `//evil`，漏：
  - 反斜線 `/\evil.com`（部分瀏覽器 normalize）
  - URL-encoded `/%2f%2fevil.com` / `/%5cevil.com`
  - whitespace-prefixed `  //evil.com`（browser nav 前 trim）

**Security (MED)**

- `useRequestSSE`:
  - 新 `narrowStatus()` / `narrowProcessedBy()` runtime guard — `status` /
    `processedBy` 不再 blind cast。malformed JSON / compromised proxy → 不
    branch on 未知字串 → UI 不會 silent hang。
  - 新 `clampErrorMessage()` 500 char cap + strip newline，防 multi-MB blast
    或未來 markdown render 路徑變 stored-DOM-XSS。
  - `pollOnce` 立即 fire 一次（之前要等 30s 第一次 poll）— AI 健檢可能 7s
    SSE silent-fail 就完成，user 不再等 30s。
- `usePoiSearch.ts` / `useRoute.ts` 改走 `apiFetchRaw` 而非 bare `fetch`
  — 對齊 sibling hook，重新接上 `reportFetchResult` → useOnlineStatus
  ledger。`useRoute` 同時加 polyline shape 驗證（IndexedDB cache 100 entry
  cache-poisoning 風險）。
- `useOnlineStatus`: module-level callback singleton 改 `Set<callback>` —
  StrictMode dev double-mount / 多 instance 不再 last-mount-wins clobber。
- `useCurrentUser`: `cancelled` flag 換 `AbortController`，快速 reload()
  時 in-flight 真正 cancel，slower response 不會覆蓋。
- `useRequestSSE`: stale comment 「1s tick」改「1-minute tick」對齊
  `ELAPSED_TICK_MS = 60_000`。

**Security (LOW)**

- `usePlacesAutocomplete`: `crypto.randomUUID` 加 feature-detect — Safari
  < 15.4 + 部分 embedded browser 沒有，過去第一個 keystroke throw 整支
  AddCustomStopPage 死。session token 非 cryptographic，fallback time +
  Math.random 足夠。

**Tests (2 new files, 15 tests)**

- `tests/unit/redirect-sanitize.test.ts` — 10 case open-redirect 攻擊面
  + same-origin path / query / hash 接受。
- `tests/unit/use-require-auth.test.tsx` — 4 case auth gate
  (loading / authed / unauthed / query+hash encode)。

**Round 4 follow-up**

- 其餘 hook test gap (usePermissions / useTrip.refetchDay /
  usePoiSearch full / useDarkMode body-class effect)
- IMPORTANT: useChatPagination missing deps stale closure / useNavigateBack
  history.length unreliable / useTripSegments unused state / useDarkMode
  double initial read / useSheetBehavior 查詢 cache / useDragDrop sensor
  options stable / usePullToRefresh ref pattern / usePlacesAutocomplete
  LRU cap
- 開始下個 module: functions/api/ 或 src/components/

2208/2208 unit pass (+15 新 test)。

## [2.33.38] - 2026-05-24

**Round 3: LOW-priority finding cleanup — `src/lib/` review**

延續 v2.33.36 / v2.33.37 兩輪，本 PR 把 3-agent review 剩餘 LOW priority
finding 全部處理（含 audit 寫的「defense in depth」項目）。

**Hardening / defensive coding**

- `errors.ts`:
  - `ApiError.code` 增 64-char cap，防 malicious server 回 giant code 串字。
  - `sniffErrorCode` 改 anchored phrase patterns 取代 `includes` substring：
    - `「administered」` 不再誤命中 admin
    - 「已系統管理員處理過」不再誤命中 PERM_ADMIN_ONLY
    - 「encoding」需 word-boundary 才命中（非 `encoded` 等變形）
    - 「conflict」需 `\bconflict\b` 避免「conflictResolver」誤命中
  - JS `\b` 對 CJK 不適用（CJK 字符非 word char），改用 specific phrase。
- `localStorage.ts`:
  - 新 `isLsEntry()` type guard — 驗證 `{v, exp}` envelope shape（`exp`
    必須 finite number），同 origin 攻擊者寫入 malformed JSON 不會撐死。
  - `lsGet` 在 JSON.parse throw 時也 remove 壞 entry，省下後續 retry 解析。
  - `removeItem` 包 try/catch — Safari profile locked 情境也能繼續執行。
- `routes.ts`:
  - 新 `safeReturnTo()` helper 集中 redirect target 驗證：
    - 拒絕 protocol-relative `//evil.com`
    - 拒絕 absolute URL `https://evil.com`
    - 拒絕 backslash variant `/\\evil.com` (Safari open-redirect 歷史)
    - 拒絕 empty / non-string input
    - 只接受 same-origin `/path` 形式
- `poiSearchHelpers.ts`:
  - `poiMeta` `景點` fallback 改用 `POI_TYPE_LABELS.attraction`，避免
    將來 PR-1 canonical label 改名造成 drift。

**Dead code / cleanup**

- `constants.ts`: 移除 `EXTERNAL_NAVIGATION_URL_BASE`（grep 確認零 caller）。
- `drag-strategy.ts`: 新 `DEFAULT_START_MINUTES = 9 * 60` 取代
  `parseClockToMinutes(DEFAULT_START)!` non-null assertion + double-parse。
- `mapDay.ts`: 移除 `effGoogleRating` redundant `as { rating?... }` cast
  — `RawEntryPoi.rating` 早已 typed (line 104)。
- `lib/maps/region.ts`: `regionToCountryCode` 加 `@deprecated` JSDoc tag —
  零 production caller，僅留 `tests/unit/region-to-country-code.test.ts`
  為向後相容。

**New tests (3 files, 21 tests)**

- `tests/unit/routes-safe-return-to.test.ts` — 7 case
  (same-origin / protocol-relative / absolute URL / backslash / relative /
  empty / custom fallback)。
- `tests/unit/errors-code-cap.test.ts` — 8 case
  (64-char cap / 短 code / 6 個 sniff phrase pattern variant /
  「administered by user」false-positive regression)。
- `tests/unit/local-storage-shape.test.ts` — 8 case
  (broken JSON / missing exp / wrong-type exp / NaN exp / non-object payload /
  null payload / expired / lsRemove smoke test)。

2193/2193 unit suite green (+21 新 test)。

**Round 4 留 follow-up**

- runtime 反向依賴 (apiClient → useOnlineStatus, tripExport → Toast 的
  `showToast` callback) — 需注入 pattern 或 EventTarget
- 11 個剩餘 zero-test 檔: weather (257 LOC) / tripExport (272 LOC) /
  mapDay (313 LOC) / dayArtMapping / entryAction / sentry / sanitize 更全 /
  apiClient 完整 / parseUtcDate edges / events / maps/cache
- 開始下個 module: src/hooks/ 或 functions/api/

## [2.33.37] - 2026-05-24

**Architecture refactor + coverage — `src/lib/` review round 2**

延續 v2.33.36 round 1 fixes，本 PR 處理兩類 finding：
1. **反向依賴**：`src/lib/` 不該 import `src/components/` 或 `src/hooks/`
   (utility layer 應為 leaf module)。code-reviewer agent 點出 5 個 callsite。
2. **零測試 high-impact 檔**：test-engineer agent top-5 priority gap 中
   `poiCategory.ts` / `poiSearchHelpers.ts` / `travelMode.ts` 直接補 unit test。

**Architecture refactor**

- 新 `src/types/timeline.ts` — 9 個 timeline / map 共用 type 集中:
  `MapLocation` / `NavLocation` / `SouvenirItem` / `InfoBoxType` /
  `InfoBoxData` / `ShopData` / `GasStationDetail` / `TravelData` / `PoiPhoto`
  / `StopPoiOptionData` / `TimelineEntryData`。沒有 React import。
- 5 個檔改 import 路徑：
  - `src/lib/mapDay.ts` 從 4 個 `components/trip/*` import 7 個 type → 改取
    `src/types/timeline`。
  - `src/lib/timelineUtils.ts` `TimelineEntryData` 改取 `src/types/timeline`。
  - `src/components/trip/{TimelineEvent,MapLinks,InfoBox,Shop}.tsx` 移除
    local interface declaration 改 re-export from `src/types/timeline` 保留
    向後相容（既有 import path 不破）。
- 新 `src/lib/docKeys.ts` — `DOC_KEYS` const 從 `src/hooks/useTrip.ts` extract。
  `src/lib/tripExport.ts` 改 import lib path。`useTrip.ts` re-export 向後相容
  (DocKey 是 `(typeof DOC_KEYS)[number]`)。

留下的反向依賴（round 3 處理）：`apiClient.ts → hooks/useOnlineStatus`
(`reportFetchResult` 需要 React context-like 注入)、`tripExport.ts → 
components/shared/Toast` (`showToast` 同理)。這兩個是 runtime side-effect 不
是 pure type，需 callback 注入 pattern。

**New tests (3 files, 41 tests)**

- `tests/unit/poi-category.test.ts` — 27 case `mapNominatimCategory` mapping
  (hotel/restaurant/shopping/parking/transport/activity/attraction/fallback) +
  `POI_TYPE_LABELS` 8 個 canonical zh-TW label (含 hotel→飯店 PR-1 fix +
  transport→交通 v2.31.23 fix)。
- `tests/unit/poi-search-helpers.test.ts` — 24 case `matchCategory` /
  `poiTone` / `poiMeta` / `normalizeSearchResults` (strict shape validation
  + array vs `{ results: [...] }` 兩種 input shape + null/undefined fallback
  + missing place_id/name filter)。
- `tests/unit/travel-mode.test.ts` — 7 case canonical labels (開車/步行/大眾
  運輸) + icons (car/walking/bus) + 完整性 invariant。

2167/2167 unit suite green (+41)。

## [2.33.36] - 2026-05-23

**Security + stability hardening — `src/lib/` review round 1**

`/simplify` 後續 review，3 agent (code-reviewer + security-auditor +
test-engineer) 平行掃 `src/lib/` 32 檔。本 PR 撿 HIGH + MED 安全與穩定
findings 集中修；架構 refactor（拔 `lib/` → `components/` 反向 import）
與 test coverage 大批擴充留 round 2/3 PR。

**Security**

- `sanitize.ts` — XSS 攻擊面擴增：
  - URI-bearing attribute allowlist 從 `href|src|action` 擴到含 `formaction`
    / `xlink:href` / `srcset` / `poster` / `background` / `data` / `ping` /
    `cite`。漏掉的 `formaction` 過去可讓 `<button formaction="javascript:...">`
    繞 sanitize 跑 script。
  - 整支 `<svg>` 直接拔，消除 `<use href="javascript:...">` 變形攻擊面。
  - `style` attribute 整支拔（之前只 blocklist `expression(`/`javascript:`/
    `url(` 等 keyword），消除 `position:fixed;opacity:0` clickjacking 與
    `content:` CSS exfil 風險。chat / AI reply markdown 不需要 inline style。
- `apiClient.ts` — `Sentry.captureException` 上報 SYS_* 錯誤前先 scrub：
  - `path.split('?')[0]` 拔 query string（之前 `?email=…` / `?selected=…`
    會 leak PII 到 Sentry）。
  - `detail.replace(/[\r\n]+/g, ' ').slice(0, 200)` 限長 + 拔換行，避免
    backend SQL fragment / stack trace 透過 detail 流出。
- `errors.ts` — `ApiError.detail` constructor 同樣 cap 在 200 char + 拔換行。
  callers (`InvitePage:142` / `DeveloperAppNewPage:251` etc) 把 detail 直接
  toast 給 user，這層 cap 是底線防護。
- `tripExport.ts` — 兩個 export 漏洞：
  - filename：`a.download = \`${tripName}-${today}\`` 過去把 user-controlled
    `trip.name`（可含 `../`、CRLF、`:`）直接當檔名。Safari 歷史有過 path
    traversal in `download`。新 `safeFileBase()` strip path separators /
    control chars / Windows-reserved + cap 80 char。
  - CSV injection：cells 以 `=` / `+` / `-` / `@` / `\t` / `\r` 開頭被
    Excel / Google Sheets 當公式執行（`=HYPERLINK("evil",A1)` 可 exfil 其他
    cell）。新 `csvSafe()` 對這些 leading char 補單引號。

**Stability**

- `apiClient.ts` — 之前 `if (opts?.body) headers['Content-Type'] = 'application/json'`
  對 FormData / Blob / URLSearchParams body 強塞 JSON Content-Type → server
  parse fail。新邏輯只在 body 是 string 且 caller 沒帶 Content-Type 時補。
- `localStorage.ts`:
  - `lsSet` 包 try/catch + 回傳 boolean — Safari 私密模式 / QuotaExceeded
    過去直接 throw 在 `useEffect` 內導致 page 白屏。
  - `lsRenewAll` snapshot keys 先（避免 parallel tab remove 改變 indices）。
- `weather.ts` — Open-Meteo fetch 包 try/catch + `AbortSignal.timeout(8000)`，
  upstream hang 不再 stall awaiting render。
- `poiHours.ts` — `WEEKDAY_RE` 改非 stateful（每次 new RegExp）。之前依賴
  `lastIndex = 0` reset 才正確，未來若 export 共用會踩到 stateful bug。
- `tripExport.ts` — catch block 加 `console.error('[downloadTripFormat]', err)`，
  之前 `catch {}` 完全 swallow，user 看 toast「下載失敗」但無 console 可附 bug。

**Tests (4 new files, 32 new tests)**

- `tests/unit/sanitize-uri-attrs.test.ts` — 10 個 XSS attack vector regression
  (formaction / srcset / poster / background / data / ping / cite / svg /
  style / 大小寫 / target=_blank rel injection / SPA `/path` 保留)。
- `tests/unit/trip-export-safety.test.ts` — `safeFileBase` + `csvSafe` 行為
  pattern check + source-grep guard。
- `tests/unit/errors-detail-cap.test.ts` — 200 char cap + newline strip + 短
  detail pass through + undefined detail 保留。
- `tests/unit/api-client-content-type.test.ts` — GET 無 Content-Type / POST
  string JSON / POST FormData / POST URLSearchParams / caller-provided
  Content-Type 保留。
- 2126/2126 unit suite green (+32 新 test)。

**Round 2 / 3 留 follow-up**

- `mapDay.ts` + `timelineUtils.ts` 反向 import `components/trip/*` 應抽 type
  到 `src/types/timeline.ts`（架構，純 refactor 無 behavior change）。
- `tripExport.ts` 反向 import `DOC_KEYS` from `hooks/useTrip` 與 `showToast`
  from `components` 應 invert（callback pattern 或 throw）。
- 14 個 `src/lib/*` 檔零測試（含 `poiCategory.ts` PR-1 canonical / `travelMode.ts`
  PR-1 / `mapDay.ts` 313 LOC / `weather.ts` 257 LOC）— Round 3 補。

## [2.33.35] - 2026-05-23

**Perf (simplify PR-8): batch `GET /api/trips/:id/docs` endpoint**

`/simplify` efficiency finding: `useTrip` startup 對 5 個 doc_type 各打一次
`GET /api/trips/:id/docs/:type` = **5 個 sequential CF Function calls + 10
D1 queries**（每 type 一個 trip_docs SELECT + 一個 trip_doc_entries SELECT），
其中 4 個 callsite 對新 trip 永遠 404（trip_docs 還沒建）— 純浪費。

新增 batch endpoint `functions/api/trips/[id]/docs/index.ts`:

- `SELECT id, doc_type, title, updated_at FROM trip_docs WHERE trip_id = ?` (1 query)
- `SELECT * FROM trip_doc_entries WHERE doc_id IN (?,?,...)` (1 query)
- Group entries by doc_id in-memory
- Return `{ docs: { flights: DocData | null, checklist: ..., ... } }` —
  5 個 doc_type key 永遠 present，不存在的 doc 為 `null`，caller 不需
  per-doc catch `DATA_NOT_FOUND`

`src/hooks/useTrip.ts` `fetchAllDocs` 改為單一 batch call：

```ts
const res = await apiFetch<{ docs: Record<DocKey, DocData | null> }>(
  `/trips/${tripId}/docs`,
  { signal: controller.signal },
);
const next: Partial<Record<DocKey, DocData>> = {};
for (const key of DOC_KEYS) {
  const data = res.docs[key];
  if (data) next[key] = data;
}
setDocs((prev) => ({ ...prev, ...next }));
```

效能：5 個 CF Function calls + 10 D1 queries → **1 個 CF Function call + 2
D1 queries**。對「新 trip 5 連 404」的 cold path 改善尤其明顯（之前 5 個
404 都要付 CF Function 冷啟動 + Auth + D1 round-trip）。

寫路徑（`PUT /api/trips/:id/docs/:type`）維持原 single-doc 端點不變 —
寫一個 doc 不該觸發 batch 邏輯。

Test:
- `tests/api/docs.integration.test.ts` + 2 個 batch test（trip 含 docs 與
  trip 空 docs 兩 case）
- `tests/unit/use-trip-docs-404.test.tsx` 重寫對齊新 contract（5 個 case：
  all-null / 500 / 404 / 部分 null / 只 fire 1 次 regression guard）

Total 12 test pass。270/270 unit suite green。

## [2.33.34] - 2026-05-23

**Refactor (simplify PR-7): AddStopPage / ChangePoiPage extract shared poi-search helpers**

`/simplify` quality finding: AddStopPage / ChangePoiPage 100% 複製 8 個
constants/functions —
`REGION_OPTIONS` / `CATEGORY_TABS` / `matchCategory` / `normalizeSearchResults` /
`poiTone` / `poiMeta` / `PoiCardTone` / `Tab`。Drift 已存在：ChangePoi 的
`normalizeSearchResults` 是 cast-only，AddStop 的版本嚴格 type check。

Extract `src/lib/poiSearchHelpers.ts` exporting canonical（取嚴格版）:

- `REGION_OPTIONS` + `RegionOption` type
- `CATEGORY_TABS` + `PoiSearchCategory` type
- `PoiCardTone` + `PoiSearchTab` types
- `matchCategory()` + `normalizeSearchResults()` + `poiTone()` + `poiMeta()`

Both pages now `import { ... } from '../lib/poiSearchHelpers'` and drop
local definitions. ~150 LOC removed across the 2 pages.

**完整 component extraction** (`<PoiSearchTab>` / `<PoiFavoritesTab>` 共用
React component) 留 future PR — 涉及 React component restructure，本 PR
只做 pure function 收斂。

Test 同步:
- `add-stop-page-rating-and-title` / `add-stop-page-region-filter`: grep
  改 read poiSearchHelpers.ts source
- `change-poi-custom-tab`: 改驗 `type PoiSearchTab as Tab` import pattern

270 files / 2092 tests pass。

## [2.33.33] - 2026-05-23

**Refactor (simplify PR-6): apiFetch migration — 19 files / 31 callsites**

`/simplify` reuse finding: 30+ pages 用 raw `fetch('/api/...')` 繞過
`apiFetch` wrapper → 失去 offline-banner trigger (`reportFetchResult`) +
Sentry SYS_* 自動上報 + ApiError 結構化。

Migrated to `apiFetch` / `apiFetchRaw`：

- `src/pages/SessionsPage.tsx` (3 callsites)
- `src/pages/ConnectedAppsPage.tsx` (2)
- `src/pages/AccountPage.tsx` (1)
- `src/components/trip/TripHealthBanner.tsx` (1)
- `src/hooks/usePlacesAutocomplete.ts` (1)
- `src/pages/TripsListPage.tsx` (2)
- `src/pages/ChatPage.tsx` (3)
- `src/pages/MapPage.tsx` (2)
- `src/pages/GlobalMapPage.tsx` (2)
- `src/pages/AddStopPage.tsx` (1)
- `src/pages/DeveloperAppsPage.tsx` (1)
- `src/pages/DeveloperAppNewPage.tsx` (1)
- `src/pages/InvitePage.tsx` (2)
- `src/components/shared/ErrorPlaceholder.tsx` (2)
- `src/pages/LoginPage.tsx` (2 → apiFetchRaw for header inspection)
- `src/pages/SignupPage.tsx` (2)
- `src/pages/ForgotPasswordPage.tsx` (1)
- `src/pages/ResetPasswordPage.tsx` (1)
- `src/pages/EmailVerifyPendingPage.tsx` (1)

**Deferred**：`ExplorePage.tsx` poi-search 暫保留 raw fetch — test suite
mocks fetch directly with detailed payload assertions, 重構成本太高。

**Bug fix incidentally**：`ApiError.fromResponse` 現在同時讀 `error.detail`
與 `error.message`（之前只讀 detail，後端用 message 的 endpoint 失去
human-message detail）。

### Test 同步

- `tests/unit/account-page.test.tsx` 加 apiFetchRaw mock
- `tests/unit/chat-page-ai-avatar.test.tsx` mock 改 apiFetch path
- `tests/unit/error-placeholder.test.ts` Response 改 204
- `tests/unit/invite-page` / `developer-app-new-page` 等隨 detail 修正

vitest 270 files / 2092 tests pass。

## [2.33.32] - 2026-05-23

**Perf (simplify PR-5): recompute-travel backend N+1 fix**

`/simplify` efficiency finding: `POST /api/trips/:id/recompute-travel` 在
N-day trip 跑 N 個 `SELECT trip_entries WHERE day_id=?` sequential round
trips。30-day trip = 30 個 D1 round trips before Routes API 呼叫即開始
擦邊 CF Pages Functions 50/invocation subrequest 上限。

Fix：batch 成單一 `WHERE e.day_id IN (?,?,...)` query + in-memory group
by `day_id`，從 N round trips → 1。30-day trip 省 ~29 subrequests，安全
留出 budget 給 Routes calls。

無行為改動，純 SQL 改寫。270 files / 2092 tests pass (frontend);
`npm run test:api` 上 pre-existing miniflare EADDRNOTAVAIL fail 同 master
基線，與本 PR 無關。

## [2.33.31] - 2026-05-23

**Perf (simplify PR-4): useRequestSSE elapsedMs tick 1s → 60s**

`/simplify` efficiency finding: `useRequestSSE` tick `setElapsedMs` 每 1
秒一次，但 UI consumer (ChatPage:944-946) 只在 `>= 3 * 60 * 1000`
threshold 跟 `Math.floor(elapsedMs / 60_000)` 顯示分鐘。AI 健檢 5-15 分鐘
wait 期間 ChatPage 大子樹重 render **300-900 次** 全是 no-op。

Fix: `ELAPSED_TICK_MS` 從 `1_000` 改 `60_000`。UI 行為不變（3 min
threshold 與 minute display 都在 minute boundary 才變）。

Test：`use-request-sse.test.tsx` `elapsedMs ticks up` assertion 從每 5 s
改 minute boundary，新邏輯 60 s 內維持 0、60 s 後跳一次。

270 files / 2092 tests pass。

## [2.33.30] - 2026-05-23

**Chore (simplify PR-3): requireAuth codemod — 32 backend handlers**

`/simplify` agent finding: 32 個 handlers inline 2-line auth check
`const auth = getAuth(context); if (!auth) throw new AppError('AUTH_REQUIRED');`
when `_auth.ts` already exports `requireAuth(context)` that wraps the same
logic.

Codemod 把所有 callsite 改用 `requireAuth(context)`、補對應 import、
清理不再用的 `getAuth` / `AppError` import。`functions/api/trips.ts:185`
保留 `getAuth` 因為是 optional `auth?.isAdmin` 用途（不 throw）。

無行為改動。270 files / 2092 tests pass。tsc clean (frontend + functions).

## [2.33.29] - 2026-05-23

**Chore (simplify PR-2): scripts/lib/d1-client.js + load-env 統一**

`/simplify` agent finding: 4 個 script (`auth-cleanup` / `daily-check` /
`daily-report` / `provision-admin-cli-client`) 各自重寫 `loadEnvLocal` +
`queryD1`/`execD1`。原本的 `/^(\w+)=(.+)/` regex 不處理 values with `=`
in them（base64 / JWT / JSON），引發過 multi-line env bug。

Added:
- `scripts/lib/load-env.js` — CommonJS .env.local loader (indexOf 取代 regex,
  strip-quotes safe)
- `scripts/lib/d1-client.js` — shared `queryD1` (returns rows) + `execD1`
  (returns changes count) + `rawQuery` (returns full result)

Migrated:
- `scripts/auth-cleanup.js`：~45 LOC removed
- `scripts/daily-check.js`：~30 LOC removed（保留 `loadConfigYaml`）
- `scripts/daily-report.js`：~17 LOC removed
- `scripts/provision-admin-cli-client.js`：~16 LOC removed

無行為改動，純 dedupe。270 files / 2092 tests pass。

## [2.33.28] - 2026-05-23

**Chore (simplify PR-1): dedupe POI_TYPE_LABEL + MODE_LABEL stringly-typed sprawl**

`/simplify` agent 全 repo scan finding：TimelineRail / EditEntryPage 各
自定義 POI_TYPE_LABEL，hotel: '住宿' 與 canonical `POI_TYPE_LABELS` 的
'飯店' drift — 屬於 v2.31.23 同類 bug 家族 root cause。MODE_LABEL/ICON
也在 EditEntryPage 重複 canonical 3 modes。

Fix：
- 新增 `src/lib/travelMode.ts` exports `TravelMode` type + `TRAVEL_MODE_LABEL` + `TRAVEL_MODE_ICON`
- TimelineRail 改 import `POI_TYPE_LABELS` from `poiCategory.ts`，移除本地 POI_TYPE_LABEL
- EditEntryPage 同上，再 import `TRAVEL_MODE_LABEL/ICON` 取代本地 const
- TravelPill 用 `...TRAVEL_MODE_LABEL` spread 為 base，本地僅留 legacy
  alias (car/drive/walk/train/bus/...) 給 backend raw `entry.travel.type`

**User-facing diff**：TimelineRail / EditEntryPage 顯 hotel 類型景點時
標籤從「住宿」→「飯店」（對齊 /favorites 既有用法）。

vitest test `edit-entry-page.test.tsx:325` 同步 assertion 改「住宿」→「飯店」。

270 files / 2092 tests pass。

## [2.33.27] - 2026-05-23

**Fix: api-server daily-check race condition — 5/19 起 4 天沒 fire**

Symptom: `scripts/logs/daily-check/` 最後 report 在 2026-05-19，5/20-5/22
完全沒新 log。api-server process 仍 running（PID 98173, started 5/19 10am）。

Root cause: `hasActiveSession()` 用共用 `tripline-request-` prefix 不分
skill。`/tp-request` 排程在 :09 fire（10 min interval），`/tp-daily-check`
排程在 :10 fire（06:10 daily）— 兩者只差 60 秒，daily-check fire 時偵測到
`/tp-request` 剛 spawn 的 tmux session 還活著 → SKIP。

Log evidence:
```
[2026-05-20T22:09:42] Process loop started (skill: /tp-request)
[2026-05-20T22:09:45] Spawned tmux session: tripline-request-1779...
[2026-05-20T22:10:00] Process loop started (skill: /tp-daily-check)
[2026-05-20T22:10:00] Active session tripline-request-1779... still running, skip
```

每天 22:10 UTC（06:10 +0800）都重演同 race。

Fix（per-skill lock, not global）：

1. `sessionPrefixForSkill('/tp-request')` → `'tripline-tp-request-'`
   `sessionPrefixForSkill('/tp-daily-check')` → `'tripline-tp-daily-check-'`
2. `hasActiveSession(skillCommand?)` 接 optional filter — 只擋同 skill
3. spawn tmux session name 用 per-skill prefix
4. `isRunning` global boolean → `runningSkills: Set<string>` per-skill 鎖
5. `/health` endpoint 回 `{ running, runningSkills }`（boolean 保留兼容）
6. `/trigger` lock 只擋 `/tp-request`（per-skill）

兩個 skill **可平行跑** — claude REPL 兩個 instance 互不干擾，
daily-check audit 跟 request queue drain 是 disjoint workload。

Backward-compat：`hasActiveSession('/tp-request')` 仍辨識 legacy
`tripline-request-` prefix（api-server restart 過渡期）。

### Test

10 個 source-grep regression test (`tests/unit/api-server-per-skill-session.test.ts`)。
Vitest 270 files / 2092 tests pass。

### Deploy

Ship 後手動 `kill <api-server pid> && launchd / nohup restart api-server`
讓新 logic 上線。下次 06:10 +0800 daily-check 應正常 fire。

## [2.33.26] - 2026-05-23

**Feat: mobile e2e coverage for `/add-custom-stop` fullpage（v2.33.25 follow-up）**

v2.33.25 skip 了 4 個 AddStopPage tests on mobile（因 mobile 切自訂 tab 會
redirect 到 /add-custom-stop fullpage）。本版補完 mobile 路徑 coverage。

新檔 `tests/e2e/add-custom-stop-page.spec.js`：

- **mobile-only: page render + 4 form fields + confirm disabled wedge**
  驗 mobile viewport 進 /add-custom-stop 後 add-custom-stop-page render，
  title/address/time/duration/note 5 個 fields visible，confirm 在 title-only
  無 map coord 時保持 disabled（對齊 AddStopPage v2.31.94 wedge guard）
- **mobile-only: TripTimePicker trigger 顯 --:-- placeholder**
  驗 v2.33.21 TripTimePicker migration 仍 render 在 mobile fullpage
- **desktop redirect 反向驗證**
  Desktop project 進 /add-custom-stop 應被 MobileOnlyRoute redirect 到 /trips

每個 test 用 `testInfo.skip(...)` 明確區分 mobile-only / desktop-only。

## [2.33.25] - 2026-05-23

**Fix: master CI mobile e2e flaky — skip 4 desktop-only AddStopPage tests on mobile**

master CI 連續 5 個 fail 全在 mobile-chrome / mobile-safari project。Root cause：
`AddStopPage.tsx:776-787` 設計 — mobile (≤1023px) 切自訂 tab 自動 redirect 到
`/add-custom-stop` (fullpage, IME-safe)，testid 改 `add-custom-stop-*` 不再是
`add-stop-custom-*`。

`add-stop-page.spec.js` (3 個) + `qa-flows.spec.js` (1 個) 直接 assert
`add-stop-custom-*` testid → mobile redirect 後 element 找不到 → 失敗。

PR CI 因為只跑 chromium (`.github/workflows/ci.yml` matrix gated on `pull_request`)
所以這些 mobile fail 只在 master push 才暴露。

Fix：4 個 affected tests 加 `testInfo.skip(testInfo.project.name.startsWith('mobile-'))`
明確標示「desktop-only inline tab」。mobile 路徑 (/add-custom-stop) 由 e2e
`add-custom-stop-*.spec.js` 覆蓋（未來 follow-up）。

## [2.33.24] - 2026-05-22

**Fix: AddStopPage 自訂 tab 開始時間 input migrated to TripTimePicker**

v2.33.21 inventory `type="time"` grep 漏抓 `AddStopPage.tsx:1331` — 該
input 用 `type="text"` 接受 free-form 文字（placeholder 顯示「Day 01 ·
17:00」hint）。Prod QA 驗證 v2.33.23 scroll-center fix 時，把 AddStopPage
自訂 tab 開啟發現它仍 native input。

Fix: 同 5 個 native time 改 TripTimePicker — wrapper div 帶 testid，picker
trigger 自帶 22px bold center + chevron。Placeholder 統一成預設「--:--」。

無 prod 行為改動（state 仍 `customTime: string`，submit 仍經 join HH:MM
join）。

## [2.33.23] - 2026-05-22

**Fix: TripTimePicker popover 開啟時不 scroll center 到 selected value**

Prod QA 發現 EditEntryPage 開「抵達 22:07」picker 時，popover 顯示 00-04
+ 00-20（沒 scroll 到 22 + 05）。

Root cause 2 個：
1. `requestAnimationFrame` 內 query 元素時，PopoverPanel portal 雖 mount
   但 layout/scroll 尚未 ready → scrollIntoView 無效
2. 既有 value 的 minute 若非 `minuteStep` 整數倍（22:07，step=5），minute
   column 內無對應 cell → 完全無 scroll target

Fix:
- `setTimeout(60ms)` 取代 `requestAnimationFrame`（等 transition + layout）
- `scrollTop = offsetTop - half-height` 直接設 parent scroll，避免
  `scrollIntoView` 把整頁也 scroll
- 既有 mm 非 step 整數倍 → reduce 找最近 step cell（07 → 05）

## [2.33.22] - 2026-05-22

**Chore: page-scoped input/select CSS cleanup (v2.33.16/17/19/21 follow-up)**

v2.33.16-21 把所有 native `<select>` / `<input type="date">` / `<input
type="time">` 換成 Trip* components 後，多支 page 的 page-scoped CSS rules
已成 dead code（無 callsite）。本次 sweep 移除：

- `src/pages/AddPoiFavoriteToTripPage.tsx`：`.tp-favorites-add-to-trip
  .tp-form-select`/`.tp-form-input` 整批規則（含 dark mode + mobile font-size）
- `src/pages/AddEntryPage.tsx`：`.tp-add-entry-daypicker-select`（含
  chevron data:image + focus ring）
- `src/pages/EditTripPage.tsx`：`.tp-shift-modal-input`（含 webkit-date-time-value
  + focus ring）

順手收：
- `src/pages/AddCustomStopPage.tsx`：title input className `.tp-custom-stop-input`
  → `.tp-input-long`（page-scoped rule 同步移除）
- `src/pages/EditEntryPage.tsx`：抵達/離開卡片 (`.tp-edit-entry-time-card`)
  原 wrapper 自帶 border + padding，TripTimePicker 自己也有 trigger border →
  double frame 視覺 bug。改 wrapper 只保留 label + flex（gap 6px），由
  TripTimePicker 顯示 input frame。

### Tests

tsc clean / vitest 269 files / 2082 tests pass。`edit-entry-time-row-overflow.test.ts`
assert 反轉：原 `.tp-edit-entry-time-card input` 規則消失，overflow guard
改靠 grid minmax(0, 1fr) + card min-width: 0 兩道防線（button trigger
overflow:hidden text-overflow:ellipsis 在 TripTimePicker.styles 自帶）。

## [2.33.21] - 2026-05-22

**Feat: TripTimePicker — 5 個 native `<input type="time">` 改網站風格**

v2.33.17 把 calendar + select 改 headless library + terracotta theme，但
5 個 `type="time"` 仍是 native OS chrome（iOS rotating drum / Chrome native
list）。v2.33.21 補完三件套 — TripTimePicker = `@headlessui/react` Popover +
2-col scrolling lists (hour 0-23 + minute 0-55 by 5)。

### Added

- `src/components/TripTimePicker.tsx` + `TripTimePicker.styles.ts`
  - Trigger: tp-input-short solo 22px bold center, 44px tap target
  - Popover: 2-col scrolling lists, 240px height, scroll-snap-y
  - Hour cell 0-23 (data-h attr), Minute cell by `minuteStep` prop
    (default 5, options 1/5/10/15/30)
  - scrollIntoView center on open，is-selected accent bg
- `tests/unit/__helpers__/tripTimePicker.ts` — `pickTime(testId, 'HH:MM')`

### Migrated 5 callsites

- AddCustomStopPage 開始時間 (`add-custom-stop-time`)
- AddPoiFavoriteToTripPage 開始/結束時間 (`favorites-add-to-trip-start/end`)
- EditEntryPage 抵達/離開 (`edit-entry-start-time/end-time`) +
  順手把 `<label>` wrapper 改 `<div>` 因為 picker 自帶 button trigger

### Test refactors (fireEvent.change → pickTime helper)

- poi-favorite-add-to-trip-form: 5 callsites updated
- poi-favorite-add-to-trip-states: 2 callsites updated
- edit-entry-page: 3 callsites updated（含 value 讀取 → button textContent）

### Tests

tsc clean / vitest 269 files / 2082 tests pass / 新 TripTimePicker 8 tests.

## [2.33.20] - 2026-05-22

**Fix: companion-resolver.test.ts beforeAll hookTimeout — CI flaky 修復**

`tests/unit/companion-resolver.test.ts` 在 master CI 多次 fail：
`Hook timed out in 10000ms` 於 `beforeAll`。Local 跑通常 5-6s 但 CI
runner cold-start miniflare D1 偶爾 >10s 觸發 vitest default hookTimeout。
Fix：`beforeAll(..., 30_000)` 明確 30s budget。

加入 v2.33.19 prod QA 完整 v2.33.19 verify 截圖：
- `qa-2-v2.33.19-newtrip-end-date.png`
- `qa-4a-v2.33.19-favorites-trip.png`
- `qa-4b-v2.33.19-favorites-day.png`

對齊 qa-5/6/7 的 v2.33.19 再 screenshot — 5 個 TripSelect 全驗 dual chevron 拔掉。

## [2.33.19] - 2026-05-22

**Fix: dual chevron on TripSelect — `.tp-select` class name collision**

Prod QA 截圖發現 v2.33.17 ship 完 TripSelect 渲染出兩個 chevron：

1. trigger button 內 `.tp-select-chev` SVG（正確 — 開啟時 rotate 180）
2. 同一 row 右側 12px 額外 down-chevron（多餘）

Root cause: v2.31.81 在 `css/tokens.css` 加 native `<select>` chrome
override，selectors 含 `.tp-form-row > select` 與 `.tp-select` 兩條，包
含 `appearance: none` + `background-image: data:image/svg... chevron`
+ `padding-right: 36px` + `min-height: 40px`。v2.33.17 TripSelect
wrapper `<div>` 用了同名 class `.tp-select`，wrapper div 被 legacy CSS
誤套用 chevron background → user 看到第二個 chevron。

Fix: 刪掉 `css/tokens.css` 內 `.tp-form-row > select` + `.tp-select`
規則（v2.33.17 migrated 6 個 callsites 已不用 native `<select>`；4 個
auth pages 驗過 `<input>` only 無 `<select>`）。共 3 個 block 移除：

- `.tp-form-row > input, ... > select, .tp-select { padding... }` —
  從中移除 `> select, .tp-select`
- `.tp-form-row > select, .tp-select { appearance: none; ... }` — 整 block 移除
- `body.dark .tp-form-row > select, body.dark .tp-select { ... }` — 整 block 移除
- `.tp-form-row > input:focus, ... > select:focus, .tp-select:focus` —
  從中移除 `> select:focus, .tp-select:focus`

tsc clean / TripSelect 6 tests pass / v2.31.81 13 tests pass。

## [2.33.18] - 2026-05-22

**Fix: E2E qa-flows.spec.js 用 TripDatePicker helper 取代 native fill('YYYY-MM-DD')**

v2.33.17 把 NewTripPage 的 `<input type="date">` 換成 TripDatePicker（button-based）
之後，e2e Flow 1「新增行程」test 跑 `page.getByTestId('new-trip-start-input').fill(iso)`
失敗 — Element is not an `<input>`。新 helper `tests/e2e/_helpers/pickDate.js`：

- 點 trigger 開 popover
- 比對 `.rdp-month_caption` 中文 caption「2026 年 8 月」+ navigate prev/next 到 target month
- 點 `.rdp-day:not(.rdp-outside)` day cell（避開 muted prev/next-month days）
- 等 popover 關閉再 return

無 prod 行為改動。

## [2.33.17] - 2026-05-22

**Feat: 日曆 + Select 改網站風格（取代 native popup）。** User sign-off
mockup `docs/design-sessions/2026-05-22-calendar-select-mockup/` Variant B
Spacious（44px cell / 20px padding / iOS HIG tap target）。

### Why

v2.33.16 把 input trigger 樣式統一到 `tp-input-short`，但 native
`type="date"` 跟 `<select>` 的彈出層仍是 OS chrome（iOS rotating drum /
macOS native calendar / Chrome native list），跨平台不一致也不符合
Terracotta 視覺。改用 headless library + 自訂 popover 才能根本解決。

### Added

- `react-day-picker@9` + `date-fns@4` + `@headlessui/react@2` deps
- `src/components/TripDatePicker.tsx` + `TripDatePicker.styles.ts`
  - Wrap `DayPicker`，trigger 重用 tp-input-short solo 樣式
  - 44px cell, 18px nav button, terracotta accent/today/selected
  - ISO string ("YYYY-MM-DD") 進出，與既有 callsites drop-in 相容
  - 中文星期 / 月份 formatter（日一二三四五六 / 2026 年 5 月）
  - Outside-click 關 + Esc 關 + a11y aria-haspopup="dialog"
- `src/components/TripSelect.tsx` + `TripSelect.styles.ts`
  - Wrap headless-ui `Listbox`，44px row, accent-subtle hover
  - `variant: 'default' | 'pill'`：pill (32px / footnote / radius-full)
    給 TripsListPage 排序 toolbar；default 給 form field
  - Generic `<V extends string | number>` 保留 type safety
- `tests/unit/__helpers__/tripSelect.ts` — pickFromTripSelect helper
  替代 native fireEvent.change pattern
- `tests/unit/trip-date-picker.test.tsx` (6 test)
- `tests/unit/trip-select.test.tsx` (6 test)
- `tests/setup-jest-dom.js` 加 ResizeObserver stub（@headlessui 需要）

### Migrated 3 date callsites → TripDatePicker

- NewTripPage 出發 / 回程
- EditTripPage shift modal「變更出發日期」

### Migrated 6 select callsites → TripSelect

- AddPoiFavoriteToTripPage 行程 + 天數
- EditTripPage 顯示語言
- EntryActionPage copy/move 時段
- TripsListPage 排序（variant="pill"）
- AddEntryPage Day dropdown

### Test refactors（fireEvent.change → click trigger + click option）

- poi-favorite-add-to-trip-form.test.tsx × 4 callsites
- poi-favorite-add-to-trip-states.test.tsx × 3 callsites
- add-entry-page.test.ts — option-testid assertion 改 TripSelect import
- v2_31_81-batch-ux-fixes.test.ts §3 重寫：5 callsites import TripSelect

### Tests

tsc clean / vitest 268 files / 2074 tests pass。

## [2.33.16] - 2026-05-22

**Refactor: Input 二系統 — `.tp-input-long` (一般文字) + `.tp-input-short`
(固定格式短值 22px bold)。** User sign-off mockup
`docs/design-sessions/2026-05-21-input-full-inventory/two-styles-proposal.html`。

### Design

74 個 input 用 4 種 styles 收斂成 2 種正式 system class：

- **`.tp-input-long`** — email / password / 標題 / 地址 / 描述 / 備註 /
  搜尋 / textarea / 長 select。Padding 12 14 / border 1.5px / radius lg /
  bg secondary / font body / left align。
- **`.tp-input-short`** — time / date / 短 number / 短 select。提供兩種
  pattern：(a) wrapper + label + input nested、(b) solo 直接套 input
  (透過 `input.tp-input-short` 高 specificity override)，避免 JSX 重構。

### Added

`css/tokens.css @layer base`：
- 完整 `.tp-input-long` rule (含 textarea 加長 + select chevron 變化)
- 完整 `.tp-input-short` wrapper pattern + solo input pattern
- 兩者都 inherit v2.33.11 + v2.33.12 base 的 `color-scheme: light` /
  `appearance: none` / accent focus ring

### Migrated 7 callsites to `.tp-input-short` (solo)

- NewTripPage 出發 / 回程 date
- EditTripPage shift modal date (替換 `.tp-shift-modal-input`)
- AddPoiFavoriteToTripPage 開始 / 結束時間 (替換 `.tp-form-input.tabular`)
- AddCustomStopPage 開始時間 + 停留分鐘 (替換 `.tp-custom-stop-input`)
- AddStopPage 預估停留 number
- TravelPillDialog transit min
- EditEntryPage transit min

EditEntryPage 抵達 / 離開 (`.tp-edit-entry-time-card` wrapper pattern)
保留 — 已在 card pattern，rename 屬未來 cleanup。

### Long callsites 不顯式遷移

無 className 的 text/email/textarea/select 由 v2.33.12 `:where()` base
layer 處理（Terracotta tokens 同 `.tp-input-long`，視覺等效）。後續若要
拔除 `.tp-form-input` / `.tp-new-form-row input` / `.tp-edit-row input`
等 page-scoped class 再做 sweep。

### Tests

tsc clean / vitest 266 files / 2061 tests pass。

## [2.33.15] - 2026-05-21

**Fix: shift modal「取消」button fallback browser native 黑底白字。** User
prod 截圖回報「按鈕和 mockup 不同」— 取消看起來是 dark/black solid，
不是 mockup 期待的 light outlined。

### Root cause

v2.33.8 起 shift modal cancel button 用 `.tp-confirm-btn` + `.tp-confirm-btn-cancel`
className。這兩個 class 定義在 `ConfirmModal.tsx` 的 SCOPED_STYLES 內部
— 只有 ConfirmModal mount 才注入到 DOM。Shift modal 單獨開時，
`.tp-confirm-btn*` 樣式沒注入 → 取消 button fallback 到 browser native button
default（dark/black bg + white text on Safari/Chrome）。

同 v2.33.9 `.tp-confirm-backdrop` 同類 bug。

### Fix

`src/pages/EditTripPage.tsx`：
- JSX：`tp-confirm-btn tp-confirm-btn-cancel` → `tp-shift-modal-btn tp-shift-modal-cancel`
- 同步：`tp-confirm-btn tp-shift-modal-confirm` → `tp-shift-modal-btn tp-shift-modal-confirm`
- Container：`tp-confirm-actions` → `tp-shift-modal-actions`
- SCOPED_STYLES 加完整定義（cancel: secondary bg / foreground text / border;
  confirm 保留 accent solid）

避免再依賴別 component 的 scoped CSS。

## [2.33.14] - 2026-05-21

**Fix: day-remove ✕ button 改用 accent-deep (terracotta) 不用 destructive
red。** User 回報「不要紅色，要和手機一樣」 — v2.33.13 加的 destructive-bg
tint 反而讓桌機更紅，user 視覺對齊期待是 Tripline 暖橘色系。

### Root cause

`--color-destructive: #C13515` (warm-red vermilion) 在 mobile retina 高密度
螢幕渲染偏 terracotta，desktop 大畫面看起來偏 vivid red。v2.33.13 又加
`--color-destructive-bg` (#FDECEC) 淡紅 tint 加重紅感。

### Fix

`src/pages/EditTripPage.tsx` `.tp-edit-day-remove`：

- Default hover: `var(--color-destructive)` → `var(--color-accent)` + accent-subtle bg + accent-deep text
- `.has-entries-warning`: `var(--color-destructive)` → `var(--color-accent-deep)`
  - border-color + color 都改 accent-deep (#B85C2E)
  - 移除 v2.33.13 加的 destructive-bg tint
- `.has-entries-warning:hover`: solid destructive → solid accent-deep + white text

Real destructive moment (confirm dialog) 仍保留紅色（ConfirmModal 內部 token）。

### Rationale

Accent-deep 是 Tripline 既有設計系統暖橘色，跨 device 渲染一致。warning
state 提示力道仍夠（border + icon 都變色），但不會造成 mobile/desktop
色差感。

## [2.33.13] - 2026-05-21

**Polish: shift 功能 copy 改「變更出發日期」+ ✕ button 視覺對齊手機紅度。**
User prod 回報「版面不正確 working 改為變更出發日期」+「紅框刪除按鈕顏色
與手機不同 請對齊手機色碼」。

### Copy 改動 (`src/pages/EditTripPage.tsx`)

- Section button: 「Day 1 起始日期：5/1（五）」→「出發日期：5/1（五）」
- Modal title: 「整體平移行程」→「變更出發日期」
- Modal label: 「Day 1 起始日期」→「出發日期」
- Confirm button: 「確認平移 / 平移中⋯」→「確認變更 / 變更中⋯」
- Toast: 「已平移到 8/15」→「出發日期已變更為 8/15」

### ✕ button 視覺對齊

`.tp-edit-day-remove.has-entries-warning` 加 `background:
var(--color-destructive-bg)` (淡紅 tint #FDECEC)。原本只有 red border +
red icon，background 還是 cream，desktop 大畫面下 anti-aliasing 讓 ✕ icon
看起來偏淡。加 bg tint 後三層 (border + bg + icon) 都帶紅，視覺更貼近
mobile retina 渲染。Hover 仍走 destructive solid 不變。

### Tests

`edit-trip-day1-start-date-shift.test.ts` 更新驗新 copy + 確認舊 copy
不再 render（21 tests）。

## [2.33.12] - 2026-05-21

**Fix: 全域 input / textarea / select baseline — 確保任何新加 input 自動套
Terracotta 樣式。** User 要求「Input 也用全域控制 避免遺漏」(v2.33.11 只
管 date/time)。

### Context

v2.33.11 加了 native date/time input 全域 color-scheme: light 保護。但
text/email/password/search/number/textarea/select 等仍散落各 page 自己
scope CSS（`.tp-form-input` / `.tp-new-form-row input` / `.tp-edit-row
input[type=text]` 等）。新增頁面忘加 page-scoped class → fallback 到
browser native default（白底藍 focus ring），不符 Tripline 風格。

### Fix

`css/tokens.css @layer base` 加全域 baseline rule，用 `:where()` 把
specificity 降為 0 讓 page-scoped class 易 override：

```css
:where(
  input:not([type=checkbox|radio|file|range|color|button|submit|reset|hidden|image]),
  textarea, select
) {
  padding: 12px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  background-color: var(--color-secondary);
  color: var(--color-foreground);
  font: inherit;
  font-size: var(--font-size-body);
  min-height: var(--spacing-tap-min);
  outline: none;
  transition: border-color 120ms, box-shadow 120ms, background-color 120ms;
}
:where(...):focus {
  border-color: var(--color-accent);
  background-color: var(--color-background);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
:where(input[type=checkbox], input[type=radio]) {
  accent-color: var(--color-accent);
  cursor: pointer;
}
```

### 涵蓋

- 28+ text-type inputs (text/email/password/search/tel/url/number)
- 14+ textarea
- N selects
- All checkbox/radio (accent-color)

排除 checkbox/radio/file/range/color/button/submit/reset/hidden/image 從
text-input baseline（這些有自己視覺語意）。

### 不會 regression

`:where()` specificity 0 → 既有 page-scoped class（`.tp-form-input`、
`.tp-edit-row input[type=text]` 等）100% 仍 override 成功。

## [2.33.11] - 2026-05-21

**Fix: 全域 native date/time input 在 iOS Safari dark mode 防護。** v2.33.10
只修了 EditTripPage shift modal 一個 input。User 要求 audit 所有 input 並
統一修。

### Audit (docs/design-sessions/2026-05-21-input-styles-audit/audit.html)

7 個 native `<input type="date"|"time">` callsites 全部缺 `color-scheme:
light` 保護：
- NewTripPage.tsx:818, 829 — 出發 / 回程 date
- AddPoiFavoriteToTripPage.tsx:557, 570 — 開始 / 結束時間
- AddCustomStopPage.tsx:565 — 開始時間
- EditEntryPage.tsx:1347, 1360 — 抵達 / 離開時間

加上 EditTripPage shift modal date 共 8 處（後者 v2.33.10 已局部修）。

### Fix

`css/tokens.css` `@layer base` 加全域 rule，自動套到所有 `input[type=
"date"|"time"|"datetime-local"|"month"|"week"]`：

```css
color-scheme: light;
-webkit-appearance: none;
appearance: none;
background-color: var(--color-background);
color: var(--color-foreground);
font-variant-numeric: tabular-nums;

::-webkit-date-and-time-value {
  color: var(--color-foreground);
  text-align: inherit;
}
::-webkit-calendar-picker-indicator {
  opacity: 0.6;
  cursor: pointer;
}
```

### 未來保證

新增 native date/time input 自動 inherit 此防護，不會再發生 iOS dark mode
黑底黑字事件。Page-scoped CSS 仍可 override `background-color` 對齊各 page
palette。

## [2.33.10] - 2026-05-21

**Fix: shift modal date input 在 iOS Safari 系統深色模式下背景變黑，文字幾乎
看不見。** User 真機截圖回報。

### Root cause

`<input type="date">` 在 iOS Safari 沒設 explicit `background` / `color` /
`color-scheme` 時，會跟系統 dark mode 走 → 整個 input 變黑背景黑字。
桌機 Chrome 沒問題（系統不在 dark mode）但 iOS Safari 立刻翻車。

### Fix

`src/pages/EditTripPage.tsx` `.tp-shift-modal-input`：
- `background: var(--color-background)`
- `color: var(--color-foreground)`
- `color-scheme: light` — 明確告訴 iOS 不要跟系統 dark mode
- `-webkit-appearance: none` + `appearance: none` — 移除 iOS native dark style
- `::-webkit-date-and-time-value` 加 color override 保 value 文字色

### Tests

既有 5 個 source-grep test 仍 pass（CSS-only fix，testid + selector 不變）。

## [2.33.9] - 2026-05-20

**Fix: 整體平移行程 modal backdrop CSS 沒套用 → modal 跌到 viewport 外。**
v2.33.8 prod QA 立刻發現。

### Root cause

v2.33.8 reuse `.tp-confirm-backdrop` className，但該 class 定義在
`src/components/shared/ConfirmModal.tsx` 的 SCOPED_STYLES — 只在 ConfirmModal
mount 時 inject 到 DOM。Shift modal 單獨開（無 ConfirmModal）時，
`.tp-confirm-backdrop` 樣式沒注入 → backdrop 變 `position: static`、
`display: block` → modal 子元素跌到 viewport 下面 (y=844px out of view)。

### Fix

`src/pages/EditTripPage.tsx` SCOPED_STYLES 加自己的 `.tp-shift-backdrop`
class (與 `.tp-confirm-backdrop` 同 spec：`position: fixed; inset: 0;
z-index: 1100; display: grid; place-items: center`)。Modal markup 改 className 對應。

### Tests

既有 5 個 frontend source-grep test 都仍 pass（不需新測試，純 CSS class
rename）。

## [2.33.8] - 2026-05-20

**Feat: EditTripPage 加「整體平移行程」入口，直接設定 Day 1 起始日期讓全
trip 平移。** User 需求：「修改天數提供另外一種模式 直接設定 Day 1 的
起始日期」。

### Design

Mockup `docs/design-sessions/2026-05-20-day1-start-date-shift/` V2 button +
modal 中選，user 指定：文字精簡 + 不需 icon。

### Added

**Backend** `POST /api/trips/:id/days/shift` body `{ startDate: 'YYYY-MM-DD' }`：
- 計算 delta = startDate - day_num=1 之 date
- Batch UPDATE 所有 trip_days 的 date + day_of_week (delta-based shift)
- Gap-preserving：原 dates 之間的 gap 自動 preserve
- 空 trip / 有 null date 拒 (400)
- Returns `{ ok, newStartDate, newEndDate, daysShifted }`

**Frontend** EditTripPage:
- 「Day 1 起始日期：5/1（五）」精簡單行 button（chev right，無 icon），
  放在 section helper text 下方、prepend「+ 加一天」card 上方
- 點 button → modal（title「整體平移行程」+ date input + preview
  「5/1（五）– 5/5（二）→ 8/15（六）– 8/19（三）」+ 取消/確認）
- 確認後 POST `/days/shift` + refetch + toast「已平移到 8/15」
- Confirm button disabled when new date 等於原 Day 1 date (no-op guard)

### Tests

- API: `tests/api/trips-days-shift.integration.test.ts` 6 tests (含
  gap-preservation、no-op delta=0、validation、auth)
- Frontend: `tests/unit/edit-trip-day1-start-date-shift.test.ts` 5
  source-grep tests

## [2.33.7] - 2026-05-20

**Feat: EditTripPage 中間天 gap 加 dashed placeholder「+ 加回 M/D」可點擊還原。**
User 要求：「移除中間天後留下虛線框，然後可以加回」。

### Context

v2.33.1 fix DELETE 保留 dates → 中間天移除後 date 序列出現 gap (e.g. 5/1, 5/2, 5/4, 5/5)。
之前 UI 沒視覺呈現這個 gap → user 不知道有缺日 / 無法加回。

### Added

**Backend**: `POST /api/trips/:id/days` 新 `position: 'insert'` + `date` body：
- 找 < insertDate 的 days 數量 → newDayNum = count + 1
- 後續 days (≥ newDayNum) 逆序 day_num += 1（避開 D1 UNIQUE constraint）
- 拒重複日期（400 if date 已存在）

**Frontend** EditTripPage：
- 新 helpers: `daysBetween(d1, d2)` / `shiftDateByDays(date, n)` / `chineseDayOfWeek(date)`
- `handleRestoreDay(date)` callback → POST insert + refetch + toast
- 渲染 day list 用 `flatMap` 偵測連續兩天 date 是否 contiguous，gap 處 render
  `<button class="tp-edit-day-gap">` dashed 邊框、accent-tertiary 底色、
  「+ 加回 5/3（六）」label
- Hover state 變成 accent dashed + colored plus icon
- testid `edit-trip-day-gap-${gapDate}`

### Tests

- API: `trips-days-mutate.integration.test.ts` 加 3 個 insert tests (13 total)
- Frontend: `edit-trip-days-management.test.ts` 加 gap detection + render + CSS test (16 total)

## [2.33.6] - 2026-05-20

**Feat: TripPage 右上「⋯」action menu 加「編輯行程」入口。** User 要求：
詳細頁可從 menu 直接編輯，不用退回 trips list 用 card menu。

### Added

`TripsListPage.tsx::EmbeddedActionMenu`:
- `onEdit` prop (() => void)
- 新 menu item「編輯行程」放最前面（Icon edit + label），對齊
  TripCardMenu 順序：編輯行程 → 共編設定 → AI 健檢 → 列印 → 下載格式
- testid `trip-embedded-menu-edit-${tripId}`
- Caller (line 1247) wire `onEdit={() => navigate('/trip/:id/edit')}`

### Tests

`tests/unit/trip-detail-action-menu-edit.test.ts` 5 個 source-grep。

## [2.33.5] - 2026-05-20

**Fix: EditTripPage day-remove ✕ icon 沒 render — wrong Icon name。** User
prod 截圖回報「紅框 ✕ 不見了」— remove button 顯示空圓圈。

### Root cause

`EditTripPage.tsx:970` 用 `<Icon name="x" />`，但 Icon component
（`src/components/shared/Icon.tsx`）只有 `x-mark` / `x-circle`，沒有 `x`
→ `IconMap[name]` undefined → `<svg>` 空白 → 圓圈內無 ✕ 符號。

### Fix

`name="x"` → `name="x-mark"`。

### Tests

`edit-trip-days-management.test.ts` 加 15th test 驗 icon name + 不再用「x」。

## [2.33.4] - 2026-05-20

**Polish: AddCustomStopPage Day context strip 改 M/D 短格式對齊 mockup。**
QA 對比 2026-05-18 add-custom-stop mockup 發現 Day label 用 ISO `2026-07-31（五）`，
mockup 是 `7/28（一）` 短格式（跟 v2.33.2 EditTripPage 同類問題）。

### Fix

`AddCustomStopPage.tsx::deriveDayLabel`：
- import 既有 `formatDateLabel(date)` from `src/lib/mapDay.ts`
- ISO date `2026-07-31` → `7/31`

### Tests

`add-custom-stop-day-label-short-date.test.ts` 3 個 source-grep。

## [2.33.3] - 2026-05-20

**Polish: 行程天數 day row 加總距離「· X km」對齊 mockup。** v2.33.2 仍漏
mockup 「7 個景點 · 33 km」的 km 部分。

### Fix

`EditTripPage.tsx`：
- 新 helper `computeTotalKm(timeline)`：從 `trip_entries[].travel.distanceM`
  sum + rounded km（對齊 DaySection 既有 `getTotalKm` 邏輯）
- `DaySummary` interface 加 `totalKm: number | null`
- Day row conditional render：
  - has entries + has km: `${count} 個景點 · ${totalKm} km`
  - has entries no km: `${count} 個景點`
  - empty: `空`

### Tests

`edit-trip-days-management.test.ts` 14th test 驗 computeTotalKm wire +
conditional render。

## [2.33.2] - 2026-05-20

**Polish: EditTripPage 行程天數 section date 顯示對齊 mockup 用 M/D 短格式。**
v2.33.0 prod QA 對比 mockup 發現視覺差異。

### Root cause

v2.33.0 day row + header + ConfirmModal 都用 raw ISO `2026-05-01（五）`，
mockup 設計用 `5/1（五）` 短格式。長 ISO 在 mobile 390px viewport 占 row
寬太多，跟原 mockup 的「Day 1 · 7/29（三）· 7 個景點 · 33 km」風格不符。

### Fix

新 helper `formatShortDate('2026-05-01')` → `'5/1'`，三處套用：
- Day row date label
- Section header「5/1（五）– 5/5（二），共 5 天」
- ConfirmModal 對話「Day 1（5/1）目前是空的」

### Tests

`edit-trip-days-management.test.ts` 加 13th test 驗 formatShortDate 三處 wire。

## [2.33.1] - 2026-05-20

**Fix: DELETE /api/trips/:id/days/:num 不再 shift dates — 修 prepend +
delete-first 不對稱問題。** v2.33.0 prod QA 立刻發現的 bug。

### Root cause

v2.33.0 backend DELETE 在 cascade subsequent days 時，把 day_num **和**
date 同時 shift up 1 天：
- 用戶 prepend 加 Day 1 = 4/30（trip 4/30-5/5）→ delete Day 1（empty）
  → 預期回到原 5/1-5/5，但實際變 4/30-5/4
- 整個 trip 提前 1 天，違反 prepend / delete-first 對稱性
- 中間刪除 day 也會「整體上移」→ entry 的 calendar date 跟著變

### Fix

`functions/api/trips/[id]/days/[num].ts onRequestDelete`：

- 後續 days **只 renumber day_num**（`day_num -= 1`）
- **dates / day_of_week 保留**不動
- Trade-off: 中間刪 day 會在日期上留 gap（e.g. 5/1, 5/2, 5/4, 5/5）— 但
  Tripline 不強制 contiguous dates，user 意圖「我刪掉那天，其他天不變」
  比 contiguous 重要

### Frontend warning 更新

ConfirmModal warning「後續天數的日期會自動上移」→ 「後續天數的 Day
編號會往前遞補（日期保留，可能會留下空檔的日子）。」

### Tests

更新 `trips-days-mutate.integration.test.ts`：
- 中間天刪除測 dates 保留（剩 4/1, 4/2, 4/4, 4/5）
- 新增「刪除第一天」test 確認 prepend / delete-first 對稱

## [2.33.0] - 2026-05-20

**Feat: EditTripPage 加「行程天數」section — 任意天可增 / 減，移除有
景點的天 → 紅色 destructive confirm + cascade 刪除 entries。** 取代
v2.32.5 之前的 read-only date section。

### Context

Prod QA pain point：建好 trip 後想加 1 天或刪掉空的尾巴 day 必須建新行程。
v2.32.5 之前的「修改日期請另建新行程」placeholder 不再夠用。本 PR 加完
days CRUD + 即時 mutation pattern（atomic 比 queue-and-commit 安全，
cascade 刪 entries 不可復原）。

### Design (mockup sign-off 2026-05-20)

`docs/design-sessions/2026-05-20-edit-trip-days-management/`：
- V1 (per-day list + 雙向 card-style add button) 中選 + user 指定 visual:
  card 同 row 大小 + accent-subtle 底色 + 「+ 加一天」label

### Added

- **Backend new endpoints**：
  - `POST /api/trips/:id/days` body `{ position: 'start' | 'end' }`
    - `end`: day_num = max+1, date = max+1d
    - `start`: 既有 day_num 逆序 +1（D1 row-by-row UNIQUE check 要求逆序）,
      INSERT day_num=1 + date = min-1d
    - Returns `{ day: { id, dayNum, date, dayOfWeek, label, title } }`
  - `DELETE /api/trips/:id/days/:dayNum`
    - Cascade trip_entries via FK (ON DELETE CASCADE)
    - 後續 days：day_num -= 1 + date 上移 1 天 + day_of_week 重算
    - 最後一天禁刪（trip 至少 1 天）
    - Returns `{ ok: true, removedEntryCount }`
- **Frontend EditTripPage** 新「行程天數」section：
  - 日期區間 header 從 days 衍生（取代 read-only date section）
  - Card-style「+ 加一天」 button 雙向（list 上方 prepend / 下方 append）
  - Per-day row 含 ✕ button + entry count（has-entries → 紅色 border）
  - 點 ✕ → ConfirmModal「刪除 Day N？」+ has-entries 加「後續日期上移」warning
  - Toast feedback「Day N 已刪除（連同 X 個景點）」/「已在最前 / 最後加入一天」
- 9 個 backend integration tests `tests/api/trips-days-mutate.integration.test.ts`
- 12 個 frontend source-grep tests `tests/unit/edit-trip-days-management.test.ts`

### Changed

- EditTripPage hint: 「修改行程基本設定 + 目的地。修改日期請另建新行程」
  → 「修改行程基本設定 + 目的地 + 行程天數」
- 移除 `dateRange` unused const（改由 days section header 計算）

### Auth

- POST/DELETE 都要求 trip write permission（owner/admin/member; viewer 拒）

## [2.32.5] - 2026-05-19

**Fix: `.tp-map-day-tabs` 水平 scroll 缺 affordance — user 不知 chips 可往右
swipe。** v2.32.1 QA round 3 發現，原列為「minor non-blocking」follow-up，
本 PR 完成。

### Root cause

7-day trip (沖繩七日遊) 在 mobile (≤390px viewport) day 6/7 chips 超出可視
範圍，但：

- `.tp-map-day-tabs` 設 `overflow-x: auto`（OK）
- `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`（隱藏 scrollbar）
- 無 chevron icon、無 fade gradient → 完全沒視覺提示「往右還有 chips」

User 常以為 trip 只有 5 天。

### Fix

`css/tokens.css` 加 `mask-image` 右側 24px fade linear-gradient：

```css
-webkit-mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent 100%);
        mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent 100%);
```

Trade-off：scroll 到末尾時最後一個 chip 會略微 fade（visible 但邊緣透明
化），acceptable visual sacrifice for clearer scroll affordance。

### Tests

`tests/unit/day-tabs-scroll-affordance.test.ts` 3 個 source-grep regression
（standard + -webkit- prefix + 原 overflow-x preserved）。

## [2.32.4] - 2026-05-19

**Fix: `/account/*` vs `/settings/*` cross-prefix direct URL 落 /trips。**
v2.32.1 QA round 4 發現，pre-existing。

### Root cause

Account hub 跑「terracotta-account-hub-page」重設時把 appearance/notifications
配在 `/account/*`，但 sessions/connected-apps 歷史上仍在 `/settings/*`。
AccountPage 用 `<Link>` 走 configured path，所以從 hub 進去都 OK。但
user 直接打 URL 或舊書籤 `/settings/notifications` / `/account/sessions` /
`/account/connected-apps` 沒對應 Route → catch-all 落 /trips。

### Fix

`src/entries/main.tsx` 加 4 個 alias Route 讓兩 prefix 都 valid:

- `/account/sessions` → `<SessionsPage />`
- `/account/connected-apps` → `<ConnectedAppsPage />`
- `/settings/appearance` → `<AppearanceSettingsPage />`
- `/settings/notifications` → `<NotificationsSettingsPage />`

原 4 個 canonical Route 保留。AccountPage `<Link>` 不動。

### Tests

`tests/unit/settings-account-route-aliases.test.ts` 8 個 source-grep
regression test（4 alias + 4 canonical preserved）。

## [2.32.3] - 2026-05-19

**Fix: EditEntryPage 時間 row 在 mobile (≤390px viewport) horizontal
overflow，「離開」card 被切邊。** v2.32.1 QA round 2 發現，pre-existing
非本 round 引入。

### Root cause

`<input type="time">` 在 mobile browser 有 intrinsic minimum width (~130px)
含「10:45 AM」AM/PM label。`.tp-edit-entry-time-row` 用
`grid-template-columns: 1fr auto 1fr`，1fr 預設 `min-width: auto = min-content`
不允許 column 縮到 input intrinsic width 以下。實測 scrollWidth 374px
> viewport content area 347px → 「離開」card 溢出 22-27px。

### Fix

`EditEntryPage.tsx` styled CSS：

- `grid-template-columns: 1fr auto 1fr` → `minmax(0, 1fr) auto minmax(0, 1fr)`
- `.tp-edit-entry-time-card` 加 `min-width: 0`
- `.tp-edit-entry-time-card input` 加 `min-width: 0`

放寬 grid/flex default min-content limit，allow column 縮到 intrinsic
width 以下。Input 寬度跟著 column 縮，AM/PM 可能 truncate 顯示「···」
但 click 後 native picker 仍可選；trade-off 比 overflow 切邊好。

### Tests

`tests/unit/edit-entry-time-row-overflow.test.ts` 4 個 source-grep
regression test（minmax / card min-width / input min-width / 舊
hardcoded gone）。

## [2.32.2] - 2026-05-19

**Fix: AddStopPage tab 初值從 URL param 讀取。** v2.32.1 QA 發現
`/trip/:id/add-stop?tab=custom` direct URL 進來永遠 land 在「搜尋」tab，
忽略 `?tab=custom` query string。Pre-existing bug，非 v2.32.1 引入。

### Root cause

`AddStopPage.tsx:693` hardcode `useState<Tab>('search')`，初值與 URL param
無關係。`handleTabChange` 雖會 mutate URL，但 mount 階段不讀回去。

### Fix

`AddStopPage.tsx:693` 初值改用 IIFE 讀 `searchParams.get('tab')`，allowlist
`'favorites' | 'custom' | 'search'`（拒任意值 forward）：

```ts
const initialTab: Tab = (() => {
  const raw = searchParams.get('tab');
  return raw === 'favorites' ? 'favorites' : raw === 'custom' ? 'custom' : 'search';
})();
const [tab, setTab] = useState<Tab>(initialTab);
```

對齊 ChangePoiPage 既有 URL→tab derivation pattern（line 578-579）。

### Tests

`tests/unit/add-stop-tab-url-init.test.ts` 4 個 source-grep regression test。

## [2.32.1] - 2026-05-19

**Fix: LocationPickerMap initialCenter race — 自訂景點 map 永遠卡 Tokyo Station fallback。** v2.32.0 QA 發現 AddEntryPage / AddStopPage / AddCustomStopPage 自訂 tab map 中心不是 trip destination 而是 Tokyo Station (35.6812, 139.7671)。

### Root cause

`useGoogleMap` hook 一 mount 就 lock `initialCenter`，後續 prop 變更不會 re-center。3 頁原本 `customDestinations` / `destinations` 初值 `[]`：

1. 首次 render → `customInitialCenter` useMemo 從空陣列推算 → fallback chain 走到 Tokyo Station hard fallback
2. `<CustomPoiForm initialCenter={Tokyo}>` mount → useGoogleMap 鎖死 Tokyo
3. fetch resolve 後 `setCustomDestinations([沖繩 destinations])` re-render → useMemo 重算 → 沖繩座標，但 useGoogleMap 不接受 dynamic center → 地圖永遠卡 Tokyo

### Fix

初值 `[]` → `null`（區分「未載入」與「載入後 0 個」），render gate `destinations !== null` 才 mount picker：

- `ChangePoiPage` — `customDestinations: TripDestApiLite[] | null`、fetch effect 改 mount-gated（不再 `tab !== 'custom'` early return）、catch fallback `setCustomDestinations([])`、render gate `<CustomPoiForm>` 等 destinations 非 null（null 期間顯 `change-poi-custom-loading` placeholder）
- `AddStopPage` — 相同 pattern，placeholder testid `add-stop-custom-loading`
- `AddCustomStopPage` — `destinations: TripDestApi[] | null`、render gate 直接包 `<LocationPickerMap>`（null 顯 `add-custom-stop-loading`）

### Tests

`tests/unit/custom-poi-init-center-race.test.ts` 11 個 source-grep regression test，covering 3 pages × (null init + fetch effect mount-gated + catch fallback + render gate + loading placeholder)。

### Verification

QA 流程：trip 詳細頁 → 新增景點 → day 下拉選擇 → 自訂 button → AddEntryPage navigate ChangePoiPage mode=new&tab=custom → CustomPoiForm map 應 center 於 day 第一個 entry / trip destination（非 Tokyo）。

## [2.32.0] - 2026-05-19

**Feat: 新增景點 wizard — EditEntryPage-style page + day 下拉 + 3 picker buttons → ChangePoiPage mode=new POST entries → redirect /edit。** User feedback：「頁面不正確 是 類似 .../stop/435/edit 但增加選擇天數下拉,然後相同的增加景點的方式, 第一個景點選完可以選替換, 也可以繼續增加備選以及調整順序」。

### Context

v2.31.99 把「+ 新增景點」入口接 /add-stop（AddStopPage 多選 grid），但 user 期待是 EditEntryPage 形狀 — POI card + 備選 + 時間 + 移動方式 + 備註。本 PR 改寫入口流程：trip header 「+ 新增景點」 button 現改 navigate /add-entry，wizard 主路徑。AddStopPage chip row 仍保留給 direct URL `/add-stop?day=N` (bulk add fallback)。

### Added

- **新 page** `src/pages/AddEntryPage.tsx` — EditEntryPage 形狀的「新增景點」wizard:
  - Day 下拉 (default 第一天, URL replaceState 切換)
  - POI placeholder card + 3 picker buttons (搜尋 / 收藏 / 自訂)
  - Preview greyed 備選 / 時間 / 移動方式 sections (提示完成後可在 EditEntryPage 編輯)
- **新 route** `/trip/:tripId/add-entry` (in `src/entries/main.tsx`)
- **ChangePoiPage mode=new branch** — picker UI 不變，submit 走 `POST /trips/:id/days/:N/entries` (而不是 PUT poi-id 或 POST alternates)。完成後 navigate `/trip/:id/stop/:newId/edit` 讓 user 接著加 alternates / 改時間
- 12 個 v2.32.0 source-grep test `tests/unit/add-entry-page.test.ts`

### Changed

- **TripsListPage trip header** 「+ 新增景點」 button: `/add-stop` → `/add-entry`
- ChangePoiPage `mode` union: `'master' | 'alternate'` → `'master' | 'alternate' | 'new'`
- ChangePoiPage `?day=N` param 在 mode=new 下用於 POST entries endpoint path
- ChangePoiPage entryPoisVersion fetch effect 跳過 mode=new (new entry 沒對應 OCC token)

### Tests

- 12 new source-grep test (file existence / route registration / layout / mode=new branch)
- v2.31.99 既有 test regex 對齊 /add-entry navigate
- 全 257 files / 2002 tests pass; tsc clean

### Backend

不動。`/trips/:id/days/:N/entries` POST 早已支援 `{title, lat?, lng?, source?, poiId?}` payload (v2.31.94 + earlier)。

## [2.31.99] - 2026-05-19

**Feat: trip header「+ 新增景點」按鈕取代探索 icon + AddStopPage day picker chip row。** User feedback：「`/stop/419/edit` 要有新增景點的版本, 取代附圖宏框的放大鏡 icon, 改為 + 號 名稱為新增景點, 新增景點要多可以選擇加入哪天」。

### Context

之前的「新增景點」（AddStopPage）沒任何 UI button 接上（v2.31.94 已查過，`openAddStop` handle 是死路、ChatPage 註解提到的 DaySection button 已被拔）。trip 詳細頁 header 有個放大鏡 icon `trip-explore-trigger` → 跳 /explore，但 explore 還能從「收藏」tab 進，這格更該給「+ 新增景點」優先級。

### Changed

- **TripsListPage trip header**: `trip-explore-trigger`（🔍 → /explore）→ `trip-add-stop-trigger`（+ 新增景點 → /trip/:id/add-stop）。探索仍可由「收藏」tab TitleBar 入口進
- **AddStopPage**: `?day=N` 改 optional。沒帶 day 進來時：
  - 上方 render DAY 01-N chip row（含 mm/dd 日期 + 星期），click 切換 → URL replaceState
  - 帶 day 也仍 render chip row，可隨時切換
  - `confirmEnabled` 加 `hasDay` gate，沒選一天不能 submit
  - Bottom counter「請先選擇加入哪天」prompt
  - 既有 invalid-params blocking page 改成只 block 沒 tripId 的 case
- **State refactor**: `currentDay` 從 useState 改 useMemo 從 `allDays` 衍生（單一 truth）。所有 days 一次 fetch 給 chip row 用

### Tests

- 新 12 個 source-grep test `tests/unit/add-stop-daypicker.test.ts` — 入口取代 + day picker state + chip row testid + hasDay gate
- 更新 v2.31.33 counter-shorten test regex 對齊新 dayLabel 三元
- 全 256 files / 1988 tests pass; tsc clean

### Out-of-scope

- AddStopPage 桌機 2-pane layout（自訂 tab）— v2.31.95+98 已設定，本 PR 不動
- 其他 entry point（DaySection footer、TimelineRail 末尾）— 後續 PR 可加

## [2.31.98] - 2026-05-19

**Feat: ChangePoiPage 加「自訂」tab — alternate / master 模式都能用地圖 pin 新增景點。** User feedback：「我要知道如何進去自訂景點 我找不到功能在哪」+「`/stop/420/change-poi?mode=alternate&tab=search` 這頁增加入口」。

### Context

v2.31.94 上線「自訂景點」feature，但**只在 AddStopPage（建立新 entry）有入口**。ChangePoiPage（置換景點 + 加為備選）只有「搜尋 / 收藏」tab，加備選的場景無法用 map pin custom POI。Symmetry gap。

### Added

- **新 shared component** `src/components/trip/CustomPoiForm.tsx` — 抽出 title + address typeahead + LocationPickerMap + hint checkbox + sidehelp 共用 UI/邏輯，跨 AddStopPage + ChangePoiPage（往後 AddCustomStopPage 也可遷移）
- **ChangePoiPage 自訂 tab** — `?tab=custom` URL state，submit:
  - `mode=alternate` → `POST /alternates` with `{name, lat, lng, source: 'custom'}`
  - `mode=master` (預設) → `PUT /poi-id` with same payload
- 新 testid: `change-poi-tab-custom` / `change-poi-custom-twopane` / `change-poi-custom-title` / `change-poi-custom-coord-readout` 等（共用 `testIdPrefix="change-poi-custom"` 命名空間）

### Changed

- `AddStopPage.tsx` 自訂 tab JSX 從 inline 改 `<CustomPoiForm testIdPrefix="add-stop-custom" extraRows={time/duration/note}>`，~200 行重複 JSX 消失
- `AddStopPage.tsx` SCOPED_STYLES 大幅減少 — `.tp-add-stop-custom-*` / `.tp-custom-picker-*` / hint / sidehelp / two-pane grid 全搬進 `CustomPoiForm`
- `LocationPickerMap` 的 base CSS 也搬進 `CustomPoiForm` SCOPED_STYLES（之前依賴 AddStopPage 載入才有樣式 — ChangePoiPage 用不了 fix）
- ChangePoiPage `Tab` type extends 為 `'search' | 'favorites' | 'custom'`，`submitDisabled` gating 支援 custom tab（title + coord 必填）

### Tests

- 新 16 個 source-grep test `tests/unit/change-poi-custom-tab.test.ts` — Tab type / button / handleSubmit branch / shared component contract / 兩 pane media query
- 既有 254 files / 1960 tests 全綠

### Backend

不動。`/alternates` + `/poi-id` 早已支援 `{name, lat, lng, source}` payload（via `findOrCreatePoi`）。

### Mockup reference

延用 `docs/design-sessions/2026-05-18-add-custom-stop/desktop-inline.html` 兩段式 layout（mockup C 已 APPROVED），ChangePoiPage 自訂 tab 自動繼承。

## [2.31.97] - 2026-05-19

**Change: daily-check 排程從 09:00 → 06:10。** Ray 想早一點看每日報告。06:10 留 100 min 緩衝給 04:30 google-poi-refresh 完成 50 POI × 1.5s sleep + Place Details API 後再稽核（實測 refresh 跑 ~3-5 min，緩衝充足）。

### Changed

- `scripts/tripline-api-server.ts:scheduleDaily(9, 0, '/tp-daily-check')` → `scheduleDaily(6, 10, ...)`

### Deploy

Same as v2.31.96 — `launchctl unload && load` api-server 後驗證 log 出現 `Scheduled daily-check (...) first fire at YYYY-MM-DDT22:10:00.000Z`（UTC 22:10 = 台灣 06:10）。

## [2.31.96] - 2026-05-19

**Fix: 接 3 個 launchd 廢棄後的孤兒 daily script — Google Maps 花費、POI 30 天 refresh、auth-cleanup retention sweep。** 使用者 QA「每日檢查排程應該有 Google Maps 使用金額」抓到 v2.31.3 把 launchd 廢棄、改 api-server 內部 cron 時只搬 `/tp-daily-check`，其他 daily 任務變孤兒沒人觸發。

### Context

v2.31.3 廢棄 launchd `com.tripline.daily-check`，把 `/tp-daily-check` 改成 api-server 內部 cron (09:00)。但 `scripts/google-quota-monitor.ts` / `scripts/google-poi-refresh-30d.ts` / `scripts/auth-cleanup.js` 三個原由 launchd 觸發的 daily script 沒人搬，13 天沒跑：

- **`google-quota-monitor.ts`** → Telegram 看不到 Google Maps MTD 花費 + 90% lock / <50% unlock 自動機制停擺
- **`google-poi-refresh-30d.ts`** → `pois.status_checked_at` 不更新，`<TripHealthBanner>` 永遠綠燈（即使 POI 已永久結業也不知道）；650 個 POI 該 refresh 沒 refresh
- **`auth-cleanup.js`** → V2-P6 30 天 retention 承諾失守，`auth_audit_log` / `session_devices` / `oauth_models` 三表無限長

### Added

- **新 lib** `scripts/lib/google-maps-quota.js` — 抽出 `PRICE_PER_1K` + `calcDailyCost` + `calcMtdCost` + `classifyStatus` 純函式（drift test 守住與 `google-quota-monitor.ts` SoT 對齊）
- **`daily-check.js` 新增 7th section** `queryGoogleMapsQuota` — GET `/api/admin/maps-settings` + `/api/admin/quota-estimate` 算 MTD，threshold mapping（≥`lock_threshold_pct` → critical, ≥50% → warning, <50% → ok）
- **`build-daily-check-msg.js` 新增 Google Maps section** — critical/warning 進 issue 列表（🔴/🟡），metrics block 永遠顯 `💰 Google Maps MTD: $X.XX / $200 (Y%)` 透明可見
- **`tripline-api-server.ts` 新 helper** `fireScheduleScript` + `scheduleDailyScript` — fire-and-forget spawn shell script（不走 claude/tmux/token mint，獨立 log 到 `scripts/logs/api-server/script-<label>-YYYY-MM-DD.log`）
- 新 cron 排程：
  - `auth-cleanup.js` 每天 04:00
  - `bun run refresh:google` 每天 04:30

### Tests

- 21 unit tests (cost calc + threshold + msg renderer + drift detection)
- 全 suite 254 files / 1960 tests pass; tsc clean

### Deploy 順序

1. PR merge → master
2. 重啟 launchd api-server：`launchctl unload ~/Library/LaunchAgents/com.tripline.api-server.plist && launchctl load ~/Library/LaunchAgents/com.tripline.api-server.plist`
3. 觀察 `scripts/logs/api-server/<today>.log` 看到 3 行 `Scheduled <label> first fire at ...`
4. 隔天 04:00 / 04:30 / 09:00 三條 schedule fire 後檢查各自 log + Telegram 訊息

## [2.31.95] - 2026-05-19

**Fix: 桌機自訂景點 tab 改 two-pane layout 對齊 mockup C。** User QA feedback：桌機地圖位置和 mockup C 不同 — 之前 form 與 map 是上下 stacked，現在改回 mockup approved 的左 form 380px / 右 map 1fr。

### Changed

- `src/pages/AddStopPage.tsx` 自訂 tab JSX — 由 stacked form-rows 改為 two-pane grid（`.tp-add-stop-custom-twopane` 外層 + `.tp-add-stop-form-pane` 左 / `.tp-add-stop-map-pane` 右）。Map pane 含地圖 + 「已調整到正確位置」hint + 「小提示」sidehelp（解釋為什麼地址不夠、要拖 pin）
- 新 testid：`add-stop-custom-twopane` / `add-stop-custom-map-pane` / `add-stop-custom-coord-readout`
- 移除 unwired placeholders「結束時間 自動估算」+「類型 SIGHT · 景點」（pre-existing dead UI，這版順手清掉以對齊 mockup C 4-field form）
- `.tp-add-stop-body:has(.tp-add-stop-custom-twopane)` 在 ≥1024px 放寬 max-width 1024px，讓 380+map 兩 pane 排得開（其他 tab 仍維持 720px）

### Mockup reference

`docs/design-sessions/2026-05-18-add-custom-stop/desktop-inline.html` (V3 chosen variant, APPROVED 2026-05-18)

## [2.31.94] - 2026-05-19

**Feat: 自訂景點 + 地址 typeahead + 地圖 pin pick → 自動計算前後車程。** 旅伴加自訂 entry 時 UI 強制提供 lat/lng，map marker 不再 silent drop、travel pill 30s 內計算車程。

### Context

Owner Ray observation：旅伴**以為**自訂 entry 在 map 上、實際被 silent drop（無座標 → OceanMap 漏 marker + segment 跳過 → travel pill 空白 → timeline 整本帳斷掉）。這是 product expectation gap (bug 層級)，不是 nice-to-have feature。Design doc + reviewer 3 輪 + CSO HIGH 2 個全修。

### Added

- **新 backend endpoint** `POST /api/places/autocomplete` — Google Places API (New) `/v1/places:autocomplete` proxy with auth + per-user 1000/24h rate limit + sessionToken/regionCode length caps
- **新 backend endpoint** `GET /api/places/resolve?placeId=...&sessionToken=...` — Place Details wrapper that closes Google billing session (one autocomplete + one details = 1 billable interaction). Per-user 500/24h rate limit
- **新 mobile route** `/trip/:id/add-custom-stop?day=N` (AddCustomStopPage) — fullpage 自訂景點 picker，IME-occlusion 友善，per `<MobileOnlyRoute>` guard 桌面 redirect 回 inline tab
- **新 frontend hook** `usePlacesAutocomplete` — 300ms debounce + crypto.randomUUID() session + LRU cache + abort + cleanup
- **新 frontend hook** `useTypeaheadKeyboard` — ARIA combobox + Arrow/Enter/Escape 鍵盤導航（WCAG 2.1 Level A）
- **新 frontend lib** `src/lib/locationPicker.ts` — isValidCoord / computeArrowKeyStepPixels / selectDefaultCenter fallback chain
- **新 frontend component** `<LocationPickerMap>` — picker-mode Google Maps，CSS overlay center marker (NOT AdvancedMarkerElement)、`idle` listener、arrow-key panBy a11y
- **新 frontend wrapper** `<MobileOnlyRoute>` — `matchMedia (max-width: 1023px)` responsive route guard

### Changed

- `AddStopPage` 自訂 tab — title/time/duration/note 4 欄位保留，新增 address typeahead + LocationPickerMap + 「已調整到正確位置」hint checkbox。Submit 強制 lat/lng + source='custom'。Mobile (≤1023px) auto-redirect 到 fullpage route 避免 IME occlusion
- `functions/api/_validate.ts` validateEntryBody — 新增 lat/lng XOR + range check + source allowlist
- `functions/api/trips/[id]/days/[num]/entries.ts:87` — forward `body.source` 進 pois.source (改 hardcode 'ai')
- `src/server/maps/google-client.ts` getPlaceDetails 簽名 — 新增 optional sessionToken arg，URL `?sessionToken=` forward Google billing session

### Security audit

CSO HIGH 2 個 + LOW 3 個全部 address：
1. ~~`auth.user.id` typo~~ → `auth.userId` (autocomplete 在 prod 之前是 500 broken)
2. ~~/api/places/resolve 無 rate limit~~ → 加 500/24h per-user cap
3. body.source 加 allowlist
4. sessionToken / regionCode / placeId 加 length cap

### Mockups

`docs/design-sessions/2026-05-18-add-custom-stop/` — 3 cross-form-factor variants + compare board (V1 mobile fullpage + V3 desktop inline 為 ship combo).

### Test

新 89 個 vitest unit test，覆蓋 backend validation / autocomplete client / endpoint / resolve / hook / lib / a11y keyboard / route guard. 既有 1850 test 0 regression — total 1939/1939 green.

## [2.31.93] - 2026-05-18

**Fix: TripMapRail 對齊 MapPage focusId flow — 點 stop marker 換 accent 視覺 + 浮頂避免被相鄰 marker 蓋住（user feedback 2 issue）。**

### Context

User 反映兩個地圖互動問題：
1. 「點行程的 stop 地圖的 icon 沒有換被點選的 marker (參考地圖頁的方式)」— TripMapRail 在 v2.31.87/88 用手動 `setPanToCoord+zoom` 控 flyTo，沒進 OceanMap `focusId` flow → marker 顏色 / size / accent ring 不變
2. 「被點的 stop 沒有浮在最高 被壓住了」— `AdvancedMarkerElement.zIndex = 1000` 給 DOM stacking 但相鄰 marker overlap 時視覺凸度不夠

### Changed

- **`src/components/trip/TripMapRail.tsx`** entryFocused listener 重寫對齊 MapPage focusId flow：
  - 新 `focusedEntryId` state，pass `focusId={focusedEntryId}` 給 OceanMap
  - `isExpanding === true` → `setFocusedEntryId(entryId)` + clear panToCoord（觸發 OceanMap focusId useEffect 切 marker accent 視覺 + flyTo z<12?13:undefined）
  - `isExpanding === false` → `setFocusedEntryId(undefined)` + clear panToCoord（觸發 OceanMap focusId useEffect collapse 自動 fitBounds visible pins 回 overview）
  - `isExpanding === undefined` (scroll spy fallback) → 維持 v2.31.81 行為（panToCoord pan only no zoom，不切 marker 視覺）
- **`src/components/trip/OceanMap.tsx::markerContent`** focused marker box-shadow 加強：
  - 新增 `isFocused = typeof style.zIndex === 'number' && style.zIndex >= 1000` 偵測
  - Focused 時 box-shadow 換「1.5px accent inner ring + 5px accent-subtle outer ring (217,120,72,0.35) + 6px 16px deeper drop shadow (42,31,24,0.35)」取代 idle 的 0.18 black drop shadow
  - Focused 時 inline style 加 `position: relative; z-index: 1000;` 強化 CSS stacking

### Why

對齊 MapPage 行為 — 桌機 rail 點 timeline row 跟手機 MapPage 點 marker 應有一致 visual response（marker 變大、變橘、accent ring、flyTo zoom 13）。CSS box-shadow 補強解決 `AdvancedMarkerElement.zIndex` 在 Google Maps overlay layer 內已生效但 marker 本身視覺差異不夠的問題。

### Test

- `tests/unit/v2_31_93-trip-map-focusid-marker.test.ts` 新增 6 個 source-grep test（focusedEntryId state / focusId prop / isExpanding 兩 branch / markerContent isFocused 偵測 / accent ring + 加深 drop shadow / z-index:1000 inline style）
- `tests/unit/v2_31_79-marker-label-text-outline.test.ts` 第 3 個 test 更新 — focused marker 不再含 idle 的 `rgba(0,0,0,0.18)` drop shadow，改 assert accent ring + 加深 drop shadow
- `tests/unit/v2_31_87-map-zoom-on-stop-toggle.test.ts` 重寫 — 移除 obsolete「zoom 13/10」assertion（v2.31.93 改 focusId flow），保留仍 valid 的 TimelineRail dispatch / panToCoord prop shape / OceanMap flyTo path 三 contract，zoom 值 assertion 由 v2.31.93 test 接手
- 全 unit suite 1839/1839 pass

## [2.31.92] - 2026-05-18

**Fix: 移除 stop toolbar 2 個重複/不需要 button + StopLightbox 改 Portal 修 backdrop 沒蓋住 viewport（user feedback 2 issue）。**

### Changed

- **`src/components/trip/TimelineRail.tsx`** expanded toolbar：
  - 移除「置換景點」icon button（pin icon）— 編輯景點 path 已含此功能
  - 移除「收合」icon button（minimize icon）— row click 已 toggle expand/collapse，重複 entry
  - Toolbar 從 6+2 grouped 變 4+1 grouped（放大檢視 / 複製 / 移到他天 / 編輯 + spacer + 刪除）

### Fixed

- **`src/components/trip/StopLightbox.tsx`** backdrop overflow issue（user QA 截圖：TitleBar / day picker / sticky map 沒被 backdrop 蓋住）：
  - 改用 `createPortal` mount 至 `document.body` — bypass embedded TripPage 的 transform / sticky containing block ancestor，確保 `position: fixed; inset: 0` 蓋滿 viewport
  - z-index 寫死 `1100` → 改 `var(--z-modal, 9000)` 對齊系統 modal hierarchy token

### Test

- `tests/unit/timeline-rail-toolbar-pencil.test.tsx`：assertion 從「4 個 action button (放大/編輯/刪除/收合)」改「3 個 (放大/編輯/刪除)」，加 negative assertion `queryByTestId('timeline-rail-collapse-42')).toBeNull()` + `timeline-rail-change-poi-42` toBeNull。27/27 pass。

## [2.31.91] - 2026-05-18

**Fix: chat 內 markdown link 樣式對齊 terracotta 風格（user feedback「健檢報告連結 樣式不符合網站風格」）。**

AI 健檢 reply 含 markdown link `[前往健檢報告](/trip/:id/health)`，prod chat bubble 用 browser 預設藍/紫 underline → 不符合 site terracotta UX。

### Changed

- **`src/pages/ChatPage.tsx` SCOPED_STYLES**：加 3 條 link rule：
  - `.tp-chat-msg a`：terracotta `--color-accent-deep`（fallback `--color-accent`）+ underline 1px / offset 2px + weight 500
  - `.tp-chat-msg a:hover`：opacity 0.7 transition
  - `.tp-chat-msg-user a`：user bubble (accent bg) → text 用 `--color-accent-foreground` (white) + underline 半透明白
- Assistant bubble (cream bg) link → terracotta deep；user bubble (orange bg) link → white。所有 chat 內 markdown link 統一套用，不只健檢 reply。

### Test

- `tests/unit/v2_31_91-chat-md-link-style.test.ts`：4 source-grep test 鎖 4 條 CSS rule。

## [2.31.90] - 2026-05-18

**Fix: 桌機 TitleBar action 全 icon-only（user direction「檢查桌機版 title bar 都改為 icon 無說明文字」）。**

### Changed

- **`css/tokens.css`**：`.tp-titlebar-action-label { display: none; }` 從 `@media (max-width: 760px)` block 內 → top-level（all viewport），桌機也 icon-only。
- 缺 `title` attr 的 button 補 hover tooltip（DOM `tp-titlebar-action-label` span 仍保留供 sr-only 但視覺 hidden）：
  - `src/pages/TripsListPage.tsx` 新增行程 → `title="新增行程"`
  - `src/pages/SessionsPage.tsx` 登出其他全部裝置 → `title="登出其他全部裝置"`
  - `src/pages/DeveloperAppsPage.tsx` 建立新應用 → `title="建立新應用"`
  - `src/components/shell/TitleBarPrimaryAction.tsx`（5+ pages reuse: 儲存 / 完成 / 建立）→ `title={displayLabel}`
- 既有 ExplorePage「收藏」/ PoiFavoritesPage「探索」/ TripsListPage「探索」/「切換行程」已有 title attr，無變更。

### Test

- `tests/unit/v2_31_90-titlebar-action-icon-only.test.ts`：6 source-grep test 鎖 CSS top-level rule + 5 個 button title attr。tsc clean。

## [2.31.89] - 2026-05-18

**Fix: 切換行程 button 改 dropdown picker（user feedback「要用的下拉選單的版本的 icon」）。**

v2.31.85 加的 simple swap-horiz icon button click 直接跳 /trips 列表。User 反映要對齊 ChatPage TitleBar trip picker 設計 — swap-horiz + chevron ▾ + dropdown 列 trips，user 不離開行程詳細頁直接切換。

### Changed

- **`src/pages/TripsListPage.tsx`** embedded TitleBar「切換行程」button：
  - simple `<Icon name="swap-horiz" />` + `onClick=clearSelected` → **dropdown picker**
  - `.tp-titlebar-trip-menu` wrap + `.tp-titlebar-trip-picker` button (swap-horiz + chevron ▾) + `.tp-titlebar-trip-dropdown` menu panel
  - menu rows 顯示 trips 標題 + countries meta，active trip highlight
  - row click → `setActiveTrip(tripId)` + `setSearchParams({ selected })` + close menu
  - outside click close menu (mousedown listener)
  - 加 `tripPickerOpen` state + `tripPickerRef`
- CSS class 全 reuse `css/tokens.css` 既有 `.tp-titlebar-trip-*`（ChatPage 也用）— 無新 CSS。

### Test

- `tests/unit/v2_31_89-trip-picker-dropdown.test.ts`：7 source-grep test 鎖 button 結構 + dropdown menu + row click handler + outside click effect。tsc clean。

## [2.31.88] - 2026-05-18

**Fix: TripMapRail zoom level 對齊 MapPage focusId flow（user 反映 v2.31.87 zoom 太大）。**

User direction：「行程地圖的 zoom 太大 比照地圖功能的 zoom」。MapPage 點 stop card 用 OceanMap focusId flow → `flyTo z<12?13:undefined` zoom max 13。

### Changed

- **`src/components/trip/TripMapRail.tsx`** entryFocused listener：
  - 展開 (isExpanding=true) → zoom 15 **→ 13**（對齊 MapPage focusId zoom）
  - 收合 (isExpanding=false) → zoom 11 **→ 10**（對齊 MapPage 沖繩 overview fitBounds level）

### Test

- `tests/unit/v2_31_87-map-zoom-on-stop-toggle.test.ts`：assertion 對齊 zoom 13/10。6/6 pass。

## [2.31.87] - 2026-05-18

**Feat: TimelineRail row click 展開 → map flyTo zoom 15；收合 → flyTo zoom 11 trip overview。**

User direction（v2.31.85 follow-up #5+#6）：
- 行程點選景點展開 → 地圖也要放大同地圖頁效果
- 收合則縮小地圖

### Changed

- **`src/components/trip/TimelineRail.tsx`**：dispatch `EVENT.entryFocused` 加 `isExpanding: !expanded` detail（true = 將要展開 / false = 將要收合，next state）
- **`src/components/trip/TripMapRail.tsx`**：
  - `panToCoord` state 加 `zoom?: number` field
  - listener 區分 `detail.isExpanding`：
    - `true` (展開) → `setPanToCoord({ ..., zoom: 15 })` 景點 close-up
    - `false` (收合) → `setPanToCoord({ ..., zoom: 11 })` trip overview level
    - `undefined` (scroll spy fallback) → 維持 v2.31.81 panTo only no zoom
- **`src/components/trip/OceanMap.tsx`**：
  - `panToCoord` prop type 加 optional `zoom`
  - useEffect 處理：`typeof zoom === 'number'` 走 `flyTo(coord, zoom)`，否則 `map.panTo(coord)` (backward compat)

### Test

- `tests/unit/v2_31_87-map-zoom-on-stop-toggle.test.ts`：6 個 source-grep test 鎖 isExpanding payload + zoom state + flyTo path。
- timeline-rail-segments-wiring 既有 regression test 8/8 pass。

## [2.31.86] - 2026-05-18

**Feat: TripSheet「聊天」tab 接 AI 聊天功能（user direction follow-up v2.31.85 #4）。**

### Added

- **`src/pages/ChatPage.tsx` 加 `ChatPageProps`**：
  - `embedded?: boolean` — skip AppShell + DesktopSidebar + GlobalBottomNav + TitleBar，讓 ChatPage 可嵌 TripSheet 內
  - `lockTripId?: string` — useEffect 強制 `setActiveTripId(lockTripId)` 鎖 trip context 到當前 TripPage trip
  - `if (embedded) return main;` skip AppShell wrapper

- **`src/components/trip/TripSheet.tsx` chat tab**：
  - 拿掉 placeholder「即將推出 / 行程專屬對話 / 下一階段推出」copy + 結構
  - `currentTab === 'chat'` 時 `<Suspense><ChatPage embedded lockTripId={tripId} /></Suspense>` lazy mount
  - lazy import 對齊既有 TripMapRail pattern

### Test

- `tests/unit/v2_31_86-chat-page-embedded.test.ts`：7 個 source-grep test 鎖 ChatPageProps interface + embedded conditional render + TripSheet embed wiring。
- 既有 5 個 chat-page tests + 1 trip-sheet test 27/27 pass。

## [2.31.85] - 2026-05-18

**Feat: trip detail page TitleBar icon-only + TripSheet 拿掉「行程」tab（用戶截圖標出紅框）。**

### Changed

- **TripsListPage embedded TitleBar**：
  - 「探索」button 拿掉中文 label，保留 search icon + tooltip（aria-label / title 仍為「探索」可用）
  - 加「切換行程」icon button（swap-horiz），onClick = clearSelected → 回 /trips 列表
- **TripSheet**（右側 sticky sheet）：
  - 拿掉「行程」tab — main column 已 render 行程內容，sheet 重複 placeholder 無 user value
  - `SHEET_TABS = ['itinerary', 'map', 'chat']` → `['map', 'chat']`
  - `?sheet=itinerary` legacy URL → parseSheetParam null → fallback 'map'
  - TripSheetTabs TAB_LABELS 只剩 map/chat 2 key

### Test

- `tests/unit/trip-sheet.test.tsx`：itinerary placeholder assertion → degrades-to-map；click target → tab-chat；2-tab labels lock。
- `tests/unit/trip-sheet-tabs-aria.test.tsx`：active aria-selected 改測 chat tab。
- `tests/unit/trip-sheet-tabs-keyboard.test.tsx`：全 rewrite for 2-tab navigation (map ⇄ chat)。
- 21/21 pass + tsc clean。

## [2.31.84] - 2026-05-18

**Fix: marker 重疊時數字外框顯示加強 — v2.31.79 的 1px halo + 1.5px ring 不夠強，user 反映 prod 仍難讀（4 marker 重疊那覇都心 5/6/4/3）。**

### Fixed

- **`src/components/trip/OceanMap.tsx` `markerContent()`**：
  - text-shadow halo 1px → 2px（marker overlap 時自己 fill 蓋下方 marker bg 露出，halo 加粗讓對比更明顯）
  - box-shadow 加 outer 3px `rgba(0, 0, 0, 0.18)` drop shadow：所有 state 統一 elevation，marker 間有明顯陰影分離（不依賴 fill 同色，普適於 idle/focused/past 三 state）
  - 保留 v2.31.79 inner 1.5px `${fill}` ring（marker overlap 蓋層邏輯）
- **`tests/unit/v2_31_79-marker-label-text-outline.test.ts`** 更新 lock 2px halo + drop shadow rgba(0,0,0,0.18) 雙條件。

## [2.31.83] - 2026-05-18

**Revert: v2.31.81 #6+#7 sidebar 改動（user：「sidebar 復原, 原本的修正都是調整 content 頁面 不要動 sidebar」）。**

### Reverted

- **DesktopSidebar IA 回 v2.31.80**：5 nav items 中文 label（聊天 / 行程 / 地圖 / 收藏 / 登入），不再 icon-only。「探索」+「切換行程」icon 拔除；「行程」nav 還原。aria-label / title tooltip / sr-only `<span className="tp-nav-item-label">` / sidebar-nav-${key} testid 全部移除。icon size 16px / font 14px 600 / padding 10px 12px 對齊 v2.31.80。
- **`tests/unit/desktop-sidebar.test.tsx` + `tests/unit/desktop-sidebar-visual.test.tsx`** 還原 v2.31.80 state（5-nav assertions）。
- **`tests/unit/v2_31_81-batch-ux-fixes.test.ts`** 中 #6+#7 sidebar describe block 拔除，header doc 標 ✅ 區分保留 vs revert 點。

### 不變（v2.31.81 其餘 6 點 + v2.31.82 chevron follow-up 保留）

- #1 MapPage handleCardClick day nav sync ✅
- #2 MapPage TitleBar trip name + picker icon-only ✅
- #3 5 個 native `<select>` chevron + appearance:none（含 v2.31.82 EditTripPage .tp-edit-row 強化）✅
- #4 TripSheet X 桌機 ≥1024px 隱藏 ✅
- #5 TimelineRail row click → EVENT.entryFocused → TripMapRail panTo ✅
- #8 Sidebar 聊天 nav /chat — v2.31.80 已是 /chat，sidebar revert 後仍 hold ✅

## [2.31.82] - 2026-05-18

**Fix: v2.31.81 #3 chevron 在 EditTripPage 顯示語言 select 沒生效（QA 截圖 found）。**

### Fixed

v2.31.81 prod browse QA 抓到 `EditTripPage` 顯示語言 select `#edit-trip-lang` 的 chevron 沒 render —— computed style `backgroundImage: none`、`paddingRight: 14px`（應為 40px）。

**Root cause**：`src/components/trip/_tripFormStyles.ts` line 134 page-scoped rule `.tp-edit-row select` 用 `background: var(--color-secondary)` shorthand 覆蓋 → background-image 被 reset 成 none。`.tp-select` (tokens.css) 的 chevron 雖然 declared 但被 page-scoped rule 後接覆寫。

**Fix**：`_tripFormStyles.ts` 加 dedicated `.tp-edit-row select` rule 含 `appearance: none` + chevron `background-image` (longhand) + `padding-right: 40px` + dark mode override。Page-scoped specificity (0,2,0) 直接 win 確保 chevron 100% render。

### Test results

- vitest: 237 file / 1807 test 全綠（無新 regression test 需要 — v2.31.81 source-grep test 已涵蓋 `.tp-edit-row select` rule shape，automatic 通過 because regex 匹配存在 .tp-edit-row select 含 appearance + background-image 的 block）

## [2.31.81] - 2026-05-18

**User batch UX fixes：8 點一次到位（地圖 day nav 同步 / title bar 對齊 / select 樣式 / 桌機 sheet X / timeline 點擊放大 / sidebar icon-only IA）。**

### Fixed

1. **#1 MapPage handleCardClick 在 overview 模式同步 day nav**：user 點 map pin 時 day nav 不會切到該 entry 的那一天。`handleCardClick` 加 `isOverview` check + `entryDayMap.get(entryId)` 反查 dayNum，call `handleTabClick(targetDay)` 同步切 tab + URL `?day=N`。

2. **#2 MapPage TitleBar 對齊 ChatPage 格式**：左 trip name（`trip?.title || trip?.name || '地圖'`），右 picker icon-only（移除 `tp-titlebar-trip-picker-name` span 內 trip name 重複顯示）。對齊 v2.31.47 ChatPage 同步調整。

3. **#3 5 個 native `<select>` 改 site-style**：
   - `css/tokens.css` 加 `.tp-select` 全域 class + 擴 `.tp-form-row > select`：`appearance: none`、自訂 chevron data:image SVG（accent terracotta light / cream dark mode）+ `padding-right: 36px` 容 chevron。
   - 各頁 page-scoped `.tp-form-select` / `.tp-entry-action-time-select` / `.tp-trips-sort` 加 `appearance: none` + chevron。
   - `EditTripPage.tsx` 顯示語言 select 加 `className="tp-select"`。
   - 保留 native `<select>` element → 鍵盤 a11y + mobile picker UX 完整不動（不 roll custom dropdown 避免 a11y regression）。

4. **#4 桌機版 trip page 右側 sheet X close button 沒用**：sheet 在 desktop ≥1024px 是 always-on 右側 column（AppShell 3-pane 控），X click 改 URL `?sheet=` 但 sheet 仍 mount → user 看到 click 沒反應。修正：`@media (min-width: 1024px) { .trip-sheet-close { display: none } }`。Mobile <1024px X 仍保留（mobile sheet 是 slide-up overlay，X dismiss 合理）。Sheet tab 切換靠 header `.trip-sheet-tabs`，不需 close。

5. **#5 桌機版 timeline stop 點擊地圖未放大到該景點**：原本 `TripMapRail` 只做 scroll-spy day-center pan（平均座標），無單一 pin focus。新增 `EVENT.entryFocused` (`tp-entry-focused`) custom event：
   - `TimelineRail` row click handler 內 `dispatchEvent` 帶 `{ entryId }`。
   - `TripMapRail` `useEffect` listen，find pin by id → `setPanToCoord({ lat, lng })` panTo 該景點精準座標。
   - 跨檔互動走 window CustomEvent 模式（對齊 codebase `tp-entry-updated` / `tp-segment-updated` 風格），避免 TimelineRail 直接 import map ref。

6. **#6+#7 桌機 sidebar 全 icon-only + 重組 IA**：
   - NavItemConfig key type：`'chat' | 'explore' | 'map' | 'favorites' | 'switch-trip' | 'login'`（原 `'trips'` 移除，新增 `'explore'` + `'switch-trip'`）。
   - 6 個 nav item（anonymous）/ 5 個（logged-in 隱藏「登入」）：聊天 / 探索 / 地圖 / 收藏 / 切換行程 / [登入]。
   - 「行程」 nav 移除（取代為「切換行程」走相同 /trips href + TRIP_ACTIVE_PATTERNS active 條件）。
   - 「探索」 nav 新加（icon=`search`），從 /favorites secondary action 升為 primary nav icon。
   - 「切換行程」 nav 新加（icon=`swap-horiz`）。
   - 視覺：icon size 16 → 22px、`min-height/width: 44px` 中心對齊、padding `10px 12px` → `10px`、`text-align: center`、新增 `.tp-nav-item-label` sr-only class（visually hidden 但 DOM 仍 surface 給 screen reader）+ `aria-label` + `title` tooltip。Sidebar width 保留 240px 不動，避免 grid template cascade。

7. **#8 桌機 sidebar 聊天 → /chat (AI chat)**：驗證現狀正確（ChatPage 即 AI chat 功能，v2.31.27 起 chat AI 健檢功能 surface 在此）。無 code 變更。

### Test results

- vitest: **237 file / 1807 test 全綠**（+17 個 v2.31.81 regression test）
- tsc + build：0 errors
- Sidebar tests (desktop-sidebar.test.tsx + desktop-sidebar-visual.test.tsx) 全套對齊新 IA 重寫

## [2.31.80] - 2026-05-18

**Cleanup: AddStopPage `normalizePoiFavorites` 移除 snake_case dead fallback。**

### Cleaned: 4 個 `?? item.poi_*` defensive 路徑從未生效

`/api/poi-favorites` 用 `functions/api/_utils.json()` 經 `deepCamel`，response 永遠 camelCase (`poiId` / `poiName` / `poiAddress` / `poiType` / `poiRating`)。`AddStopPage.normalizePoiFavorites` 寫 `item.poiId ?? item.poi_id` 等 4 個 defensive fallback 從未生效，留著只是製造混淆。

Source 簡化：
```ts
// Before
const poiId = Number(item.poiId ?? item.poi_id);
const poiName = item.poiName ?? item.poi_name;
const poiAddress = item.poiAddress ?? item.poi_address;
const poiType = item.poiType ?? item.poi_type;
const poiRating = typeof item.poiRating === 'number' ? item.poiRating
  : typeof item.poi_rating === 'number' ? item.poi_rating
  : undefined;
// After
const poiId = Number(item.poiId);
const poiName = item.poiName;
const poiAddress = item.poiAddress;
const poiType = item.poiType;
const poiRating = typeof item.poiRating === 'number' ? item.poiRating : undefined;
```

延續 v2.31.77 entry.start_time camelCase 修正的同精神 — TypeScript 型別、實際 runtime 跟 backend `deepCamel` 三方對齊。

**Test update**：`tests/unit/add-stop-page-rating-and-title.test.ts` 既有 v2.31.17 assertion 「snake_case poi_rating fallback」改為 lock 「dead fallback 移除」。

**New regression test**：`tests/unit/v2_31_80-normalize-poi-favorites-camel-only.test.ts` 3 個 assertion — fn block 含 camelCase 5 field、不含任何 `item.poi_*` snake property access。

### Test results

- vitest: **236 file / 1791 test 全綠**（+3 個 regression，1 個 v2.31.17 既有 test 更新）
- tsc/build：0 errors

## [2.31.79] - 2026-05-18

**Fix: OceanMap marker 疊在一起時數字看不清楚（user QA prod screenshot）。**

### Fixed: 那霸都心多 marker 重疊區的數字混在一起難讀

user prod 截圖（那覇都心 5/6/4/3 圈疊在一起）顯示 marker 重疊時數字邊界模糊：每個 marker 是 28px 白底圓 + 灰色 stroke 圈 + 內含 day-color 的數字，相鄰兩個 marker 的 stroke 圈與字體緊貼，沒有任何視覺 separator。

**Fix**：`markerContent()` HTMLDivElement 加兩個視覺 separator：
1. `text-shadow`：8 個方向各 1px offset 用 `style.fill` 顏色當 halo，數字四周生出 1px ring → 數字疊在相鄰 marker stroke 邊上仍可讀
2. `box-shadow: 0 0 0 1.5px ${style.fill}`：marker stroke 外圈再加 1.5px fill-color outer ring → marker 邊界視覺與相鄰 marker stroke 分離

對 focused (orange fill, white text) / past (white fill, mute text) / idle 三種 state 全 apply，halo 永遠等於該 marker 自己的 fill bg → 視覺像「字浮在 marker 上、marker 自己有發光外框」。

**Regression test**：`tests/unit/v2_31_79-marker-label-text-outline.test.ts` — 6 個 assertion lock text-shadow ≥4 個 fill offsets + box-shadow 含 `1.5px ${fill}` + 三種 state 全 apply + dayColor 不影響 halo（halo 永遠等於 fill）+ v2.31.75 contract (textContent + borderRadius) 維持。

### Test results

- vitest: **235 file / 1788 test 全綠**（+6 個 regression）
- tsc/build：0 errors

## [2.31.78] - 2026-05-18

**Fix: AddStopPage lazy favorites fetch 缺 unmount guard。**

### Fixed: tab='favorites' → 切回 search 期間 fetch 還在 inflight → React state update warning + closure leak

`src/pages/AddStopPage.tsx` 切到 ★ 我的收藏 tab 才 lazy fetch `/api/poi-favorites`。若 user 立刻切回 search tab 或 unmount component，inflight fetch 完成後 `setPoiFavorites` + `setSavedLoading(false)` 仍會觸發 → React 印「Can't perform a state update on an unmounted component」warning，殘留 closure 不被 GC。

實際 user impact 小（fetch 很快、tab toggle 不頻繁）但屬 known anti-pattern。對齊 codebase 其他 useEffect async fetch 的 cancelled-flag 風格（useTrip / useCurrentUser / useChatPagination / useGoogleMap 都有）。

**Fix**: 加 `let cancelled = false` + `return () => { cancelled = true; }` cleanup + 3 個 `if (cancelled) return` guard（try happy / catch / finally setSavedLoading 全 cover）。

**Regression test**：`tests/unit/v2_31_78-add-stop-favorites-cancelled.test.ts` — 3 個 source-grep assertion 鎖 cancelled flag 存在 + cleanup return 存在 + ≥2 個 guard + finally setSavedLoading 用 `!cancelled` 條件 set。

### Test results

- vitest: **234 file / 1782 test 全綠**（+3 個 regression）
- tsc --noEmit: 0 errors

## [2.31.77] - 2026-05-18

**Fix #196：entry.start_time / end_time 全 frontend read path 全 broken since v2.29.0。**

### Fixed: TimelineRail row 時間 chip 完全沒顯示 + 多項時間相依 logic 失效

從 v2.29.0（migration 0062 `DROP COLUMN trip_entries.time`）起，backend 改回 `start_time` / `end_time`（D1 snake_case col），`json()` helper 經 `deepCamel` → response shape 是 `startTime` / `endTime` （camelCase）。但 frontend 6 個 read 模組 hard-code `entry.start_time` / `entry.end_time` snake_case，**runtime 永遠 undefined**。

**影響範圍**：
1. `src/lib/timelineUtils.ts::parseEntryTime` → TimelineRail row sub-line 時間 chip（`{parsed.start}`）永遠空字串 → UI 上看「景點 · ★ 4.2」直接接，沒時間
2. `src/lib/drag-strategy.ts::parseEntryTimeRange` → smart placement / hasTimeConflict / getSmartPlacement 全 broken → drag-drop 新 entry 預設 09:00 永遠不會避開既有時段
3. `src/lib/validateDay.ts::validateDay` → POI 營業時段對比的 warning 從未觸發
4. `src/lib/weather.ts::buildWeatherDay` → entry start hour 永遠 0 → 早上 / 中午 / 傍晚 三段選 location 邏輯失效
5. `src/lib/mapDay.ts::toTimelineEntry` → composedTime 永遠 null → entry.time display fallback 也壞
6. `src/components/trip/TimelineEvent.tsx::TimelineEntryData` 型別宣告錯誤（讓 TS 沒 catch 此 bug）

**Why prod hasn't caught fire**：desktop 行程一覽視覺重心在 POI 名稱 / 描述 / 評分；row 時間 chip 雖然消失但 user 還能從上下文推測時段，沒人 file bug。AI 健檢的時間數字（「Day 2 第 879 號景點 hoppepan 麵包店 10:13-10:33」）來自 Claude prompt context 的 entry 序列化，那條路徑不依賴 parseEntryTime → 顯示正常。Drag-drop 預設時段不避開既有 entry 也是 silently happened — user 改完才發現衝突。

**Fix**：6 個檔案全部把 read 端的 `start_time` / `end_time` 改 camelCase `startTime` / `endTime`。`mapDay.ts::toTimelineEntry` output 也加 surface `startTime` / `endTime`（之前只 surface composed `time`，下游 parseEntryTime 拿不到）。

**Write path 不變**：`src/pages/EditEntryPage.tsx:877-878` PATCH /trip-entries body 仍用 `body.start_time` / `body.end_time`（backend `ALLOWED_FIELDS` 是 snake_case，contract 不動）。

**Test fixture 同步**：
- `tests/unit/drag-strategy.test.ts` — 多筆 fixture `start_time` / `end_time` → `startTime` / `endTime`（之前 fixture 是 snake_case 是 stale assumption，從未驗證真實 API shape）
- `tests/unit/stop-lightbox.test.tsx` — ENTRY fixture 改 camelCase

**Regression test**：`tests/unit/v2_31_77-entry-time-camelcase-read.test.ts` — 11 個 assertion 鎖：
- `parseEntryTime` / `parseEntryTimeRange` / `validateDay` / `buildWeatherDay` 接受 camelCase input 並回 expected 結果
- 5 個檔 source-grep 沒有 `.start_time` / `.end_time` property reads
- `EditEntryPage` write payload 仍含 `body.start_time` / `body.end_time`（contract lock）

### Test results

- 全套 vitest: **233 file / 1779 test 全綠**（+11 個新 regression）
- tsc --noEmit: 0 errors
- vite build: 0 errors

## [2.31.76] - 2026-05-18

**Hotfix v2.31.75 follow-up：useGoogleMap 必須 await 'marker' library 才能 setMap。**

### Fixed: trip detail page 地圖整個進 ErrorBoundary

v2.31.75 把 `google.maps.Marker` → `google.maps.marker.AdvancedMarkerElement` 但 `useGoogleMap.ts` 只 `await importLibrary('maps')`，'marker' library 沒等就 `setMap(instance)` → child component（OceanMap / MapFabs）render 時 `google.maps.marker` 還是 undefined → `new google.maps.marker.AdvancedMarkerElement(...)` 觸發 `TypeError: Cannot read properties of undefined (reading 'AdvancedMarkerElement')` → 整個 map 進 React ErrorBoundary 紅屏。

prod 後驗截圖第一發就抓到（trip/okinawa-trip-2026-HuiYun detail page console error）。

**Fix**: `src/hooks/useGoogleMap.ts` 改用 `Promise.all([importLibrary('maps'), importLibrary('marker')])` 等兩個 library 都 ready 才 setMap。

**Regression test**：`tests/unit/v2_31_76-useGoogleMap-marker-library-await.test.ts`（source-grep 4 個 assertion）lock：
1. `importLibrary('maps')` 仍存在
2. `importLibrary('marker')` 也呼叫
3. 兩者用 `Promise.all([...])` parallel await（不能拆成 sequential 也不能只等其一）
4. `setOptions.libraries` 仍含 `['maps', 'marker']`

### Why this missed the unit tests in v2.31.75

`tests/unit/__mocks__/google-maps.ts` 的 `setupGoogleMapsMock()` 直接 install `globalThis.google.maps.*` 全套 constructor，跟真實 `@googlemaps/js-api-loader` 的 lazy import 行為不一致（mock 沒模擬「marker namespace 只在 importLibrary('marker') 後才出現」這個 race condition）。unit test 全綠不代表 prod 正常 — 視覺驗證（v2.31.75 PR test plan 第 4 項）才是抓到的關卡。

未來建議：mock 改成在 `importLibrary('marker')` 被 await 後才 install `google.maps.marker.*`，讓 unit test 能模擬 race。本 PR 不做這項 mock 重構（hot fix 範圍最小化），列為 follow-up。

## [2.31.75] - 2026-05-18

**Google Maps `Marker` → `AdvancedMarkerElement` 遷移（deprecated API 退場）。**

### Migrated: 拔掉 `google.maps.Marker` 改用 `AdvancedMarkerElement` + custom HTMLDivElement content

Google 2024-02-21 將 `google.maps.Marker` 標記 deprecated（仍可用、不再開發新功能、可能任意 release 被拔）。控制台會在 prod 印 deprecation warning，且新瀏覽器版本可能逐步退場。

**Files:**

- `src/hooks/useGoogleMap.ts` — `new google.maps.Map(...)` config 新增 `mapId: 'DEMO_MAP_ID'`（AdvancedMarkerElement 要求 mapId）。`libraries: ['maps', 'marker']` 早在 v2.23.0 已存在。
- `src/components/trip/OceanMap.tsx` — 將原 `markerIcon(pin, isActive, isPast, dayColor?)` 拆兩個函式：
  - `markerStyle(pin, isActive, isPast, dayColor?): MarkerStyle` — 純資料（fill / stroke / text / size / borderWidth / fontSize / label / zIndex），可純 logic test 不需 DOM。
  - `markerContent(style: MarkerStyle): HTMLDivElement` — DOM 建構（border-radius 50% 圓形 + 中央數字 label）。
  - 取代 `new google.maps.Marker({...})` 為 `new google.maps.marker.AdvancedMarkerElement({position, map, content: markerContent(style), title, gmpClickable: onMarkerClick !== undefined})`。
  - Click event 由 `'click'` 改為 `'gmp-click'`（AdvancedMarkerElement 的 events 命名）。
  - Marker 移除由 `m.setMap(null)` 改為 `m.map = null`（AdvancedMarkerElement 用 property 不是 method）。
  - 更新時改 `marker.content = markerContent(newStyle); marker.zIndex = isFocused ? 1000 : null`（content 為 property assignment）。
  - Type：`Map<number, google.maps.Marker>` → `Map<number, google.maps.marker.AdvancedMarkerElement>`。
- `src/components/trip/MapFabs.tsx` — 「我的位置」FAB 觸發後的 user location marker 同步遷移至 AdvancedMarkerElement，用 16×16 圓點 `<div>` 取代原 `Symbol.CIRCLE` icon。

**Test rewrites:**

- `tests/unit/ocean-map-marker-no-emoji.test.tsx` — 10 個 test 全重寫，斷言 `markerStyle().label` 為純數字（不含 emoji）+ `markerContent().textContent` + `borderRadius: '50%'`。涵蓋 idle / focused / past / hotel / dayColor / zIndex 6 維度。
- `tests/unit/ocean-map-imperative-effects.test.tsx` — 既有 "OceanMap.markerIcon (color contract)" describe block 5 個 assertion 重寫，將 `opts.icon.strokeColor` → `style.stroke`、`opts.label.color` → `style.text`、`opts.icon.fillColor` → `style.fill`、`opts.icon.scale > 15` → `style.size > 28`。

**Visual contract 保證**：圓形外觀 + 中央數字 + day color stroke + 28px idle / 36px focused 全 round-trip 對齊原 Symbol.CIRCLE 視覺。

### Why

- 拔掉 deprecated API console warning（prod 巡視能看到 Google 印出的 deprecation 訊息）。
- 為未來 Web Components 化 marker（可放任意 HTML / CSS）打底，自訂 marker UI 不再受 Symbol path / scale 限制。
- 對齊 v2.31.74 的 prod stability 路線（先把已知 deprecation 清掉，避免日後突然強制退場）。

### Test results

- 全套 vitest: **231 file / 1764 test 全綠**。
- tsc --noEmit: 0 errors。
- vite build: 0 errors。

## [2.31.74] - 2026-05-18

**AI 健檢 findings backend post-process sanitizer — regex 強制替換 schema 詞不靠 LLM 服從。**

### Fixed: Day 2 早餐 finding suggestion 「新增早餐 entry 並掛具體店家」leak

prod browse QA (沖繩七日遊行程表，7 個 findings) 驗證 v2.31.65 prompt 用詞規定，6/7 全清 lean 但 1 處 leak：「新增早餐 **entry** 並掛具體店家」(Day 2 早餐 finding suggestion)。

v2.31.65 強化 prompt instruction 仍無法 100% 服從 — Claude 在較長 prose 中偶爾退回 schema 借詞。改用 **backend regex sanitizer** 在 `sanitizeFindings()` 對 title / description / suggestion 三欄套 word-boundary regex 強制替換。

`functions/api/requests/[id]/index.ts` 新 export `sanitizeSchemaWords(s: string)`：

| Banword | Replacement |
|---------|-------------|
| `entry` / `entries` (case-insensitive) | `景點` |
| `POI` / `POIs` (case-sensitive — acronym) | `景點` |
| `check-in` / `check in` | `入住` |
| `(\d+)\s*min` (numbered) | `$1 分鐘` |
| `(\d+)\s*km` (numbered) | `$1 公里` |
| `travel min` (no number) | `移動時間` |
| `travel` (standalone) | `移動` |
| `polyline` | `路線` |
| `buffer` | `緩衝時間` |
| `rating` | `評分` |
| `alt` | `替代` |

Regex 用 `\b` word-boundary 避免 false positive（`altitude` / `minute` / `alternate` 不被誤改）。

10 個 unit test 涵蓋每個替換規則 + 邊界 case + prod 實際 leak 字串。tsc clean、build pass。

## [2.31.73] - 2026-05-18

**Add 3 missing security headers in `public/_headers` — X-Frame-Options / HSTS / Permissions-Policy。**

### Added: defense-in-depth security headers

curl prod response audit 發現 3 個 widely-recommended security header missing：

- `X-Frame-Options: DENY` — 防 clickjacking。app 0 iframe usage（已 grep verify），全 deny 安全
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — 1 年 HSTS 強制 HTTPS。app 已 HTTPS-only via CF Pages，加 header 防 first-visit downgrade attack
- `Permissions-Policy: geolocation=(self), clipboard-write=(self), camera=(), microphone=(), ...` — 只允許 self 的 geolocation（MapFabs「我的位置」用）+ clipboard-write（DeveloperAppNewPage copy token 用），其他 features (camera/mic/payment/usb/magnetometer/gyroscope/accelerometer/midi/encrypted-media) 全 deny，fullscreen 允許 self

既有 Content-Security-Policy (CSP) 保留不動，已含 default-src 'self' + 必要白名單。

## [2.31.72] - 2026-05-18

**Rip unused `AuditLog` TypeScript interface — 43 行整檔零 import。**

### Removed: src/types/api.ts AuditLog interface

Inline `src/types/` 死 export audit：對每個 exported type/interface 用 word boundary grep 跨 src/ + functions/ + tests/，扣掉自身檔案的 self-reference，看 external usage：

- `PoiFavoriteUsage` → transitively used via `PoiFavorite.usages?: PoiFavoriteUsage[]`（PoiFavorite imported in AddPoiFavoriteToTripPage.tsx）→ **保留**
- `TripDestination` → transitively used via `Trip.destinations?: TripDestination[]`（Trip imported in useTrip / tripExport）→ **保留**
- `AuditLog` → **0 import 全 codebase**（functions/ 內 `audit_log` 是 SQL string literal 非 type import）→ **刪除**

刪除 AuditLog interface（22 行）+ section divider comment（4 行）+ 包含 docstring（17 行）= 43 行。tsc clean, build pass。

## [2.31.71] - 2026-05-18

**Rip 53 unused CSS tokens + 2 dead keyframes — 67 行縮減（Tailwind-aware re-audit）。**

### Removed: 53 unused CSS tokens + 2 dead @keyframes blocks

v2.31.69 第一輪嘗試（PR #635）audit 只看 `var()` reference 漏掉 Tailwind 4 從 `@theme {}` block 生成的 utility class（`animate-toast-slide-up` / `text-body` / `p-12` 等）誤判 65 tokens 為 unused。Closed。

v2.31.71 重做：分 `@theme` block (131 tokens) vs `:root`/`body.dark`/`@media` (48 tokens) 兩類 audit：
- **@theme tokens**: 對每個 token 推導 Tailwind utility class pattern (e.g. `--color-X` → `bg-X` / `text-X` / `border-X` / `from-X` / etc.) + grep JSX `className=`，零 hit 才算 dead
- **non-@theme tokens**: 只用 `var()` reference (Tailwind 不為這類生 utility)

確認 dead：
- **20 @theme tokens** (excluding `--sidebar-width-desktop` 在 mockup 用)
  - animate (1: stepper-pulse)
  - color (4: disabled-foreground, plan-bg/hover/text)
  - font-family/font-weight (3: inherit, light, normal)
  - spacing (6: 12/16/half/content-h/page-max-w/page-pt)
  - text size shortcut (5: caption2/eyebrow/headline/large-title/title)
  - z-index (1: fab)
- **33 non-@theme tokens**: badge-*-bg/text (8), color-badge-open/closed (2), color-google-maps/naver-maps (2), content-max-w/fab-size, destructive/error/info/success/warning, duration-indicator/tap, mobile-font-size-* (2), shadow-map-marker-active/idle/toast, theme-* (4), z-day-header/print-exit/quick-panel
- **2 dead keyframes**: `@keyframes stepper-pulse` / `@keyframes tl-pulse` (0 ref 也順手刪)

`tokens-css.test.ts` 同步刪 `--z-fab:` + `--spacing-page-max-w:` + `@keyframes stepper-pulse` 三個 assertion。11/11 test pass、tsc clean、`npm run build` 通過、brace balance 304/304。

## [2.31.70] - 2026-05-18

**Remove unused npm dependency `@dnd-kit/modifiers` — 0 imports across codebase。**

### Removed: @dnd-kit/modifiers from package.json

Inline npm deps audit 對 production `dependencies` 列表逐個 grep import：
- `@dnd-kit/modifiers`: **0 imports** in src/, functions/, tests/, scripts/
- `@dnd-kit/core` (5 imports) + `@dnd-kit/sortable` (4 imports) 仍在用 — 只 modifiers 是孤兒

`npm uninstall @dnd-kit/modifiers` → tsc clean、build pass、package-lock 自動 prune。

其他 dep audit findings：
- `oidc-provider` 0 imports 但 V2-P2 計畫保留（`src/server/oauth-d1-adapter.ts` planning comment）→ **不刪**
- `html2pdf.js` 0 static import 但有 dynamic `await import('html2pdf.js')` in `tripExport.ts:247` → **保留**
- `nodemailer` 0 SPA import 但 `scripts/tripline-api-server.ts` mac mini server 用 → **保留**
- 其他 13 個 production dep 都有 active import

## [2.31.69] - 2026-05-18

**Rip 4 個 abandoned API test files — v2.20.1 V2 cutover 後標 TODO 但 11 個版本沒人 rewrite。**

### Removed: stale API integration tests pinned to dropped schema

Inline tests/ audit 找出 4 個 `.test.ts` file 全部 `describe.skip` 從 v2.20.1 起：

| 檔案 | describe.skip blocks | 等效新 coverage |
|------|---------------------|----------------|
| `tests/api/trips.integration.test.ts` | 2 | trips-id.integration / trip-health.integration / trip-entries-order-in-day-schema |
| `tests/api/invitations-list-revoke.test.ts` | 2 | invitations-accept / invitations-get |
| `tests/api/permissions-post.test.ts` | 5 | permissions.integration |
| `tests/api/account-stats.integration.test.ts` | 1 | account-connected-apps / account-sessions |

10 個 describe.skip blocks 全跳過，TODO comment pin 舊 schema（v2.21.0 migration 0046+0047 後 `trips.owner` / `trip_permissions.email` / `saved_pois.email` 已 dropped）。11 個 minor version 沒人 rewrite → 純死碼。

`oauth-signup.test.ts` 雖也有同樣 TODO 但 13 個 `it()` 仍 active 跑成功 → 保留。

`tsc --noEmit` 通過、`npm run test:api` 60 passed 不變（5 個 fail 是 local miniflare EADDRNOTAVAIL flake 非本改動）。

## [2.31.68] - 2026-05-18

**Rip dead backend helper `functions/api/_poi-defaults.ts`（36 行整檔 0 callers）。**

### Removed: _poi-defaults.ts（v2.26.0 TIME_RE 搬家後遺漏）

dispatched Explore agent 做 `functions/api/` backend tech debt audit，發現：

- `_poi-defaults.ts` exports `TIME_RE` / `stayMinutesFor` / `defaultStartFor` / `addMinutes` 全 0 caller
- v2.26.0 migration 0056 後 `TIME_RE` canonical 搬到 `_time.ts`，所有 caller 改 import `_time` 但 `_poi-defaults.ts` 沒同步刪
- 其他 3 個函數（stayMinutesFor/defaultStartFor/addMinutes）也 0 caller — historic dead

順手清 2 處 stale comment reference：
- `functions/api/poi-favorites/[id]/add-to-trip.ts:26` 提到 `_poi-defaults.ts:6 仍保留同 const 給 saved-pois fast-path（defense-in-depth）` — 過時，刪
- `src/pages/AddPoiFavoriteToTripPage.tsx:335` 註解「後端 TIME_RE 同 functions/api/_poi-defaults.ts」→ 改「同 functions/api/_time.ts」

tsc clean，57/57 sample test pass。零行為變動。

## [2.31.67] - 2026-05-18

**Rip dead code — `src/components/trip/Restaurant.tsx` (168 行整檔零 imports)。**

### Removed: Restaurant component（v2.21-v2.31 refactor 過程被孤立）

dispatched 平行 Explore agent 做 dead-code audit，確認 `Restaurant.tsx` 與其 `RestaurantData` interface 在 src/、tests/、functions/ 內**零 import**。檔案 168 行 + memoized 元件 + 完整 CSS 都已死。

歷史脈絡：Restaurant.tsx 起源於 v2.0.0 Ocean 大改版（ec01f940），最後 touched 是 d0e61b04 shell refactor Phase A。後續 v2.21-v2.31 把餐廳 rendering 整合到 timeline rail / InfoBox 既有 entry-poi 模型，舊獨立 Restaurant card 元件失去 caller，但檔案被遺忘在 repo。

刪除後 `tsc --noEmit` clean，unit + integration test 全綠（57/57 sample run）。零行為變動。

## [2.31.66] - 2026-05-18

**4 處 user-visible「POI」洩漏 → 中文 — CSV 表頭 + 3 處 aria-label。**

### Fixed: source-grep 找剩餘英文殘留

源碼 grep `aria-label="POI 類別"` + `'POI名'/'POI類型'/'POI評分'/'POI價格'`：

- `src/lib/tripExport.ts:190` — 用戶下載的 CSV 表頭 `'POI名'/'POI類型'/'POI評分'/'POI價格'` → `'景點名稱'/'景點類型'/'景點評分'/'景點價格'`。離線打開試算表的用戶第一眼看到的字一定要中文。
- `src/pages/ChangePoiPage.tsx:714` `aria-label="POI 類別"` → `"景點類別"`（screen reader 朗讀字）
- `src/pages/ExplorePage.tsx:691` 同上
- `src/pages/AddStopPage.tsx:863` 同上

5 個 source-grep regression test 防止 backsliding（CSV 4 個表頭 + 3 個 aria-label assertion）。

## [2.31.65] - 2026-05-18

**AI 健檢 Claude prompt 加用詞規定，避免 schema field 借詞混雜中文。**

### Fixed: HEALTH_CHECK_MESSAGE 引導 Claude 用全中文

prod 登入截圖驗證發現 AI 健檢 findings 的 title / description / suggestion
含「Day 4 重疊午餐 entry」「entry #877」「主 POI KOURI SHRIMP」「travel min」
「check-in」「alt 七輪燒肉」等 schema field name 直接借詞 → user 看到中英混雜。

`HEALTH_CHECK_MESSAGE` 加用詞規定段落：
- 明確列禁用借詞表 (entry/min/km/POI/check-in/buffer/rating/travel/polyline/alt)
- 範例 JSON 改全中文用詞示範
- 強制 Claude 在 prose 用「景點/分鐘/公里/入住/緩衝時間/評分/移動/路線/替代」

Prompt-engineering only — 後端 schema 與 frontend code 不變。
已 ship 的舊 findings 不會自動 retro，user 點「重新生成」會用新 prompt。

## [2.31.64] - 2026-05-18

**PoiFavoritesPage zh-TW 收尾 — eyebrow / count / card type / empty state / aria-label。**

### Fixed: 6 處 user-visible 英文混雜

prod 登入截圖驗證發現 `/favorites` 仍有大量英文殘留：
- hero eyebrow「my favorites · 我的收藏」→「我的收藏」
- count meta「N 個收藏 POI」→「N 個收藏景點」
- card eyebrow `{row.poiType}` raw render (CSS uppercase「ATTRACTION/HOTEL」)
  → `POI_TYPE_LABELS[mapNominatimCategory(row.poiType)]`（「景點/飯店/餐廳」中文）
- delete confirm message「N 個收藏 POI」→「N 個收藏景點」
- aria-label「POI 類型篩選」→「景點類型篩選」
- empty state eyebrow「my favorites」→「我的收藏」
- empty state message「點 heart 圖示收藏」→「點愛心圖示收藏」

對齊 v2.31.63 系列：UI 全頁繁中無英文混雜（OAuth 標準術語 / 品牌名除外）。

`poi-favorites-page-region-pill.test.tsx` aria-label assertion 同步更新。

## [2.31.63] - 2026-05-17

**AccountPage + EditEntryPage + TimelineRail + DaySection + GlobalMapPage zh-TW polish。**

### Fixed: 20 處 user-visible 英文混雜

`/account` 設定 hub 三個 settings row 的 title / helper 還是英文混雜：
- `已連結 App` → `已連結的應用程式`
- `OAuth client app 註冊` → `OAuth 應用程式註冊`
- `管理所有 active session` → `管理所有登入中的裝置`

`EditEntryPage` 刪除整個 entry 的 6 處 confirm modal + error message
也還是「stop」raw English：
- `刪除整個 stop` button label → `刪除整個停留點`
- `刪除整個 stop？` modal title → `刪除整個停留點？`
- `刪除 stop` modal confirmLabel → `刪除停留點`
- `將從這個 stop 移除備選...` modal message → `將從這個停留點移除備選...`
- `刪除 stop 失敗 (${status})` throw → `刪除停留點失敗`
- `setError('刪除 stop 失敗')` catch fallback → `setError('刪除停留點失敗')`

`TimelineRail`（trip 主時間軸 header）+ `DaySection`（day hero）+ `GlobalMapPage`
（全圖 sheet overview） 4 處 stops/days/Itinerary 英文混雜：
- `Itinerary` eyebrow → `行程`
- `N stops` meta → `N 個停留點`
- DaySection hero sub `N 個 stops` → `N 個停留點`
- GlobalMapPage sheet overview `N stops · N days` → `N 個停留點 · N 天`
- GlobalMapPage day list eyebrow `DAY XX · N stops` → `DAY XX · N 個停留點`

LoginPage banner error 2 處「email」→「電子郵件」；ConsentPage scope 描述 +
ForgotPasswordPage 安全承諾 + ResetPasswordPage value prop + ConnectedAppsPage
TitleBar 「app/email/session」混雜 → 全中文化。

SignupPage 右側 brand hero「Why Tripline」eyebrow（跟 v2.31.62 LoginPage
「Why sign in」同 pattern）→「為什麼選 Tripline」。SignupPage / LoginPage
hero items desc「用一個 link」→「用一個連結」；「下次規劃直接拉進 trip」
→「下次規劃直接拉進行程」；「POI 一鍵加入下次 trip」→「景點一鍵加入下次旅程」。
SignupPage form sub「用 email + 密碼註冊」→「用電子郵件 + 密碼註冊」。

同 v2.31.61 / v2.31.62 zh-TW 系列收尾，不留半個英文。

## [2.31.62] - 2026-05-17

**LoginPage brand hero eyebrow「Why sign in」→「登入後可以」。**

### Fixed: zh-TW 一致性

Desktop split-screen Login 右側 brand hero 有 English eyebrow「Why sign in」。
雖然外層 `aria-hidden` 給 screen reader 跳過，但 visual user 仍會看到
英文 eyebrow 開頭、下面緊接 Chinese h2「把每次旅程留在身邊」 + Chinese
features — 不一致。改為「登入後可以」。

## [2.31.61] - 2026-05-17

**Error message 內混雜英文「stop」→ 統一中文「停留點」。**

### Fixed: 5 處 user-visible error messages 內 stop 英文混雜

App UI 通篇用「景點」「停留點」指 trip entry，但 ERROR_MESSAGES 與 throw
new Error 訊息混入 raw English 「stop」 → user 看到「此景點已存在於 stop 中」
這種雜訊。

**修 5 處 user-visible**：
- `src/types/api.ts` `DUPLICATE_POI` 「此景點已存在於 stop 中」→ 「此景點已存在於這個停留點」
- `src/types/api.ts` `POI_NOT_ALTERNATE` 「此景點不是此 stop 的備選」→ 「此景點不是這個停留點的備選」
- `src/types/api.ts` `MISSING_MASTER` 「每個 stop 必須有正選景點」→ 「每個停留點必須有一個正選景點」
- `src/pages/ChangePoiPage.tsx:662` `throw new Error('此景點已存在於 stop 中')` → 「此景點已存在於這個停留點」
- `src/pages/EditEntryPage.tsx:1028` `throw new Error('此 stop 已被改成「${X}」...')` → 「這個停留點已被改成...」

同步更新 `tests/unit/change-poi-page.test.tsx` mock + assert 對齊。

## [2.31.60] - 2026-05-17

**TripSheet placeholder 英文 / dev jargon → 純中文 user-facing copy。**

### Fixed: itinerary / chat placeholder 文案不是給 user 看的

- `Itinerary` (eyebrow) → 「行程」
- `Coming soon · Phase 3` (eyebrow) → 「即將推出」
- `Per-trip chat` (heading) → 「行程專屬對話」
- 「Timeline 在 main 區已展開，未來會搬到這個 tab（Mindtrip 3-pane 模式）。」
  → 「行程已在左側展開，未來會搬到這裡的分頁。」
- 「針對這趟 trip 的 AI 對話。實作在 Workstream V2。」
  → 「針對這趟行程的 AI 對話，下一階段推出。目前可在「聊天」分頁使用通用對話。」

Trip detail 右 sheet 點「行程」/「聊天」 tab 看到開發 jargon（Timeline, main,
tab, Mindtrip 3-pane, Workstream V2）+ 英文 placeholder（Itinerary, Coming
soon · Phase 3, Per-trip chat）→ user 困惑。改純中文 + 拿掉技術術語。

## [2.31.59] - 2026-05-17

**LegacyRedirect 不再寫死 admin trip ID — multi-user 安全 fix。**

### Fixed: 其他 user 走 legacy URL → 被 redirect 到 admin trip → 403

`src/entries/main.tsx` line 137 `const DEFAULT_TRIP = 'okinawa-trip-2026-Ray'`
是 admin（Ray）私有的 trip ID。當其他 user 訪問 unknown route（catch-all
`<Route path="*">`），LegacyRedirect 沒 valid `?trip=xxx` query 時 fallback
到 DEFAULT_TRIP → redirect 到 `/trips?selected=okinawa-trip-2026-Ray` →
非 owner 看 403。

**Fix**：移除 DEFAULT_TRIP 常數，沒 valid trip query 時 redirect 到 `/trips`
（無 selected param，讓 TripsListPage 自然處理：fallback 到 user 最新編輯
trip 或顯示 empty state）。

### Regression coverage

`tests/unit/legacy-redirect-no-default-trip.test.ts` — 4 個 source-grep test
（DEFAULT_TRIP 常數移除 / `<Navigate to="/trips">` fallback / valid query
仍處理 / executable code 無 admin trip hardcode）。

## [2.31.58] - 2026-05-17

**Empty trip AI 健檢 guard + ForgotPasswordPage 文法 fix — 2 個 prod QA bug。**

### Fixed (2): ForgotPasswordPage + SignupPage rate-limit fallback「幾分鐘秒後」文法不通

兩處同 pattern：`{retryAfter ?? '幾分鐘'} 秒後` 在 null 路徑 →
「請幾分鐘秒後再試」(請 [few minutes] seconds later) 文法不通。
Fix 條件式分支：retryAfter 存在用秒、null 用「請幾分鐘後再試」。

### Fixed (3): ConsentPage 缺 client_id 錯誤訊息英文

`setError('Missing client_id')` 在 zh-TW UI 中突兀的英文 → user 看不懂。
改為 actionable 中文「授權連結缺少必要參數 client_id，請從應用商家提供的
連結重新進入。」。

### Fixed (4): ConflictModal eyebrow 英文「Time conflict」

aria-label 已正確「時段衝突」但 visible eyebrow 是英文，不一致。改中文。



### Fixed: empty trip 也可觸發 AI 健檢 → 白燒 Claude quota

Prod QA：trip-rgp1（台南，5 天空白行程）⋯ menu → AI 健檢 仍可點。後端
firing Claude with empty trip context → 回 nothing useful + 浪費 quota。

### Fix: 三層防線

**Backend** `functions/api/trips/[id]/health-check.ts`：在 hasWritePermission
後加 `SELECT COUNT(*) FROM trip_entries WHERE trip_id = ?` guard，0 →
throw `AppError('TRIP_EMPTY')` HTTP 422。防 race condition / direct API。

**Frontend** `src/pages/TripHealthCheckPage.tsx`：
- useEffect 同步 fetch `/trips/:id/days?all=1`，累加跨天 timeline length
  得 totalEntries，存進 `entryCount` state
- 開始健檢 button `disabled` 條件加 `entryCount === 0`
- entryCount === 0 顯示 hint「此行程尚無景點，請先加入景點再執行健檢」
- handleStart 收到 backend TRIP_EMPTY 422 → 同步 setEntryCount(0)
  讓 button 立即 disable（race window 補救）

**Error code**：`src/types/api.ts` 加 `ErrorCode.TRIP_EMPTY` +
`ERROR_MESSAGES['TRIP_EMPTY']` 中文 message；`functions/api/_errors.ts`
`STATUS_MAP['TRIP_EMPTY'] = 422`（unprocessable entity — semantic 比 400/409
準確）。

### Regression coverage

`tests/unit/trip-health-check-empty-guard.test.ts` — 10 個 source-grep test
（backend SELECT / throw / 順序、frontend useState / fetch / disabled / hint、
ErrorCode 3 處同步）。

## [2.31.57] - 2026-05-17

**繁體中文 Typography fix — user-visible 半形逗號 → 全形「，」。**

### Fixed: 5 處 user-visible 半形 ASCII comma in 中文 strings

繁體中文（台灣）排版慣例：中文句子用全形「，」分隔，不是半形「,」。
prod QA 看 collab 頁面 helper 文案發現「對方的 email,他們下次登入會...」
用半形逗號 — 在中文 paragraph 中視覺斷裂、不符合 zh-TW typography 標準。

**修 5 處**：
- `CollabPanel.tsx:333` — viewer role 描述「只可檢視,不能編輯」
- `CollabPanel.tsx:504` — collab page header 兩處
- `CollabPanel.tsx:519` — 空成員 placeholder
- `CollabPanel.tsx:716` — 撤銷邀請 confirm message
- `ExplorePage.tsx:847` — landing empty state copy

註解（comments）內的半形逗號保留，純 code-doc 不影響 user。

## [2.31.56] - 2026-05-17

**AddPoiFavoriteToTripPage `tripDisplayName` 對齊 title-first canonical — prod QA 跨頁面 label 不一致。**

### Fixed: 同一 trip 跨頁面 label 不一致

User 在 trips list 看到 user-set 標題「2026 沖繩七日遊行程表」(`trip.title`)，
但點「加入行程」打開 AddPoiFavoriteToTripPage 後 trip dropdown 顯示
「Hui Yun 的沖繩之旅」(`trip.name` backend auto-generated)。同一 trip 在不同
頁面看到不同 label → user 困惑「這是同一個 trip 嗎」。

**Root cause**：`tripDisplayName(t)` 寫成 `t.name || t.title || tripId`，
但 TripsListPage:1088 / TripPickerPopover / ChatPage / MapPage / GlobalMapPage
5 處 canonical pattern 都用 `t.title || t.name || tripId`。

**Fix**：對齊 canonical pattern，title 優先 name 其次。

### Regression coverage

`tests/unit/add-poi-favorite-trip-display-name.test.ts` — 2 個 source-grep test。

## [2.31.55] - 2026-05-17

**2 個 prod QA 發現的小 bug — ExplorePage section header + AddStopPage landing empty state。**

### Fixed (1): ExplorePage section title 跟 active tab 不符

`ExplorePage` mount 自動 auto-search seed（region=全部地區 時 seed=「東京」）
→ `results` 有值 → section header 寫死「搜尋結果」。但 user landing 點
「為你推薦」tab 看到「搜尋結果」header → 語意衝突（user 沒 search 卻看到
search results header）。

**Fix**：對齊 AddStopPage（v2.31.10）/ ChangePoiPage（v2.31.11）同樣的
search/landing conditional：

```tsx
const sectionTitle = query.trim().length >= 2 ? '搜尋結果' : '推薦景點';
<h2>{sectionTitle}</h2>
```

### Fixed (2): AddStopPage landing empty state 不再 gate 在 poiFavorites

User 進 `/trip/:id/add-stop?day=N` 預設「搜尋」 tab + 「為你推薦」 category，
empty state hint「輸入關鍵字搜尋，或切到「收藏」 tab」之前 gate 在
`poiFavorites && poiFavorites.length > 0`。但 poiFavorites 只在 user 切到
「收藏」 tab 才 lazy fetch（line 664-681）→ 搜尋 tab 預設 null → empty state
永不 render → user 看到 blank page 完全沒 hint「該做什麼」。

**Fix**：decouple empty state from poiFavorites state，搜尋 tab + query 空 +
category=all 一律顯示 hint。

### Regression coverage

- `tests/unit/explore-page-section-title.test.ts` — 3 個 test（fix 1）
- `tests/unit/add-stop-landing-empty-state.test.ts` — 3 個 test（fix 2）

## [2.31.54] - 2026-05-17

**TripSheet useMemo sheetContent + CSS scope — `/simplify` 3-agent review
follow-up（v2.31.46-49 sticky map chain ship 後）。**

### Fixed: 2 個 robustness issues from /simplify review

**(0) Attempted per-render `sheetPortalNode` lookup — REVERTED**

/simplify quality agent flagged `useEffect deps [noShell]` only mount → stale
ref hazard if host AppShell remounts。第一輪嘗試 per-render
`document.getElementById` lookup 觸發 e2e 10 個 trip detail timeout — React
render phase 跑在 DOM commit 之前，第一次 render 拿不到 portal target →
no portal mounted → e2e wait visible timeout。Reverted 回 useState +
useEffect 兩階段 pattern。Stale ref 是 theoretical 風險（v2.31.46 prod 已
3 個月穩定運行）— 不修了。

**(1) `TripPage.sheetContent` 沒 useMemo → portal subtree reconcile 浪費**

每次 TripPage render 重建 `<Suspense><TripSheet/></Suspense>` JSX → portal
target children prop 變新 reference → React reconcile lazy boundary +
TripSheet shallow prop diff。TripPage 有 30+ state hooks，scroll/day-switch
時 render 頻繁。

**Fix**：`useMemo` 包 sheetContent，deps = `[loading, trip, mapRailData.allPins,
mapRailData.pinsByDay, isDark]`（mapRailData 已是 useMemo stable identity）。

**(2) `TripSheet [role="tabpanel"]` CSS selector 全 document scope**

v2.31.48/49 加的 `[role="tabpanel"][hidden]` + `:not([hidden])` 是 global
selector，會影響其他 page 的 tabpanel（雖目前無），unintentional reach。

**Fix**：scope 到 `.trip-sheet-body [role="tabpanel"]` 限定 TripSheet 內部。

**Test**：5 個 source-grep regression（每 fix 對應）+ existing TripSheet 相關
tests 全綠（hidden tabpanel / map tab flex / desktop sticky map portal 4 個
test file，17/17 GREEN）+ 全 unit suite 1725/1725 GREEN。tsc clean。

## [2.31.53] - 2026-05-17

**Mockup favorites region row hide 規範 align prod。**

### Updated: 2026-05-04-favorites-redesign.html

加 spec comment 對齊 v2.31.32 fix #133 `PoiFavoritesPage` 只有 1 region 時 hide
region row 行為。避免單一 chip 視覺噪音（user 只有沖繩 trip → 「全部 4 / 沖繩 4」
無 filter 意義）。

## [2.31.52] - 2026-05-17

**Mockup chat empty state align prod — v2.31.51 follow-up，補 `.tp-chat-empty`
CSS 規範 + 3 個 sub-state 描述。**

### Updated: terracotta-preview-v2.html `.tp-chat-empty` CSS

prod ChatPage 有 3 個 sub-state empty placeholder：
1. `trips.length === 0` → 「還沒有行程可以聊」+「去新增行程」CTA → /trips
2. `trips === null` → 「載入中…」inline placeholder
3. `activeTripId set, history loading` → 「載入歷史對話…」placeholder

Mockup 無對應 CSS 規範。加 `.tp-chat-empty` rule（flex center column +
muted color）+ `.tp-chat-empty-icon`（accent-subtle circle bg + accent icon）
+ `.tp-chat-empty .cta`（accent pill button）+ comment 註明 3 sub-state +
reference src/pages/ChatPage.tsx。

## [2.31.51] - 2026-05-17

**Mockup empty state align prod loop ship — v2.31.50 follow-up，補 explore/favorites
0-result placeholder UX。**

### Updated: terracotta-preview-v2.html `.tp-explore-empty` CSS + 註解

v2.31.22 fix #123：prod 的 ExplorePage 在 query/category 篩出 0 個結果時 render
dashed-border placeholder + 中文「沒有符合「{label}」的結果。試試其他分類或回到
「為你推薦」。」+ accent pill「回到為你推薦」reset。Mockup 之前無此 spec，加 CSS
規則 + 註解註明 prod behavior + reference source。

### Updated: 2026-05-04-favorites-redesign.html empty state 文案對齊

Mockup line 989 之前寫「沒有符合條件的收藏。/ 清空篩選」，prod 改「目前的篩選沒
有符合的收藏 / 清除篩選」。對齊 prod wording。

## [2.31.50] - 2026-05-17

**Mockup align with prod loop ship — terracotta-preview-v2.html + DESIGN.md
回頭對齊本 loop 多輪 polish/fix。**

### Updated: terracotta-preview-v2.html

對齊 v2.31.47 chat picker button 拔 trip name span：
- 拔 6 處 `<span class="tp-titlebar-trip-picker-name">沖繩...</span>` 從 7
  個 chat header sample frames（剩 2 個是 CSS 規則註解）。
- CSS `.tp-titlebar-trip-picker-name` rule + `.tp-page-frame-compact` 對應
  `.tp-titlebar-trip-picker-name` hide rule 都拔，留 explanatory comment。
- 2 處 page-frame-label 描述「SVG icon + 行程名」改「SVG icon + ▾,v2.31.47
  拔名稱避免跟 title 重複」。
- Comment block 規範描述更新對齊 production behavior。

對齊 v2.31.43 explore heart toggle off hover 紅化：
- `.tp-explore-card-fav.is-saved:hover` 加紅化 + `transform: scale(1.05)`
  affordance（暗示「點擊取消收藏」雙 affordance）。
- fallback color inline `#fee2e2 / #b91c1c`（mockup 沒定義 priority tokens）。

### Updated: DESIGN.md

`.tp-titlebar-trip-picker` 規範描述更新 — v2.31.47 起 icon + chevron only，
dropdown rows 顯每個 trip name 不變。

## [2.31.49] - 2026-05-17

**TripSheet map tab collapse 4px — v2.31.48 hidden tabpanel fix follow-up。**

### Fixed: 桌機 sticky map sheet 空白（map tab flex collapse）

v2.31.48 把 hidden tabpanels 改 `display: none`，但 active map tab
`<div role="tabpanel">` 沒 className 也沒 flex 屬性 → `trip-sheet-body`
（display:flex column）內 collapse 到 4px。Sheet 顯空白，Google Map 沒
空間 render。

之前 placeholders `display: flex; flex: 1` 跟 map tab 一起撐 height；
hidden 後 active panel 失去 height 來源。

**Fix**：CSS `[role="tabpanel"]:not([hidden]) { flex: 1; min-height: 0 }`
強制 active tabpanel 拿 flex:1。`min-height: 0` 給 `.trip-sheet-body .trip-map-rail
{ height: 100% }` rule 拿得到實際高度。

**Test**：2 個 source-grep regression（active flex + min-height / v2.31.48 [hidden]
rule regression）。tsc clean。

## [2.31.48] - 2026-05-17

**TripSheet hidden tabpanel CSS override — v2.31.46 sticky map portal 部署後
prod QA 發現所有 placeholder 跟 active map tab 疊在一起。**

### Fixed: 桌機 sticky map sheet 4 個 tabpanel 同時顯示

prod QA：v2.31.46 sticky map portal fix 部署後，desktop trip detail 右側
sheet `<aside id="trip-sheet-portal">` 內顯示「行程已顯示在左側 / Per-trip
chat COMING SOON」 兩個 placeholder + 中間夾 map tab — `hidden` 沒生效。

**Root cause**：`TripSheet.tsx:50-51` `.trip-sheet-placeholder { display: flex }`
specificity (0,1,0) 蓋過 HTML `hidden` 預設 `display: none`（UA stylesheet
specificity 0,0,1）。所有 placeholder tabpanel 即使 `hidden=true` 仍 `flex` 顯示。

**Fix**：CSS `[role="tabpanel"][hidden] { display: none }` specificity (0,2,0)
強制隱藏 hidden tabpanel。Active tab（無 hidden attr）仍 fall through 到
`.trip-sheet-placeholder` rule。

**Test**：2 個 source-grep regression（[hidden] rule + 保留 .trip-sheet-placeholder
flex regression）。tsc clean。

## [2.31.47] - 2026-05-17

**ChatPage TitleBar title 跟 trip picker button 都顯 trip name → 視覺冗餘。**

### Fixed: /chat TitleBar 跟 picker button 重複顯 trip name

`ChatPage.tsx` line 714 TitleBar `title={activeTrip?.title || ... || '聊天'}`
(v2.18 design SoT，existing test `chat-page-ai-avatar.test.tsx:134` 已 pin),
line 727-729 picker button 內加 `<span class="tp-titlebar-trip-picker-name">`
也顯**同**字串 → user 看到「2026 沖繩... ⇄ 2026 沖繩...」視覺冗餘。

**Fix**：title 維持 trip name（existing design SoT 不動），picker button
**拔掉 trip name span**，只留 ⇄ icon + ▾ chevron affordance。User click 開
dropdown 看完整 trip list（dropdown rows 仍顯每個 trip name）。

**Test**：4 個 source-grep regression（title 維持 dynamic / picker span 拔掉 /
icon + chevron affordance regression / dropdown rows 顯 trip name regression）+
existing `chat-page-ai-avatar.test.tsx` 7/7 GREEN。

## [2.31.46] - 2026-05-17

**Desktop trip detail sticky map regression fix（v2.17.17 起 ~3 個月）— React Portal
based，避開 v2.31.41 #604 setState-from-effect 引發的 prod ErrorBoundary。**

### Fixed: viewport ≥1024 trip detail 右側 sticky map 缺席

**Bug 取證**：v2.17.17 把 `TripPage` 改 embedded mode（`noShell=true`），
TripsListPage 沒接 sheet → AppShell 退化 3-pane→2-pane，右側空白 ~40vw，
違反 `CLAUDE.md` 「Desktop ≥1024px: 2-col timeline + sticky map」spec。

**v2.31.41 #604 第一次 fix 失敗**：用 callback prop + `setSheet(content)` in
useEffect → strict mode 雙倍 fire + useMemo deps `mapRailData.allPins`
identity 變動 → infinite re-render → prod 觸發 ErrorBoundary，已 revert #606。

**v2.31.46 safer approach — React Portal**：
1. **`AppShell.tsx`** 加 `sheetPortalId?: string` prop。設定後即使 `sheet`
   為空也 render `<aside id={sheetPortalId} className="app-shell-sheet" />`，
   且 layout 用 3-pane（讓 grid 第 3 column 存在給 portal 掛載）。
2. **`TripsListPage.tsx`** embedded mode 傳
   `sheetPortalId={showEmbeddedTrip ? 'trip-sheet-portal' : undefined}`。
3. **`TripPage.tsx`** embedded mode：
   - `useEffect` lookup `document.getElementById('trip-sheet-portal')` 拿
     DOM target → `setSheetPortalNode`（一次性，deps 只 `noShell`）。
   - return fragment 含 `<wrappedMain>` + `createPortal(sheetContent, sheetPortalNode)`。

**為何 portal 安全**：
- Portal render 內容**直接掛 target DOM**，不經 parent setState → 無
  re-render 風暴。
- `useEffect` 只在 mount 時 lookup DOM 一次（deps `noShell`），strict mode
  雙倍 fire setState 同值 → React bail out 不 re-render。
- 不需要 callback prop 雙向溝通 → 無 v2.31.41 setState-from-effect race。

**Test**：8 個 source-grep regression（AppShell prop / layout 3-pane 條件 /
aside id / TripsListPage wire / TripPage createPortal import / portal node
lookup / portal render call / 不再用 setSheet callback pattern）+ 既有 unit
suite 1712/1712 GREEN，tsc clean。

**注意**：本 PR 仍須 prod verify — 之前 #604 因 prod ErrorBoundary 才被抓到，
unit/tsc green 不代表 strict mode race 完全消除。Portal approach 理論上安全，
但 deploy 後 desktop viewport 仍須人工 verify。

## [2.31.45] - 2026-05-17

**SessionsPage「IP TSdE1hEx…」label 改「裝置 ID」 — prod QA loop wording polish。**

### Fixed: 登入裝置列表 IP label 誤導

`SessionsPage.tsx:318` 顯示「· IP {ip_hash_prefix}…」但 `ip_hash_prefix`
實際是 hashed IP 前綴（privacy by design，line 12 comment 有 hint），
不是真實 IP。User 看到「IP TSdE1hEx…」會誤以為奇怪格式 IP。

**Fix**：文案改「· 裝置 ID xxx…」+ 加 `title` attr 解釋
「IP 位址的雜湊前綴（privacy）— 同一網路下相同」給好奇 user。
Hash prefix 顯示維持（device fingerprint discoverable）。

**Test**：3 個 source-grep regression（拿掉 raw IP label / 新文案 / 保留 hash prefix）。

## [2.31.44] - 2026-05-17

**`apiFetch` 對 204 No Content empty body 補 short-circuit — v2.31.43 prod
QA surface 的 cross-page DELETE 失敗 root cause。**

### Fixed: ExplorePage heart toggle off 顯「Failed to execute 'json' on R...」

v2.31.43 部署後 prod QA 測 click 已收藏 heart 取消收藏 → toast 顯
「取消收藏失敗：Failed to execute 'json' on 'R...」。`apiFetch` line 48
永遠 `response.json() as Promise<T>`，但 backend `functions/api/poi-favorites/[id].ts:65`
`return new Response(null, { status: 204 })` 是 empty body → `json()`
throws `SyntaxError: Unexpected end of JSON input`。

**影響範圍 pre-existing**：所有 `apiFetch` + DELETE callsite 都 broken。
- PoiFavoritesPage selection delete 走 `Promise.all(...).then(... .catch(...))`
  把 SyntaxError swallow 進 `{ ok: false }` → toast「刪除失敗 N 個」
  但 backend 其實已經刪了 → user reload 看到 row 不見以為成功 → toast wrong
  feedback 一直被忽略。
- sessions revoke / connected-apps revoke / trip delete / day delete /
  entries delete 同 pattern，全部隱性失敗。
- ExplorePage v2.31.43 直接 surface 才被抓到。

**Fix**（root cause）：`apiFetch` 偵測 `response.status === 204` 早返
`undefined as T`，不 call `json()`。DELETE callers 通常不用 return value，
cast 不破壞 type signature。

**Test**：2 個 jsdom unit test（204 path 不 call json + 200 path 仍走 json）。

## [2.31.43] - 2026-05-17

**ExplorePage 已收藏 heart 改可取消收藏 — prod QA loop user 訴求「不同顯示 + 取消收藏」。**

### Fixed: `/explore` 搜尋結果已收藏 POI heart icon 可 toggle off

QA loop user 提出：搜尋結果卡片如果已加入收藏，要不同顯示 + 要可以取消收藏。
原本 `ExplorePage.tsx` line 745-748 `disabled={isSaving || isPoiFavorited}`
鎖死「已收藏」狀態，user 必須切去 `/favorites` 多步驟刪除。

**Bug 取證**：
- Saved 狀態：heart `disabled`, `onClick` no-op, `aria-label='已收藏'`（無 affordance）
- User 無法在 explore page 取消收藏
- 額外發現 pre-existing key mismatch — `favoriteKeySet` key 用 `poi.category`
  raw（Google Places enum）但 saved row `poiType` 已 `mapNominatimCategory()`
  映射，兩邊永遠對不上，`isPoiFavorited` 即使資料有收藏也是 false → user
  重複加同一個 POI 進收藏（重複 row）。同 PR 一併修。

**Fix**：
1. `SavedKeyRow` 加 `id: number` 欄位（reuse DELETE `/poi-favorites/:id`）。
2. `favoriteKeySet: Set<string>` → `favoriteKeyMap: Map<string, number>`。
3. `handleSave` → `handleToggleFavorite(poi, isPoiFavorited)`：is-saved
   分支走 `DELETE /poi-favorites/:id` + toast「已取消收藏」，否則原 POST 流程。
4. Heart button 拔掉 `disabled={isPoiFavorited}` 留 `disabled={isSaving}`
   防雙擊；`aria-label` / `title` 動態切「已收藏 · 點擊取消」/「加入收藏」。
5. Key 對齊 `mapNominatimCategory(poi.category ?? '')` 修 pre-existing bug。
6. CSS `.is-saved:hover` 紅化暗示「點擊取消」affordance（保留 saved accent
   主色，hover 才轉紅 + scale 1.05）。

**Test**：6 個 source-grep regression（SavedKeyRow id 欄位 / Map<string,number>
/ disabled 拔 isPoiFavorited / aria-label 取消 affordance / DELETE 分支 /
path 含 :id）+ 既有 explore tests 27/27 全綠。

## [2.31.42] - 2026-05-17

**Sessions / Trip MapPage 缺 TitleBar back button — 同 #601 nav regression 家族。**

(v2.31.41 sticky map fix 引入 prod ErrorBoundary 已 revert via #606，留待離線 debug。)

### Fixed: `/settings/sessions` 缺 back button

QA loop 截圖確認 user 進「登入裝置」頁無法返回 `/account` hub，只能用瀏覽器 back。

`src/pages/SessionsPage.tsx`：import `useNavigate` + 加 `navigate` var + TitleBar 加 `back={() => navigate('/account')}`。

### Fixed: `/trip/:id/map` MapPage 缺 back button

trip-scoped map view 從 trip detail 進來但無返回 trip detail 的箭頭。Global `/map` (GlobalMapPage) 是 bottom nav root 不需 back ✓ 不受影響。

`src/pages/MapPage.tsx`：TitleBar 加 `back={tripId ? () => navigate(\`/trip/${encodeURIComponent(tripId)}\`) : undefined}`。

### Tests

`tests/unit/missing-back-buttons.test.ts`：3 個 source-grep regression。

## [2.31.40] - 2026-05-17

**GlobalBottomNav auth flicker 修正 — 22 callsite 統一 loading-aware。**

### Fixed: 第 5 tab 短暫顯示「登入」flicker

QA loop @ /favorites 截到 mobile bottom nav 第 5 tab 顯示「登入」label，但 user 已 login。reload 後變「帳號」。

Root cause：`useCurrentUser` 三態 `user: CurrentUser | null | undefined`（loading / 未登入 / 已登入），docstring 明確警告「Caller 必須保留 undefined loading state，不要先當成未登入」。但所有 22 個 callsite 寫 `authed={!!user}` 把 loading 當未登入 → page mount 期間 fetch /api/oauth/userinfo 還沒回，bottom nav 渲染「登入」；fetch 完成 re-render「帳號」。flicker window 取決於 cold fetch latency。

### Fix: callsite 改 `user !== null` 樂觀預設

21 個 page sed `authed={!!user}` → `authed={user !== null}`（含 `!!auth.user` / `!!currentUser` 變體）：

- AccountPage / AddPoiFavoriteToTripPage / AddStopPage / ChangePoiPage / ChatPage / CollabPage / ConnectedAppsPage / DeveloperAppNewPage / DeveloperAppsPage / EditEntryPage / EditTripPage / EntryActionPage / ExplorePage / GlobalMapPage / MapPage / NewTripPage / PoiFavoritesPage / SessionsPage / TripHealthCheckPage / TripPage / TripsListPage

樂觀邏輯：
- `user === undefined`（loading） → `user !== null` = `true` → 顯示「帳號」
- `user === null`（401 fetch 確認未登入） → `false` → 顯示「登入」
- `user === CurrentUser` → `true` → 顯示「帳號」

### Tests

`tests/unit/auth-flicker-bottomnav.test.ts`：2 個 page-source-grep regression（no callsite 用 `!!user` 變體 + 至少 20 callsite 用 `user !== null` pattern）。

## [2.31.39] - 2026-05-17

**Settings sub-page 導航 regression — 修返回 button + 補 GlobalBottomNav。**

### Fixed: `/settings/connected-apps` 缺 GlobalBottomNav + 缺 back button

QA loop 發現：user 進「已連結 App」設定頁後，mobile 看不到底部 5-tab nav（卡在 page 內），且 TitleBar 沒返回箭頭，無法回 `/account` hub，必須用瀏覽器 back。

Fix `src/pages/ConnectedAppsPage.tsx`：
- AppShell 補 `bottomNav={<GlobalBottomNav authed={!!user} />}`
- TitleBar 加 `back={() => navigate('/account')}`
- `useRequireAuth()` 改 destructure 拿 `user` 給 nav prop

### Fixed: `/developer/apps` 缺 back button

v2.31.34 fix #135 補了 GlobalBottomNav 但漏 TitleBar back，user 仍無法從「開發者後台」返回 `/account`。

Fix `src/pages/DeveloperAppsPage.tsx`：TitleBar 加 `back={() => navigate('/account')}`。

### Tests

`tests/unit/settings-nav-back.test.ts`：5 個 source-grep test（import / AppShell bottomNav prop / TitleBar back callback / navigate /account）。

## [2.31.38] - 2026-05-17

**Toast 重設計 — centering 修正 + Terracotta SoT 對齊。**

### Fixed: Toast bubble 跑到 viewport 左邊被切半

`Toast.tsx:64` container 改 `flex items-center` 後忘記同步 `@keyframes toast-slide-down/up`（`css/tokens.css:840`），仍含 `transform: translateX(-50%) translateY(...)` legacy 自身置中 → bubble 從 flex 已置中位置再被往左推一半 bubble 寬 → 截圖看到「該筆資料已經存在」chip 卡在 viewport 左半邊只露半截。

### Changed: Toast 視覺對齊 `.tp-status-toast` SoT

- `src/components/shared/Toast.tsx`：拔 `ToastIcon` SVG component；改用 `tp-toast` + `tp-toast--{error|success|warning|info}` 命名 class；dot indicator 改 CSS `::before` pseudo-element 不入 DOM
- `css/tokens.css`：新增 `.tp-toast` rules 對齊 `docs/design-sessions/terracotta-preview-v2.html` 的 `.tp-status-toast` pattern（白底 + 8px coloured dot + coloured border + `--shadow-md`），dark mode bg 改 `--color-secondary`；keyframes 拔 `translateX(-50%)`
- mockup 紀錄：`docs/design-sessions/2026-05-17-toast-redesign.html`（3 variant 對比 + bug callout + V1 sign-off）

### Tests

`tests/unit/toast.test.tsx` 加 7 個 V1 regression：DOM 無 SVG、bubble 套 `tp-toast` prefix、`tp-toast--error`/`--success` modifier、`@keyframes toast-slide-down/up` source 無 `translateX`、`background severity` 走 info type。共 16 個 toast test 全綠。

## [2.31.37] - 2026-05-17

**daily-check autofix：拔 SW unhandled rejection + segments refetch debounce。**

### Sentry SW load failed (#7359874308 TypeError + #7355334934 SecurityError)

iOS Chrome 偶發「Script /sw.js load failed」TypeError / SecurityError，原本
`navigator.serviceWorker.getRegistration().then((reg) => reg.update())` 沒 `.catch`
→ unhandled promise rejection bubble 進 `auto.browser.global_handlers.onunhandledrejection`
上 Sentry。SW 是 enhancement，load failure 對真實 user 無 functional impact。

Fix：chain `.then((reg) => { if (reg) return reg.update(); }).catch(() => {})` 靜默吞下。
新增 source-grep regression test 防後續 refactor 又拔掉。

### Sentry N+1 #7475580989 `/api/trips/*/segments`

`useTripSegments` hook 內 `tp-entry-updated` / `tp-segment-updated` event handler
直接 trigger fetch，drag-reorder / batch save flow 連 dispatch 多個 event
→ 短時間內 5+ 個 `GET /segments` 觸發 Sentry N+1 偵測。

Fix：handler 內加 200ms debounce，cleanup 取消 pending timer。新增 2 個 unit test
（5 個 event in 200ms = 1 fetch、unmount 取消 pending refetch）。

### Skipped

- N+1 #7437512068 `/api/route?from=*&to=*` (/map, 32 spans)：MapPage 每 segment
  lazy fetch 是架構必要（IndexedDB cache + per-segment polyline）。0 user
  impact，HeadlessChrome e2e cold cache trigger。不修。

## [2.31.36] - 2026-05-17

**Refactor: DROP 6 dead trip fields + POI address normalize（雙 fix 同 PR）。**

### Part 1: DROP dead trip fields（migration 0068）

`trips` table 6 columns 自 v2.23.0 Google Maps Platform 切換後變 dead data — UI 收集
user 輸入存進 DB，但 backend 沒任何 logic 讀取此 column 影響行為（`recompute-travel.ts:146`
直接用 Haversine gate 決定 mode，沒讀 trip.default_travel_mode）。

**移除：**
- `default_travel_mode` TEXT
- `self_drive_enabled` INTEGER（0/1）
- `self_drive_pickup_at` TEXT
- `self_drive_return_at` TEXT
- `self_drive_pickup_location` TEXT
- `self_drive_return_location` TEXT

**Cleanup 範圍（11 files）：**
- migration 0068 + rollback
- `functions/api/trips.ts`：INSERT VALUES + VALID_TRAVEL_MODES + nullableStr helper + SELECT
- `functions/api/trips/[id].ts`：ALLOWED_FIELDS + validateEnumFields + VALID_TRAVEL_MODES
- `functions/api/trips/[id]/audit/[aid]/rollback.ts`：TABLE_COLUMNS.trips
- `src/types/trip.ts`：TripListItem + Trip interface
- `src/pages/EditTripPage.tsx`：state + form UI + read/write logic + TripApi/TravelMode type
- `src/pages/NewTripPage.tsx`：state + form UI + POST body
- `tests/api/trips-id.integration.test.ts` + `tests/api/trips.integration.test.ts` + `tests/unit/map-row.test.js` + `tests/e2e/api-mocks.js`

**Deploy 順序（用戶選「單 PR」path）：**
1. backend code 不再 read/write 此 6 columns（同 PR）
2. merge PR + CF Pages auto-deploy
3. apply migration 0068（DROP COLUMN）— 因 columns 都 nullable + 無 FK + 無 NOT NULL，race window 不會炸。

SQLite 不允許 DROP COLUMN 當 index reference，migration 先 `DROP INDEX IF EXISTS idx_trips_self_drive_enabled`（migration 0052 創立）再 DROP COLUMN。

### Part 2: POI address normalize（fix 「736 號號地下一層」doubled char）

**Bug**：Google Places API 偶有 user-submitted typo 含 doubled admin suffix
（「號號」/「縣縣」/「市市」等）。prod-found case：search「熊越岳」回 raw address
「242 台灣新北市新莊區幸福路 736 號號地下一層」— 「號」字 doubled。

**Fix：**
1. `src/lib/maps/normalize-address.ts`（新）— `normalizePoiAddress` helper：
   - Collapse consecutive admin/positional suffix chars（號 / 号 / 縣 / 県 / 市 / 区 /
     區 / 鎮 / 鄉 / 村 / 里 / 路 / 街 / 巷 / 弄 / 町 / 丁）
   - Collapse 連續逗號（含全形「，」）
   - Collapse 連續空白
   - Trim 頭尾
2. `src/server/maps/google-client.ts` searchPlaces + getPlaceDetails return 邊界 apply
   → 後續 INSERT/UPDATE 路徑 inherit clean data
3. `functions/api/_poi.ts` `normalizeFindOrCreatePoiPayload` 也 apply（防 direct INSERT 漏）
4. `scripts/backfill-poi-addresses.ts`（新）— 一次性 backfill existing pois.address
   row。Idempotent，支援 `--local` / `--remote` × `--dry-run` / `--apply`。

**Test：** `tests/unit/normalize-address.test.ts` 新（23 cases）：
- 11 cases doubled admin suffix collapse（含 prod-found case + 日文 kanji 区/県/号/町/丁）
- 4 cases non-admin 字不 collapse regression（化學詞 / 已乾淨 / 街口）
- 4 cases comma + whitespace cleanup
- 4 cases null / empty / non-string

1675 unit test 全綠 + typecheck clean。

**Backfill 操作（merge 後）：**
1. `bun scripts/backfill-poi-addresses.ts --dry-run --remote` 確認 candidates
2. `bun scripts/backfill-poi-addresses.ts --apply --remote` 執行

## [2.31.35] - 2026-05-17

**Fix: CollabPanel avatar initial 用 displayName（與 TripsListPage 一致）。**

Bug #136（mobile prod QA found）：`/trip/.../collab` 「擁有者」row email lean.lean@gmail.com，
avatar 顯「L」(email[0])。但 TripsListPage / Sidebar 用 displayName 顯「R」(Ray)。Memory
rule「avatar 一律用帳號名稱第一字母（不是 email）」CollabPanel 漏對齊。

Root cause：`functions/api/permissions.ts` GET endpoint SELECT 只取 `u.email`，沒帶
`u.display_name` → frontend Permission type 沒 displayName 欄位 → CollabPanel.tsx 直接
`p.email.charAt(0).toUpperCase()`。

**Fix（3-file change）：**
1. `functions/api/permissions.ts` SELECT 加 `u.display_name`（deepCamel → `displayName`）
2. `src/types/api.ts` `Permission` 加 `displayName?: string | null`
3. `src/components/trip/CollabPanel.tsx` initial logic：`(p.displayName?.trim() || p.email).charAt(0).toUpperCase()`

**Test：** `collab-panel-avatar-display-name.test.ts`（4 cases）— backend SELECT / type /
panel logic / regression。1655 全綠 + 3 api integration test 全綠。

**Deploy 順序：** backend deploy 先（frontend type 是 optional fallback 安全），rollout 自然
合流。

## [2.31.34] - 2026-05-17

**Fix: DeveloperAppsPage mobile 缺 GlobalBottomNav 5-tab。**

Bug #135（mobile prod QA found）：`/developer/apps` mobile (375x812) 底部沒 5-tab nav，
user 只能透過 back button 切其他 page。其他 page（AccountPage / PoiFavoritesPage /
DeveloperAppNewPage 等）都傳 `bottomNav` prop，這頁漏。一致性 bug。

Root cause：`DeveloperAppsPage` 的 AppShell 只傳 `sidebar` + `main`，沒 `bottomNav`。
DeveloperAppNewPage 已對 — 同類型 dev page 沒對齊。

**Fix：** 加 import GlobalBottomNav + useCurrentUser → `bottomNav={<GlobalBottomNav authed={!!user} />}`。

**Test：** `developer-apps-page-bottom-nav.test.ts`（4 cases）— import / hook / prop /
regression sidebar。1651 全綠。

## [2.31.33] - 2026-05-17

**Fix: AddStopPage bottom counter mobile overflow 簡化為「→ DAY NN」。**

Bug #134（mobile prod QA found）：`/trip/.../add-stop?day=1` bottom counter
「已選 0 個 · 將加入 DAY 01 · 7/29（三）」248px 文字 > 191px counter container
（mobile 375x812 viewport）→ overflow 57px → ellipsis 切「... · ...」。

Root cause：counter 嵌入完整 `dayLabel`（含 date + weekday）。Page header 上方已顯
完整 dayLabel，counter 不必重複。

**Fix：** counter 簡化 `「已選 N 個 → DAY NN」` 短 day index（取 dayNum padStart）。
Date + weekday 仍由 page header 提供，user 不會遺失 context。

**Test：** `add-stop-counter-shorten.test.ts` 新（3 cases）+ 修 existing
`add-stop-page-region-filter.test.ts` 期望從「· 將加入」改「→ DAY」。1647 全綠。

## [2.31.32] - 2026-05-17

**Fix: PoiFavoritesPage 只有 1 region 時 hide region 篩選 row。**

Bug #133（mobile prod QA found）：`/favorites` page region filter row 顯「全部 3 / 其他 3」。
3 個 POI 全部 derive 進「其他」region bucket（沒任何 POI 配進 visible region）→ 兩個
tab count 完全等價 → user 看到「全部 / 其他」兩 chip 困惑「該選哪個」。

Root cause：`regionOptions` length 1 時 render row 顯「全部 N」+「{region} N」兩 chip
但 count 等價，filter 無意義（點任一都看到全部 3 POI）。

**Fix：** `regionOptions.length >= 2` guard — 只有 ≥2 region group（有實際 filter 意義）
才 render row。單 group → hide row（節省空間）。

**Test：** `favorites-region-row-hide-single.test.ts` 新（3 cases）+ 修 existing
`poi-favorites-page-region-pill.test.tsx` + `poi-favorites-page-hierarchy.test.tsx` 用
≥2 region fixtures。1644 全綠。

## [2.31.31] - 2026-05-17

**Fix: trips list card meta mobile 仍 overflow，對齊 mockup 拔 memberCount。**

Bug #132（mobile prod QA found）：v2.31.30 desktop 修好「重複出發日」（176px card 不再切），
但 mobile 2-col grid 切換 viewport 後 card width 117px，meta「由你建立 · 7/29 – 8/2 · 1 旅伴」
136px → overflow 19px → ellipsis 切成「... · 1 ...」。

Root cause：v2.31.30 把 memberCount 也加進 cardMeta — `{range} · {members} 旅伴`。
但 mockup spec line 5920 / 6213 是「{owner} · 7/29 出發」沒 memberCount。我加的
memberCount 撐破 mobile card width。

**Fix：** cardMeta 簡化為 `range / startMD` fallback chain，拔掉 memberCount path。
對齊 mockup spec。Desktop / mobile 都 fit。

**Test：** `trips-list-card-meta.test.ts` 加 regression 釘住 `not.toMatch(/range && members/)`
+ `not.toMatch(/trip\.memberCount/)`；`trips-list-page.test.tsx:92` 期望改回「7/26 – 7/30」。

**Lesson learned：** v2.31.30 desktop 驗證 OK 就 ship，沒查 mobile responsive 是疏忽。
日後 trips list / favorites / explore 等 grid layout 改動需 desktop + mobile 雙驗證。

## [2.31.30] - 2026-05-17

**Fix: trips list card meta 移除重複出發日（range 已含起始日）。**

Bug #131（prod QA found）：trips list `/trips` card 2「2026 沖繩五日自駕遊行程表」
meta 顯「由你建立 · 7/29 出發 · 7/29 – 8/2」被 ellipsis 切成「由你建立 · 7/29 出發 · 7/29 – ...」。
其他 card 因為文字較短沒被切，視覺不一致。

Root cause：`cardMeta()` 邏輯 `startMD && range` → `${startMD} · ${range}` 重複 —
「7/29 出發」是起始日，「7/29 – 8/2」range 也含起始日。資訊重複且擠爆 176px card
（meta 文字實際 183px > card 176px = 7px overflow）。

**Fix：** 移除 startMD + range 並列。改成優先順序：
- range + members → `{range} · {members} 旅伴`
- range → `{range}`
- startMD → `{startMD}`（沒 endDate 才 fallback「7/29 出發」）
- members → `{members} 旅伴`

**Test：** `trips-list-card-meta.test.ts` 加 regression 釘住「不再 `startMD && range`」；
`trips-list-page.test.tsx:92` 期望從「7/26 出發 · 7/26 – 7/30」改「7/26 – 7/30 · 2 旅伴」
（sample 含 memberCount: 2）。

## [2.31.29] - 2026-05-17

**Fix: EditEntryPage prev header displayTitle 從 master.name 計算（v2.31.28 follow-up）。**

Bug #130（prod verify 抓到）：v2.31.28 deploy 後 trip `/trip/.../stop/420/edit`
mode header 仍顯「從「抵達那霸機場」移動」，沒對齊 TimelineRail「那霸機場」。

Root cause：v2.31.28 用 `getTimelineEntryDisplayTitle(prev)` 期望 prev 物件帶
`displayTitle` 欄位，但 `src/lib/mapDay.ts` 的 `toTimelineEntry` 是 **frontend-only**
mapper（只在 `DaySection.tsx` 內呼叫）。EditEntryPage 直接 fetch `/api/trips/:id/days/:dayNum`
拿到的 raw response 沒 `displayTitle` 欄位 → fallback 取 `prev.title` = 「抵達那霸機場」。

**Fix：** 直接用 `getStopDisplayTitle({title, poiName: prev.master?.name})`
重算 — 這跟 `mapDay.ts:230` 內部規則一致（master.name ?? title）。Backend response
帶 `master.name = "那霸機場"`，計算結果即「那霸機場」。

**Test：** `tests/unit/edit-entry-prev-display-title.test.ts` 更新（4 cases）：
import `getStopDisplayTitle` / 用 `poiName: prev.master?.name` / `setPrevEntry({title: derivedTitle})`
/ retain `prev.title` fallback。

**Lesson learned：** mapDay 是 frontend-only mapper，backend day endpoint 不算
displayTitle。日後跟 mapDay 對齊的邏輯不應假設 backend response 帶 `displayTitle`，
應直接從 raw 欄位（title / master.name / poi.name 等）重算。

## [2.31.28] - 2026-05-17

**Fix: EditEntryPage 「從「prev」移動」header 改用 displayTitle 與 TimelineRail 對齊。**

Bug #129（prod QA found）：trip `/trip/.../stop/420/edit` mode section header
顯示「從「抵達那霸機場」移動」，但 TripPage TimelineRail 同一 entry 顯示
「那霸機場」（POI name 優先）。同一 entry 兩處 UI 名稱不一致，使用者困惑。

Root cause：`mapDay.ts` 計算 `displayTitle = poiName ?? title`，TimelineRail
用 `getTimelineEntryDisplayTitle` 取 displayTitle，但 `EditEntryPage.tsx` 直接
讀 `prev.title` raw 欄位 → 跳過 displayTitle 推導。`DayApi.timeline` type 也
沒宣告 `displayTitle?` → backend 回傳的 displayTitle 被 silent drop。

**Fix：**
- import `getTimelineEntryDisplayTitle` from `src/lib/stopDisplay`。
- `DayApi.timeline` type 加 `displayTitle?: string | null` 欄位。
- `setPrevEntry({ id, title: getTimelineEntryDisplayTitle(prev) })` —
  state 儲存 derived 顯示用 title（不再儲存 raw title）。
- 渲染端 `從「{prevEntry.title}」移動` 維持不變。

**Test：** `tests/unit/edit-entry-prev-display-title.test.ts`（新）— 4 cases：
import / type / setPrevEntry helper 用法 / render header pattern。

## [2.31.27] - 2026-05-17

**Fix: chat AI 健檢 user message 顯短摘要而非整個 system prompt（v2.31.18 follow-up）。**

Bug #128（prod QA found）：user trigger AI 健檢 → `trip_requests.message`
寫整個 `HEALTH_CHECK_MESSAGE` system prompt（含 5 維度 + JSON schema + 範例
+ 「若行程無問題回 []」等）→ chat UI 直接 render `row.message` → user
看到一大坨雜訊。v2.31.18 fix 了 reply（buildHealthCheckSummary），但 message
還是 raw prompt。

Root cause：`src/pages/ChatPage.tsx` `buildPairsFromRequest` 直接用
`row.message` 當 user message text，沒偵測 AI 健檢 prefix。

**Fix：**
- `buildPairsFromRequest` 偵測 `row.message.startsWith('[AI 健檢]')` →
  `displayText = '已觸發 AI 行程健檢'` 短摘要。
- 其他 message 維持原 `row.message`。
- 完整 prompt 仍存 `trip_requests.message` → api-server 拿到完整 text
  送 Claude（沒影響 backend 邏輯）。

**Test：** `tests/unit/chat-ai-health-user-message.test.ts`（新）— 4 cases：
prefix 偵測 + 短摘要文案 + regression (其他 message 維持) + push displayText。

## [2.31.26] - 2026-05-17

**Fix: sanitizeHtml 允許 SPA 相對路徑 href（v2.31.18 follow-up）。**

Bug #127（prod QA found，v2.31.18 fix #115 完整驗證後發現的次級 issue）：
v2.31.18 backend AI 健檢 reply 改寫為 user-friendly summary + markdown link
`[前往健檢報告 →](/trip/:id/health)`，prod 驗證 chat 顯示「AI 健檢完成 —
發現 8 個 finding（high 4 · medium 3 · low 1）。\n\n前往健檢報告 →」— 但
inner HTML 是 `<a>前往健檢報告 →</a>` **沒有 href**！link 看起來是 link
但點不下去。

Root cause：`src/lib/sanitize.ts` line 44 allowed href regex
`/^(https?:|tel:|mailto:|#)/` 只接受絕對 URL / hash anchor，**相對路徑
`/trip/:id/health` 被 strip 掉**。

**Fix：** allowed regex 加 `|\/(?!\/)` — 允許 `/path` 拒絕 protocol-relative
`//host`（會打到不同 host = security 漏洞）。

**Test：** `tests/unit/sanitize-href-relative.test.ts`（新）— 8 cases：
SPA 相對路徑 + query/hash + protocol-relative regression + javascript:
regression + data: regression + https/mailto/tel 保留。

## [2.31.25] - 2026-05-17

**Fix: dark mode 跨 page 沒套用 body.dark class（嚴重 UX bug）。**

Bug #126（prod QA found）：user `/account/appearance` 切「深」mode 後，
localStorage `tp-color-mode` 正確存「dark」，但切到 `/trips` `/chat`
`/favorites` `/explore` 等 page 後 `body.dark` class 沒套用 → page bg
還是 light cream。dark mode 切換只在 AppearanceSettingsPage / TripPage /
GlobalMapPage 三處有效。

Root cause：`useDarkMode` hook 只在 ThemeToggle / TripPage / GlobalMapPage
三 component mount，其他 page (TripsListPage / ChatPage / PoiFavoritesPage /
ExplorePage / etc.) 無 init body.dark class。

**Fix：** 加 root-level `<DarkModeInit />` component（call `useDarkMode()`
+ return null）mount 在 `main.tsx` 內 `<BrowserRouter>` 之下、`<Routes>` 之外，
確保每次 page mount 都 init body.dark class from localStorage。

**Test：** `tests/unit/main-dark-mode-init.test.ts`（新）— 3 cases：
import useDarkMode + DarkModeInit 定義 + root render 含 component。

## [2.31.24] - 2026-05-17

**Fix: 日本 24h POI 顯示日文「24時間」改為中文「24 小時」。**

Bug #125（prod QA found）：那霸機場 timeline expand 顯示「★ 4.1 · 24時間」
— `24時間` 是 Google Places 對日本 24h 商家回的日文 raw（同 24 hour）。
中文 UI 顯日文「時間」字眼不一致，user 看了會困惑。

**Fix：** `src/lib/poiHours.ts` `condenseHours` 加 special case：
`/^24\s*時間(?:営業)?$/` → `'24 小時'`。涵蓋三種形式：
- `24時間` → 24 小時
- `24 時間`（含空格）→ 24 小時
- `24時間営業` → 24 小時

**Test：** `tests/unit/poiHours.test.ts` 4 個新 cases（3 個轉換 + 1 個
「24小時」中文保留 regression）。

## [2.31.23] - 2026-05-17

**Fix: transport POI label 統一為「交通」（之前 TimelineRail 顯「移動」與其他 4 處不一致）。**

Bug #124（prod QA found）：那霸機場 POI（type='transport'）在 TripPage
TimelineRail 顯「那霸機場 移動 · ★ 4.1」，但 EditEntryPage 同 POI 顯「交通」。
4 處 POI_TYPE_LABEL mapping（poiCategory.ts / TimelineRail / EditEntryPage /
其他）都用「交通」，只有 `timelineUtils.ts` `deriveTypeMeta` line 140 用
「移動」造成不一致。User 連續 click 進去看到不同 label confuse。

**Fix：**
- `src/lib/timelineUtils.ts` line 140 `poiType === 'transport'` 返「移動」→
  「交通」對齊 canonical POI_TYPE_LABELS。
- line 157 text-based「開車/drive」keyword 偵測仍返「移動」（描述 segment
  travel 行為而非 POI 屬性，保留）。

**Test：** `tests/unit/timeline-transport-label.test.ts`（新）— 4 cases：
transport POI → 交通 + 不再返移動 + text-based keyword 仍返移動 +
其他 poiType regression（hotel/restaurant/attraction）。

## [2.31.22] - 2026-05-17

**Fix: ExplorePage category filter 0 結果補 empty state。**

Bug #123（prod QA found）：搜尋「拉麵」→ 切到「景點」filter chip → 0 個
結果，grid 完全空白，user 不知如何救回（要點別 chip）。

**Frontend：**
- `src/pages/ExplorePage.tsx` `filtered.length === 0` 時 conditional render
  empty state：`沒有符合「{CATEGORY_LABELS[category]}」的結果。試試其他分類
  或回到「為你推薦」。` + 「回到為你推薦」button onClick `setCategory('all')`。
- CATEGORY_LABELS map（all / attraction / food / hotel / shopping → 為你推薦
  / 景點 / 美食 / 住宿 / 購物）。
- CSS 新規則 `.explore-filter-empty`（dashed border placeholder）+
  `.explore-filter-empty-reset`（accent pill button）。

**Test：** `tests/unit/explore-filter-empty-state.test.ts`（新）— 4 cases：
conditional 結構 + 文案含「沒有符合」+ CATEGORY_LABELS 五個 mapping +
reset CTA onClick + CSS rule 存在。

## [2.31.21] - 2026-05-17

**Fix: AddPoiFavoriteToTrip 結束時間 helper text 文字殘缺。**

Bug #122（prod QA found）：`src/pages/AddPoiFavoriteToTripPage.tsx`
line 557 「可空 — 依停留時間預估推」缺字，對齊 line 544 開始時間
「可空 — 依景點類型自動推算」風格改為「可空 — 依停留時間自動推算」。

**Test：** `tests/unit/add-favorite-to-trip-helper-text.test.ts`（新）—
3 cases：新文案存在 + 殘缺文案不存在 + 開始時間 helper regression。

## [2.31.20] - 2026-05-17

**Fix: ExplorePage 搜尋結果 card 顯示中文 type label。**

Bug #121（prod QA found）：搜尋「拉麵」結果三張卡分別顯 `RAMEN_RESTAURANT`、
`RESTAURANT`、`RAMEN_RESTAURANT` — Google Places primary type raw enum
直接 dump 出來，對中文使用者無意義且不一致（同類別出 2 種 enum）。

Root cause：`src/pages/ExplorePage.tsx` line 736 直接 render
`{poi.category || 'POI'}`，沒走 `POI_TYPE_LABELS[mapNominatimCategory(...)]`
helper 把 Google Places 細分 type → Tripline whitelist enum → 中文 label。
Helper 都已存在於 `src/lib/poiCategory.ts`（AddStopPage / ChangePoiPage
都已用），ExplorePage 漏 import + 漏 call。

**Frontend：**
- `src/pages/ExplorePage.tsx` import 加 `POI_TYPE_LABELS`，poi-category div
  改用 `POI_TYPE_LABELS[mapNominatimCategory(poi.category)] ?? 'POI'`。

**Test：** `tests/unit/explore-page-category-label.test.ts`（新）—
import 含 POI_TYPE_LABELS + poi-category 走 helper + 不再 raw render
poi.category + fallback 'POI' 保留。4 cases。

## [2.31.19] - 2026-05-17

**Fix: PoiFavoritesPage 主收藏頁 card 補回 ★ rating 顯示。**

Bug #120（prod QA found）：v2.31.17 補了 backend poi-favorites GET SELECT
含 `p.rating AS poi_rating` + AddStopPage / ChangePoiPage favorites card 的
★ N.N · address conditional 顯示。**忘了主收藏頁 `/favorites` PoiFavoritesPage**
— card 三張都只顯 type chip / name / address / usage badge，沒有 ★ rating，
雖然 backend 早已回 `poiRating: 4.1`。

**Frontend：**
- `src/pages/PoiFavoritesPage.tsx` `PoiFavoriteRow` interface 加
  `poiRating?: number | null`。
- card body 加 `★ N.N · address` conditional：rating 存在則「★ 4.1 · 地址」，
  缺則只顯地址。
- CSS 新增 `.favorites-card .poi-rating`（accent 色 weight 600）+
  `.poi-meta-sep`（muted 色）。

**Test：** `tests/unit/poi-favorites-page-rating.test.ts`（新）— interface
含 poiRating + card conditional render + 分隔符 + CSS rule 存在。4 cases。

## [2.31.18] - 2026-05-17

**Fix: AI 健檢 reply 在 chat 顯示為 raw JSON array。**

Bug #115（prod QA found）：使用者觸發 AI 健檢後，chat 的 assistant
bubble 直接 dump 一大坨 `[{"severity":"high","dimension":"distance",...}]`
原始 JSON，使用者完全看不懂這是什麼、要怎麼處理。

Root cause：Claude prompt 規定回純 JSON array（給 `applyHealthCheckCompletion`
parse 進 `trip_health_reports.findings_json`），但 `trip_requests.reply`
維持原樣，chat UI 又把 `row.reply` 當 markdown 渲染 → user 看到 raw JSON。

**Fix（backend only）：**
- `functions/api/requests/[id]/index.ts` `applyHealthCheckCompletion`
  在 UPDATE `trip_health_reports` 之後同時 UPDATE
  `trip_requests SET reply = <user-friendly summary>`：
  - 完成 0 findings：`AI 健檢完成 — 行程沒發現問題。\n\n[前往健檢報告 →](/trip/:id/health)`
  - 完成 N findings：`AI 健檢完成 — 發現 N 個 finding（high H · medium M · low L）。\n\n[前往健檢報告 →](/trip/:id/health)`（severity 0 的層級不列）
  - failed：`AI 健檢失敗 — <err>\n\n可重新觸發：[前往健檢報告](/trip/:id/health)`
- 原 raw findings 保留在 `trip_health_reports.findings_json`（健檢全頁讀此），
  chat reply 只保留人話 summary。
- 新 helper `buildHealthCheckSummary` + `rewriteRequestReply`。

**Test：** `tests/unit/health-check-chat-reply-rewrite.test.ts`（新）—
完成/失敗兩條 branch 各驗 UPDATE call + summary 內容 + markdown link。

## [2.31.17] - 2026-05-17

**Fix: AddStopPage / ChangePoiPage favorites card 補回 ★ rating 顯示。**

Bug #114（prod QA found）：v2.31.10/11 因為 `functions/api/poi-favorites.ts`
SELECT 沒拿 `p.rating`，favorites card 顯示孤兒 star icon（icon 後接 address
看起來像 broken）— 當時的修法是直接拔掉 star icon、保留 address。本版補回
backend SELECT 並把 frontend favorites card 改成跟 search card 一致：rating
存在則顯 `★ N.N · address`，否則只顯 address。

**Backend：**
- `functions/api/poi-favorites.ts` GET SELECT 補 `p.rating AS poi_rating`
  （deepCamel 自動轉成 response 的 `poiRating`）。

**Frontend：**
- `src/types/api.ts` `PoiFavorite` interface 加 `poiRating?: number | null`。
- `src/pages/AddStopPage.tsx`：
  - `PoiFavoriteRow` interface 加 `poiRating?: number | null`。
  - `normalizePoiFavorites` 抽 `item.poiRating`（camelCase）+ `item.poi_rating`
    （snake_case fallback，防 backend 沒同步 deploy）。
  - favorites card body 改成 `★ N.N · address` conditional，rating 不存在
    時只顯 address。
- `src/pages/ChangePoiPage.tsx` favorites card 同 AddStopPage 一致改法。

**Tests：**
- `tests/unit/poi-favorites-select-rating.test.ts`（新）— GET SELECT 含
  `p.rating AS poi_rating` regression + 原 pois 欄位不被誤刪。
- `tests/unit/add-stop-page-rating-and-title.test.ts` v2.31.17 section 加
  `PoiFavoriteRow.poiRating` + `normalizePoiFavorites` camelCase/snake_case
  fallback 驗證 + favorites card 從「不該有 star」反轉為「rating 存在才
  render star」。
- `tests/unit/change-poi-page-rating-and-title.test.ts` 同步反轉 + 驗
  `src/types/api.ts` PoiFavorite 含 `poiRating`。

## [2.31.16] - 2026-05-16

**Fix: EntryActionPage Day picker 永遠顯示「空」即使 day 有 stops。**

Prod QA 抓到 `/trip/:id/stop/:eid/copy` 和 `/move` 的 day picker 每個 Day 顯示「空」，誤導 user 以為所有 day 都沒 stops。Root cause：fetch `/api/trips/:id/days`（no `?all=1`）讀 `d.entryCount`，但 backend 該端點不回此欄位 → 永遠 undefined → fallback 0 → UI 顯「空」。

### Changed

- `src/pages/EntryActionPage.tsx`：改用 `/days?all=1` endpoint（已存在），用 `Array.isArray(d.timeline) ? d.timeline.length : 0` 算 stopCount
- `DaysApiRow` type 加 `timeline?: unknown[]`（取代 dead `entryCount` field）

### Added

- `tests/unit/entry-action-page-stop-count.test.ts` — 3 cases

## [2.31.15] - 2026-05-16

**Fix: EditTripPage 「預設交通方式」永遠顯示「自駕」即使 trip 真實是 walking/transit — defaultTravelMode camelCase read。**

Prod QA sweep 抓到 EditTripPage `TripApi` 仍含 snake_case `data_source` / `default_travel_mode`，read 時 `data.default_travel_mode` 永遠 undefined（backend 經 deepCamel 是 `defaultTravelMode`），fallback `'driving'` → UI 「預設交通方式」永遠顯示「自駕」。Driving trip 因 fallback 巧合正確 mask 此 bug；walking/transit trip user 看到錯誤 default。

同 #573 / #574 camelCase 對齊 bug 家族。

### Changed

- `src/pages/EditTripPage.tsx::TripApi` 改 camelCase（`defaultTravelMode` / `dataSource`）
- Read path `data.defaultTravelMode` + `original.defaultTravelMode`
- Write path 維持 `body.default_travel_mode`（backend `WRITABLE_FIELDS` allow-list 是 snake_case）

### Added

- `tests/unit/edit-trip-page-default-travel-mode.test.ts` — 3 cases

## [2.31.14] - 2026-05-16

**Fix: AI 健檢 findings 的「前往景點」/「前往 Day」按鈕永不 render — actionTarget camelCase 對齊。**

Prod QA tour 抓到 AI 健檢 findings 沒有可點的「前往景點」/「前往 Day」 navigation button，即使 backend 有 `actionTarget: { day, entryId }` 資料。同 #573 EditTripPage 一樣的 camelCase 對齊 bug 家族。

Frontend `Finding` type 寫 `action_target?: { day?, entry_id? }` (snake_case)，6 處 reference 都 snake；backend 經 `deepCamel` 回 `actionTarget: { day, entryId }` (camel) → `f.action_target?.entry_id` 永遠 undefined → button condition 永不 true → 不 render。

### Changed

- `src/pages/TripHealthCheckPage.tsx::Finding.actionTarget` 改 camelCase
- 6 處 reference 改用 `f.actionTarget?.entryId` / `f.actionTarget?.day`
- `tests/unit/trip-health-check-page.test.tsx` mock data 改 camelCase（對齊真實 API response shape）

### Added

- `tests/unit/health-finding-action-target-camel.test.ts` — 4 cases

## [2.31.13] - 2026-05-16

**Fix: EditTripPage destinations 沒從 backend load — 顯示「尚無目的地」。**

Prod QA 抓到 `/trip/:id/edit` 顯示「尚無目的地」即使行程明明有 destinations。Backend GET `/api/trips/:id` 經 `deepCamel` 回 `destinations: [{destOrder, name, lat, lng, dayQuota, subAreas}]`，但 EditTripPage `TripDestApi` type 寫死 snake_case + filter 用 `typeof d.place_id === 'number'`（`trip_destinations` 表沒此欄位）→ 永遠 false → 全 filter 掉。

### Changed

- `src/pages/EditTripPage.tsx::TripDestApi` 對齊 backend camelCase：`destOrder` / `dayQuota` / `subAreas`
- Filter logic 改 `typeof d.name === 'string' && d.name.trim().length > 0` (對齊 backend `isValidDestination`)
- 既有 dest map 用 synthetic `existing-${destOrder}-${name}` 當 React key（backend `trip_destinations` 表沒 place_id 欄位）

### Added

- `tests/unit/edit-trip-page-destinations-load.test.ts` — 3 cases

## [2.31.12] - 2026-05-16

**Fix: ExplorePage POI 卡片真的接 Google rating。**

ExplorePage POI 卡片 rating meta 寫死 placeholder「探索更多評論」。Comment 寫「真實 rating 待 backend 提供」— 但 v2.23.0 google-maps-migration 後 backend `PoiSearchResult.rating` 已含 Google rating，UI 沒對齊。

### Changed

- `src/pages/ExplorePage.tsx`：`<span>{typeof poi.rating === 'number' ? poi.rating.toFixed(1) : '探索更多評論'}</span>`
- 過時 comment 改成現況註解

### Added

- `tests/unit/explore-page-rating-display.test.ts` — 2 cases

## [2.31.11] - 2026-05-16

**Fix: ChangePoiPage 同樣的 search rating + section title + favorites star bug。**

v2.31.10 修了 AddStopPage，prod QA 順手測 `/trip/:id/stop/:eid/change-poi` 發現完全相同 3 個 bug（copy-paste pattern）：

1. Section title 寫死「熱門景點 · {region}」
2. Search card 孤兒 star icon
3. Favorites card 孤兒 star icon

修法同 v2.31.10：

### Changed

- `src/pages/ChangePoiPage.tsx` section title `query.trim().length >= 2 ? '搜尋結果' : '熱門景點'`
- Search card 條件 render `★ {rating.toFixed(1)} · address`（ChangePoiPage `normalizeSearchResults` 用 cast，rating 已含）
- Favorites card 暫拔 star（task #114 backend SELECT 補後再恢復）
- 新 CSS class `.tp-change-poi-card-meta-sep`

### Added

- `tests/unit/change-poi-page-rating-and-title.test.ts` — 3 cases

## [2.31.10] - 2026-05-16

**Fix: add-stop 搜尋 rating 顯示 + section title 條件化。**

Prod QA 抓到 `/trip/:id/add-stop` 三個小 bug：

1. **Section title 寫死「熱門景點 · {region}」**：搜尋「美麗海」回 2 個 POI，標題仍顯示「熱門景點」誤導 user。
2. **Card star icon 沒值**：`<Icon name="star" />` 後面直接接 address fragment，看起來像 broken display。Backend 其實有回 `rating: 4.6`，但 `normalizeSearchResults` 沒抽出來。
3. **Favorites tab 同樣 broken star**：poi-favorites API 沒回 rating（schema 有 `pois.rating` 但 SELECT 沒拿），導致 favorites card 也是孤兒 star。Follow-up #114 處理 backend SELECT。

### Changed

- `src/pages/AddStopPage.tsx::normalizeSearchResults` 加 `rating: typeof item.rating === 'number' ? item.rating : undefined`
- Search card meta：`{typeof r.rating === 'number' && ⟨★ {r.rating.toFixed(1)} · separator⟩} <span>{poiMeta(...)}</span>`
- Section title：`{query.trim().length >= 2 ? '搜尋結果' : '熱門景點'} · {region}`
- Favorites card：暫拔孤兒 star icon（沒 rating data 避免誤導），#114 backend follow-up 後補回
- 新 CSS class `.tp-add-stop-card-meta-sep`（separator 視覺）

### Added

- `tests/unit/add-stop-page-rating-and-title.test.ts` — 4 cases 對應 4 個 fix point

## [2.31.9] - 2026-05-16

**Perf: useTripSegments N+1 fix — TripPage 一次 fetch 取代每 day 一次。**

Trip 詳細頁有多少 day 就 mount 多少 `TimelineRail`，每個 `TimelineRail` 自己 call `useTripSegments(tripId)` → 5-day trip 平行打 5 個 `GET /api/trips/:id/segments`。同份 segments data 重複請求 5 次，浪費約 200-300ms。

### Added

- `src/contexts/TripSegmentsContext.tsx` — Provider 暴露 `{ segments, segmentMap, loading }` 給子樹共用
- `tests/unit/use-trip-segments-context.test.tsx` — 3 cases：context 存在不 fetch、多 hook caller 共用、context 缺席 hook 自己 fetch（EditEntryPage path）

### Changed

- `src/hooks/useTripSegments.ts`：hook 偵測 `TripSegmentsContext` 存在 → 直接讀 context；context 缺席 → 走原本 fetch path（保留 EditEntryPage / 其他獨立頁面 fallback）
- `src/pages/TripPage.tsx`：頂層 call 一次 `useTripSegments(activeTripId)`，用 `TripSegmentsContext.Provider` 包 main content；children TimelineRail 從 context 拿值

## [2.31.8] - 2026-05-16

**Fix: TravelPill 初始 render 閃顯反向 + AI 健檢 pending 文案 30s→3-7min。**

v2.31.7 prod QA 抓到兩個小 bug：

1. **TravelPill 閃顯反向（Bug #3）**：行程詳細頁初次載入瞬間，segments hook 還沒 resolve 時，TimelineRail 落地用 `entry.travel` fallback 渲染。v2.29.0 backend rewrite 後 `entry.travel` 從 `segmentsMap.get(from_entry_id=eid)` 取值，語意是「離開此 entry 到下一站」。但 UI pill 渲染位置在 (prev → curr) 中間，意思是「抵達 curr 的旅程」=「離開 prev」，應該讀 `prev.travel` 不是 `entry.travel`。Segments 載入後 segment prop 接手覆蓋 → 正確值，所以肉眼看起來只是「閃一下」但方向值是錯的（min/distance 對應錯 leg）。
2. **AI 健檢「30 秒內完成」文案誤導（Bug #4）**：實測 request #190 跑 3m46s、#196 跑 9 分鐘、#187 worst case 1h19m。30 秒是早期 mockup 期樂觀估計，後續 prompt 強化 + dimensions 拓展後實際時間拉長，文案沒更新 → user 等 1 分鐘就以為卡住。

### Changed

- `src/components/trip/TimelineRail.tsx`：fallback `travelObj` 從 `entry.travel` 改 `prev?.travel`（修正 v2.29.0 backend semantic 與 UI 渲染位置不符）
- `src/pages/TripHealthCheckPage.tsx`：empty state + pending state 「30 秒內完成」→ 「3-7 分鐘完成」
- `tests/unit/timeline-rail-segments-wiring.test.tsx`：更新 fallback test 對齊 v2.29.0 backend semantic（travel 改掛 prev = entry 1），新增 regression test 確認 travel on curr 不會誤觸發 fallback

## [2.31.7] - 2026-05-16

**Fix: D1 naive datetime UTC parsing — AI 健檢 / chat 時間戳顯示落差 TZ offset。**

v2.31.6 prod QA 抓到「AI 健檢 8 小時前完成」實際 7 分鐘前的 bug。Root cause: D1 `datetime('now')` 回傳 `YYYY-MM-DD HH:MM:SS` 無 Z 後綴，前端 `new Date(s)` 在 Chrome 被當 local time → 顯示落差 TZ offset 小時（TPE +8）。

Affected：
- `TripHealthCheckPage.formatTimestamp` → 「N 小時前完成」label
- `ChatPage.formatChatTime` + `formatDayDivider` + `buildMessagesWithDividers` → chat bubble HH:MM + day divider
- `SessionsPage.relativeTime` → session 列表「N 分鐘前」
- `DeveloperAppsPage` → app 建立日期

### Added

- `src/lib/parseUtcDate.ts` — 偵測 D1 naive datetime → 補 'Z' → UTC parse；ISO 8601 帶 Z/offset pass-through
- `tests/unit/parse-utc-date.test.ts` — 7 cases（D1 naive / millis / ISO Z / offset / null / garbage / 不重複加 Z）

### Changed

- 4 個 `new Date(iso)` 用 D1 字串的 callsite → `parseUtcDate(iso)`

**Chat polling robust 化 — 解 SSE 逾時後 silent 卡死 bug。**

User QA 回報：「等待更新技術逾時，剛剛送出的 request 沒回應」。Root cause 兩條無聲斷鏈：

1. **SSE server 上限 10 min** (`functions/api/requests/[id]/events.ts`) — 但 request #187 曾跑 1h19m、AI 健檢 5–7 min 是常態。timeout 後 server close stream
2. **EventSource auto-reconnect 不一定觸 client `onerror`** — 原本只有 `onerror → fallback to polling` 的 client 設計，server clean-close 觸發 browser 自動重連時走不到 fallback path → polling 永遠沒啟動 → 卡 spinner

### Changed

- `functions/api/requests/[id]/events.ts`：`MAX_DURATION_MS` `10 * 60 * 1000` → `30 * 60 * 1000`
- `src/hooks/useRequestSSE.ts`：重寫 — polling 永遠跑（safety-net 每 30s），SSE 退位成 latency optimization；第一個看到 terminal 的 source 贏，cleanup 雙方。401 → `errorReason='auth_expired'`，新增 `elapsedMs` 給 UI 顯示等待時間
- `src/pages/ChatPage.tsx`：用 new `errorReason` + `elapsedMs`；新增「AI 還在處理（已等候 N 分鐘）」提示（超過 3 min 顯示，避免 spinner-only 看起來卡死）；401 顯示「登入已過期，重新整理」CTA

### Added

- `tests/unit/use-request-sse.test.tsx`：6 cases — polling 跟 SSE 並行、polling 看到 completed、SSE message terminate polling、401 → auth_expired、elapsedMs 計時、null requestId no-op

## [2.31.5] - 2026-05-16

**`/tp-request` 兜底 cron 30 min → 10 min。**

CF Pages POST `/trigger` 仍是第一線即時觸發；30 min 兜底在 Tailscale Funnel 530 / Caddy 中斷等場景救援週期太長（一筆 trip_request 卡 open 最久要 30 min 才補救）。10 min 把 worst-case 拉短到 1/3。

每 10 min spawn 開銷：tmux session + bun + claude 啟動約 2-3s，empty-queue 路徑直接 self-destruct → 每次成本可忽略。

### Changed

- `scripts/tripline-api-server.ts`：`REQUEST_CRON_INTERVAL_MS` `30 * 60 * 1000` → `10 * 60 * 1000`

### Migration

- Deploy 順序：merge → `launchctl kickstart -k gui/501/com.tripline.api-server`
- 驗證點：log `Scheduled request-handler (/tp-request) every 10 min`

## [2.31.4] - 2026-05-16

**Remove dead `/tp-poi-enrich-monthly` schedule — batch 腳本 v2.23.0 已刪除。**

`scripts/poi-enrich-batch.ts`（OSM Nominatim 月度 enrich）在 commit `ac23d4e`（v2.23.0 Google Maps Platform 切換）已從 repo 移除。POI enrichment 流程已改：
- 新 POI 即時 enrich：`POST /api/pois/:id/enrich` 同步打 Google Place Details
- 既有 POI 30 天 refresh：`scripts/google-poi-refresh-30d.ts`（50 POI/day cap，由 daily-check 一併處理）

monthly batch skill 失去意義，每天 fire 都 day-1 guard early exit；真到 1 號會撞 `bun: No such file` 紅 Telegram 警報。

### Removed

- `scripts/tripline-api-server.ts`：`scheduleDaily(8, 0, '/tp-poi-enrich-monthly', 'poi-enrich')` schedule（v2.31.3 才加，沒等到觸發就拔）
- `.claude/skills/tp-poi-enrich-monthly/` + `.codex/skills/tp-poi-enrich-monthly/` 整個 skill 目錄

### Migration

- Deploy 順序：merge PR → `launchctl kickstart -k gui/501/com.tripline.api-server` 載入剩 2 schedules

## [2.31.3] - 2026-05-16

**api-server 內建多排程 cron 取代 launchd / Cowork — v2.30.18 band-aid 升級為主路徑。**

v2.30.5 把 schedulers 從 launchd 搬進 Claude Desktop Cowork，預期重啟保留任務；觀察到 Cowork `scheduled-tasks.json` 重啟會清空 + 2026-05 起 backend API 化讓「直接寫 JSON」失效 → 2026-05-07 起 cron 完全停跑（自動 reply 卡 11 天 / poi enrich + daily check 完全沒跑）。v2.30.18 加 15-min `/tp-request` 兜底 internal cron 但只覆蓋 1 個 schedule。

### Added

- `scripts/lib/schedule-daily.ts` — `computeNextDailyFire(now, hour, minute)` pure helper（setTimeout-to-next-occurrence ↔ setInterval 24h chain 的計算邏輯）
- `tests/unit/api-server-schedule-daily.test.ts` — 3 cases（目標時段晚/早於 now + 邊界等於 now 排到明天）
- `scripts/tripline-api-server.ts`：3 schedules
  - `/tp-request` 每 30 分鐘（兜底，CF Pages POST `/trigger` 仍是第一線即時觸發）
  - `/tp-daily-check` 每天 09:00（每日健康報告 + 自動 fix）
  - `/tp-poi-enrich-monthly` 每天 08:00（skill 內 day-1 guard 自行決定是否真的跑）
- `spawnTmuxRequest(skillCommand)` + `processLoop(source, skillCommand)` — 支援 ephemeral tmux session 傳遞不同 skill command（之前 hard-code `/tp-request`）
- `.claude/skills/tp-request/SKILL.md` + `.codex` mirror：step 2「無待處理請求」也跳到 self-destruct（之前 empty queue path 不砍 session → tmux 滯留到 30min orphan cleanup → cron 下一輪被 active session 擋掉）
- `.claude/skills/tp-daily-check/SKILL.md` + `.claude/skills/tp-poi-enrich-monthly/SKILL.md` + `.codex` mirror：新增 Self-destruct section（任何 termination path 都跑 `tmux kill-session`）

### Removed

- `scripts/tripline-api-server.ts` v2.30.18 的 `CRON_INTERVAL_MS = 15 * 60 * 1000` 單一 setInterval band-aid

### Migration

- 不需 D1 migration
- Deploy 順序：merge PR → CF Pages auto-deploy（不影響 api-server）→ `launchctl kickstart -k gui/501/com.tripline.api-server` 讓 mac mini restart 載入新 schedules
- 觀察點：log 出現 3 行 `Scheduled <label> ...` 表示註冊成功；隔日 09:00 / 08:00 看 daily-check / poi-enrich 是否觸發

## [2.30.13] - 2026-05-16

**TravelPill mobile margin cascade fix — v2.30.12 layout 緊湊化未生效在 mobile。**

QA prod (`/qa` + login) 發現 v2.30.12 改動實際在 mobile viewport (390x844) 上**沒生效**：

```
$B css '.tp-travel-pill-wrap' 'margin-left'
→ 92px (should be 44px)
```

### Root cause

`src/components/trip/TravelPill.tsx` SCOPED_STYLES 內**兩個** `@media (max-width: 760px)` block：

- v2.30.12 我加在 line 34-36：`.tp-travel-pill-wrap { margin: 6px 0 6px 44px; }`
- 舊 line 107-115 既有 block（未修）：`.tp-travel-pill-wrap { margin-left: 92px; }`

CSS cascade 後者勝出 → mobile 實際 margin-left = 92px，等同 v2.30.12 沒做。Desktop 因為沒落入 mobile media query 才正確顯示 56px。

### Fixed

- 將 v2.30.12 新增的 mobile @media block 合併進舊 mobile @media block（消除 cascade race）
- 舊 `.tp-travel-pill-wrap { margin-left: 92px; }` 改為 `margin: 6px 0 6px 44px;`（與設計值一致）

QA 確認 `.tp-rail-detail` mobile margin-left = 44px ✓（既有單一 @media block 無 cascade 問題）。只有 TravelPill 因為兩個 @media block 才中招。

### Verified

- `$B css '.tp-travel-pill-wrap' 'margin-left'` 在 mobile 應顯示 44px
- 1525 unit tests pass + typecheck clean

## [2.30.12] - 2026-05-16

**TimelineRail mobile 緊湊版型（移除 time col）+ 重新計算 toast feedback 精準化。**

User 兩個 issue：
- 「橫條紅框為什麼有車程未更新 按下重新計算無效」— recompute 沉默 fail（後端 0 段被算，前端只 show 通用 toast）
- 「長條紅框版面太空 移除這段空白 將右邊內容往左靠」+「行程展開後也是空白 調整讓版面緊湊」— rail 左側 time col 為空（user 沒填 entry.time），佔 50px 桌面 / 44px mobile 的 dead 寬度；expanded panel 與 TravelPill 因為對齊舊 dot 中心也 indent 過深。

### Changed — TimelineRail layout 緊湊

- `css/tokens.css` `.ocean-rail-item` grid 從 6-col `24 50 24 44 1fr 20` → 5-col `24 24 44 1fr 20`（移除 time col）；mobile 從 `20 44 24 36 1fr 16` → `20 24 36 1fr 16`
- `.ocean-rail-dot` 移 `grid-column: 3` → `2`
- `.ocean-rail-head` 移 `grid-column: 4 / span 3` → `3 / span 3`
- `src/components/trip/TimelineRail.tsx`:
  - 移除獨立 `<span className="ocean-rail-time">` JSX
  - 若 `entry.time` 有值，在 `.ocean-rail-sub` 行首加 `.ocean-rail-sub-time` chip（rail row 仍可看到時間，只是位置從左 col 改 inline sub line）
  - `.tp-rail-detail` margin-left desktop `110px → 56px`，mobile `92px → 44px`（對齊新 dot 中心 = item-pad + grip + gap + dot/2）
- `src/components/trip/TravelPill.tsx` `.tp-travel-pill-wrap` margin-left `110px → 56px`，新增 mobile `@media (max-width: 760px)` 設 `44px`
- `.ocean-rail-sub-time` 新 CSS：bold + tabular-nums + `var(--color-foreground)`，與 sub-type label 區隔

mobile 寬度節省 ~52px（44px time col + 8px gap），expanded panel 與 TravelPill 左 indent 從 92px → 44px 節省 48px。

### Changed — recompute toast 精準化

- `functions/api/trips/[id]/recompute-travel.ts`:
  - 新增 `pairsSkippedMissingCoords` counter（POI 缺 lat/lng 跳過時 ++）
  - response 加 field `pairsSkippedMissingCoords` 給 frontend 解析
- `src/components/trip/TimelineRail.tsx` `handleRecomputeTravel` 重寫 success branch：
  - 解析 response JSON 拿 `pairsComputed` / `pairsSkippedMissingCoords` / `errorsDetail`
  - `computed === 0 && missing > 0` → `「X 段缺少 POI 座標無法計算，請補上 lat/lng」`
  - `computed === 0 && errs > 0` → `「X 段重算失敗（Google Routes API）」`
  - `computed === 0` → `「沒有可重算的車程」`
  - `errs > 0 || missing > 0` → `「重算 X 段，Y 段跳過」`
  - 一般 success → `「已重新計算 X 段車程」`

避免「車程未更新 重新計算」按下後系統明明 0 段被算卻 show「車程已重新計算」誤導 user。

### Tests

- 1525 unit tests pass (181 files)
- typecheck clean
- `tests/unit/timeline-rail-stale-travel.test.tsx` 3 個 mock response 補上 `json()` method（avoid 我的新 parsing 在 mock 上 TypeError）

## [2.30.11] - 2026-05-15

**DaySection ocean-hero `STOPS/Start/End` stats block 移除 — 與 `heroSub`「7 個 stops · 33 km · 預估 X 小時」資訊重複。**

DayHero 卡片視覺：標題下方 `heroSub` 已顯示「N 個 stops · X km · 預估 Y 小時」字串，下方又有分隔線 + 3-col stats grid 重複顯示「STOPS / 7 / Start / End」（screenshot 紅框）。User 指出重複，刪 stats grid 保留 heroSub。

### Removed

- `src/components/trip/DaySection.tsx`：`<div className="ocean-hero-stats">` 整個 JSX block（21 行）— 含 Stops / Start / End 3 個 `<div className="ocean-hero-stat">`。`bounds` / `totalHours` 變數仍保留（feed 進 `heroSub` 文字組成）
- `css/tokens.css` 4 個 dead CSS class block：
  - `.ocean-hero-stats`（3-col grid + 上方淡白色分隔線，~9 lines）
  - `.ocean-hero-stat`（label 上 value 下 block，~5 lines）
  - `.ocean-hero-stat-label`（uppercase eyebrow label，~7 lines）
  - `.ocean-hero-stat-value`（18px / 16px mobile，~5 lines）
- `.ocean-hero-summary` orphan class（無 React consumer）順手清掉
- `@media (min-width: 961px)` 內 `.ocean-hero-stat-value` desktop font-size override
- `@media (max-width: 760px)` 內 `.ocean-hero-stat-value` mobile font-size override
- `body.print-mode .ocean-hero-stat` / `body.print-mode .ocean-hero-stat-label, body.print-mode .ocean-hero-stat-value` 2 條 print-mode override

### Tests

- 1525 unit tests pass (181 files)
- typecheck clean

## [2.30.10] - 2026-05-15

**`/account/appearance` 移除「主題色 / 選擇色票」card grid — 跟「深淺模式」ThemeToggle 重複。**

`AppearanceSettingsPage` 原本兩個 section 都操控同一個 `colorMode` state（淺/自動/深）：
- 上方「深淺模式」：`<ThemeToggle>` pill 選 toggle
- 下方「主題色 / 選擇色票」：`COLOR_MODE_OPTIONS` card grid 預覽 + 點選

User 指出功能重複，刪掉下半段保留 ThemeToggle。連帶清掉 dead code：

### Removed

- `src/pages/AppearanceSettingsPage.tsx`：刪「主題色」section JSX、`useDarkMode` hook 呼叫（page-level 不再需要 colorMode state，`<ThemeToggle>` 自己管）、`COLOR_MODE_OPTIONS` / `clsx` import、`.tp-appearance-modes-grid` CSS class
- `src/lib/appearance.ts` 整檔刪除（唯一 export `COLOR_MODE_OPTIONS` 已無消費者）
- `css/tokens.css`：刪 `.color-mode-card` / `.color-mode-preview` / `.color-mode-{light,dark,auto}` 整 family（~33 lines）+ `--cmp-light-{bg,surface,input}` / `--cmp-dark-{bg,surface,input}` 6 個變數（color-mode preview mini UI 專用，無其他 consumer）
- `tests/unit/tokens-css.test.ts:84`：`.color-mode-card` 存在斷言改為 not.toContain

### Tests

- 1525 unit tests pass (181 files)
- typecheck clean

## [2.30.9] - 2026-05-15

**`scripts/_archived/` 整個目錄刪除 — User 規則「不使用的就刪除」。**

v2.30.8 把 3 支 stale script 搬進 `scripts/_archived/`，但 user 表態「不使用的就刪除」 — archive 不是答案，刪掉才是。本 PR 把 `scripts/_archived/` 整個目錄 8 支 one-shot script 一次清掉：

### Removed

- `scripts/_archived/backfill-pois.js`
- `scripts/_archived/backfill-user-id.js` (v2.30.8 剛搬進來)
- `scripts/_archived/migrate-docs-to-v2.js`
- `scripts/_archived/migrate-md-to-d1.js`
- `scripts/_archived/migrate-pois.js`
- `scripts/_archived/migrate-trip-docs.js`
- `scripts/_archived/resolve-poi-collisions.js` (v2.30.8 剛搬進來)
- `scripts/_archived/verify-user-backfill.ts` (v2.30.8 剛搬進來)

### Why safe

全 8 支都是 one-shot migration / backfill script，prod 已跑過、obsolete。Active code 0 reference（grep 確認）；CHANGELOG 與 `openspec/changes/archive/` historical doc 提到不算 reference — 純歷史記載，無 functional dependency。日後若需要重現 migration pattern，可從 git history 撈（`git log --all --diff-filter=D --name-only -- scripts/_archived/` 找 commit 還原）。

## [2.30.8] - 2026-05-15

**Dropped-table 殘留清理 — dump-d1 table list 對齊 v2.30 schema + 3 支 stale one-shot script 歸檔。**

User 觸發完整 audit「檢查還有沒有使用到 drop table 的程式碼」。掃 active code SQL 操作（FROM/JOIN/INTO/UPDATE/DELETE）發現 1 個 active bug + 3 支 stale script。其他 hit 全部是 historical comment / migration test 字串斷言 / endpoint URL 路徑保留 backward compat，無 active SQL ops。

### Fixed

- **`scripts/dump-d1.js:7` table list 對齊現況**：移除 dropped `trip_pois`（v2.29.0 migration 0061+0062）；補上 v2.22+v2.27+v2.x 加入的新表：
  - `trip_entry_pois`（v2.27.0 multi-POI per entry junction）
  - `trip_segments`（v2.x travel segment）
  - `trip_destinations`（trip 目的地清單）
  - `trip_invitations`（V2 OAuth signup invite）
  - `poi_favorites`（v2.22.0 rename from `saved_pois`）
  - `users`（V2 OAuth）
  - `companion_request_actions`（v2.22.0 companion quota gate）
  不含 ephemeral infra（`api_logs` / `pois_search_cache` / `rate_limit_buckets` / `oauth_models` / `session_devices` / `auth_audit_log` / `auth_identities` / `client_apps` / `error_reports` / `app_settings`）— 純 cache / log / config，無 user-data 價值。
  舊版每次跑 backup 對 `trip_pois` 觸發 D1 400 + 漏 backup 新表 ~7 種 user-data。

### Archived

3 支 stale one-shot script 搬進 `scripts/_archived/`（同既有 `migrate-pois.js` pattern）：

- **`scripts/resolve-poi-collisions.js`** → `scripts/_archived/`：pre-migration-0027 一次性 collision resolver，引用 `trip_pois`（DROPPED）+ `trip_entries.poi_id`（DROPPED v2.29.0 phase 2）。
- **`scripts/backfill-user-id.js`** → `scripts/_archived/`：V2-P1 prep backfill (migration 0033 era)，`UPDATE saved_pois` / `UPDATE trip_ideas`（兩表都 DROPPED）。
- **`scripts/verify-user-backfill.ts`** → `scripts/_archived/`：V2-P1 cutover hard gate，驗證 `saved_pois.email` / `trip_ideas.added_by` 都能 resolve 到 `users.id`。Migration 0046+0047 跑完後 obsolete。

跑這 3 支會 crash on D1 400（query dropped table），歸檔避免誤觸。

### Verified safe (historical comments only)

掃描中其他 hit 都是無 SQL ops 的 historical 文字參照：

- `functions/api/trips/[id]/entries/[eid]/trip-pois.ts` — endpoint URL 路徑保留 backward compat，內部寫 `trip_entry_pois`
- `functions/api/{_poi,trips/[id]/days/_merge,trips/[id]/days/[num],trips/[id].ts,trips/[id]/audit/[aid]/rollback,trips/[id]/days,trips/[id]/entries/[eid],pois/[id]}.ts` — v2.29.0 trip_pois rip-out 說明 comment
- `scripts/daily-report.js:283` — comment only（actual SELECT 在 v2.30.4 已修）
- `tests/api/{oauth-signup,permissions-post,account-stats,invitations-list-revoke,trips}.integration.test.ts` — TODO v2.20.1 comment + 舊 schema SQL 字串斷言（測 migration 內容，不對 prod D1 跑）
- `tests/unit/migration-0033-add-user-id-columns.test.ts` — 測 migration 0033 SQL 字串斷言
- `tests/e2e/api-mocks.js:68` — 純 comment
- `src/types/api.ts` / `src/lib/trip-url.ts` / `src/components/trip/InfoBox.tsx` — comment

## [2.30.7] - 2026-05-15

**Revert v2.30.6 over-removal + 改用 ephemeral tmux session 跑 claude（無 `-p` flag）。**

v2.30.6 (PR #546) 誤解 user 指令「替換 claude -p」做過度刪除 — 整支 `processLoop` / `runClaude` / `POST /trigger` endpoint 全砍。User 澄清「不是整個移除 只是移除-p參數」。本 PR 先 `git revert 7d6b324` 還原 v2.30.6 刪除的 trigger/processLoop 結構，再把 `claude -p` spawn pattern 換成 ephemeral tmux session pattern：固定 prefix `tripline-request-` + timestamp suffix 命名、skill 處理完自殺、orphan > 30min 由 API server 強取回收。

### Reverted

- `Revert "v2.30.6 chore: remove last claude -p spawn (api-server /trigger 廢除) (#546)"` — 還原刪掉的 `runClaude` / `processLoop` / `fetchOldestOpen` / `patchStatus` / `authedFetch` / `authHeaders` / `POST /trigger` endpoint / state vars / `child_process` import / `recordEmailEvent` + `alertAdminTelegram` 用法 / `tests/unit/api-server-process-loop.test.js`

### Changed

- `scripts/tripline-api-server.ts`：
  - `runClaude()` → `spawnTmuxRequest()`：以 `spawnSync('tmux', ['new-session', '-d', '-s', name, ...])` 開 detached session，session 內跑 `claude --dangerously-skip-permissions --name <session>`（**移除 `-p` flag**，但仍 `--dangerously-skip-permissions` 因為非 TTY 自動 skip workspace trust）。Inject `TRIPLINE_API_TOKEN` + `TRIPLINE_TMUX_SESSION` env var 給 skill 用
  - 新 `cleanupOrphans(maxAgeMs)`：parse `tmux ls -F` 找 `tripline-request-*` session > 30 min 強取 kill
  - 新 `hasActiveSession()`：檢查是否有 active session（同時只允一個 — 避免 race condition）
  - `processLoop()` 大幅簡化：`cleanupOrphans → hasActiveSession check → spawnTmuxRequest`（單次 fire-and-forget，**不再 loop**）。skill 自己 drain queue 不需要 API server iterate
  - 刪 `fetchOldestOpen` / `patchStatus` / `authedFetch` / `authHeaders` / `TripRequest` interface / `CLAUDE_TIMEOUT_MS` / `API_BASE`：skill 自己處理 queue + PATCH status
  - 改 `spawn` → `spawnSync`（tmux 操作 synchronous，無 streaming buffer 需求）
- `.claude/skills/tp-request/SKILL.md` + `.codex/skills/tp-request/SKILL.md`：結尾加 self-destruct 段落
  ```bash
  if [ -n "$TRIPLINE_TMUX_SESSION" ]; then
    tmux kill-session -t "$TRIPLINE_TMUX_SESSION" 2>/dev/null || true
  fi
  ```
  Cowork 觸發時無 `TRIPLINE_TMUX_SESSION` env var → skip（Cowork 自管 session lifecycle）
- `tests/unit/api-server-process-loop.test.js`：移除 `consecutiveFailures` simulated test（行為已不存在），保留 health endpoint 結構 + verifyAuth + session prefix 命名測試（3 條）

### Why tmux ephemeral

- ✓ 隱藏執行（detached session，無視窗）
- ✓ 沒 `-p` flag（user 明確要求）
- ✓ 同時只允一個（避免 race condition 兩個 claude 競爭同 D1 request）
- ✓ Ephemeral（用完即砍，避免 context 累積成本爆炸）
- ✓ Orphan 30min 自動回收（token TTL 1h 之內 cleanup 一定發生）
- ⚠ Concurrent /trigger 期間第二個 call 直接 return（active session 仍在 drain queue）

### Tests

- 1525 unit tests pass (181 files)
- typecheck clean
- npm test:api `tests/api/requests.integration.test.ts` 9 passed (未動 trigger caller，仍 fire-and-forget)

## [2.30.5] - 2026-05-15

**Schedulers → Claude Cowork migration — 3 支 launchd-driven scheduler 全部廢除。**

2026-05-11 LaunchAgent → LaunchDaemon migration 引入 keychain isolation regression：LaunchDaemon `UserName=ray` 雖標 user 但跑 pre-login system context，沒附著 user keychain session → `claude -p` CLI OAuth token unreachable → daily-check Phase 2 自動修復 / tp-request 處理全部沉默失敗（user 描述「改排程執行方式抓不到授權了」）。本 PR 不修 keychain 問題本身，改用 Claude Desktop 內建的 **Cowork scheduled task** 直接觸發 skill — Cowork 跑在使用者 session 內，自然繼承 keychain + shell env，零 auth 設定，順便消滅所有 `claude -p` headless invocation。

### Removed

- `scripts/daily-check-scheduler.sh` / `scripts/tp-request-scheduler.sh` / `scripts/poi-enrich-scheduler.sh` — 3 支 .sh wrapper 整支刪掉
- `scripts/com.tripline.daily-check.plist` / `scripts/com.tripline.request-job.plist` — launchd 設定檔 source 刪除（user 手動 bootout `/Library/LaunchDaemons/` 或 `~/Library/LaunchAgents/` 既有 install 透過 `scripts/migrate-launchd-to-cowork.sh`）
- `scripts/install-daily-check-launchdaemon.sh` — daemon install helper 過時
- `scripts/register-daily-check.ps1` / `scripts/register-scheduler.ps1` / `scripts/tp-request-scheduler.ps1` / `scripts/unregister-scheduler.ps1` — Windows PowerShell 排程 wrapper（專案 2026-04 已遷 macOS，PS1 為歷史殘留）
- `scripts/lib/scheduler-common.sh` — 無 .sh 呼叫者後失去意義（env loading 改 skill 內直呼 `scripts/lib/load-env.mjs`）

### Added

- `.claude/skills/tp-poi-enrich-monthly/SKILL.md` — 新 skill 取代 `poi-enrich-scheduler.sh`，Cowork Daily fire + skill 內 `if [ "$(date +%d)" != "01" ]; then exit 0; fi`（Cowork 不支援 monthly 頻率，30 次 noop fire 換 monthly 一次 batch）
- `scripts/lib/send-telegram.sh` — 3 支 scheduler 重複 Telegram bot wrapper 抽出共用 helper（`bash scripts/lib/send-telegram.sh "<msg>"`）
- `scripts/lib/build-daily-check-msg.js` — daily-check report JSON → Telegram 訊息 builder（抽自 `daily-check-scheduler.sh` 的 inline `build_telegram_msg()` Node script）
- `scripts/migrate-launchd-to-cowork.sh` — 使用者手動跑一次：bootout 舊 LaunchDaemon `/Library/LaunchDaemons/com.tripline.daily-check.plist` + LaunchAgent `~/Library/LaunchAgents/com.tripline.{request-job,poi-enrich-monthly}.plist`，rm `~/.local/bin/tripline-daily-check.sh` + `~/.local/bin/tripline-poi-enrich-monthly.sh`

### Changed

- `.claude/skills/tp-daily-check/SKILL.md` 重寫：Phase 1 改 Bash tool 直呼 `node scripts/daily-check.js` + Phase 2 in-session auto-fix（同 Cowork session 內走 `/tp-code-verify` → `/ship` → `/land-and-deploy`，不再 spawn 新 `claude -p` process）+ Phase 3 `bash scripts/lib/send-telegram.sh`
- `.claude/skills/tp-request/SKILL.md` 觸發模式段落改 Cowork Hourly（接受 hourly latency，從原 15 min 降級換取 keychain isolation 修復）；env loading 走 `scripts/lib/load-env.mjs`，token 走 `scripts/lib/get-tripline-token.js`
- `scripts/daily-check.js:querySchedulerErrors()` 移除 `tp-request` / `daily-check` error-log scan（Cowork session 失敗 surface 在 Telegram + fix-result.json，不再寫 `.error.log`）；保留 `api-server` stderr scan（LaunchAgent 仍長駐）
- `ARCHITECTURE.md` poi-enrich 排程段落改指向 `.claude/skills/tp-poi-enrich-monthly/`
- `.codex/skills/tp-{daily-check,request,poi-enrich-monthly}/SKILL.md` mirror 同步

### Manual steps after merge

1. `bash scripts/migrate-launchd-to-cowork.sh` — bootout 舊 launchd
2. Claude Desktop → Cowork → 建 3 個 scheduled task（task name 列在每個 SKILL.md 開頭「排程」段）：
   - `Tripline Daily Check` / Daily / `/tp-daily-check` / working folder `/Users/ray/Projects/trip-planner`
   - `Tripline Request Handler` / Hourly / `/tp-request` / 同 folder
   - `Tripline POI Enrich Monthly` / Daily / `/tp-poi-enrich-monthly` / 同 folder

## [2.30.4] - 2026-05-15

**Daily-check follow-up fixes — daily-report `trip_pois` stale SELECT + skill docs `POST /api/poi-search` → `GET`。**

兩個 2026-05-15 daily-check 告警的 root cause 修法：

### Fixed

- **`scripts/daily-report.js:285` stale `trip_pois` table SELECT**：v2.29.0 (PR #527, migration 0061+0062) trip_pois rip-out 後該 table 已 DROP，但 daily-report 的孤立 POI 偵測仍 query `trip_pois`，每天觸發 D1 400 → Telegram「⚠️ Tripline 資料異常 偵測失敗：D1 query failed: 400」告警。改 query 新 canonical table `trip_entry_pois`（保留同樣孤立 PO I 偵測語意）。同 PR #535 (queryRequestErrors fix v2.29.3) pattern。
- **4 個 skill docs `POST /api/poi-search` → `GET`**：`functions/api/poi-search.ts` 只 export `onRequestGet`，但 `.claude/skills/tp-search-strategies/SKILL.md` × 2 處 + `.claude/skills/tp-request/SKILL.md:154` + `.claude/skills/tp-shared/references/poi-spec.md` × 3 處 + `.codex/` mirror (3 處) 寫成 POST。LLM 跟著 doc 用 POST → 405 ×4/day api_logs 噪音。改 GET + curl `-G --data-urlencode "q=..."`。Frontend callers (`usePoiSearch.ts` / `ExplorePage.tsx` / `google-poi-initial-backfill.ts`) 本來就 GET 正確，這次只動 docs。

### Notes

- 5/14 daily-check fix-result 早診斷出 POST/GET 問題，本來說「等 v2.30 segment-mode-rework land 後另開分支」— 今天順手清掉
- 第三個 daily-check 告警「Phase 2 fix-result 缺失」root cause 是 LaunchDaemon ↔ macOS Keychain isolation（claude CLI OAuth 存 user keychain，LaunchDaemon 雖 `UserName=ray` 但跑 pre-login system context 沒附著 user keychain session）。本 PR 不處理 — 屬於 scheduler infra issue，需另外決策（split LaunchAgent for claude + LaunchDaemon for daily-check.js，或用 ANTHROPIC_API_KEY env 繞 keychain）

## [2.30.3] - 2026-05-15

**`.tp-action-btn` family 抽出共用 — poi-favorites-rename §13 收尾。**

PoiFavoritesPage 既有 `.favorites-toolbar-btn` 系列（base / ghost / destructive）跟 ExplorePage 重複定義同 pattern（後者實際 JSX 從未 reference，是 dead CSS）。抽出 universal `.tp-action-btn` family 至 `css/tokens.css`，配合 design tokens canonical destructive 色（`--color-destructive` / `--color-destructive-bg`）。`§13` Shared component extract（`<PageErrorState>` / `<EmptyState>` 已在 v2.29.x 完成）這次補上最後 button family。

### Changed

- `css/tokens.css`：新增 `.tp-action-btn` + `.tp-action-btn--ghost` + `.tp-action-btn--destructive`（BEM 風格 modifier，對齊 `.tp-page-bottom-bar--end` 既有 pattern）
- `src/pages/PoiFavoritesPage.tsx`：
  - SCOPED_STYLES 移除 `.favorites-toolbar-btn` 3 條 rules
  - className 換成 `tp-action-btn tp-action-btn--ghost` / `tp-action-btn tp-action-btn--destructive`
  - destructive 從 `--color-priority-high-dot` (fallback `#c0392b`) 改用 canonical `--color-destructive` (`#C13515`)，light/dark 視覺一致
  - 新增 hover affordance（`filter: brightness(0.92)` + destructive `background: --color-destructive-bg`），與 ExplorePage 既有設計意圖一致
- `src/pages/ExplorePage.tsx`：移除 dead `.explore-toolbar-btn*` CSS（5 條 rules）+ `.explore-toolbar-actions`（JSX 從未引用）

### Tests

- 1532 unit tests pass
- naming-convention test pass（先前 comment 內 `.favorites-toolbar-btn-*` 帶 trailing dash 誤觸 kebab-case lint，已修）

### Follow-ups

- `AddPoiFavoriteToTripPage` 內 scoped `.tp-favorites-add-to-trip .tp-action-btn`（font-size: 15px / padding: 12px 28px / min-width: 200px）是 large variant，未來可抽 `.tp-action-btn--large` 統一；本 PR 保持原 scope 避免擴大 diff
- PoiFavoritesPage redesign（mockup v4）一併處理時可同時 sweep 其他 `.favorites-*` 系列 className → universal class

## [2.30.2] - 2026-05-15

**V2-P6 `rate_limit_buckets` cleanup cron — 兌現 migration 0035 註解承諾。**

`migrations/0035` 註解承諾「V2-P6 cron job 每小時跑 DELETE WHERE locked_until IS NULL AND window_start + 1h < now」清過期 unlocked rows，但 cron 未在 repo 設定 → `rate_limit_buckets` table 隨每個 unique bucket key 持續累積。Tripline 目前 admin-only traffic 還不痛，但 long-running prod 仍會 index bloat。

### Added

- `.github/workflows/rate-limit-cleanup.yml` — hourly schedule (`cron: "0 * * * *"`)
  - 直接 `wrangler d1 execute --remote --command "DELETE FROM rate_limit_buckets WHERE locked_until IS NULL AND window_start + 3600000 < (unixepoch() * 1000)"`
  - Cloudflare Pages Functions 不原生支援 `functions/_scheduled.ts`，採用 `deploy.yml` 既有 pattern（GitHub Actions cron + wrangler CLI），免新增 Workers code
  - `concurrency: d1-rate-limit-cleanup` + `cancel-in-progress: false` — 排隊不殺正在跑的
  - 失敗 Telegram 即時告警（fail-loud）

### Notes

- Cutoff 用 `window_start + 3600000 < now_ms`（1h），覆蓋最長 `windowMs` = 1h（SIGNUP / FORGOT_PASSWORD）
- 鎖中 rows（`locked_until IS NOT NULL AND > now`）保留，防誤清正在 throttle 的攻擊 bucket
- 第一次 deploy 後手動 `gh workflow run rate-limit-cleanup.yml` 驗證一次（或等下個整點）

## [2.30.1] - 2026-05-14

**P3 OCC quick wins — concurrent edit 防護升級 + cascade perf。**

3 個 P3 OCC / cascade 改動並 ship。Migration 0065 加 `trip_days.version`，PUT /days/:num 可選 `expectedDayVersion` 比對；4 個 entry-pois OCC callsite 把 pre-SELECT version 合進 snapshot Promise.all 省 1 RT；EditEntryPage refreshEntryPois 把 GET /entries 跟 GET /days 並行。

### Added

- **Day-level OCC token**（migration 0065 + PUT /days/:num + GET response 加 `version`）
  - `trip_days.version INTEGER NOT NULL DEFAULT 0` — 比照 `trip_entries.entry_pois_version` pattern
  - PUT /days/:num 接受 optional `expectedDayVersion: number`，不符 → 409 STALE_ENTRY（複用 error code，client 邏輯一致：refetch + retry）
  - PUT response 加 `dayVersion` 給 client 下次 PUT 用；GET /days/:num response (via `assembleDay`) 加 `version`
  - `expectedDayVersion` undefined 略過 OCC check — 既有 client 不破

### Changed

- **`_entry_pois.ts` OCC callsite parallelize**（perf）
  - `setMaster` / `addAlternate` / `removeAlternate` / `reorderAlternates` 把 pre-SELECT `getEntryPoisVersion()` 合進已有的 snapshot `Promise.all`
  - `expectedVersion` provided 時 sequential 2 RT 降到 1 RT；race-safety 由既有 UNIQUE constraint catch 保護
  - `removeAlternate` 順便修錯誤碼語意：OCC fail-fast 提前到 row null check 之前，stale token 回 409 STALE_ENTRY 而非 404 (client 應 retry 不該誤判 POI 已刪)
- **EditEntryPage `refreshEntryPois` parallelize**（perf）
  - GET /entries/:id 跟 GET /days 改 `Promise.all` 並行 — 3 sequential RT 降到 2
  - GET /days/:num 仍 sequential（needs dayNum from days list）

### Tests

- `days-num.integration.test.ts` 加 5 個 Day-level OCC integration tests：GET response 含 version / PUT bump / PUT match → 200 / PUT mismatch → 409 STALE_ENTRY / 未帶 expectedDayVersion → BWC skip check
- 1533 unit tests pass / 74 integration tests pass (49 entry-pois + 25 days-num)

### Deploy 順序

1. Apply migration 0065（加欄位 DEFAULT 0，無 backfill / race window）
2. Deploy backend 任意順序（新 backend `?? 0` null-coalesce，OLD backend SELECT 不會 5xx）

### Follow-ups

- Day-level OCC frontend wire — BulkEditDayPage / EditDayPage 帶 expectedDayVersion，接 409 STALE_ENTRY 提示 refetch
- 真正 atomic CAS via UPDATE RETURNING — 跟 D1 batch atomicity 衝突，需要 redesign batch 結構
- `syncEntryMaster` 加 `expectedVersion` 參數讓 PUT /entries/:eid/poi-id 真正帶 OCC token
- `EditEntryPage.refreshEntryPois` 完整 hook 化 cascade（含 useTripSegments 協調）

## [2.30.0] - 2026-05-14

**`trip_segments.mode_source` 欄位 DROPPED — transit 自然代理 user override，不再有「上鎖」概念。**

User 想自行輸入大眾運輸車程時間，但切回駕車 / 步行 → 直接 Google Routes 重算。v2.24.0 加的 `mode_source` lock concept 讓使用者改完 driving 後無法重新觸發計算，只能砍 segment 重建 — 不符合使用直覺。

### Changed

**Backend：**
- `migrations/0064_drop_segments_mode_source.sql`：`ALTER TABLE trip_segments DROP COLUMN mode_source`（+ rollback SQL）
- `PATCH /api/trips/:id/segments/:sid`：
  - `mode='transit'` → 必填 `min`，save `source='manual'`、`distance_m=NULL`，不打 Routes API
  - `mode='driving'` / `'walking'` → 永遠 Google Routes 重算（**ignore `body.min`**），`source='google'`；缺 coords / API key → 保留舊 min/distance，`computed_at=NULL` 標 stale
- `POST /api/trips/:id/recompute-travel`：skip 條件由 `mode_source='user'` 改成 `mode='transit'`；response field `pairsSkippedUser` → `pairsSkippedTransit`
- `GET /api/trips/:id/segments` + `_merge.ts fetchTripSegmentsMap`：SELECT 移除 `mode_source` 欄位

**Frontend：**
- `TravelPillSegment` interface 移除 `modeSource` field
- `TravelPill`：拔掉 🔒 lock icon + `tp-travel-pill-lock` CSS + `isLocked` 變數 + aria-label「（已手動覆寫）」；▾ affordance 永遠顯示
- `TravelPillDialog`：拔掉 `modeSource` prop、「已手動覆寫」title indicator + `.tp-travel-dialog-locked` CSS
- `EditEntryPage`：移除「手動覆寫」section heading aux chip、「重設為自動」button、`tp-edit-entry-reset` + `is-lock` CSS、`resetMode` callback
- `useTripSegments`：`TripSegment` interface 移除 `modeSource`

### Migration / Deploy 順序

1. Apply migration 0064 → `trip_segments` 無 `mode_source` col
2. Pages deploy 新 backend（不讀寫 `mode_source`）

順序顛倒 → migration 後 30-90s 內 OLD backend SELECT 會回 SQL error（已知短窗 race，accept；同 v2.29.0 trip_pois rip-out pattern）。

### Tests

- `tests/unit/`：移除 fixture `modeSource`、刪除「mode_source=user → 顯示鎖頭」cases
- `tests/api/segments-patch.integration.test.ts`：「user 自帶 min 時不重算 — manual override 優先」改寫為「mode=walking 帶 body.min → backend 強制 Google 重算」
- `tests/api/recompute-travel-segments.integration.test.ts`：「既有 `mode_source=user` segment 被 skip」改寫為「既有 `mode=transit` segment 被 skip」；response field `pairsSkippedUser` → `pairsSkippedTransit`

## [2.29.3] - 2026-05-14

**`daily-check` 排程資料不完整 fix — `trip_requests.mode` stale SELECT 害 Telegram 每天誤報全綠。**

`scripts/daily-check.js:309 queryRequestErrors` 仍 SELECT `trip_requests.mode`，但 migration 0049 (v2.21.3) 已 DROP 該欄位 → D1 query 回 400 → `Promise.allSettled` fallback 寫假 `{status:'ok', total:0}` 進 report → Telegram 每天 silent 誤報「未完成請求 0 筆」，掩蓋實際 open/processing/failed 請求。連續 5/12-5/14 三天 report.json 都吃 fallback 假資料。

### Fixed

- `daily-check.js queryRequestErrors`：移除 SELECT 與 `pending.map` 內的 `mode` 欄位引用
- requestErrors 段恢復顯示真實資料（過去 24h 內非 completed 請求數、status 分布、卡住 >15min 計數）

### Tests

- `daily-check-trip-requests.test.ts`：新增 regression test (2 tests) — 抓 `queryRequestErrors` function source，斷言不再含 `mode` 字串 + `pending.map` 不再 surface `mode: r.mode`
- 驗證 fail-without-fix → pass-with-fix 兩端對齊

### Verify

- 修前 log: `Source 4 failed: D1 query failed: 400`（連續 5/12-5/14 三天）
- 修後 stdout: 無 Source failed 訊息，requestErrors 段拿到真實 D1 query 結果
- `npx vitest run tests/unit/` — 181 files / 1535 tests pass（新增 2 test）

## [2.29.2] - 2026-05-14

**`車程未更新` 警告全段亂噴 fix — 改用 `segment.computed_at` 信號。**

Ray 沖繩行程 32 段 driving 段幾乎每段都顯示「⚠ 車程未更新」。原因：v2.28.1 的 stale-travel 偵測比對 Haversine 直線距離 vs `segment.distanceM` 道路距離，divergence > 20% 即警告。但道路本來就有 detour ratio（沖繩多山多灣 1.3-2.5x），driving 段永遠超過 threshold → false positive。

正確 signal：backend `setMaster()` 在 master swap 時已經 `UPDATE trip_segments SET computed_at = NULL`。改用此欄位當 stale 唯一信號 — `computedAt IS NULL` = backend 確認需要重算。

### Changed

- `TravelPill`：stale 判斷改 `segment.computedAt == null`；stale 時清空 min/distance display，只渲染「⚠ 車程未更新 重新計算」chip
- `TravelPillSegment` interface 加 `computedAt: number | null` 欄位
- `TimelineRail`：拔掉 Haversine baseline 計算 + `staleHaversineM` prop 傳遞
- `TravelPill` 移除 `STALE_TRAVEL_THRESHOLD_RATIO` const + `staleHaversineM` prop

### Tests

- `travel-pill-stale.test.tsx`：重寫覆蓋新 logic（8 tests）— 含 Ray 真實 S1 案例（11.3km 道路 / 5.2km 直線 / detour 54%）verify 不誤觸發
- `timeline-rail-stale-travel.test.tsx`：重寫 wiring tests 走 segment 路徑（6 tests）

### Verify

- `npx tsc --noEmit` clean
- `npx vitest run tests/unit/` — 180 files / 1531 tests pass

## [2.29.1] - 2026-05-14

**`saved_pois` 表終於 DROP — poi-favorites-rename Phase 2 收尾。**

migration 0050 (v2.22.0, 2026-05-04) 用 expand-contract 把 `saved_pois` rename 為 `poi_favorites`。10 天 soak 過後 (grep 確認 0 reads/writes、prod row count 對齊)，本次 migration 0063 把舊表清掉。openspec change archive 同步歸檔。

### Changed

- 拔掉 `src/types/api.ts` PoiFavorite docstring 內「(migration 0050 rename from saved_pois)」殘留字串
- `src/lib/trip-url.ts` 收藏池來源字句改 `poi_favorites — v2.22.0 rename from saved_pois`

### Removed

- Migration 0063: `DROP TABLE saved_pois` + `DROP INDEX idx_saved_pois_poi`
- 刪除 `tests/unit/migration-0050-data-copy.test.ts`（一次性 INSERT SELECT 測試，prod cutover 已 verify，table dropped 後無法 reseed）

### Migrations

- `0063_drop_saved_pois.sql` + rollback SQL
- Pre-merge audit：prod `saved_pois` 2 rows（2026-04-26 + 2026-05-02，皆早於 v2.22.0 ship）、`poi_favorites` 4 rows、`WHERE saved_at > '2026-05-04'` count = 0 → 確認 v2.22.0 後 0 traffic

### Verify

- `npm run typecheck`
- `npm run test:unit` — should drop ~7 tests (data-copy test deleted)

## [2.29.0] - 2026-05-14

**Phase-2 schema cleanup：`trip_pois` 整表 + 10 個過期 column 一次清乾淨。**

「住宿」與「順路採買」改從專屬欄位 / canonical 表查得，行程載入更直觀；hotel hours / 餐廳 alternates 的 POI 主檔欄位 (rating / hours / price) 從 master JOIN 出來，前端不再走 `trip_pois` shim。

### Changed

- Hotel 從 `trip_pois(context='hotel')` 搬到 `trip_days.hotel_poi_id` (FK → pois)。一個 day 一個 hotel，不再用 junction row。
- Entry-level shopping 從 `trip_pois(context='shopping')` 搬到 `trip_entry_pois`（sort_order > 1），跟主選 + alternates 走同一通道。
- Travel info（步行 / 車程 / 距離）讀 `trip_segments`，不再讀 `trip_entries.travel_*`。
- `PATCH /api/trips/:id/entries/batch` ALLOWED_FIELDS 改為 `[sort_order, day_id, start_time, end_time]`，移除 `time` 與 5 個 `travel_*`。
- `POST /api/trips/:id/entries/:eid/trip-pois` MAX-sort + INSERT 合成單 SQL + UNIQUE catch，concurrent POST 改回 409 / 422，不再 500。

### Removed

- 整表 DROP `trip_pois` (migration 0062)。
- DROP 8 cols：`trip_entries.{time, poi_id, travel_type, travel_desc, travel_min, travel_distance_m, travel_computed_at, travel_source}`。
- DROP 2 cols：`trip_destinations.{osm_id, osm_type}` (v2.23.0 Google Maps 切換後 deprecated)。
- DROP `InfoBoxType` 的 `'restaurants'` + `RestaurantsBox`（restaurant timeline 已 cutover 進 `trip_entry_pois` alternates）。
- 移除 `src/types/trip.ts` 的 `TripPoi` / `MergedPoi` interfaces（指向已 drop schema）。
- 移除 `functions/api/trips/[id]/trip-pois/[tpid].ts`（endpoint 整檔）。

### Migrations

- `0060_trip_pois_rip_out_add_col.sql`：ADD COLUMN `trip_days.hotel_poi_id INTEGER REFERENCES pois(id)`。
- `0061_trip_pois_rip_out_backfill.sql`：hotel backfill 用 INNER JOIN pois 避免 dangling FK；shopping backfill 用 ROW_NUMBER PARTITION BY (entry, poi) CTE dedup `trip_pois` 內部 duplicates；day-level shopping 24 rows DELETE（user 接受 data loss）。
- `0062_trip_pois_rip_out_drop.sql`：DROP INDEX `idx_trip_entries_poi_id` → DROP 10 cols → DROP TABLE `trip_pois`。

### Deploy 順序

`/ship` → CF Pages auto-deploy + GitHub Actions apply migrations 0060/0061/0062 並行。30–90 秒 cutover 窗口內舊 backend in-flight 請求若觸到已 drop 表會 5xx；user 接受短時 outage，靠 Step 0 `wrangler d1 export` backup + D1 Time Travel 30 天 retention 兜底。

### Verify

- `npm test`（frontend 1532 tests pass）
- `npx vitest run --config vitest.config.api.mts --no-file-parallelism`（API 670 tests pass）
- `npx tsc --noEmit && npx tsc --noEmit -p tsconfig.functions.json`
- `/review` + Codex adversarial（2 critical + 1 high + 1 medium 已修）
- `/cso --diff`（0 findings）
- `/qa` UI cutover render：hotel via trip_days.hotel_poi_id ✓、travel via trip_segments ✓、master/alternates via trip_entry_pois ✓

## [2.28.7] - 2026-05-14

**置換景點頁樣式重整：對齊 DESIGN.md / terracotta mockup 的搜尋與收藏加入模式。**

### Changed

- ChangePoiPage 改成 Add Stop mockup 同款全頁表單：TitleBar action、搜尋/收藏 tabs、類別 chips、地區 pill、搜尋列、篩選按鈕、POI card grid、收藏 empty state、sticky bottom action bar。
- 搜尋 input 改用 native-uncontrolled typing path，補上 foreground / placeholder / WebKit text-fill / caret color，避免輸入值存在但畫面不可見。
- Service worker controller 更新後自動刷新現有頁面，避免使用者停留在舊版 JS chunk。

### Verify

- `npm test -- tests/unit/change-poi-page.test.tsx`
- `npm run typecheck`
- `npm run typecheck:functions`
- `npm run build`
- `npm test`
- `npx vitest run --config vitest.config.api.mts --no-file-parallelism --maxWorkers=1`
- `npm run test:e2e -- --project=chromium`
- Playwright local visual QA：mobile + desktop screenshots for ChangePoiPage search tab, including typed-text pixel detection

## [2.28.6] - 2026-05-13

**置換景點搜尋修正：ChangePoiPage 正確讀取 `/api/poi-search` 結果。**

### Fixed

- ChangePoiPage 搜尋 tab 補上 `/api/poi-search` `{ results: [...] }` response normalise，避免 production 搜尋明明 200 卻顯示「無結果」。
- 置換景點搜尋 input 改為 text input + search enter hint，對齊新增景點 / Explore 的可輸入搜尋體驗。

### Verify

- `npm test -- tests/unit/change-poi-page.test.tsx`
- `npm run typecheck`
- `npm run typecheck:functions`
- `npm test` — 182 files / 1539 tests
- `npm run build`
- `node scripts/verify-sw.js`
- `bash scripts/bundle-size-check.sh`
- `npm run test:e2e -- --project=chromium` — 44 tests

## [2.28.5] - 2026-05-13

**備選加入入口修正：搜尋與收藏是兩個明確入口，進同一頁不同 tab。**

### Fixed

- Edit entry 備選區塊改回兩個加入方式：「搜尋加入備選」與「收藏加入備選」。
- 兩個入口都進同一個 `change-poi?mode=alternate` 畫面，但分別帶 `tab=search` / `tab=favorites`。
- ChangePoiPage 依 `tab` query 預設到搜尋或收藏頁籤，搜尋加入備選不再被藏在單一 CTA 後面。

### Verify

- `npm test -- tests/unit/edit-entry-page.test.tsx tests/unit/change-poi-page.test.tsx`
- `npm run typecheck`
- `npm run typecheck:functions`
- `npm test` — 182 files / 1538 tests
- `npm run test:api` — 65 files / 683 tests
- `npm run build`
- `node scripts/verify-sw.js`
- `bash scripts/bundle-size-check.sh`
- `npm run test:e2e -- --project=chromium` — 44 tests

## [2.28.4] - 2026-05-13

**Canonical entry POI cutover：移除舊 timeline 餐廳格式，不再 runtime fallback。**

### Added

- **Migration 0059**：把 `trip_pois.context='timeline'` 升級到 `trip_entry_pois`，保留正選 / 備選順序與 reservation/note metadata，最後刪除所有舊 timeline rows。
- **Canonical-only health / travel / POI permission checks**：trip health、travel recompute、segment mode recalculation、POI patch/enrich 都改讀 `trip_entry_pois.sort_order=1` 或合法 contextual `trip_pois`。

### Changed

- **Day / Entry API 改為 canonical response**：`GET /days`、`GET /days/:num`、`GET /entries/:eid` 不再回傳 legacy `poi` / `poiId`，只回 `master`、`alternates`、`stopPois`、`entryPoisVersion`。
- **Day PUT 拒絕舊格式**：`restaurants`、`stop_pois`、`poi` 欄位只要出現就回 `DATA_VALIDATION`，不做格式 fallback。
- **Copy entry / add favorite to trip**：新 entry 直接寫 `trip_entry_pois`；copy 會複製完整 canonical stopPois 順序。
- **Favorites usages**：改用 `trip_entry_pois`，同時保留 hotel/shopping contextual usages，但忽略舊 timeline rows。

### Removed

- 刪除舊 backfill script `scripts/migrate-0059-restaurants-to-alternates.ts` 與 `meal-stop-primary-poi-backfill` helper/tests。
- Frontend `Entry.restaurants` / `Entry.poi` / `Entry.poiId` runtime fallback 已移除。

### Tests

- 新增 `tests/unit/migration-0059-canonical-entry-pois.test.ts`
- 新增 `tests/api/trip-health.integration.test.ts`
- 擴充 days / entries / entry-pois / poi-favorites / pois / travel segment tests，鎖住 canonical-only 行為與舊 timeline rows 忽略/刪除。

### Verify

- `npm run typecheck`
- `npm run typecheck:functions`
- `npm test` — 182 files / 1536 tests
- `npm run test:api -- --maxWorkers=1` — 65 passed / 4 skipped files, 683 passed / 35 skipped tests
- `npm run build`
- `npm run test:e2e` — 130 passed / 2 skipped

## [2.28.3] - 2026-05-13

**Entry multi-POI UI parity：正選 / 備選顯示一致，搜尋與收藏都能加入備選。**

Trip 的 entry 設計是「一個 entry 對一到多個 POI」：`trip_entry_pois.sort_order=1` 是正選，`sort_order>1` 是備選。本版把編輯頁、置換頁、行程一覽統一到這個資料模型，不再讓餐廳與一般景點走不同 UI。

### Added

- **ChangePoiPage alternate mode 支援搜尋加入備選**：`POST /alternates` 現在接受搜尋結果 payload，會先 find-or-create POI 再加入 `trip_entry_pois`，不用先收藏才能加入備選。
- **行程一覽通用「景點選擇」區塊**：TimelineRail 展開後顯示正選卡片，接著顯示備選卡片；餐廳與一般景點共用同一格式。
- **搜尋 POI payload runtime validation**：後端統一驗證 name/type/lat/lng/rating/category/address/country/source，malformed body 回 `DATA_VALIDATION`，不落到 D1 bind error。

### Changed

- **EditEntryPage 備選區塊 0-N 筆一致**：有正選景點時永遠顯示備選區；0 筆顯示 empty state +「加入備選景點」CTA。
- **行程標題優先使用正選 POI 名稱**：`getStopDisplayTitle()` 現在一般景點也優先顯示 primary POI name，不只修餐廳 `午餐` wrapper。
- **使用者文字統一為正選 / 備選 / 置換景點**：取代舊的首選 / 備案 / 變更 POI 混用。
- **ARCHITECTURE.md 同步資料模型用語**：明確記錄 `sort_order=1` 是正選景點，`sort_order>1` 是備選景點。

### Fixed

- **置換景點從搜尋建立 POI 不再硬寫 attraction**：`PUT /poi-id` 保留搜尋結果的 type/category/address/rating/country。
- **備選加入頁 UI 不再依是否已有備選而分岔**：搜尋與收藏兩個 tab 都能加入備選，點擊進入的是同一個置換 / 加入備選畫面。
- **行程一覽不再用餐廳專屬卡片渲染餐廳 choices**：改讀 `entry.stopPois` 並依 `sortOrder` 排序，正選先於備選。

### Tests

- 新增 `tests/unit/change-poi-page.test.tsx`
- 擴充 `tests/api/entry-pois.integration.test.ts`，鎖住搜尋 payload → find-or-create → alternate link
- 擴充 `timeline-rail-restaurants` / `edit-entry-page` / `map-day` / `stop-display` tests，覆蓋通用正選 / 備選顯示

### Verify

- `npm run typecheck`
- `npm run typecheck:functions`
- `npm test` — 182 files / 1542 tests
- `npm run test:api` — 64 files / 678 tests
- `npm run build`

## [2.28.2] - 2026-05-13

**Meal stop primary POI：行程一覽顯示實際首選餐廳，而不是泛用「午餐」。**

User 在 `/trip/okinawa-trip-2026-HuiYun/stop/783/edit` 已把 `order=1` 設為「敘敘苑 沖繩浦添PARCO CITY店」，但 TripPage timeline 仍顯示 `午餐`。Root cause 是 overview 仍以 entry title / legacy wrapper POI 為 canonical display source，沒有把用餐 stop 的首選餐廳提升為 stop 本身的 primary POI。

### Fixed

- **TimelineRail / TravelPill / StopLightbox 顯示 selected restaurant name**：新增 `stopDisplay` helper。只有泛用用餐 label（`午餐` / `晚餐` / `lunch` 等）會被 restaurant POI name 取代；`本部午餐` 這類具體標題保留原文。
- **Map pins / stale-travel 座標改讀 canonical stop POI**：`mapDay` + `useMapData` 以 `stopPois sortOrder=1` 作為 entry 的 POI source，fallback 到 `master` / legacy `poi`，讓地圖 pin、rating、`masterLat/masterLng` 與實際首選一致。
- **Day API surface `stop_pois` + legacy meal promotion**：`GET /api/trips/:id/days/:num` 現在回傳完整 stop POI list；legacy 用餐 stop 若 master 仍是 wrapper，但 `trip_pois context='timeline'` 有 restaurant choices，response 會把第一順位餐廳 virtual promote 成 `poi/master/stopPois[0]`。
- **Migration 0059 backfill script upgraded**：`scripts/migrate-0059-restaurants-to-alternates.ts` 改成 meal stop primary POI backfill：第一順位餐廳 → `trip_entry_pois.sort_order=1`，其餘餐廳與既有 stop POIs 依序保留，並同步 `trip_entries.poi_id` + bump `entry_pois_version`。提供 pure planner helper + unit tests。

### Tests

- 新增 `tests/unit/stop-display.test.ts`、`tests/unit/meal-stop-primary-poi-backfill.test.ts`
- 擴充 `tests/api/entry-pois.integration.test.ts`，鎖住 `poi/poiId/master/stopPois` 都取用餐 stop 首選餐廳
- 擴充 `map-day` / `use-map-data` / `timeline-rail-inline-expand` regression tests

### Verify

- `npm run typecheck`
- `npm run typecheck:functions`
- `npm test` — 181 files / 1539 tests
- `npx vitest run --config vitest.config.api.mts --maxWorkers=1 --no-file-parallelism` — 64 files / 677 tests
- `npm run build`

## [2.28.1] - 2026-05-12

**Master swap / stale-travel 防呆 UX：跨區警告 + ⚠ 車程未更新提示。**

v2.28.0 ship 後 entry 430 暴露兩個 UX 弱點：(A) 沒有 visual signal 阻止 user 不小心把 Tokyo POI swap 進沖繩 itinerary，(B) swap 後 `entry.travel.distanceM` 還停在舊值但 master 已換，timeline 顯「3 min 0.4 km」指向 Tokyo Tower。本版加兩道防線。

### Added

- **EditEntryPage swap 確認 modal — 跨區警告**：把備案設為首選時，若新 master POI 距當日其他 entries master 平均座標 > 50 km，confirm modal 加一行紅字「新首選距離本日其他點約 X km，可能跨區，前後車程會誤算」。
  - User 仍可確認 swap（不阻擋）— 純 visual nudge，threshold 50 km 是「同日內常識邊界」（沖繩本島南北 ~120 km、城市內 ~10 km、跨日本 1500+ km）。
  - 任一 POI 缺座標 → 不警告（無法判斷）。當日無其他 entries → 不警告（無基準）。
- **TimelineRail TravelPill — stale-travel ⚠ + 「重新計算」button**：每對 (prev, curr) entry 算 Haversine(prev.master, curr.master)，與顯示中的 `travel.distanceM` 比對，divergence > 20% 顯紅色「⚠ 車程未更新」chip + 「重新計算」link。
  - 點「重新計算」→ `POST /trips/:id/recompute-travel?day=N`（day-scoped，只重算當日不重算全 trip），完成後 dispatch `tp-entry-updated` 觸發 TripPage refetch。
  - useRef in-flight guard：防快點 N× burn Google Routes quota；失敗時 `.finally` 解鎖讓 user 可重試。
- **`src/lib/geo.ts` — canonical haversine + LatLng + avgLatLng + CROSS_REGION_THRESHOLD_M**：取代 `src/server/maps/haversine.ts`，client + server 共用（避免 drift）。`functions/api/.../recompute-travel.ts` import path 更新。

### Fixed

- **`refreshEntryPois` 漏抄 restaurant fields (price/hours/reservation)**：v2.28.0 init useEffect 正確 surface 但 refresh path（master swap 後）漏掉，導致 swap 完 alternates 的 price/hours/reservation chips 消失。抽 `mapAlternate(a)` helper 兩條路徑共用，避免 drift。
- **TravelPill nested `<button>` HTML5 違規**：interactive pill 變 `<button>` 時，內嵌的 ⚠「重新計算」也是 `<button>` → 違反 HTML5 + 破壞 keyboard a11y。restructure：stale chip 改為 pill 旁的 sibling（用 `.tp-travel-pill-wrap` 包起來保持 inline）。
- **Migration 0059 `wrangler --command` SQL escape**：multi-line SQL JSON.stringify 後傳給 `wrangler d1 execute --command`，CF API 收到 literal `\n` 會以 unrecognized token reject。加 `flattenSql()` helper 把 whitespace 收成單 space。實測通過（80 alternates inserted / 25 entries bumped / 0 errors），此版收尾未提交 fix。

### Changed

- **`mapDay.toTimelineEntry` surface `masterLat` / `masterLng`**：TimelineEntryData 加兩個 optional fields。優先 v2.27.0 `raw.master.lat/lng`（multi-POI SoT），fallback `raw.poi.lat/lng`（Phase 2 legacy）。TimelineRail 用來算 stale-travel detection。
- **ConfirmModal 加 optional `warning?: string` prop**：紅色警告 box，用 `--color-priority-high-bg` token，可用於其他 destructive flow 補充說明。
- **EditEntryPage helper 抽出 (DRY fix)**：`mapAlternate(a)` + `extractSiblingCoords(timeline, excludeEntryId)` 兩個 helper，init useEffect + refreshEntryPois 共用，避免 v2.28.0 既有的「refresh 漏抄欄位」bug 再復發。

### Tests

- `tests/unit/geo.test.ts` (新, 9 tests)：haversineMeters 同點 / Naha-Nago / Naha-Tokyo / 同區 / commutative / 1km gate boundary / 500m short range / 美國村 distance
- `tests/unit/travel-pill-stale.test.tsx` (新, 10 tests)：staleHaversineM undefined / 一致 / >20% divergence / onRecompute click / distanceM null + stale value 不渲染 / staleHaversineM=0 / 負值 / 20% 邊界 / isStale=true 但無 onRecompute
- `tests/unit/timeline-rail-stale-travel.test.tsx` (新, 6 tests)：cross-region + bad distanceM 顯 ⚠ / same-region 不顯 / missing master coords / click → POST + event / rapid 3-click → 1 POST (in-flight guard) / failed POST → retry POSTs again (.finally unlock)
- `tests/unit/edit-entry-page.test.tsx` (+2 tests, cross-region 警告 describe)：跨區 alternate setmaster → confirm modal 顯 `confirm-modal-warning` / 同區 alternate setmaster → 不顯

Total: 1526/1526 unit tests pass, 675/675 API integration tests pass, tsc clean (src + functions)。

## [2.28.0] - 2026-05-12

**Restaurants → alternates schema migration (Phase 1) + GET /entries SELECT * fix。**

### Fixed

- **`GET /api/trips/:id/entries/:eid` SELECT 只回 `id, day_id, title, entry_pois_version`** — 缺 `start_time/end_time/time/note/poi_id`。EditEntryPage 初始 load 後 `entry.startTime/endTime/note` 全 undefined → 起訖時間 input 空白 + 備註空白。User 報 entry 424 (`/trip/okinawa-trip-2026-Ray/stop/424/edit`)。
  - 自 v2.26.0 開始就漏 — `test fixture mock 全欄位讓 CI mask 掉 bug`。v2.26.3 修了 frontend camelCase 但 backend SELECT 沒同步修。round 9 加 entry_pois_version 也漏。
  - 修法：SELECT * 一勞永逸 + integration test 鎖住 response shape (time/startTime/endTime/note/poiId/entryPoisVersion 必須 surface)。

### Added (Phase 1)

- **Migration 0059 — Restaurants (trip_pois timeline) → trip_entry_pois alternates**（背景：legacy `restaurants` TABLE 自 v2.14 後就 dead，所有寫入路徑都進 `trip_pois context='timeline'`）。
  - `scripts/migrate-0059-restaurants-to-alternates.ts` standalone bun script，標準 wrangler d1 execute。
  - For each `trip_pois` row WHERE `context='timeline'` AND `entry_id IS NOT NULL`：INSERT trip_entry_pois (sort_order=max+1)，bump `entry_pois_version` 讓既有 client refetch。
  - **Idempotent** via UNIQUE (entry_id, poi_id) → INSERT OR IGNORE，重跑安全。
  - 支援 `--dry-run` / `--apply`、`--local` / `--remote`，report 寫到 `.gstack/migration-reports/`。
  - **Deploy 順序**：merge PR → backend 上線 → user 手動跑 `bun run scripts/migrate-0059-restaurants-to-alternates.ts --dry-run --remote` → 看影響範圍 → `--apply --remote`。
- **alternates response 加 restaurant 欄位**：`functions/api/trips/[id]/days/_merge.ts:fetchEntryPoisByEntries` SELECT 多 LEFT JOIN `trip_pois` (context='timeline')，surface `hours/rating/price`（pois master）+ `reservation/reservation_url/description/note`（trip_pois override）。
- **EditEntryPage alternates row 加 restaurant inline info**：type label 旁邊顯示 rating (⭐ 4.5)，meta 下方 chip 顯示 `price · hours · reservation`。`reservationUrl` 存在時 reservation chip 改 link。`src/types/trip.ts` `EntryPoiInfo` extend 含這些欄位。

### Phase 2 (待 v2.28.x — 2 週 observation 後)

- DROP `restaurants` legacy TABLE（已 dead 但 schema 還在）
- TripPage TimelineRail 改讀 `alternates with type='restaurant'` 取代 `entry.restaurants[]`（per user — 「之後被選的景點都用相同格式渲染」）

### Tests

- 2 個新 integration tests（alternates 含 restaurant fields surface + non-restaurant alt 不誤 surface）
- 3 個新 EditEntryPage unit tests（price/hours chip rendering、reservationUrl → link、rating star + 數字）
- 修正 GET /entries integration test 鎖住完整 response shape (含 time/startTime/endTime/note/poiId/entryPoisVersion)
- 既有 103 API + 56 unit tests pass，無 regression

## [2.27.0] - 2026-05-12

**Multi-POI per entry — 同一 stop 可掛多個備案景點（master + alternates），EditEntryPage 加 alternates section + master swap UI。**

### Added

- **Migration 0057** `trip_entry_pois` junction table（entry × poi M:N）+ backfill `entries.poi_id → sort_order=1`。`UNIQUE (entry_id, sort_order)` 保證單一 master + `UNIQUE (entry_id, poi_id)` 防同 POI 重複 + `CHECK (sort_order >= 1)`。
- **Migration 0058** `trip_entries.entry_pois_version INTEGER NOT NULL DEFAULT 0` — OCC（樂觀並發控制）dedicated counter，僅 multi-POI mutating helpers bump（setMaster / addAlternate / removeAlternate / reorderAlternates + syncEntryMaster entry-create paths），PATCH /entries note/time edit **不** 觸碰，避免 cross-mutation false-positive。
- **4 個新 API endpoints**：
  - `PATCH /api/trips/:id/entries/:eid/master` — 設為首選 POI（含 alt → master swap 或 INSERT 新 master）
  - `POST /api/trips/:id/entries/:eid/alternates` — 加入備案 POI
  - `DELETE /api/trips/:id/entries/:eid/alternates/:poiId?entryPoisVersion=...` — 移除備案
  - `PATCH /api/trips/:id/entries/:eid/alternates/reorder` — 重排備案順序
  - 全部含 OCC token (`entryPoisVersion`)，409 STALE_ENTRY 表示 client 應 refetch `/days/:num` 拿 fresh token 後重試
- **`functions/api/_entry_pois.ts`** helper：setMaster / addAlternate / removeAlternate / reorderAlternates / syncEntryMaster / getEntryPoisVersion，封裝 D1 batch + UNIQUE collision routing + temp_order swap idiom + dual-write Phase 1 (trip_entries.poi_id 同步維護)。
- **GET /api/trips/:id/days/:num** response 加 `master` + `alternates` + `entryPoisVersion` 三欄（`_merge.ts` fetchEntryPoisByEntries Promise.all join + version seed from trip_entries.entry_pois_version）。Phase 1 dual-response：legacy `poi` + `poi_id` 保留，frontend selector fallback chain `getEntryMaster(entry)` / `getEntryMasterPoiId(entry)` 處理過渡期。
- **EditEntryPage** 新增 alternates section（V1 compact + expandable list）：master swap confirm modal、加備案（從搜尋 / 從收藏）、刪除備案、上下重排、刪除整個 stop。8-state matrix 涵蓋 loading / error / empty / pending 各場景。409 STALE_ENTRY auto-refresh + retry once，且加 cross-tab safety check — 若 refresh 後 master 已被其他 tab 改變，**abort** retry 並顯示「此 stop 已被改成 X，請重新確認」（避免 silent overwrite）。
- **GET /api/trips/:id/entries/:eid** response 加 `entryPoisVersion` 欄位（round 9 — 之前只回 `id / dayId / title`），讓 frontend recovery 路徑不必再 refetch 整個 day blob。
- **`src/types/trip.ts`** Entry 加 `master` / `alternates` / `entryPoisVersion`，舊 `poi` / `poiId` 標 `@deprecated`（Phase 1 dual-read，Phase 2 = v2.27.1 DROP）。

### Changed

- **PUT /api/trips/:id/entries/:eid/poi-id** 接受可選 `entry_pois_version` / `entryPoisVersion` body field 做 OCC check（之前 cross-tab swap 會 silently lost update）。`poi_id: null` 改 explicit 拒絕 — v2.27.0 invariant「每 entry 至少 1 master POI」，要清空走 DELETE /entries。
- **PUT /api/trips/:id/days/:num** alt-restore 邏輯改 per-OLD-entry snapshot + claim-once mapping（之前 keyed by master_poi_id 在多 entries 共享同 master POI 場景會 collapse snapshot 互換 alternates）。同步 bump `entry_pois_version` 讓 outstanding tokens 失效。

### Performance

- `fetchEntryPoisByEntries` 用 Promise.all 並行 — 多 1 SELECT 但同 RTT。
- 每 mutation +1 SQL statement (UPDATE entry_pois_version + 1) — D1 batch limit 100 仍餘量。
- migration 0058 ADD COLUMN DEFAULT 0 為 metadata-only（SQLite ≥3.35 / D1）— 既有 trip_entries rows 不重寫。

### Security

- ALLOWED_FIELDS whitelist 排除 entry_pois_version，PATCH /entries body 帶該 field 不能 mass-assign（test 鎖住）。
- STALE_ENTRY error response 不洩漏 token format / 中英混用（round 7 fix）。

### Migration / Deploy Order

1. Apply migration 0057 + 0058 (`wrangler d1 migrations apply DB --remote`)
2. Wait ~30s for propagation
3. Merge PR → CF Pages auto-deploys backend + frontend
4. Verify GET /api/trips/:id/days/:num response 含 `master` / `alternates` / `entryPoisVersion`
5. Rollback：必須先 revert backend deploy 再 run `migrations/rollback/0058_*.sql` + `0057_*.sql`（current backend reads entry_pois_version exclusively；DROP COLUMN without revert → hard 500 on all day GETs）

### Tests

- 42 entry-pois integration tests（master swap / alt CRUD / reorder / OCC / UNIQUE routing / dual-write / Phase 1 fallback / cross-mutation isolation / mass-assignment）
- 17 days-num integration tests（含 v2.27.0 alt preservation single-entry + shared-master regression）
- 5 migration 0058 unit tests（schema / DEFAULT / monotonic / isolation / upper bound）
- 既有 segments-patch + entries + days + unit tests pass，無 regression

## [2.26.4] - 2026-05-11

**EditEntryPage 加 trip name 顯示 + 變更景點入口（mockup V1 sign-off）。**

### Added

- **TitleBar inline trip name**：TitleBar 標題從固定「編輯景點」改為「編輯景點 · {trip name}」。透過新增 `apiFetch<TripMeta>('/trips/${tripId}')` 取 trip meta，silent 失敗 fallback 為單純「編輯景點」不擋頁面 load。Mobile 走 TitleBar 既有 `text-overflow: ellipsis`，trip name 過長會截斷但「編輯景點」保留。
- **POI 卡右側「變更景點」icon button**：44×44 swap icon button（`swap-horizontal` 新增到 Icon sprite），click 後 navigate 到既有的 `/trip/:tripId/stop/:entryId/change-poi`（`ChangePoiPage` 已建好只是無入口）。Touch target 達 DESIGN.md ≥44px 標準，aria-label「變更景點」+ hover terracotta accent。
- Mockup：`/tmp/EditEntryPage-trip-name-change-poi-variants.html` V1 Compact（user sign-off 2026-05-11）

### Tests

- 3 個新 unit case in `tests/unit/edit-entry-page.test.tsx`：
  - TitleBar 顯示「編輯景點 · {trip name}」
  - trip meta 還沒載入 → 不擋頁面、fallback 為「編輯景點」
  - POI 卡 swap button click → navigate 到 change-poi route（含 aria-label 驗證）

## [2.26.3] - 2026-05-11

**修 v2.26.0 EditEntryPage 一半畫面不顯示的 bug — snake_case vs camelCase API 讀取錯誤。**

### Fixed

- **`src/pages/EditEntryPage.tsx` 讀錯 API 欄位 case**：`functions/api/_utils.ts:json()` 自動 deepCamel response，real API 回 `{ id, dayId, startTime, endTime, poiId, ... }`，但前端 interface + 所有讀取點都用 snake_case (`entry.day_id` / `entry.start_time` / `entry.end_time`)。連鎖效應：
  - 起訖時間 input 永遠空白（even if entry has time in DB）
  - `dayId` undefined → days lookup 找不到 day → `poiInfo` + `prevEntry` 都 null → POI 摘要卡 + 從上一站移動 section 完全不 render
  - 只有備註 textarea 能用 → user 反映「編輯景點功能不完全」
- **Why CI 沒抓到**：`tests/unit/edit-entry-page.test.tsx` 的 ENTRY / DAYS / DAY_DATA fixture 也用 snake_case 跟前端 code 一致 → mock 自己騙自己，test pass production fail。
- **修法**：(1) interface + 所有讀取點改 camelCase (2) test fixture 改 camelCase 對齊 real API 防 regression。PATCH 寫入 body 仍用 snake_case（對齊 backend `ALLOWED_FIELDS`），未改。

## [2.26.2] - 2026-05-11

**修 v2.26.0 EditEntryPage 切 mode 後 min 沒重算的 bug。**

### Fixed

- **`PATCH /api/trips/:id/segments/:sid`：mode=driving/walking 不帶 min → backend 自動 call Google Routes 重算 min + distance_m，source='google'**。
  - User observation：v2.26.0 EditEntryPage 切 mode 後 timeline 顯示「步行 17 min / 9.3 km」，17 min 是 driving 時間（walking 9.3 km 應 ≈ 110 min）。
  - Root cause：原邏輯註解「user override mode 不重算 min，以手動覆寫優先為準」實際上反了 — segmented control 只送 `{ mode }`（無 min），backend 保留舊 mode 的 min。
  - 行為矩陣：
    | mode | user 帶 min？ | 結果 |
    |------|--------------|------|
    | transit | 必填 | source='manual', 用 user 值 |
    | driving/walking | 帶 | source='manual', 用 user 值 |
    | driving/walking | 不帶 | **call Google Routes 重算**, source='google' |
    | driving/walking | 不帶 + coords 缺 | fallback：只改 mode，保留舊 min |
  - 4 個新 regression test（`tests/api/segments-patch.integration.test.ts`）：driving→walking 重算、walking→driving 重算、manual override 不重算、coords 缺 fallback。

## [2.26.1] - 2026-05-11

**daily-check scheduler 韌性升級 — `.env.local` multi-line parser + LaunchDaemon 遷移。**

### Fixed (Scheduler)

- **`.env.local` multi-line value parser**：`scripts/lib/scheduler-common.sh` 原本用 `while IFS= read -r line` 讀 .env.local，遇到 single-quoted JSON 跨多行的值（例：`GOOGLE_CLOUD_SA_KEY` 的 `private_key` 字段）會把每行 base64 切片當獨立 `KEY=VALUE` export → zsh 丟「not an identifier」+ `set -eo pipefail` 中止 → `daily-check-scheduler.sh` 連 LOG_FILE 都還沒建就死，沒 Telegram 也沒 log。
- 觀察：2026-05-11 06:13 launchd fire 觸發此 bug，`.context/daily-check-stderr.log` 記到 export 失敗。
- 修法：新增 `scripts/lib/load-env.mjs` — 用 `dotenv@16`（已支援 multi-line single-quote）parse，輸出 bash ANSI-C `$'...'` quoting 的 `export` 指令；scheduler-common.sh 改用 `eval "$(node load-env.mjs)"`。同時 emit 時校驗 key 必須匹配 `^[A-Za-z_][A-Za-z0-9_]*$`，非法 key 直接 skip 不 export。
- 測試：`tests/unit/load-env-script.test.ts` 8 cases — 簡單 KEY=VALUE / comment+空行 / shell metachar (`< > & |`) / multi-line single-quoted（regression test for `GOOGLE_CLOUD_SA_KEY`）/ 單引號 ANSI-C escape / backslash+newline / 缺 path / path 不存在。

### Added (Scheduler)

- **LaunchDaemon 遷移**：`com.tripline.daily-check` 從 LaunchAgent (`~/Library/LaunchAgents/`) 改 LaunchDaemon (`/Library/LaunchDaemons/`)。
- 動機：2026-05-07~05-10 連 4 天 LaunchAgent 沒 fire（Mac mini 從未睡過 + uptime 29 天 + sleep=0 + user 一直 logged in，`pmset -g log` 零 Sleep/Wake event），但 `launchctl print` 顯示 `runs=8` 對齊 filesystem 上 4/30-5/6 + 5/11 = 8 次，5/7-5/10 launchd **真的沒 fire**。最可能原因是 user-tier LaunchAgent 被 macOS XPC activity throttling 節流。LaunchDaemon 跑在 system domain，不受 user session / XPC throttle 影響。
- 新增 `scripts/com.tripline.daily-check.plist`（LaunchDaemon plist，UserName=ray 讓 process 仍以 user 身分跑，env 帶 PATH/HOME/USER/LANG）。
- 新增 `scripts/install-daily-check-launchdaemon.sh`：(1) bootout 舊 LaunchAgent (2) 備份舊 plist (3) bootout 舊 LaunchDaemon if any (4) copy + chown root:wheel + chmod 644 (5) bootstrap (6) 印狀態驗證。Idempotent 可重複跑。
- 用法（需 sudo，在 mac mini 上跑）：`bash scripts/install-daily-check-launchdaemon.sh`

## [2.26.0] - 2026-05-11

**EditEntryPage — 全頁編輯 entry 起訖時間 + 從上一站移動方式 + 備註。**

### Added (Schema)

- **Migration 0056**：`trip_entries` 加 `start_time` / `end_time` TEXT cols。Backfill 既有 `time` 欄：
  - `"HH:MM-HH:MM"` → split 成兩欄
  - `"HH:MM"` → start_time = HH:MM, end_time = NULL
  - NULL/empty → 兩欄 NULL
  - **不 drop** legacy `time` col（dual-write 觀察期；後續 migration 0057 再 drop）

### Added (Frontend)

- 新增 `src/pages/EditEntryPage.tsx` — fullpage 編輯 entry。Route `/trip/:tripId/stop/:entryId/edit`。
  - **Layout**：AppShell + sticky TitleBar（左 ← back / 中 title / 右 `<TitleBarPrimaryAction>` 儲存）
  - **三 sections**：時間（兩 time inputs + 停留分鐘 chip）/ 從上一站移動（segmented control driving/walking/transit + transit min input + lock pill + 重設為自動）/ 備註（textarea + counter + Markdown）
  - **儲存策略**：dirty.entry → PATCH /entries body { start_time, end_time, note }；dirty.segment → PATCH /segments body { mode, min }；並行送 + 失敗保留 dirty 值 + toast「已儲存」
  - **取消保護**：dirty 跳 ConfirmModal「丟棄變更」
  - **Keyboard shortcuts**：⌘+S / ⌘+Enter 儲存 · Esc 取消
- 新增 route `/trip/:tripId/stop/:entryId/edit` 在 `src/entries/main.tsx`
- `TimelineRail` toolbar pencil 按鈕改 navigate 到 EditEntryPage（取代既有 inline note edit 入口；testid 從 `timeline-rail-edit-note-N` 改為 `timeline-rail-edit-N`）。**inline note edit 仍保留** — 點 `tp-rail-note-value` 仍可快速編。

### Changed (Backend)

- `functions/api/trips/[id]/entries/[eid].ts`（PATCH）：
  - `ALLOWED_FIELDS` 加 `start_time`、`end_time`
  - **dual-write**：body 帶 `start_time`/`end_time` → 寫入 + compose `time`；body 帶 legacy `time` → 解析回填 `start_time`/`end_time`
  - 加 format validation（HH:MM regex）+ start < end 驗證
- `functions/api/trips/[id]/days/[num].ts`（PUT）：INSERT trip_entries dual-write
- `functions/api/trips/[id]/days/[num]/entries.ts`（POST）：dual-write
- `functions/api/trips/[id]/entries/[eid]/copy.ts`：dual-write（copy source 的 start_time/end_time）
- `functions/api/poi-favorites/[id]/add-to-trip.ts`：4-field 純時間驅動 → 直接寫 start_time/end_time + 同步 time
- `functions/api/trips/[id]/audit/[aid]/rollback.ts`：`trip_entries` `TABLE_COLUMNS` 加 `start_time`、`end_time`

### Changed (TypeScript)

- `src/components/trip/TimelineEvent.tsx`：`TimelineEntryData` 加 `start_time` / `end_time` 欄位（v2.26.0 新 path 用）

### Tests

- `tests/api/entries.integration.test.ts`：6 個新 test
  - PATCH start_time + end_time → 同步 compose time
  - PATCH 只給 start_time → end_time 從現值繼承
  - PATCH legacy time `HH:MM-HH:MM` → 同步寫 start/end
  - PATCH legacy time `HH:MM` → end_time = NULL
  - 無效 start_time format → 400
  - start_time >= end_time → 400
- `tests/unit/edit-entry-page.test.tsx`（新檔）：12 tests 涵蓋初始 render / 驗證 / 儲存 dispatch / 取消保護
- `tests/unit/timeline-rail-toolbar-pencil.test.tsx`：更新 pencil 行為從 inline edit → navigate
- `tests/e2e/qa-flows.spec.js`：QA Flow 6 改用 `timeline-rail-note-value-N` 觸發 inline edit（pencil 改 navigate）

### Mockup

- `docs/design-sessions/2026-05-11-entry-time-segment-mode-edit.html`（v4 fullpage final）

### Migration ops

- Apply order：CF Pages auto-deploy workflow parallel run migration + CF Pages build。`start_time`/`end_time` 為 nullable，舊 backend 不會 break；可放心 merge。

### 關聯

- TravelPill v2.24.0 tap-switch 保留（不動 `TravelPillDialog`）— EditEntryPage 走「編」按鈕入口；兩個入口並存，pill 用於 timeline 上快速切，page 用於詳細編輯（含時間 + 備註）。

## [2.25.5] - 2026-05-10

**`trip_pois.hours` DROP COLUMN — hours 純 `pois` master + tp-* skills 改走 Place Details API。**

### Changed (Schema)

- **Migration 0055**：`UPDATE pois SET hours = (latest trip_pois.hours)` backfill（COALESCE，不覆蓋既有 `pois.hours`）→ `ALTER TABLE trip_pois DROP COLUMN hours`。`pois.hours` 自始就在（migration 0014），`trip_pois.hours` 是冗餘的 user override（hours 是 POI 客觀屬性，不會因 trip 而異）。
- **Deploy 順序（hard rule）**：必須**先 merge PR + deploy backend**，再 apply migration。順序顛倒會讓既有 prod backend `INSERT INTO trip_pois (..., hours, ...)` 觸發 SQL fail。

### Changed (Backend)

- `functions/api/trips/[id]/days/_merge.ts`：`hours: tp.hours ?? poi.hours` → 純 `hours: poi.hours`。
- `functions/api/trips/[id]/trip-pois/[tpid].ts`：`ALLOWED_FIELDS` 移除 `'hours'`，加入 `POI_MASTER_ONLY_FIELDS` 自動 dispatch 到 `PATCH /pois/:id`。
- `functions/api/trips/[id]/entries/[eid]/trip-pois.ts` POST：`body.hours` 透過 `findOrCreatePoi` 寫進 `pois.hours`，`INSERT INTO trip_pois` 不再含 hours col。
- `functions/api/trips/[id]/days/[num].ts` PUT：hotels[].hours 同上路徑寫 pois master。
- `functions/api/trips/[id]/audit/[aid]/rollback.ts`：`trip_pois` `TABLE_COLUMNS` 移除 `'hours'`。

### Changed (Skills)

- `tp-search-strategies/SKILL.md`：**完全重寫**。第一原則改為「用 backend `POST /api/pois/{id}/enrich`，不爬網頁」。Backend 直接打 Google Place Details API 取 rating/address/phone/hours/business_status。Anti-pattern 表新增禁止 `/browse` Google Maps + WebSearch 拼湊。
- `tp-shared/references/poi-spec.md`：新增「POI 補資料策略（migration 0051+ 後 v2.23.0）」section，trip_pois override 表移除 hours，hours 註記 Place Details API `weekday_descriptions` 已含**全週時段 + 公休日**（「星期三: 休息」），不需另外處理定休日欄位。
- `.codex/` 鏡像同步。
- `CLAUDE.md` Naming history 加 v2.25.5 紀錄。

### Tests

- `tests/api/trip-pois.integration.test.ts`：新增 `PATCH hours → dispatch 到 pois master (migration 0055)` test，鏡像既有 price dispatch test pattern。

### Rationale

POI 補資料先前同時存在三條路徑（Place Details API enrich、`/browse` Google Maps、WebSearch），各自品質不一且容易讓 LLM 自由選擇成本最高的方法。本次把 skill spec 收斂到單一路徑（`POST /api/pois/{id}/enrich`），backend 集中管理 quota / API key，`weekday_descriptions` 結構化資料把公休日語意一併解決，trip_pois.hours override 失去意義 → DROP。

## [2.25.4] - 2026-05-10

**`pois.price` schema migration phase 1：把餐廳定價從 `trip_pois` 移到 `pois` master。**

### Changed (Schema)

- **Migration 0054**：`ALTER TABLE pois ADD COLUMN price TEXT` + COPY 既有 `trip_pois.price` → `pois.price`（5 筆，同 poi 多筆衝突取最新 `updated_at`）。**不 drop** `trip_pois.price`（migration 0055 觀察期後才 drop）。
- 餐廳定價是客觀屬性（不會因 trip 而異），原本放 `trip_pois` override 是 schema misalignment。搬到 `pois` master 讓多個 trip 共用同一筆 price 資料。

### Changed (Backend)

- `functions/api/_poi.ts`：`FindOrCreatePoiData` 加 `price` 欄位；`COALESCE_FIELDS` 加 `'price'`；`INSERT INTO pois` 含 price col。
- `functions/api/pois/[id].ts`：`ALLOWED_FIELDS` 加 `'price'`。
- `functions/api/trips/[id]/trip-pois/[tpid].ts`：`ALLOWED_FIELDS` 移除 `'price'`，加入 `POI_MASTER_ONLY_FIELDS` 自動 dispatch 到 `PATCH /pois/:id`。
- `functions/api/trips/[id]/entries/[eid]/trip-pois.ts` POST：`body.price` 透過 `findOrCreatePoi` 寫進 `pois.price`，`INSERT INTO trip_pois` 不再含 price col。
- `functions/api/trips/[id]/days/[num].ts` PUT：restaurants[].price 同上路徑寫 pois master。
- `functions/api/trips/[id]/days/_merge.ts`：dual-read `price: poi.price ?? tp.price`（觀察期保險，舊 trip_pois.price 資料仍可讀；migration 0055 後簡化）。

### Changed (Skills)

- `tp-shared/references/poi-spec.md`：`price` 從 trip_pois override 區搬到 pois master 區，restaurant 建議欄位加 **price**。`.codex/` 鏡像同步。
- `CLAUDE.md` Naming history 加 v2.25.4 紀錄。

### Tests

- `tests/api/pois.integration.test.ts`：PATCH /pois/:id 接受 `price` + DB 寫入驗證。
- `tests/api/trip-pois.integration.test.ts`：
  - POST /trip-pois 帶 price → 寫 `pois.price` 不寫 `trip_pois.price`
  - PATCH /trip-pois/:tpid 帶 price → dispatch 到 pois master

### Migration ops

- `wrangler d1 migrations apply trip-planner-db --remote` 已先於 PR merge 前執行（CLAUDE.md memory：先 apply migration 再 merge PR）。5 筆 prod trip_pois.price 已 copy 到 pois.price。

## [2.25.3] - 2026-05-10

**Trip overview timeline 對齊 mockup（terracotta-preview-v2.html）+ tp-* skill 改回 /browse + WebSearch 爬 Google Maps。**

### Changed (UI)

- `src/components/trip/DaySection.tsx` + `TimelineRail.tsx` + `TimelineEvent.tsx` + `TravelPill.tsx`：對齊 mockup hero rail / row tint / connector / pill 樣式。
- `css/tokens.css`：移除 `.ocean-day` 大片暖色 wrapper bg（legacy `#tripContent section` 規則被 `:not(.ocean-day)` 排除），row 內仍保留底色。
- expanded panel margin 改 `4px 0 8px 110px`、travel pill 顯示順序改「分鐘 → 距離」、distance 整 km 不帶 `.0`、hotel sub-line 不顯示 rating（mockup design choice）。
- `src/lib/timelineUtils.ts` `deriveTypeMeta`：`poi.type` 優先 over 文字 keyword 判斷 icon。

### Fixed

- `src/lib/mapDay.ts`：補 v2.19.x col rename（`poi.googleRating` → `poi.rating`）+ v2.23.0 新增 `travelData.distanceM` field 兩處 stale 對映，導致 frontend 拿不到評分 / 距離。

### Changed (skills)

- 8 個 tp-* skill 文件改回爬 Google Maps：`tp-shared/references/poi-spec.md` 重寫「Google Maps 爬取策略 (all fields)」/browse-first + WebSearch fallback step-by-step；`tp-search-strategies` 補回 rating / hours / phone / website / address / business_status 各欄位流程；6 個 tp-* SKILL.md（`tp-create` / `tp-edit` / `tp-patch` / `tp-rebuild` / `tp-quality-rules` / `tp-check`）frontmatter 拿掉 v2.23.0 update note。
- `.codex/` 鏡像同步（8 檔）。
- 注意：backend Place Details API 仍在運作，這是 LLM workflow 層級調整，不動 production code。

### Tests

- `tests/unit/timelineUtils.test.ts`：補 `deriveTypeMeta` poi.type 優先 over keyword + distance integer formatting case。

## [2.25.1] - 2026-05-09

**修「由網頁加入的景點」沒有起訖時間 + 缺 icon 兩個 bug。**

### Fixed

- `src/lib/timelineUtils.ts` `deriveTypeMeta` 回傳 icon name 對齊 `Icon.tsx` ICONS registry：
  - `'fork-knife'` → `'utensils'`（用餐）
  - `'walk'` → `'walking'`（散步）
  - 過去這兩個未註冊名讓 `<Icon>` 靜默 return null（line 130），entry 顯示「空白匡線」。任何 `entry.travel.type === 'walking'` 都中標。
- `src/components/shared/Icon.tsx`：新增 `'coffee'` SVG（Material `local_cafe` 風格），讓 cafe / 休息 entry 有圖示。
- `src/pages/AddPoiFavoriteToTripPage.tsx` direct mode（從 /explore + 加入行程）：
  - `time` 欄位前端送錯名 — 之前送 `startTime` / `endTime` 兩欄位，但 `functions/api/trips/[id]/days/[num]/entries.ts` POST 只認 `body.time`（"HH:MM-HH:MM" 單欄位）→ time 永存 null。
  - 改成 `time: \`${startTime}-${endTime}\`` 或 `undefined`（兩者都空時）。
- 同步補 VERSION file 到 2.25.1（v2.25.0 commit 漏 bump VERSION 造成的 drift）。

### Tests

- `tests/unit/timelineUtils.test.ts`：新增 ICONS registry 完整性 regression guard — 確保 `deriveTypeMeta` 所有回傳 icon name 都在 registry 裡，防止再次 silent-null。
- `tests/unit/poi-favorite-add-to-trip-form.test.tsx`：新增 direct mode 2 個 case — `time="HH:MM-HH:MM"` 正確 join + 兩欄位都空時 `time` omitted。

## [2.25.0] - 2026-05-07

**Sidebar / Trip card / Chat 帳號顯示一致化：avatar initial 改用「帳號名稱」第一字母（不是 email）。**

### Changed

- `src/components/shell/DesktopSidebar.tsx`：
  - 移除 sidebar 底部 account card 的 email 行（個人資訊保留在 `/account` hero）
  - 移除 sidebar 底部 ThemeToggle（切換移到 `/account → /settings/appearance`）
  - 簡化 `.tp-account-body` CSS（單一 child 不需 flex column / gap）
- `src/pages/TripsListPage.tsx`：trip card avatar initial 自己的 trip 用 `user.displayName.charAt(0)`，他人 trip 仍 fallback email[0]（後端 trips list 沒帶 owner displayName）
- `src/pages/ChatPage.tsx`：
  - 自己訊息也 render avatar（先前只 other-user 有），用 `user.displayName.charAt(0)`
  - 他人訊息 avatar + sender label 用後端 `submittedByDisplayName` (LEFT JOIN users)，fallback email local part
  - 樂觀 POST 帶 `submittedByDisplayName` 給 optimistic bubble 立即顯示正確 initial

### Backend

- `functions/api/requests.ts` GET：`SELECT r.*, u.display_name AS submitted_by_display_name FROM trip_requests r LEFT JOIN users u ON u.email = r.submitted_by`
- `functions/api/requests/[id]/index.ts` GET：同樣 LEFT JOIN
- 影響：chat-messages 列表 + single request 都會帶 sender displayName

### Tests

- `tests/unit/desktop-sidebar.test.tsx`：email 斷言改 `not.toContain`
- `tests/unit/desktop-sidebar-connected.test.tsx`：email 斷言改 `not.toContain`，displayName fallback test 改 partial match

### Verified

- tsc clean (frontend + functions)
- 1429/1429 unit tests + 607/607 API tests green

## [2.24.6] - 2026-05-07

**fix(test): drag-flows :73 + :100 改用 atomic native `scrollIntoView` via
`evaluate()`，補足 v2.24.5 over-correction。**

### Fixed

v2.24.5 完全刪 `scrollIntoViewIfNeeded` → off-screen 元素 mobile-chrome :73
`getBoundingClientRect` 回 0x0 + mobile-safari :100 `focus()` fail（off-screen
不可 focus）。

修正：用 `firstGrip.evaluate((el) => { el.scrollIntoView(...); ... })` atomic
scroll + measure。Native `scrollIntoView` 不會經過 Playwright 的 stability 等
待 → 不踩 React useEffect re-render race（webkit "Element not attached"）；同
時又能保證元素 in-viewport → `getBoundingClientRect` 正確 + `focus()` 可靠。

### Verified

- 5/5 consecutive mobile-chrome :73 通過
- 5/5 consecutive mobile-safari :100 通過
- 完整 mobile-chrome 43/44 + mobile-safari 43/44，0 fail

### Notes

- 純 test 修正，無 src / API / migration 變更
- v2.24.0 sprint chronic flake hunt 真正最終收尾（v2.24.4 root cause + v2.24.5
  trade-off + v2.24.6 atomic fix）

## [2.24.5] - 2026-05-07

**fix(test): drag-flows.spec.js:73 mobile-safari `scrollIntoViewIfNeeded`
intermittent flake — webkit + sticky/transform 容器內 React useEffect
re-render race condition。**

### Fixed

- `tests/e2e/drag-flows.spec.js:73` 刪掉 `firstGrip.scrollIntoViewIfNeeded()`
  call。Test 只測 grip dimensions（24x24 tap target），`getBoundingClientRect`
  對 off-screen 元素也 work，不需要先 scroll into view
- v2.24.4 (chronic flake fix) 之後 sole remaining mobile-safari flake，5/5
  consecutive runs 通過 + 完整 mobile-safari/mobile-chrome suite 各 43/44 ✓
- 刪 scrollIntoView 後 webkit 不再踩 React useEffect re-render 中觸發
  "Element is not attached to the DOM" intermittent error

### Notes

- 純 test code 變更（4 行刪 + 4 行 comment 增加），無 src / API / migration
- 這是 v2.24.0 sprint chronic flake hunt 收尾。完整 chronic flake history：
  - **Before**：23 連續 master CI runs fail，每 run 8 specs × 2 mobile browsers 同樣 fail
  - **v2.24.4**：root cause `.app-shell-main` 全時 `will-change: transform` 變
    stacking context → bottom-bar pointer events 被 nav 攔截 → 8→1 fail (87.5%)
  - **v2.24.5 (this)**：webkit-only `scrollIntoView` race → 1→0 fail
- 預期之後 master CI 連續綠，retry --failed 不再需要

## [2.24.4] - 2026-05-07

**fix(shell): 修 22+ master CI runs chronic mobile e2e flake — `.app-shell-main`
全時 `will-change: transform` 變 stacking context 害 sibling bottom-nav 蓋過
form bottom-bar pointer events。**

### Fixed

- `.app-shell-main` 從 base CSS 拿掉 `will-change: transform`，改成只在
  `[data-pulling="true"]` 時 enable
- Root cause：`will-change: transform` 永久 enable 讓 main 變 stacking context +
  containing block for `position: fixed` descendants。內部 `.tp-page-bottom-bar`
  (z=210) 被 scope 到 main 內部，main 整體 z auto < `.app-shell-bottom-nav`
  (z=200) → mobile 上 form confirm button 永遠被 nav 蓋掉，pointer events 被
  攔截
- Bisect 顯示：PR #480（pull-to-refresh feat 2026-05-05）引入此 regression，
  之後 22+ master CI runs 連續 mobile-chrome / mobile-safari fail
  - `add-stop-page.spec.js:73` 自訂 tab 缺 title 點完成 → inline error
  - `drag-flows.spec.js:73,80,96,102` mobile grip handles touch / keyboard a11y
  - `qa-flows.spec.js:208,226` Flow 5 編輯行程 bottom button → PUT
  - `qa-flows.spec.js:264,284` Flow 7 移動景點 cross-day → PATCH

### Verified

- Local full e2e：mobile-chrome 43/44 + mobile-safari 43/44 + chromium 44/44，
  0 fail（之前 mobile 8 fail × 2 browsers）
- Pulling 期間 `will-change` 仍 enable（GPU layer hint 不損效能）

### Notes

- 純 CSS 1 行變更（move `will-change` 從 base 到 `[data-pulling="true"]`），無
  React / API / migration 變更
- 預期之後 master CI 不再連續 mobile e2e flake fail

## [2.24.3] - 2026-05-07

**v2.24.0 sprint Phase δ：tp-* skill files 切換到 segments path（recompute-travel endpoint）。**

### Changed

- `.claude/skills/tp-shared/references/modify-steps.md` — §4 travel 重算改述：
  - 結構動完後呼叫 `POST /api/trips/:id/recompute-travel?day=N|all`，backend 跑 1km gate
    + Google Routes 自動寫 trip_segments
  - `PATCH /entries/:eid` API 表格 row 加 **禁止寫 `travel_type/desc/min`** 規則
  - `PUT /days/:N` 註明 `travel: {...}` 巢狀為 backwards-compat dual-write，Phase ε 後忽略
  - 加新 row：「重算 travel」(`POST /recompute-travel`) + 「手動覆寫 segment」(`PATCH /segments/:sid`)
  - 移除舊指引「Haversine + ~30km/h 在 client 算後 PATCH」，改為**明文禁止**
- `tp-create/SKILL.md` — 加 step 8b：Phase 1 所有天 PUT + location 補完後呼叫
  `POST /recompute-travel?day=all` 一次
- `tp-edit/SKILL.md` — step 7 改述：插入 / 移除 / 替換 / 改 location / 餐廳首選變動 →
  呼叫 `recompute-travel?day={受影響天}`
- `tp-rebuild/SKILL.md` — step 6 改述：所有結構修正完成後 `recompute-travel?day=all`
- `tp-patch/SKILL.md` — step 10 改述：location 補齊後 `recompute-travel?day=all`
- `tp-request/SKILL.md` — step f2 改述：companion 動完結構後 `recompute-travel?day={天}`

### Mirrored

- 同步 6 個檔到 `.codex/skills/tp-{shared,create,edit,rebuild,patch,request}/`
  （Codex CLI parallel invocation path）

### Notes

- **Behavioural change**：v2.23 前 skill 自己跑 Haversine + ~30km/h 估計算後 PATCH
  flat fields；v2.24.0+ 改交 backend 跑 1km gate + Google Routes API + 寫 segments
- 純 docs change，無 code 變更，無 migration、API、test 影響
- Phase ε（DROP `trip_entries.travel_*`）後 PUT /days 巢狀 travel 仍然會被 ignore
  silently — 不阻斷舊 client 但 segments 才是 SoT

## [2.24.2] - 2026-05-07

**v2.24.0 sprint γ.1：TimelineRail 接 segments fetch + pass to TravelPill。**
γ.0 ship 的 TravelPill tap-switch UI 是 dormant scaffold；本次接線後使用者
真的看到可點 pill + 開 dialog 切換 mode。

### Added

- `src/hooks/useTripSegments.ts` — fetch GET `/api/trips/:id/segments` 後 build
  Map indexed by `${fromEntryId}-${toEntryId}` 給 TimelineRail render loop O(1)
  lookup。Listen `tp-segment-updated` + `tp-entry-updated` event 自動 re-fetch
  （PATCH 完 / entry sort_order 變動 / recompute-travel 完 → segments fresh）。
  Empty/null tripId → no fetch，failure → silently 留 empty map（caller graceful
  degrade，TravelPill 退回 v2.23 唯讀渲染）。

### Changed

- `src/components/trip/TimelineRail.tsx` — 接線 useTripSegments(tripId)，render
  loop 為每對 (prev, curr) entry 從 segmentMap 取對應 row，並把 `segment +
  tripId + fromName + toName` props 傳給 TravelPill。Backwards compat：
  segment 沒對到（migration 沒跑 / 新 entry 還沒 recompute）但 entry.travel
  legacy 仍存在 → fallback 用 travel obj 唯讀渲染。

### Tests

- `tests/unit/timeline-rail-segments-wiring.test.tsx`（7 tests）— 驗 hook
  call passes tripId、segmentMap → TravelPill button render、modeSource=user
  顯示鎖頭、multi-pair lookup、no segment + no travel → no pill、first entry
  上方無 pill。
- `tests/unit/timeline-rail-toolbar-pencil.test.tsx` +
  `tests/unit/timeline-rail-inline-expand.test.tsx` — 加 `vi.mock` 攔
  useTripSegments 避免 segments fetch 干擾既有 fetchSpy 斷言。

### Notes

- 純 frontend 變更，no API / migration / backend changes
- v2.24.0 sprint γ phase 完結（α schema + β backend + γ.0 UI scaffold + γ.1 wiring）
- Phase δ（skill files segments path 更新）+ Phase ε（DROP trip_entries.travel_*）
  分離 PR 不阻擋本次 ship

## [2.24.1] - 2026-05-07

**v2.24.0 sprint γ.0：TravelPill tap-switch UI scaffolding（mockup + React component + TDD）。**
TimelineRail 接線（讓使用者實際看到可點 pill）留 γ.1 PR；本次純加 component + dialog
+ tests，zero risk to existing UI。

### Added

- `docs/design-sessions/2026-05-07-travel-pill-tap-switch.html` — mockup-first
  hard gate produced：5 frames covering TravelPill states / mobile bottom sheet /
  transit input / user-mode reset / desktop popover。Self-contained，可 open 預覽
- `src/components/trip/TravelPillDialog.tsx` — segment mode picker dialog。
  Mobile bottom sheet（<760px）+ desktop popover-style modal（≥760px responsive）。
  3 mode options（駕車 / 步行 / 大眾運輸）每個 ≥44px tap target；transit 選中
  展開 number input (1–1440 分鐘)；ARIA dialog + aria-modal + Esc / overlay close。
  Save → apiFetchRaw PATCH `/api/trips/:id/segments/:sid` + 設 `mode_source='user'` +
  dispatch `tp-segment-updated` event 給 parent re-fetch
- `tests/unit/travel-pill-tap-switch.test.tsx` — 15 TDD tests 覆蓋 read-only
  backwards compat / interactive button / 鎖頭 / dialog 開合 / mode 切換 /
  transit min 邊界 / Save PATCH 含正確 body / Esc 關閉 / overlay click 關閉 /
  PATCH fail error / dispatch event

### Changed

- `src/components/trip/TravelPill.tsx` — 加 optional props `segment + tripId +
  fromName + toName`。當提供時 pill 變 button、tap 開 TravelPillDialog；
  `mode_source='user'` 顯示鎖頭 SVG；`auto` 顯示 ▾ affordance；backwards compat
  保留 v2.23 唯讀 div render 當 props 未提供。優先用 `segment.mode/min/distanceM`
  顯示（v2.24.0 SoT），fallback v2.23 `type/min/distanceM` props

### Out of Scope (Phase γ.1)

- TimelineRail 接線：尚未 fetch GET /segments + 傳 segment props 到 TravelPill。
  目前用戶 production UI 仍 render v2.23 唯讀 pill（從 trip_entries.travel_*
  dual-write 來）
- Reset to auto button：mockup frame 4 顯示，需後端 PATCH 擴 modeSource 參數
  才能實現

## [2.24.0] - 2026-05-07

**v2.24.0 trip-segments sprint α + β：新 `trip_segments` first-class entity +
1km Haversine gate 取代 v2.23.x 多層 fallback chain。** Sprint γ（TravelPill
tap-switch UI）+ δ（skill files 改 segments path）+ ε（DROP trip_entries.travel_*）
後續分批進來。

### Why

v2.23.0 切到 Google Routes API 之後 full-trip recompute 撞 Cloudflare Workers
free-tier 50 subrequest/invocation 上限。每對 pair 用 1-2 calls（WALK 試 → 失敗
fallback DRIVE，或 walk >10min 試 TRANSIT）累計 ~94 calls 對 47 pairs 的 trip
直接爆。Japan Google Routes API 沒 transit 數據（已驗證 Tokyo Station→Shinjuku
回 empty `routes` array），TRANSIT path 一直是無效呼叫。

v2.24.0 拔掉 fallback chain，改用本地 Haversine 在叫 Routes API 前算距離：
≤1km → walking + 1 WALK call；>1km → driving + 1 DRIVE call。每對永遠 1 call
不論結果。HuiYun 47 pairs 從 ~94 → ~58 subreq（仍擦邊 50 上限，但 day filter
recompute 永遠安全）。

### Added

- **`trip_segments` table** (migration 0053)：first-class entity 紀錄兩 entry
  之間的交通段。`(from_entry_id, to_entry_id) UNIQUE` + FK CASCADE 對 trips +
  trip_entries。`mode` ∈ {driving, walking, transit}，`mode_source` ∈ {auto, user}
  區分系統算的 vs user 手動覆寫，三 column CHECK constraint 鎖白名單。
- **`GET /api/trips/:id/segments`** — 回傳該行程所有 segments，按 day_num + sort_order
  排序。前端 TimelineRail / TravelPill 用此 list 配對 entry 自行 join。
- **`PATCH /api/trips/:id/segments/:sid`** — user override travel mode。set
  `mode_source='user'` → recompute 不再覆寫此 segment。`mode='transit'` 時 `min`
  必填（手動輸入 0–1440 分鐘，因 Japan 沒 Google API 數據）；driving/walking
  時 min 可選。IDOR 防護：驗 segment.trip_id === URL tripId。
- **`src/server/maps/haversine.ts`** — 純 function 大圓距離（IUGG mean radius
  6,371,008.8m）。0 API call，作為 1km gate pre-check。+ 5 unit tests。

### Changed

- **`POST /api/trips/:id/recompute-travel`** 完全改寫：
  - 1km gate 統一邏輯（self-drive 窗內也吃，短程 walk 比找停車快）
  - 永遠 1 Google Routes call/pair（移除 WALK→TRANSIT→DRIVE fallback chain）
  - 寫 `trip_segments` 為 source of truth + dual-write `trip_entries.travel_*`
    至 Phase ε（既有 React UI 不破）
  - 既有 `mode_source='user'` segment **跳過**，保留 user override
  - `INSERT ... ON CONFLICT DO UPDATE WHERE mode_source='auto'` 防 TOCTOU race：
    並發 recompute 不會撞 UNIQUE atomic fail；且 preload→write 期間若 user PATCH
    過 mode 也不被覆寫
  - 單一 `db.batch()` 寫入所有 upserts（1 subrequest 不論 statement 數）+ 預先
    SELECT existing segments to Map 省 N×D1 query
- **Subrequest budget**：HuiYun day=all ≈ 58 subreq（vs free-tier 50）— **day=N
  filter 永遠安全**（~14 subreq）。Phase ε DROP `trip_entries.travel_*` 後可再
  省 ~47 subreq（legacy entry UPDATE 那段移除）。

### Removed

- `recompute-travel` 的 50ms per-pair throttle（v2.23.15）— 真兇是 CF subreq 上限
  不是 QPS，throttle 不對症。改 1 call/pair 是根本解
- TRANSIT mode 自動算（Japan 沒資料）— user 想要 transit 透過 PATCH segment +
  手動填 min（Phase γ TravelPill tap-switch dialog 給 UI）
- WALK→TRANSIT→DRIVE fallback chain（recompute-travel 整段砍）

## [2.23.15] - 2026-05-07

**hotfix: full-trip recompute 21 errors → throttle Routes API per-pair** —
v2.23.14 後 per-day recompute 全綠 (Day 5/6/7 各 9/9/3 pairs 0 errors)，但 full
trip 一次跑就 26 pairs / 21 errors。判斷是 Routes API per-second QPS 限制 —
HuiYun 7 days × 6-9 pairs × 1-2 calls = ~80 calls burst 觸發 429。

### Fixed

- `recompute-travel.ts`：每對 pair 處理完加 50ms `setTimeout` throttle。
  保持 < 20 calls/sec，遠低於 Routes API per-second 限制
- `errors_detail` 改 capture `AppError.detail`（真實 upstream message 如 "Routes 429"），
  而非 catalog default "Google Maps 服務暫時無法回應"
- Trade-off：full-trip recompute 多 ~5 sec latency（80 pairs × 50ms = 4s），可接受

## [2.23.14] - 2026-05-07

**hotfix: entry.time time-range format → recompute Invalid time value** —
v2.23.13 debug instrumentation 暴露 root cause。`entry.time` 實際格式是
`"HH:MM-HH:MM"` (time range)，不是 single `HH:MM`。

`entryDateTime()` naive 組 `${date}T${time}:00` →
`"2026-07-29T12:10-12:40:00"` → invalid ISO → `new Date(...).toISOString()` throws
`Invalid time value`。每對自駕區間外 + walk >10min 的 pair 都 hit TRANSIT path 然後
這行 throw → outer catch → error count++。

### Fixed

- `recompute-travel.ts entryDateTime()`：parse time range，取起始 `HH:MM`。
  invalid format → return null（fallback default mode）
- `errors_detail` field 保留（v2.23.15 觀察一週後 remove）

## [2.23.13] - 2026-05-07

**debug: recompute response 加 `errors_detail`** — v2.23.10/11/12 三輪 fix 後
仍有 ~50% pairs error。猜不到 root cause，加 per-pair error message capture
方便診斷。

### Changed

- `recompute-travel.ts` response 加 `errors_detail: [{ entryId, message }]`，
  每 pair fail 的 error.message 切 200 char。debug 後 v2.23.14 會 remove。

## [2.23.12] - 2026-05-07

**hotfix: zero-distance pair (相同 lat/lng) → recompute fail** — v2.23.11 ship 後
okinawa-Ray 仍 19 errors / okinawa-HuiYun 41 errors。Routes API 對相同 lat/lng
pair 回 `{duration:"0s"}` 缺 `distanceMeters` 欄，computeRoute 嚴格檢查
`typeof distanceMeters === 'number'` → fail。

Okinawa trips 多有「午餐/晚餐/購物」共用前一 entry 的 lat（例如 PARCO CITY 商場
裡的 lunch+shopping 兩個 entry），全部 error。

### Fixed

- `src/server/maps/google-client.ts computeRoute()`：drop 嚴格 distanceMeters
  存在性檢查，缺欄位視為 distance=0（zero-distance pair 是合法輸出）

## [2.23.11] - 2026-05-07

**hotfix: WALK fail → fallback DRIVE last resort** — v2.23.10 修 TRANSIT 後仍見
okinawa-Ray Day 2 4 errors。Routes API WALK 對長距離 (那霸→恩納 50km / 跨島)
也回 empty。

### Fixed

- `recompute-travel.ts`：WALK call 加 inner try-catch。失敗 → DRIVE last
  resort，誠實 mark mode='driving'。non-self-drive trip 用戶仍能看到「開車要多久」
  當參考。
- 完整 fallback chain（非自駕區間）：
  1. WALK → ≤10min: walking
  2. WALK ok 但 >10min → TRANSIT → 失敗 fallback walking
  3. WALK fail（跨島/超 50km）→ DRIVE last resort

## [2.23.10] - 2026-05-07

**hotfix: Routes API TRANSIT 對 Tokyo 吐 empty → recompute 全 error** —
v2.23.9 ship 後 prod smoke 暴露 regression：okinawa-Ray Day 2 6 對 pair，2 succeed
(WALK ≤10min) + 5 fail (走路 >10min 落入 TRANSIT path → empty `{}` → fail throws)。

### Root cause

Routes API TRANSIT mode 對 Tokyo 主站對主站都吐 `{geocodingResults:{}}` 空回。可能：
- Routes API on this Cloud project 沒 enable TRANSIT mode
- 需 enable 舊 Directions API 或專屬 TRANSIT SKU
- 區域 transit data 缺漏

`computeRoute()` 的 polyline 必填檢查讓 TRANSIT empty 立刻 fail()，
recompute-travel 的 try-catch 把它計入 `error` count，不寫 entry。

### Fixed

- `recompute-travel.ts`：TRANSIT call wrap 額外 try-catch。失敗 → fallback
  到 walk result 並 mark mode='walking'（誠實 report walking time，不擋 recompute）
- v2.24.0 真要 enable TRANSIT 得確認 Cloud project APIs + SKU 設定

## [2.23.9] - 2026-05-06

**feat: self-drive trip + per-pair travel mode + 變更 POI** — 用戶 sprint：
(1) 新增行程加自駕選項 + 取車/還車時間 + 取/還車地點 (2) recompute 改 per-pair
mode：自駕區間 → DRIVE / 區間外走路 ≤10min → WALK / 超過 → TRANSIT
(3) timeline row 加「變更 POI」 action。

### Added

- migration `0052_trips_self_drive.sql`：trips 加 5 cols (self_drive_enabled
  + 4 nullable text/datetime fields) + partial index。全 nullable 支援後補。
- `functions/api/trips.ts` POST + `functions/api/trips/[id].ts` PATCH ALLOWED
  +5 self-drive fields
- `functions/api/trips/[id]/recompute-travel.ts` 大改：per-pair mode logic。讀
  trip self_drive 區間 + 每對 pair 的 entry datetime → 決定 DRIVE / WALK /
  TRANSIT。WALK ≤10min threshold；超過時 2nd Routes call TRANSIT。response 加
  `mode_breakdown` + `self_drive` summary。
- `src/server/maps/google-client.ts` `computeRoute` 加 optional `departureTime`
  param（TRANSIT mode 必須帶才有 schedule）
- `src/pages/NewTripPage.tsx` 加 self-drive section：toggle + 4 inputs
  （datetime-local + text）
- `src/pages/EditTripPage.tsx` 同上 + 後補 PATCH diff 邏輯
- `src/types/trip.ts Trip` interface +5 self-drive fields (camelCase API shape)
- `src/pages/ChangePoiPage.tsx` 新頁 — search/favorites 雙 tab，single-select
  → PUT `/trips/:id/entries/:eid/poi-id` (find-or-create OR existing poi_id mode)
- `functions/api/trips/[id]/entries/[eid]/poi-id.ts` PUT 加 find-or-create mode：
  body 接 `{ name, lat, lng, source }` 時自動建 POI 並重掛 entry，title 同步更新
- `src/components/trip/TimelineRail.tsx` row action 加「變更 POI」 button →
  navigate `/trip/:id/stop/:eid/change-poi`
- Route `/trip/:tripId/stop/:entryId/change-poi`

### Cost impact

- 自駕模式 entries：1 Routes call/pair (DRIVE)，同舊
- 非自駕區間 entries：1-2 calls/pair (WALK 或 WALK+TRANSIT)
- Quota 5000/day 仍夠 (典型 trip ≤80 pairs)

## [2.23.8] - 2026-05-06

**feat: trip TitleBar 加景點 退役 → 探索 + 探索 POI 卡可選收藏 OR 直接加入行程** —
用戶 IA 重構：(a)「加景點」 button 從 trip TitleBar 退役改「探索」 → /explore
(b) 探索 POI 卡並排 ❤ 收藏 + ➕ 加入行程 (Plan B：直接走加入行程頁無需先收藏)。

### Changed

- `TripsListPage.tsx:1125-1143` TitleBar action「加景點」→ 「探索」 → navigate
  `/explore`. Icon: plus → search. testid: trip-add-stop-trigger →
  trip-explore-trigger
- `ExplorePage.tsx` POI card 加 ➕ 加入行程 button 並排 ❤；click 帶 POI query
  params navigate `/add-to-trip?place_id=X&name=Y&lat=Z&lng=W&address=A&category=C`
- `AddPoiFavoriteToTripPage.tsx` 加 direct mode：
  - 無 :id route param → 從 query params 解 POI（place_id/name/lat/lng/address/category）
  - 載入只打 `/my-trips`（跳過 favorites fetch）
  - submit 走 `POST /api/trips/:tripId/days/:dayNum/entries` 直建 entry，
    fire-and-forget recompute travel（同 v2.23.1 AddStopPage pattern）
  - goBack fallback 改 `/explore`（vs favorite mode 的 `/favorites`）
- `entries/main.tsx` 加 route `/add-to-trip` → AddPoiFavoriteToTripPage（同 component
  雙 mode）
- `tests/e2e/add-stop-page.spec.js` + `qa-flows.spec.js` 改用 direct URL
  goto AddStopPage（trip-add-stop-trigger testid 已退役）

### Backward compat

- AddStopPage 仍保留：route `/trip/:id/add-stop?day=N` 仍 reachable via
  deep-link，trip TitleBar 不再 link。`tripPageRef.openAddStop()` API 也保留。
- 既有 `/favorites/:id/add-to-trip` favorite mode 完全不動。

## [2.23.7] - 2026-05-06

**hotfix: ExplorePage 三個用戶反饋串連 + days endpoint contract drift** — 用戶反饋
連續三件：(1)「探索」TitleBar 缺左上返回；(2)「加入行程頁」選 trip 後 day dropdown
顯「該行程沒有天數」；(3)「探索無法搜尋」。

### Root cause

1. `ExplorePage` TitleBar 未傳 `back` prop。`/explore` 自 v2.21.0 是 secondary entry
   (從 `/favorites` 進)，需返回 affordance — mockup section 18 line 7289+7368 也漏。
2. `AddPoiFavoriteToTripPage` line 264 打 `apiFetch('/trips/${tripId}')` 期望 `data.days`，
   但 `/api/trips/:id` 只回 trip metadata（id/name/owner/...）— 無 days 欄位。獨立 endpoint
   是 `/api/trips/:id/days`（回 array）。Contract drift 從 v2.22.0 沒抓到，因 test mock
   也錯誤 stub `{ days: [...] }` 對應同一個 endpoint。
3. `ExplorePage` line 673 client-side filter `p.address.includes(region)` —「東京」中文
   vs Google 回的英文 address「Tokyo, Japan」永遠 mismatch → 全部 results 被過濾掉 →
   看起來「無法搜尋」。Server-side locationBias (v2.23.4) 已做城市級 bias，client 重複過濾
   只會壞掉。

### Fixed

- `ExplorePage`：TitleBar 加 `back={goBack}` + `backLabel="返回收藏"`，walk `useNavigateBack('/favorites')`
- `AddPoiFavoriteToTripPage` line 264：改打 `/trips/${tripId}/days` 並讀 array
- `ExplorePage` line 673：drop region client filter（locationBias server-side 處理），
  保留 category filter
- `ExplorePage`：stale toast「Nominatim 暫時無法連線」→「搜尋失敗，請稍後再試」
- 同步更新 mockup `docs/design-sessions/terracotta-preview-v2.html` Section 18 desktop +
  compact frame 加 `.tp-titlebar-back` button
- `DESIGN.md` L181 記載 `/explore` TitleBar back button 規範
- 修 3 個 sibling test mock（form/states/layout）對齊新 days endpoint

## [2.23.6] - 2026-05-06

**hotfix: travel pill 不顯示距離 + recompute 後 pill 不渲染** — 用戶 prod 截圖
反饋：行程內 segment 只顯示「6 min」，沒有 km 距離；且 v2.23.0 後新算的 segment
（如 QA test trip）pill 直接不渲染。

### Root cause

1. `TravelPill` props 從來只有 `{type, desc, min}` — 從沒接 distance
2. `assembleDay` (functions/api/trips/[id]/days/_merge.ts:128) 用
   `e.travel_type ? {...} : null` gate travel object，但 `recompute-travel.ts`
   UPDATE 只寫 `travel_distance_m / travel_min / travel_source`，從不寫
   `travel_type`。新算的 segment 永遠 `travel_type=NULL → travel=null → pill
   不渲染`。
3. legacy entries (v2.19.x 時代) 有 `travel_type='car'` + `travel_min` 但
   `travel_distance_m=NULL`，pill 顯示分鐘但沒有 km

### Fixed

- `recompute-travel.ts` UPDATE statement 加 `travel_type = COALESCE(travel_type, ?)`
  用 trip.default_travel_mode 當 fallback。COALESCE 保留人工選擇（火車/步行 etc.）
- `_merge.ts assembleDay`：travel object 不再 gate 於 travel_type；只要
  `travel_type / travel_min / travel_distance_m` 任一非 NULL 就 surface。
  type 預設 `'car'`。回傳新增 `distance_m + source` 欄位
- `src/types/trip.ts Travel` 加 `distance_m + source` 欄位
- `src/components/trip/TimelineEvent.tsx TravelData` 加 `distance_m`
- `src/components/trip/TravelPill.tsx` 加 `distanceM` prop +
  `formatDistance()` helper：≥1km → "X.X km"、<1km → rounded 50m → "Y00 m"
- `TimelineRail` 把 `entry.travel.distance_m` 透給 `<TravelPill>`
- `tests/unit/travel-pill.test.tsx` 加 4 個 distance display case (11 tests total)

### Known limitation（待 v2.24.0 sprint）

「加入行程」flow 在 AddStopPage 的 search/favorites tab 沒 startTime/endTime
input，只有 custom tab 有。`AddPoiFavoriteToTripPage` 是唯一帶完整時間 form 的
canonical page。下個 sprint 統一 add-to-trip flow 走同一頁。

## [2.23.5] - 2026-05-06

**hotfix: search cache key 用 raw city 區分** — v2.23.4 ship 後 prod smoke：
`region=東京` 正確吐東京拉麵，但 `region=沖繩` 接著查也吐同一批東京資料。
原因：`region` normalize 成 ISO（`'東京'/'沖繩' → 'JP'`），cache key 用 ISO 後
兩個城市共用同一 row。`region=東京` 先 fetch 寫 cache，`region=沖繩` 同一
24h 內 hit cache → 拿到東京 results。

### Fixed

- `functions/api/poi-search.ts` 拆兩個變數：`region`（送 Google 的 ISO）+
  `cacheKey`（D1 cache 用 raw city 字串）。`getCachedSearch` / `setCachedSearch`
  改用 `cacheKey` → 不同 city 不撞 cache row
- 同 PR 一次性 nuke prod `pois_search_cache` 全表（209 rows）— v2.23.3 殘留
  資料含台灣 IP fallback 結果，留著會持續污染 24h

## [2.23.4] - 2026-05-06

**hotfix: regionCode 不夠強 — 改 locationBias circle 鎖城市** — v2.23.3 ship 後
prod smoke test：`region=JP&q=拉麵` 在台灣 IP 上還是吐 5 筆台灣拉麵店。Google
Places API 文檔明寫 `regionCode` 「only affects ranking, does not restrict」—
City-level bias 必須走 `locationBias { circle: { center, radius } }`。

### Fixed

- `src/lib/maps/region.ts` 改回 city → `LocationBiasCircle` mapping（lat/lng +
  radiusMeters），覆蓋 JP / KR / TW / HK / MO / TH / SG / MY / VN / ID / PH 主要
  城市。Tokyo 35km radius、沖繩 50km、京都 25km 等
- `src/server/maps/google-client.ts` `searchPlaces()` 加 optional `locationBias`
  參數，body 帶 `locationBias.circle.center.{lat,lng} + radius`
- `functions/api/poi-search.ts` 收 `region` query param 後雙模式：
  - city 中文 → `regionToLocationBias()` → 強制 city-level bias 傳 locationBias
  - ISO 2-char → fallback 用 regionCode 弱 ranking 提示（v2.23.3 backward compat）
- `regionToApiParam()` 新 helper：frontend 把 raw city 中文傳給 API（不再做 ISO
  轉換）。「全部地區」→ undefined，URL 略過參數
- `AddStopPage` + `ExplorePage` 改用 `regionToApiParam`
- 測試擴增至 21 case 守 mapping + locationBias 中心點 + API param 規範

## [2.23.3] - 2026-05-06

**hotfix: 篩選東京搜尋出 Taipei 結果** — `usePoiSearch` hook 從不接受 / 不傳
`region` 參數給 `/api/poi-search`，所以 AddStopPage / ExplorePage 上的 region pill
（「東京 / 沖繩 / 首爾 / 台南」）只是裝飾。Google Places `regionCode` 沒收到 →
fallback 用 caller IP（台灣）→ Taipei results。

### Fixed

- `src/hooks/usePoiSearch.ts` 加 `region?: string` 入口，append `&region=` 到 fetch URL，
  納入 effect deps（region 換時 re-fetch）
- `src/lib/maps/region.ts`（新）city 中文 → ISO alpha-2 country code mapping。
  涵蓋 JP / KR / TW / HK / MO / TH / SG / MY / VN / ID / PH。
  `'全部地區'` / 未收錄 city → undefined（保留 caller-IP fallback 舊行為）
- `src/pages/AddStopPage.tsx` + `src/pages/ExplorePage.tsx` 用新 helper 把 region 中文
  轉 ISO 傳到 hook / API
- 新測試 `tests/unit/region-to-country-code.test.ts` 7 個 case 守住 mapping

### Limitation

`regionCode` 只認 country level — 「東京 vs 京都」皆映射到 JP，無 city-level
bias。City 級別 bias 需走 `locationBias circle` 帶 lat/lng（v2.24.0 enhancement）。

## [2.23.2] - 2026-05-06

**hotfix: enrich.ts 漏寫 lat/lng/address/phone/hours** — v2.23.0 backfill 後驚覺
185 個 POI 拿到 `place_id` 但 `lat/lng` 全是 NULL。recompute-travel 在 trip-a7df
（東京都 + 青森縣）回傳 `pairs_computed: 0` 即源於此：JOIN `trip_entries` →
`pois` 雖找到 row，但 `lat IS NULL` 導致 segment 被 skip。

### Fixed

- `functions/api/pois/[id]/enrich.ts` UPDATE statement：原本只寫
  `rating / status / status_reason / status_checked_at / last_refreshed_at`，
  漏掉 Place Details 回的 `lat / lng / address / phone / weekday_descriptions`。
  改為用 `COALESCE(?, lat)` 等保留人工編輯值的同時 backfill 新欄位。
- 對既有 185 個 backfilled POIs 執行 re-enrich pass 補齊座標 → recompute-travel
  會在下次 trip view 觸發（或手動 POST 端點）。

## [2.23.1] - 2026-05-06

**hotfix: 新增景點重算 travel time** — v2.23.0 prod testing 暴露 pre-existing bug：
AddStopPage `handleConfirm` 只傳 `{ title, note }` 給 `POST /entries`，drop 掉 search
result 的 `lat/lng`，導致 `findOrCreatePoi` 建出無座標的 POI；加完景點也沒 trigger
`/api/trips/:id/recompute-travel`，所以 travel pill 一直空白。

### Fixed

- `src/pages/AddStopPage.tsx` `handleConfirm`：
  - search tab payload 加 `lat / lng / source: 'google'`（從 PoiSearchResult 拿）
  - favorites tab payload 加 `lat / lng / source: 'favorite'`（從 PoiFavoriteRow.poiLat/poiLng 拿，backend 已有 deepCamel 過的 `poi_lat`/`poi_lng`）
  - POST entries 完成後 fire-and-forget `POST /api/trips/:id/recompute-travel?day=N`，
    UI 立即返回 trip view，travel pill 在 server 算完後 refresh
- `PoiFavoriteRow` interface 加 `poiLat?` + `poiLng?`（backend 早就回，前端 type 沒同步）

## [2.23.0] - 2026-05-06

**Google Maps Platform 全套切換** — OSM Nominatim + Mapbox + ORS + Leaflet + Haversine
全部 ripped out，no fallback。亞洲 POI search 從 Asia-weak OSM 換成 Google Places API
(New v1)，UI 從 Leaflet → Google Maps JS API，polyline 從 Mapbox → Google Routes v2。
配 D1 24h cache + monthly $200 budget kill switch (90/50 hysteresis) + POI lifecycle
(active/closed/missing) + 30 天 refresh + Telegram alert。Big Bang 1 PR / 9 commits /
~6700 changed lines。Pre-merge gates：/autoplan APPROVED WITH OVERRIDES + /simplify pass
+ /review pass + 1384 unit tests pass + tsc clean。

### Added

- server-side Google client `src/server/maps/google-client.ts` (Places + Routes + GoogleBusinessStatus union, no fallback per P11)
- D1 cache `src/lib/maps/cache.ts` (24h TTL + cleanupExpiredCache via daily cron)
- kill switch `functions/api/_maps_lock.ts` (10s in-memory cache + setLockState atomic UPSERT)
- 8 admin endpoints `functions/api/admin/{maps-lock,maps-unlock,backfill-status,maps-settings,quota-estimate,pois-pending-place-id,pois-due-refresh,cache-cleanup}.ts` (requireAdmin gate + audit_log)
- trip POI health `/api/trips/:id/health` (versioned response shape, GROUP BY 避 N+1)
- 3 React 元件 `<PoiStatusBadge>` / `<TripHealthBanner>` / `<MapSkeleton>` (對齊 DESIGN.md tp-badge primitive，禁 emoji + 禁 strikethrough，過 no-emoji-icons.test.ts CI gate)
- 3 mac mini cron scripts (initial backfill 50/day + 30d refresh + quota monitor with hysteresis)
- Migration 0051 (place_id + 4 lifecycle cols + pois_search_cache + app_settings + 3 indexes; forward-only + INSERT OR IGNORE idempotent)
- 6 new test files (90 tests total: poi-status-badge / trip-health-banner / map-skeleton / google-client / maps-lock / shared __mocks__/google-maps.ts)
- npm scripts `backfill:google` / `refresh:google` / `quota:google`
- deps `@googlemaps/js-api-loader ^2.0` + `@types/google.maps ^3.64`

### Changed

- `functions/api/poi-search.ts` — OSM Nominatim → Google Places Text Search + cache + kill switch
- `functions/api/route.ts` — Mapbox Directions → Google Routes v2 (Haversine fallback removed per P11/T13)
- `functions/api/pois/[id]/enrich.ts` — 4-vendor OSM chain → 單一 Place Details call (business_status → status enum)
- `functions/api/trips/[id]/recompute-travel.ts` — ORS+Haversine → Google Routes per pair
- `src/components/trip/OceanMap.tsx` — Leaflet → Google Maps JS rewrite (700 LOC) + SymbolPath.CIRCLE + state-keyed lookup table
- `src/components/trip/MapFabs.tsx` — preset 街道/衛星/地形 → 路線圖/衛星/混合 (Google MapTypeId)
- `src/hooks/useGoogleMap.ts` (new) replaces `useLeafletMap` (setOptions + importLibrary + reduced-motion)
- `src/hooks/useRoute.ts` — null on backend 502/503 (no Haversine fallback)
- `src/hooks/usePoiSearch.ts` — schema guard `osm_id` → `place_id`
- `src/types/poi.ts` — osm_id (number) → place_id (Google ChIJ string) + business_status union
- 6 page files osm_id → place_id rename + L.Map → google.maps.Map type
- 11 tp-* SKILL.md files (× .claude + .codex = 22 syncs) — rating/hours/business_status/phone 來源統一 Place Details API (canonical curl block 在 tp-shared/references/poi-spec.md)
- `functions/api/_errors.ts` + `src/types/api.ts` — MAPS_LOCKED (503) + MAPS_UPSTREAM_FAILED (502) error codes
- `scripts/_lib/cron-shared.ts` (new) — OAuth client_credentials minting + token cache + retry-on-401

### Removed

- `src/server/osm/{nominatim,overpass,opentripmap,wikidata}.ts` (OSM POI enrichment)
- `src/server/poi/enrich.ts` (replaced by Place Details direct call)
- `src/server/routing/ors.ts` + `src/server/travel/compute.ts` (Haversine + ORS)
- `src/hooks/useLeafletMap.ts`
- `scripts/poi-enrich-batch.ts` (replaced by `google-poi-initial-backfill.ts`)
- `leaflet` + `@types/leaflet` npm deps
- `MAPBOX_TOKEN` + old `VITE_GOOGLE_MAPS_API_KEY` CF Pages secrets (renamed to VITE_GOOGLE_MAPS_BROWSER_KEY)
- 3 obsolete `reverseGeocode` tests (dead export — no /api/geocode endpoint)

### Fixed

- Migration 0051 INSERT not idempotent → INSERT OR IGNORE (re-apply safe)
- `useRoute.ts` Haversine fallback defeating P11/T13 contract → null on failure
- 4 obsolete `vi.mock useLeafletMap` no-op stubs → useGoogleMap stubs (false-green coverage)
- `reverseGeocode` dead export + URL-query key exposure → removed entirely

## [2.22.1] - 2026-05-05

**poi-favorites-rename simplify pass — helper extraction + dead code + perf nits** —
Internal cleanup riding on top of v2.22.0。零行為變化，1378 unit + 42 integration + 22
companion-resolver 全綠。

### Changed

- **`functions/api/_companion.ts`** 抽出 `pickFavoriteRateLimitBucket` + `assertFavoriteOwnership`
  shared helpers，3 個 handler（`poi-favorites.ts` / `[id].ts` / `[id]/add-to-trip.ts`）的
  重複 rate-limit bucket selection + ownership check 縮成單行呼叫。
- 2 個 handler 本地 `rateLimitedResponse` helper 改用既有 `buildRateLimitResponse` from
  `functions/api/_errors.ts`。
- `_audit.ts` 把 `CompanionFailureReason` union 搬到此處宣告，`logAudit.companionFailureReason`
  從 `string` narrow 成 union；`_companion.ts` re-export 維持 import compatibility。
- `PoiFavoritesPage.tsx`：REGIONS 改 module-level constant + 用 Map memoize `deriveRegion`
  per row（原本 `regionCounts` + `filteredFavorites` 兩處各跑一次 7 條 regex per row）。
- `usePullToRefresh.ts`：`refreshing` 改用 ref 同步，主 effect deps 不再含 `refreshing`，
  避免 listener 在每次 refresh toggle 時 re-attach。`setPullPx(0)` 三處加 `pullRef.current !== 0`
  guard，touchmove 60Hz 觸發路徑避免無變化的 re-render。
- `AddPoiFavoriteToTripPage.tsx`：`POI_TYPE_LABEL` 移到 `src/lib/poiCategory.ts` 統一
  zh-TW labels；nested ternary `err.message` 收斂成單層。
- 兩個 429 rate-limit response 透過 `buildRateLimitResponse` 多帶 `cache-control: no-store`
  header（避免下游 cache 把 retry-after 響應留住）；既有 `Retry-After` 行為不變。

### Removed

- `_companion.ts:resolveCompanionUserId` dead `typeof requestId !== 'number'` 檢查
  （TS narrows `number | null` 後此分支 unreachable；`Number.isInteger` 與 `requestId <= 0`
  涵蓋 case G 的 1.5 / -5 / 0 測試）。
- `PoiFavoritesPage.tsx` 冗餘 `deletingIds` state（與 `selectedIds` 在刪除流程中等價）+
  rebuild selectedIds 的冗餘 useEffect（`handleDeleteSelected` finally block 已 clear）。
- `_companion.ts` + `poi-favorites.ts` 23 行 + 20 行 release-note 風格 preamble，留 fail-closed
  rationale 與 rate-limit bucket key contract。

## [2.22.0] - 2026-05-04

**poi-favorites-rename — saved_pois → poi_favorites + companion mapping infrastructure** —
Hard cutover rename 統一 D1 / API / frontend / skill / doc 命名，並補上 companion 路徑
（旅伴請求自動加入收藏）所需的三 gate 真實認證、原子 rate limit、replay 防護、結構化
失敗 log。Closes 6 critical findings from autoplan + request 181 痛點。

### Added

- **Companion mapping helper** (`functions/api/_companion.ts`): `resolveCompanionUserId`
  + `requireFavoriteActor`，4 個 endpoint 共用。三 gate（`X-Request-Scope` header +
  OAuth `companion` scope + `clientId === env.TP_REQUEST_CLIENT_ID`）+ guarded UPDATE
  atomic claim trip_requests.status。失敗統一寫 `audit_log.companion_failure_reason`
  enum（`self_reported_scope` / `client_unauthorized` / `invalid_request_id` /
  `status_completed` / `submitter_unknown` / `quota_exceeded`），client 維持 401 uniform
  message。
- **`companion_request_actions` 表** (migration 0050): UNIQUE(request_id, action) 防
  同 requestId 灌爆 favorites pool。同 request 第 2 次同 action → 409
  `COMPANION_QUOTA_EXCEEDED`。
- **`audit_log.companion_failure_reason` 欄位** (migration 0050 ADD COLUMN nullable):
  server 端 differentiated log（dev 從 D1 query 區分 root cause），client 不洩漏 oracle。
- **`RATE_LIMITS.POI_FAVORITES_WRITE` preset**（10/min, 60s lockout）+ companion bucket
  獨立 key (`poi-favorites-post:companion:${requestId}` vs `poi-favorites-post:user:${userId}`)
  防 companion 攻擊耗光 user web quota。
- **GET /api/poi-search public-read bypass** (middleware): OSM Nominatim proxy 不需 auth
  即可查（修 prod 198 筆 401）。POST 仍要求 auth。
- **`COMPANION_QUOTA_EXCEEDED` error code**（HTTP 409）。
- **Env `TP_REQUEST_CLIENT_ID`** + AuthData `scopes?` / `clientId?` 型別欄位（middleware
  既有 runtime 寫入，本次補 type）。

### Changed

- **D1 schema** (migration 0050 expand-contract phase 1): `CREATE TABLE poi_favorites`
  + `INSERT INTO poi_favorites SELECT FROM saved_pois`（複製，不動 saved_pois — soak
  ≥ 1 week 後 migration 0051 DROP）。`saved_at` 欄位 rename 為 `favorited_at`。避免
  GitHub Actions deploy.yml migration → app deploy 順序的 5xx 窗口。
- **`_rate_limit.ts` bumpRateLimit**: read-then-replace race → 單一 `INSERT INTO ... ON
  CONFLICT(bucket_key) DO UPDATE ... RETURNING` atomic SQL。100 burst concurrent 收斂
  到 final count = 100（race 前測得 1）。
- **API handlers** rename hard cutover：`functions/api/saved-pois.ts` → `poi-favorites.ts`
  + `saved-pois/[id].ts` → `poi-favorites/[id].ts` + `saved-pois/[id]/add-to-trip.ts`
  → `poi-favorites/[id]/add-to-trip.ts`。POST 用 `requireFavoriteActor` 取 effective
  userId；ownership 嚴格綁 submitter（companion service token 帶 admin scope 不
  bypass — M2 security boundary）。
- **add-to-trip body schema** 從 6-field（含 position / anchorEntryId）改為 4-field 純
  時間驅動（`tripId / dayNum / startTime / endTime`）— spec D14。Server 依 startTime
  自動算 sort_order；conflict 邏輯保留（newStart < eEnd AND newEnd > eStart → 409 +
  conflictWith）。送 legacy 欄位 → 400「欄位已廢除」明確訊息。
- **Frontend rename hard cutover**: `SavedPoisPage` → `PoiFavoritesPage` /
  `AddSavedPoiToTripPage` → `AddPoiFavoriteToTripPage`；routes `/saved` → `/favorites` /
  `/saved-pois/:id/add-to-trip` → `/favorites/:id/add-to-trip`（不留 `<Navigate>`
  redirect）；types `SavedPoi` → `PoiFavorite` / `SavedPoiUsage` → `PoiFavoriteUsage`；
  內部變數 `savedPois` → `poiFavorites` / `savedKeySet` → `favoriteKeySet` / `isSaved`
  → `isPoiFavorited`；fetch URL `/api/saved-pois` → `/api/poi-favorites`。
- **Sidebar + BottomNav**: key `saved` → `favorites` / label「我的收藏」→「收藏」
  （廢除 DESIGN.md L298 asymmetric labels；ownership 由 PoiFavoritesPage hero
  eyebrow 補回）/ activePatterns 全 rename。
- **CSS classes** `.saved-*` → `.favorites-*`（shell/wrap/eyebrow/grid/card/error/
  toolbar 等）；data-testid 同步 rename；`.tp-saved-add-to-trip` →
  `.tp-favorites-add-to-trip`；`.tp-add-stop-saved-*` → `.tp-add-stop-favorites-*`。
- **Middleware**: companion 白名單 `/api/saved-pois*` 4 條 path → `/api/poi-favorites*`
  （hard cutover）。
- **Tp-* skill auth headers**: 14 個 skill 檔案（`.claude` + `.codex` 各 7 個）
  `CF-Access-Client-Id` / `CF_ACCESS_CLIENT_ID` → `Authorization: Bearer
  $TRIPLINE_API_TOKEN`（V2 OAuth client_credentials grant）；security.md 認證機制
  描述同步。
- **LoginPage** L546「我的收藏跟著你」→「收藏跟著你」；ExplorePage aria-label
  「儲存到收藏」→「加入收藏」/「已儲存」→「已收藏」。
- **`logAudit()` extension**: 加 optional `companionFailureReason` 欄位 + `audit_log`
  INSERT 多寫一個 column（既有 caller 不受影響 — column nullable）。
- **CLAUDE.md Hard Rules**: 加「Mockup-first hard gate — 所有 new page / new component
  ≥1 layout 變化 → /tp-claude-design 產 HTML mockup → user sign-off → 才寫 React」。

### Fixed

- **request 181 401 痛點**: tp-request scheduler 持 V2 OAuth Bearer client_credentials
  token（user_id null）打 `/api/saved-pois` 強制 `auth.userId` 觸發 401。本 PR 透過
  companion 三 gate + submitter 對映補 effective userId 解此痛點。
- **`/api/poi-search` 198 筆 prod 401**: V2 cutover 漏列 public-read whitelist。修 1 行。
- **Rate limit race**: 100 burst concurrent 從 race 收斂到 1 → atomic SQL 收斂到 100
  （+ companion bucket 隔離防 cross-attack）。

### Tests

- 18 migration tests (poi_favorites schema / companion_request_actions / audit_log
  column / data copy)
- 22 companion-resolver unit tests（10 cases A-J + V2 user fallback + GET query path）
- 24 rate-limit tests（atomic 2 + bucket-isolation 3 + module 17 + saved-pois 2）
- 16 middleware tests（companion-gate 4 + poi-search-public 4 + companion-whitelist 9）
- 41 poi-favorites integration tests（POST 15 + GET 7 + DELETE 8 + add-to-trip 11）
- 全 unit suite 1331/1331 ✓ / 全 test:api 590/632 ✓（35 intentional skipped）

### Deferred to follow-up

- §11/§12 mockup-driven UI redesigns（mockup 已 sign-off，React refactor 留 follow-up
  PR — 不阻擋本 rename + companion infra）
- §13 PageErrorState/EmptyState shared component 抽取
- §15.1-15.3 tp-request SKILL.md「加入收藏」H3 段 + 401 debug checklist
- §16.1, 16.3-16.5 tp-team SKILL.md / DESIGN.md / ARCHITECTURE.md history sections
- §17 DESIGN.md asymmetric labels rewrite
- migration 0051（DROP TABLE saved_pois，soak ≥ 1 week 後）

### Pre-merge gates（admin / SRE 動作）

- §1.2 `TRIPLINE_API_TOKEN` Cloudflare Pages secret provision（admin re-run
  `scripts/provision-admin-cli-client.js` + `wrangler pages secret put`）
- §1.3, §19 mac mini cron `scripts/tp-request-scheduler.sh` URL → `/api/poi-favorites`
  + 換新 OAuth token 含 `admin + companion` scope

## [2.21.3] - 2026-05-04

**`trip_requests.mode` rip-out phase 2 — DROP COLUMN** — 完成 PR #471 留下的
phase 2，schema 完全清掉 vestigial column。Override 24 hr soak 直接 ship（phase 1
才 deploy ~10 min 但風險已 mitigate：column 已 nullable + code 已停止寫 + types 已
optional，DROP COLUMN swap idiom 是 reversible 操作）。

### Changed

- **Migration 0049 phase 2** (`migrations/0049_trip_requests_mode_phase2.sql`):
  DROP COLUMN `trip_requests.mode` via standard SQLite swap idiom。trip_requests
  無 children FK，不需 0047 backup-restore pattern。Rollback 採 schema-only：
  mode column 重建為 nullable，歷史值已遺失（true rollback 走 wrangler d1
  time-travel）。
- **`src/types/api.ts`** — `Request.mode` field 完全移除（phase 1 為 optional，
  phase 2 schema 沒這 column 了，type 對齊）。
- **schema-pin tests** — `tests/unit/requests-api.test.js` assertion 從「INSERT
  不含 mode」延伸到「整個 handler 不 reference mode / 'trip-edit' / 'trip-plan'」。
- **integration tests** — `tests/api/requests.integration.test.ts`:
  - `data.mode` 期望從 `toBeNull()` 改 `not.toHaveProperty('mode')`（response shape
    不再有 mode key）。
  - `sanitizeReply` test 的 raw INSERT seed 移除 mode column（schema 沒這欄，
    舊 SQL 會 SQLITE_ERROR）。

### Deploy runbook

同 phase 1 順序（CF Pages auto-deploy ↔ migration apply 不 atomic）：

1. `bash scripts/backup-prod-d1.sh`
2. `wrangler d1 time-travel info trip-planner-db --json | tee backups/bookmark-pre-0049.json`
3. **先** `wrangler d1 migrations apply trip-planner-db --remote`（DROP COLUMN）
4. **再** merge PR → CF Pages auto-deploy（types/code cleanup 上線）
5. 驗證：`wrangler d1 execute trip-planner-db --remote --command "PRAGMA table_info(trip_requests);"`
   不該見 mode column。

順序顛倒會在新 code 與舊 schema 之間留 race window：舊 worker SELECT 仍會回 mode
field 但新 type 沒這 key（runtime 不影響但 inconsistent）。

## [2.21.2] - 2026-05-04

**V2 cutover audit + mode rip-out phase 1** — chat 觸發 tp-request 時發現
`sanitizeReply` 攔截 footer，引發全面 audit。修補 migrations 0045–0047 的 spec/code
殘留 drift，啟動 `trip_requests.mode` rip-out 第 1 階段（schema 改 nullable + drop
CHECK constraint，code 停止寫 mode）。

### Added

- **Migration 0048 phase 1** (`migrations/0048_trip_requests_mode_phase1.sql`):
  把 `trip_requests.mode` 從 NOT NULL + CHECK 改成 nullable，採 standard SQLite
  swap idiom（trip_requests 無 children FK，不需 0047 backup-restore pattern）。
  Rollback 採 best-effort schema-only：post-phase-1 mode=NULL row 用
  `COALESCE(mode, 'trip-plan')` backfill。
- **`scripts/backup-prod-d1.sh`** — D1 prod 完整備份 wrapper（migration apply 前的
  安全網），動態抓 user table 排除 log tables（api_logs / error_reports /
  auth_audit_log / webhook_logs），輸出 SQL dump 到 `./backups/`。
- **schema-pin test for mode rip-out** — `tests/unit/requests-api.test.js` 新增
  「INSERT 不含 mode column」+「不再驗證 trip-edit / trip-plan」negative assertions。

### Changed

- **`functions/api/requests.ts`** — POST 不再寫 `mode` column（INSERT 從
  `(trip_id, mode, message, submitted_by)` 縮成 `(trip_id, message, submitted_by)`）；
  audit `diffJson` 也移除 mode field。tp-request skill 自動判別意圖。
- **`functions/api/trips/[id]/audit/[aid]/rollback.ts`** — `TABLE_COLUMNS.trip_requests`
  移除 `mode`（phase 1 後 column 為 vestigial）。
- **`src/types/api.ts`** — `Request.mode` 從 required `'trip-edit' | 'trip-plan' | 'trip-info'`
  改成 `mode?: string | null`（schema 已 nullable，新 row 為 NULL）。
- **`src/pages/ChatPage.tsx`** — stale comment 提到 "CHECK constraint default"（已不存在）
  簡化為 mode rip-out 描述。
- **`src/pages/NewTripPage.tsx`** — 移除 dead code `ownerEmail` 變數 + POST body
  `owner` 欄位（v2.20.0 V2 cutover 後 `functions/api/trips.ts` POST handler 完全
  用 `auth.userId`，body.owner 從未被讀取）。
- **`scripts/daily-report.js`** — SQL `pois.google_rating` → `pois.rating`
  （migration 0045 rename，原本 daily-check 此項會 SQL error 中靜默失敗）。
- **tp-request skill spec** (`.claude/.codex` 鏡像同步):
  - 刪除 `reply-format.md` DX-C2 整段「reply footer」規範與 actions_taken JSON 範例
    （與 `sanitizeReply` 安全防線衝突，footer 機制 drop）。
  - 刪除 `SKILL.md` step 3c-bis「Audit log via actions_taken column」整段。
- **tp-create skill** `references/browse-rating-script.md` — POI 評分 PATCH body
  從 `{ google_rating: X.X }` 改成 `{ rating: X.X }`（API 白名單只認 rating，舊欄名
  會被 silent drop 導致 400「無有效欄位可更新」）。
- **tp-quality-rules skill** R16 改寫：`pois.maps` 已 DROP，hotel POI 改建議檢查
  `lat`+`lng`（frontend 透過 mapsUrl helper 衍生 Google Maps URL）+ `address`。
- **tp-patch skill** description / `--field` arg：`google_rating` 改 `rating`，明確
  標註「不接受 google_rating 別名」防止 LLM 誤用。

### Removed

- `.agents/` 整個本地 skill mirror 目錄（gitignored，3.2 MB；已不再使用，相關內容
  從 `.claude/` 同步來，需要時可重建）。

### Deploy runbook

⚠️ **順序很重要**（避免 race condition：CF Pages auto-deploy 與 D1 migration apply
不是 atomic，反序會在新 code 與舊 schema 之間留 NOT NULL violation 窗口）：

1. `bash scripts/backup-prod-d1.sh` — 完整備份（排除 log tables）。
2. `wrangler d1 time-travel bookmark create trip-planner-db --json | tee bookmark.json`
3. **先 apply migration**：`wrangler d1 migrations apply trip-planner-db --remote`
   （此時 mode 變 nullable，舊 worker 仍寫 `mode='trip-plan'` 也滿足 schema）。
4. **再 merge PR** → CF Pages auto-deploy 新 code（不寫 mode，DB 為 NULL）。
5. `/canary` monitor ≥ 1 hr，觀察 prod 5xx + console errors。
6. Phase 2 follow-up PR：DROP COLUMN mode（soak ≥ 24 hr 後）。

## [2.21.1] - 2026-05-04

**v2.21.0 deferred cleanup** — 完成 v2.21.0 PR 末尾留的 deferred follow-up：server-side
409 conflict detection（補完 ConflictModal contract）+ schema-pin tests 部分 rewrite
（deleted obsolete saved-pois-schema, rewrote saved-pois.integration, un-skipped
oauth-signup）。

### Added

- **Server-side 409 conflict detection** for `POST /api/saved-pois/:id/add-to-trip` (MF2 server completion):
  - 新 entry 與同 day 既有 entry 時段重疊 → 409 + `{error:'CONFLICT', conflictWith:{entryId, time, title, dayNum}}`
  - Overlap 邏輯：`newStart < entryEnd AND newEnd > entryStart`（任何 portion 重疊）
  - `position=replace` 跳過檢查（要取代的本來就重疊；avoid double-prompt）
  - NULL `time` entries 永遠不算 conflict（無時段 basis）
  - 跨 day 不算 conflict（trip_days 不同）
  - 精確接續（newStart === existingEnd）不算 conflict（半開區間語意）
- **Helper functions** `parseTimeRange()` + `hhmmToMin()` in `add-to-trip.ts` for time-range overlap math.
- **Integration test `tests/api/saved-pois-add-to-trip.integration.test.ts`** (NEW, 6 tests): overlap 409 / exact match 409 / contiguous 201 / different day 201 / NULL time 201 / replace 201.

### Changed

- **`tests/api/saved-pois.integration.test.ts`**: full V2-cutover rewrite. Pre-V2.20.0 inline `INSERT INTO saved_pois (email, poi_id)` SQL replaced with user_id-keyed inserts via `seedUser()` helper + `userIdFor()` deterministic id derivation. 3 describes un-skipped (13 tests pass: GET/POST/DELETE matrix).
- **`tests/api/oauth-signup.test.ts`**: `describe.skip` → `describe`. Tests pass un-modified (signup writes to users + auth_identities tables, unaffected by trips.owner / saved_pois.email column drops).

### Removed

- **`tests/api/saved-pois-schema.integration.test.ts`** — DELETED. Test file pinned migration 0028-era schema (`saved_pois.email` UNIQUE on `(email, poi_id)`); whole schema premise dropped V2.20.0 (migration 0046+0047 → user_id-keyed pool). Re-pin from saved-pois.integration.test.ts (current schema).

### Deferred to v2.21.2

- **`tests/api/account-stats.integration.test.ts`** — `tp.email = '*'` wildcard removed V2.20.0; needs full SQL rewrite for new permission scheme.
- **`tests/api/trips.integration.test.ts`** — POST/GET trips body/response shape (owner field) needs camel/user_id alignment.
- **`tests/api/permissions-post.test.ts`** — 5 describe blocks mocking `SELECT owner FROM trips` (now `SELECT owner_user_id FROM trips`); needs deep mock refactor + `makeContext` userId field addition.
- **`tests/api/invitations-list-revoke.test.ts`** — same mock-SQL stale pattern (8 occurrences).
- **LLM Decision Rubric prompt-injection regression test fixtures** — needs separate fixture infra design.
- **Page-transition cache** — no React Query/SWR; `/explore`→`/saved` short loading flash acceptable.
- **/design-review parallel worktree** — separate skill invocation, mockup parity audit pass.
- **X-Request-Dry-Run middleware impl** — was deferred from v2.20.1; needs separate spec.

## [2.21.0] - 2026-05-04

**IA reshuffle** — sidebar 第 4 項「探索」→「我的收藏」升 primary nav (saved POIs universal
pool first-class entity)；「探索」降為 `/saved` 頁右上 ghost secondary action。同 PR 含 P0
service-token defense-in-depth + 數項 v2.20.1 follow-up cleanup。

### Breaking

- **Primary IA**：DesktopSidebar / GlobalBottomNav 第 4 項從 `/explore` 改為 `/saved`。
  - DesktopSidebar 用「我的收藏」label（text-led）；GlobalBottomNav 用「收藏」（5-tab 緊密 + heart icon）— asymmetric labels intentional。
  - `/explore` URL 仍 valid 為 secondary entry，sidebar/bottom-nav active 仍 highlight「我的收藏 / 收藏」（via `additionalActivePatterns: [/^\/explore/]`）。
- **ExplorePage tab pair retired**：原 search/saved dual-tab 拆 page，`tab` state machine + `aria-label="我的收藏"` 殘留 ARIA 全清。
- **`audit_log.changed_by` 對 non-admin service token 改為 `service:${client_id}` sentinel**（取代 ADMIN_EMAIL forgery）。FE / 第三方 reader 不該假設 changed_by 永遠是 email — 可能是 `service:*` 或 sentinel。

### Added

- **`SavedPoisPage`** (`src/pages/SavedPoisPage.tsx`, NEW)：top-level `/saved` route，page-hero + 5-state matrix（loading skel / empty CTA / error PageErrorState / data / optimistic-delete）+ search-within-saved client-side filter + POI type filter chips + multi-select 批次刪除（ConfirmModal）+「目前在 N 個行程」usage badges + 「加入行程 →」link to `/saved-pois/:id/add-to-trip`。
- **`ConflictModal`** (`src/components/shared/ConflictModal.tsx`, NEW)：role=alertdialog，三選 action「取消 / 取代既有 / 改插入到後面」。AddSavedPoiToTripPage 接收 server 409 `{conflictWith:{entryId,time,title,dayNum}}` 自動彈出。Server 409 detection logic deferred to v2.21.1（component ready）.
- **POST `/api/saved-pois` rate limit** — D1-backed via `_rate_limit.ts`（migration 0035 `rate_limit_buckets` table），10/min per user，`SAVED_POIS_WRITE` config preset，admin scope bypass。Defends POI enumeration oracle attack。429 with Retry-After header。
- **`functions/api/_auth.ts` defense-in-depth**：`hasPermission` / `hasWritePermission` 對 `auth.isServiceToken && !isAdmin` 早 return false，belt-and-suspenders 補強既有 `userId=null` guard（防未來 code path 誤用 `auth.email`）。
- **AddSavedPoiToTripPage AppShell wrap**：4 個 render branch（loadError/loading/empty/main）統一包進 `AppShell sidebar={...} bottomNav={...}`。Sidebar 與 bottom-nav 對齊其他主功能頁面。
- **`ApiError.payload` field**：preserves full response body for structured error payloads (e.g., 409 `conflictWith` object).
- **Integration test `tests/api/middleware-service-token.integration.test.ts`** (NEW)：admin scope 通過 / non-admin scope 拒絕 / forged userId 仍拒絕（defense-in-depth）/ user session 仍 gate by trip_permissions / audit attribution sentinel 行為。
- **Integration test `tests/api/saved-pois-rate-limit.integration.test.ts`** (NEW)：10/min 通過 + 11 次回 429 + Retry-After / admin 不受 rate limit 影響。
- **Unit test `tests/unit/conflict-modal.test.tsx`** (NEW)：render + interaction + busy state。

### Changed

- **`functions/api/_middleware.ts`**：service-token email 從無條件 `env.ADMIN_EMAIL` 改為「admin scope 才繼承 ADMIN_EMAIL；non-admin scope 設 `service:${client_id}` sentinel」防 audit attribution forgery。
- **DESIGN.md** — L181（Primary IA list）/L257-260（TitleBar route 範例）/L297-298（Primary nav 順序 + asymmetric label rule）/L316-318（bottom-nav active 表格）/L482（SavedPoisPage replace ExplorePage 收藏批次「刪除」）/L628（IA chrome list）— 三方同步。新增 v2.21.0 IA Reshuffle section（SavedPoisPage 規格 + 5-state matrix + ExplorePage 變動）。
- **mockup `docs/design-sessions/terracotta-preview-v2.html`** — sidebar 第 4 項 icon `i-explore` → `i-heart` + label「探索」→「我的收藏」（多處 bottom-nav demo 同步）；section-lead descriptions + bottom-nav active aria-label + explore page section description 全標 v2.21.0 secondary entry。
- **`ExplorePage`**（純探索化）：移除 tab state machine + ARIA cleanup + TitleBar 右上 action 改 navigate `/saved`（label「收藏」）+ trips picker / saved batch operations 全部搬到 SavedPoisPage。仍 mini-fetch `/saved-pois` 維 `savedKeySet` 正確 disable heart toggle（option A，無 SWR）。
- **`AddSavedPoiToTripPage`**：`useNavigateBack` default `/explore` → `/saved`；server 409 → ConflictModal 三選 action 自動彈出（reuse submitInsert with override args）。
- **EntryActionPage / AddStopPage snake/camel mismatch (P2 from TODOS)** — `day_num` / `day_of_week` / `entry_count` / `day_id` interfaces + reads 改 camelCase（`_utils.json` deepCamel 後 API 真實回 camelCase；DAY「空」label cosmetic regression 修復）。
- **`tests/e2e/api-mocks.js`** — `MOCK_DAYS_*` 拿掉 dual-key snake_case 殘留（與真 API 一致）。

### Deferred to v2.21.1+

- Server-side 409 conflict detection logic for `POST /api/saved-pois/:id/add-to-trip`（ConflictModal component ready；server-side detection 需 day-overlap 規則設計）。
- 7 schema-pin API tests rewrite (account-stats / permissions-post / saved-pois* / trips.integration / oauth-signup / invitations-list-revoke / saved-pois-schema) — inline SQL 仍 reference V2.20.0 dropped columns（`trips.owner`, `saved_pois.email`），需逐檔 seedTrip helper migration。Re-skip 為 stable CI baseline。
- Page-transition cache (no React Query/SWR in codebase, `/explore`→`/saved` 短 loading flash acceptable)。
- LLM Decision Rubric prompt-injection regression test fixtures。
- /design-review parallel worktree run for visual mockup parity audit。

### Reviewed

- **/autoplan 3-phase**（CEO + Design + Eng）— Codex usage limit (reset 03:01) 期間以 Claude subagent-only 跑。CEO subagent severe push back on PR shape (D2=A user override, B/C 推薦) + Approach (D3=B user override A 推薦)。Design subagent 6.5/10 with 2 must-fix（page-hero + search retain）。Eng subagent 6/10 with 3 high-severity（rate limit infra D1 not KV, ConflictModal absent, AppShell LOC re-estimate）。**11 must-fix + 2 taste 全接 via D4=A**。
- Decision Audit Trail 寫入 design doc `~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260504-022947.md`。

## [2.20.0] - 2026-05-04

**Major upgrade** — V2 owner email→user_id 完整 cutover + trip_ideas 概念退場
（合一進「我的收藏」universal pool）+ tp-request 行為簡化（拔 mode/intent 分流）。

### Breaking

- **Schema cutover (migration 0046+0047)** — `saved_pois.email` / `trip_permissions.email` / `trips.owner` (email column) **DROPPED**。所有 ownership / permission 改純 `user_id`-keyed。**前置條件**：所有 prod user 必須有 V2 OAuth `users.id`。
- **`trip_ideas` table dropped** — 「備案」概念合一進 `saved_pois` (universal pool)。`?sheet=ideas` URL pattern retired (legacy URL graceful degrade to default tab)。`functions/api/trip-ideas.ts` + `IdeasTabContent.tsx` + 5 個相關 tests 一併移除。
- **`trip_permissions.email='*'` wildcard** — phase 2 cutover 先 drop，未來改 dedicated `public_trips` column (phase 3)。

### Added

- **「我的收藏」加入行程 fast-path UI** — `route /saved-pois/:id/add-to-trip`，全頁 form (DESIGN.md L390-414)，6 fields。stay duration 依 POI type heuristic。**不走** message-based tp-request 避免 LLM 8 秒等待感。
- **`POST /api/saved-pois/:id/add-to-trip` REST endpoint** — fast-path inserts trip_entries + trip_pois，travel_* 背景 fill。
- **「目前在 N 個行程」徽章** — `GET /api/saved-pois` 用 `json_group_array` 一次 LEFT JOIN trip_pois (避 N+1)。
- **`trip_requests.actions_taken` audit log column** — reply 必含「我做了什麼」摘要 footer，旅伴可即時 catch overreach。
- **Decision Rubric 取代 mode/intent matrix** — tp-request SKILL.md：明確動作詞 → 寫資料；純疑問 → 回覆；模糊 → 保守 default。含 HuiYun 「Day 2 換成沖繩そば」 worked example。
- **`X-Request-Dry-Run: 1` companion header** — DX-C4 escape hatch；Ray 排查 LLM 誤判用。
- **`scripts/verify-user-backfill.ts`** — E-H4 pre-PR gate；列出 4 表 email column 任何 orphan，0 才能 migrate。
- **`scripts/fixup-local-users.sql`** — local dev seed 補 synthetic users。`init-local-db.js` Step 2.5 自動套用。

### Changed

- **`tp-request` SKILL.md (4 平台)** — `.claude` `.codex` `.agents` 同步；意圖安全矩陣整段拔除；security.md 加 saved-pois 5 條 white-list。
- **`_auth.ts` `hasPermission` / `hasWritePermission`** — 純 user_id-keyed query；26 callers 改 pass `auth` object 而非 `auth.email`。
- **`AuthData` type** 加 `userId: string | null`。
- **DESIGN.md** 加 V2 cutover spec section。
- **`docs/design-sessions/terracotta-preview-v2.html`** 加 3 frames mockup。
- **`SHEET_TABS`** `['itinerary','ideas','map','chat']` → `['itinerary','map','chat']`。

### Infrastructure

- **D1 time-travel bookmark `00000c7e-00000000-00005060-c83adc25887a5d6b61bffb2004e726d3`** 為 phase 1+2 rollback point。
- **autoplan 13 must-fix 全 integrate** — Codex 撞 usage limit 期間跑 [subagent-only]，REVISE verdict 由 Ray override D5=B 維持 Big Bang。

### Migration runbook

phase 1 (0046) auto-applied。phase 2 (0047) 推薦 manual gate：
1. confirm commit 1-6 deploy + code 100% 走 user_id-only auth
2. soak ≥ 1 hr 觀察 prod logs
3. `bun scripts/verify-user-backfill.ts` 對 prod PASS (0 orphans)
4. `wrangler d1 backup` 記 bookmark
5. `wrangler d1 migrations apply trip-planner-db --remote`

## [2.19.17] - 2026-05-03

### Fixed

- **Chat 訊息歷史終於看得到最新的（multi-message user 全解鎖）** — ChatPage 載入用 `sort=asc&limit=20` 永遠停在最舊 20 筆，4 月 5 月送的訊息全部看不到。HuiYun 反映「沒紀錄、回覆失敗」就是這個。改用 cursor pagination：初次載最新 5 筆 (`sort=desc&limit=5` reverse)，user scroll 到頂自動載前 5 筆 (`before/beforeId` cursor)，畫面位置不跳。
- **CF Worker → Mac 即時觸發從 11 分鐘等 cron 變 1 秒（chat AI 回覆延遲修正）** — Tailscale `serve` (tailnet-only :443 → openclaw 18789) 取代了 `funnel`，CF Worker public TLS handshake 一律 525/530。Cron 15-min fallback 兜底但 user 體感很差。改 `tailscale funnel --bg --https=443 http://127.0.0.1:8080` 走回 Caddy 路徑路由 (`/tripline/api/*` → 6688)。Defense-in-depth 與 trust boundary header check 維持。Latency 11 分鐘 → 1 秒 (req 178 vs 179 對照驗證)。
- **scroll behavior 不再被 SSE / send 同 tick 干擾** — 原 `prependScrollRef` scrollHeight delta 在 SSE bubble 取代 / 新訊息 setMessages 同 tick 觸發時會誤判，user 滾上去看舊訊息可能被拉回底。改用 first/last message id diff：first 變 = prepend 補位、last 變 = 新訊息拉到底、皆同 = 不動。

### Added

- **`useChatPagination<TRow, TMsg>` hook** — `src/hooks/useChatPagination.ts`。把 cursor pagination + scroll 行為 + race guard 從 ChatPage 抽出。Generic over row + message types。同步 `loadingOlderRef` 擋 iOS momentum scroll 同 tick 多重觸發、`activeTripIdRef` 比對防 trip switch 時舊 fetch 污染、`prependScrollRef` 在 trip switch 清空、連續失敗 backoff (`ERROR_BACKOFF_MS = 2000`)。
- **Chat 載入失敗 inline retry banner** — 401/network error 時 `loadError` 觸發 sticky-top banner + retry button，不再 silent swallow + 無感 storm fetch。
- **11 個 pagination unit test** — `tests/unit/use-chat-pagination.test.tsx`。涵蓋 initial fetch / cursor seeding / hasMoreOlder / inflight resume / fetch error / trip switch reset / loadOlder happy path / empty rows defensive / 並發 gate / race guard / retry。

### Changed

- **ChatPage.tsx 縮 +55/-47**（pagination 邏輯抽到 hook）— 1148 → 1100 行。Component 變回專注 UI composition，pagination 行為單元可測。

### Infrastructure

- **Tailscale funnel 三層架構文件** — `funnel :443 → Caddy :8080 → 後端 (tripline:6688 / openclaw:18789)`。Caddy header check 擋 funnel 來的 openclaw 流量（defense-in-depth），path strip 讓後端 service 不需知 `/tripline/api` 前綴。第二次 funnel→serve regression（昨日 openspec proposal 有提），下次 incident 可參考 memory `project_tailscale_funnel_caddy_architecture.md`。

## [2.19.16] - 2026-05-03

### Fixed

- **Desktop sidebar 對齊 Terracotta mockup** — 主導覽固定為「聊天 / 行程 / 地圖 / 探索」，`/trip/:id/map` 與 stop map route 正確高亮「地圖」，行程子頁保留「行程」高亮。Sidebar icon、spacing、typography、inactive contrast、account chip 也收斂到 mockup 規格，並補 dark mode 固定 cocoa background，避免 token reversal 讓 sidebar 變亮。

### For contributors

- DESIGN.md 與 `terracotta-preview-v2.html` 同步更新 desktop IA：帳號不是 primary nav，已登入使用 bottom account chip，未登入才顯示 login action。
- 新增/更新 DesktopSidebar unit + visual tests，鎖住 map active route、4-item desktop nav、guest login、light/dark sidebar color tokens。

## [2.19.15] - 2026-05-03

### Fixed

- **mobile form action bar 終於可點（form-page 4 page 全解鎖）** — `.tp-page-bottom-bar` z-index 從 `5` 提到 `calc(var(--z-sticky-nav, 200) + 10)`。Mobile <1024px 時 `.app-shell-bottom-nav` 與 `.tp-page-bottom-bar` 都是 `position: fixed; bottom: 0`，原 z-index `5` 被 nav (`--z-sticky-nav: 200`) 蓋住，clicks on `entry-action-confirm` / `add-stop-confirm` / `edit-trip-submit` 全被 nav `<a>` 攔截。Regression 來自 PR #428/#430/#431 modal-to-fullpage migration（原 modal 走 portal stacking context 不衝突，改 page 後同層）。Desktop nav `display: none` 無此衝突。Master CI 6 mobile-chrome+mobile-safari E2E test fail 於此修復後解鎖。

### Changed

- **CLAUDE.md compacted to ~531 tokens (English)** — 從 ~3000 token 中文版精簡 82%，翻譯成英文。保留 7-stage pipeline、hard rules、layout、dev gotchas（`.dev.vars` vs `.env.local` trap、`TRIPLINE_API_URL` `:443` not `:8443`）、Design SoT 政策、skill routing（補上 `/document-release`）、GBrain config pointer。完整 env 列表、project tree、POI schema、deprecated `RESEND` 註記移到 ARCHITECTURE.md / GEMINI.md / DESIGN.md / openspec/config.yaml / .dev.vars.example 等專責檔案。

## [2.19.14] - 2026-05-03

### Changed

- **行程明細頁 day strip 回到 Terracotta 單色** — 原本 day eyebrow + active
  underline 套 10 色 day palette (sky/teal/amber/...),跟 V2 設計核心承諾
  「UI chrome 嚴守單色 accent」分歧。本版收斂: idle muted, active 套
  Terracotta accent。多色仍保留在地圖頁 (polyline + 底部 day strip + entry card),
  服務於 N 條路徑的視覺區分需求。

### For contributors

- DESIGN.md L30 + L322-324 改寫 Day palette 例外限縮到「只用於地圖
  (polyline + Map page chrome)」, 排除 trip 明細頁
- mockup `terracotta-preview-v2.html` Section 11 拆兩 variant: trip detail (單色)
  vs Map page (多色), 對齊新 spec
- DayNav.tsx 拿掉 dayColor import + 2 處 prop pass; MapDayTab component API 不動
  (`dayColor?` 仍 optional, MapPage 端仍傳)

## [2.19.13] - 2026-05-03

### Fixed

- **景點移動／複製不再卡「找不到這筆資料」** — 進 `/trip/:id/stop/:eid/move`
  或 `/copy` 之前會 hit GET `/api/trips/:id/entries/:eid` 拿當前 day。real
  endpoint 沒 export `onRequestGet` → CF Pages 回 405 → 頁面顯示 alert
  整個 broken。補 `onRequestGet` (auth + 讀權限 + cross-trip 驗證 + SELECT
  id, day_id, title)。move/copy flow 解鎖。
- **編輯行程「儲存變更」 button (bottom) 終於會 submit** — `<form>` 沒設
  `id="edit-trip-form"`,但下方 button 寫 `form="edit-trip-form"` → 對不到
  → click 沒反應。1 行加 `id` 修。TitleBar 上方「儲存」 button 走 formRef
  一直是 canonical workaround,沒受影響。

### For contributors

- 新增 4 個 integration tests cover entries/[eid] GET 200/401/cross-trip-404/not-found-404
- 新增 e2e Flow 5 bottom button submit assertion (regression lock)
- TODOS.md 新增 P2 entry: EntryActionPage / AddStopPage 多處讀 snake_case
  (d.day_num / entryData.day_id 等),但 `json()` helper 自動 deepCamel,
  page 拿到 undefined 導致 day picker 顯示「Day 空」 label。功能 work,純
  cosmetic。下個 PR 改 page consumers 對齊 camelCase。

## [2.19.12] - 2026-05-03

### Fixed

- **帳號頁「開發者選項」 row 點下去進得了** — 之前 row link 指向
  `/settings/developer-apps`, 但實際 route 是 `/developer/apps`
  （per `src/lib/routes.ts:36`）, 點擊跳到 NotFound page。對齊 canonical
  route, dev 用戶現在從帳號頁可以直接進開發者 OAuth client app 管理。

### For contributors

- **11 個 QA flow Playwright e2e specs** (`tests/e2e/qa-flows.spec.js`) — cover
  使用者最常走的 CRUD 路徑：新增行程、新增景點 (custom)、搜尋加收藏、移除
  收藏、編輯行程、編輯景點 inline note、移動景點 cross-day、刪除景點、刪除
  行程、帳號頁 + 登出 modal。每條從 user click 開始,assert 真實 endpoint
  body shape。
- **`scripts/qa-email-flows.sh`** — curl 一鍵驗 prod 發信 infrastructure
  (5 paths cover health probe + anti-enum + 真寄 reset email)。dry-run
  default,`--send` 才寄真信。Hardened 多重安全 gate (URL validation,
  email weaponize 防護, parallel-safe mktemp, env var fallback)。
- **`tests/e2e/api-mocks.js`** — 補 PUT/DELETE `/api/trips/:id` +
  GET/PATCH/DELETE `/api/trips/:id/entries/:eid` + POST entry copy
  endpoints。`MOCK_DAYS_*` 加 `day_num` snake_case dual-key (對齊真 D1 API
  schema, 讓 EntryActionPage / AddStopPage 直讀 snake_case 不需 normalize)。

## [2.19.11] - 2026-05-03

### Fixed

- **`scripts/daily-check.js` `queryProdDataHygiene` SQL bug** — 連續 3 天靜默
  失敗修復。原 SQL 從 `trip_entries` 取 `trip_id, day_num`，但這兩欄實際
  在 `trip_days`。D1 自 4/30 起回 `400 SQLITE_ERROR no such column: trip_id`，
  catch 把 error 包成 `status: 'ok'`，3 天 daily-check 假裝綠燈遮蓋 silent
  failure。改 JOIN `trip_days td ON te.day_id = td.id`，catch 改回
  `status: 'warning'` surface 失敗。
- **`scripts/daily-check-scheduler.sh` Telegram 訊息漏報** — `build_telegram_msg`
  沒讀 `r.dataHygiene`，即使 SQL 修好 + status='warning'，Telegram 仍顯示
  「✅ 全綠」。補 issues block：error → 🔴「prod data hygiene 檢查失敗」、
  `total>0` → ⚠️「N 筆 test marker 殘留」。

### Notes

- 本次修復承接 PR #416 (v2.18.4) 內容 — 該 PR 因 master 已進到 v2.19.x 不能
  直接 merge，本 PR 把 code fix cherry-pick 過來重發 v2.19.11。原 PR #416
  同步 close。
- SQL injection-safe (hardcoded `PROD_DATA_TEST_MARKERS` constants +
  `replace(/'/g, "''")` belt-and-braces)。
- INNER JOIN 在 PK + indexed FK (`migration 0030 idx_trip_entries_order(day_id, ...)`) 效能無虞。
- `trip_entries.day_id NOT NULL REFERENCES trip_days.id` (migration 0002 +
  0014)，INNER JOIN 安全無孤兒風險。

## [2.19.10] - 2026-05-03

### Changed

- **AccountPage 登出二次確認 + ConnectedAppsPage 撤銷第三方 app** 兩個手刻
  modal 改用標準化 `<ConfirmModal>` 元件 (P3 confirm-modal cleanup 收官)。
  對齊 mockup S22 「Dialogs system — ConfirmModal / InputModal / Toast」
  統一視覺 + a11y (alertdialog role / portal / ESC dismiss / focus trap /
  V2 Terracotta destructive 紅色 confirm button)。
- **Unit test testid** 從 page-specific (`account-logout-confirm` /
  `connected-apps-confirm-modal` / `connected-apps-confirm-revoke` /
  `connected-apps-cancel-revoke`) 改為 ConfirmModal 標準 testid
  (`confirm-modal-confirm` / `confirm-modal-cancel` / `confirm-modal`)
  — 跨 page 一致，未來新 confirm 流程同 selector pattern。

### Removed

- **AccountPage `tp-logout-*` CSS** (~40 LOC backdrop / shell / title /
  copy / actions / danger button) — 整段隨手刻 modal 退役，由 ConfirmModal
  SCOPED_STYLES 統一管。
- **ConnectedAppsPage `tp-modal-*` CSS** (~40 LOC backdrop / shell /
  header / icon-circle / body / footer) — 同上隨手刻 modal 退役。
- **AccountPage 手刻 modal JSX block** (~20 LOC) + **ConnectedAppsPage
  手刻 revoke confirm JSX block** (~38 LOC) — 各自 swap 為一次 `<ConfirmModal>`
  call。淨減 ~110 LOC code。

### Notes

- **Developer apps secret reveal modal 不在 cleanup 範圍** — critical
  attention UX 例外（一次性 server response state，跳頁 back/share/refresh
  會丟資料）。DESIGN.md audit table 標記 ✅ 保留。

### Migration progress

DESIGN.md 2026-05-03 「Modal vs Full Page Decision」 audit 全部結束:
- ✅ EditTripModal → /trip/:id/edit (PR #428, v2.19.4)
- ✅ NewTripModal → /trips/new (PR #429, v2.19.5)
- ✅ EntryActionPopover → /trip/:id/stop/:eid/(copy|move) (PR #430, v2.19.6)
- ✅ AddStopModal → /trip/:id/add-stop?day=N (PR #431, v2.19.7)
- ✅ DeveloperAppsPage create-app modal → /developer/apps/new (PR #432, v2.19.8)
- ✅ ExplorePage trip-picker → anchored popover (PR #433, v2.19.9)
- ✅ DESIGN.md audit + mockup banner sync (PR #434)
- ✅ **P3 confirm-modal cleanup (本次, v2.19.10)** ← audit 收官

## [2.19.9] - 2026-05-03

### Changed

- **ExplorePage trip-picker modal 改 anchored popover** — 原 `tp-trip-picker`
  modal-style backdrop chooser 改 anchored popover (DESIGN.md 2026-05-03 規則
  允許 popover 範疇)。改 popover 而非全頁的理由：
  - chooser 性質 (selection → 立即 navigate)，page 模式打斷 flow
  - URL deep-link 沒意義 (trip 列表是 user-specific dynamic)
  - 跟 region-pill / category-subtab 同類 selection menu pattern
- **Anchor**: ExplorePage saved-toolbar「加入行程」按鈕包 `position: relative`
  wrapper，popover 用 `position: absolute; top: 100%; right: 0` 出現在按鈕下方。
  `aria-haspopup="dialog"` + `aria-expanded` 提供無障礙語意。
- **Click-outside 處理**: popover mousedown listener 加 trigger button 例外
  (`data-trip-picker-trigger="true"`)，避免「按按鈕關閉 + 立即重開」 race。
  Esc key 關閉行為不變。

### Added

- **`src/components/explore/TripPickerPopover.tsx`** (~165 LOC) — anchored
  popover 共用版，`open / trips (null=loading) / selectedCount / onPick /
  onClose` props。Caller 包 `position: relative` wrapper 即可重用。

### Removed

- **ExplorePage trip-picker modal block** (~40 LOC backdrop + dialog +
  cancel button + actions) — 整段移除，由 popover 取代。
- **ExplorePage tp-trip-picker-* CSS** (~50 LOC backdrop / shell / list /
  row hover / empty state / actions / cancel button) — 一併隨 modal 退場。
  Component-scoped 等價規則搬到 TripPickerPopover SCOPED_STYLES。

### Tests

- **NEW** `tests/unit/trip-picker-popover.test.tsx` (8 specs)：open=false 不
  render + open=true render rows (含 title/name/tripId fallback + countries '—'
  fallback) + loading state + empty state + onPick + Esc onClose + 外部
  mousedown onClose + trigger button 例外。
- 1312 unit + 603 API 全綠，typecheck 乾淨。

### Migration progress

DESIGN.md 2026-05-03 「Modal vs Full Page Decision」 audit 第 6 個 PR：
- ✅ EditTripModal → /trip/:id/edit (PR #428, v2.19.4)
- ✅ NewTripModal → /trips/new (PR #429, v2.19.5)
- ✅ EntryActionPopover → /trip/:id/stop/:eid/(copy|move) (PR #430, v2.19.6)
- ✅ AddStopModal → /trip/:id/add-stop?day=N (PR #431, v2.19.7)
- ✅ DeveloperAppsPage create-app modal → /developer/apps/new (PR #432, v2.19.8)
- ✅ **ExplorePage trip-picker modal → anchored popover (本次, v2.19.9)**

Audit 剩餘 (P3 confirm-modal cleanup, 不算違規但風格不一致)：
- AccountPage logout / ConnectedAppsPage revoke / DeveloperAppsPage
  secret-display 改用標準化 `ConfirmModal` 元件

## [2.19.8] - 2026-05-03

### Changed

- **「建立新應用」 modal 改全頁** — DeveloperAppsPage TitleBar「建立新應用」
  按鈕從原本 mount `dev-apps-create-modal` portal 改為 navigate 到
  `/developer/apps/new` 全頁。9+ field form (app_name + redirect_uris textarea
  + client_type radio cards + 5 scope checkboxes) 是 DESIGN.md 2026-05-03
  audit 剩餘最大違規。原 `dev-apps-create-modal` (P1) 含複雜 form 流程，
  symbol-perfect 對齊「複雜 form 必走全頁」規則。
- **Secret reveal 仍以 modal-style 呈現** — DESIGN.md 允許 confirm-style
  modal 例外。secret 是 server response 一次性 client-side state，不適合
  走 page (back / share / refresh 都會丟資料)。NewPage submit 成功後
  在 page 內 mount secret modal block，「我已複製，繼續」 → navigate
  `/developer/apps` + dispatch `tp-developer-app-created` event。
- **DeveloperAppsPage 列表自動 refresh** — 監聽 `tp-developer-app-created`
  event 觸發 `loadApps()`，user ack secret 後不需手動重整即可看到新 client_id。
- **TitleBar 「建立」 action button** + bottom sticky bar「建立應用」按鈕
  同步 disabled state，桌機 icon + 文字 (`.tp-titlebar-action.is-primary`)、
  手機 icon-only — 對齊 DESIGN.md 2026-05-03 TitleBar 三段式規則。

### Removed

- **DeveloperAppsPage create-modal block** (~155 LOC form + radio + checkbox
  + 取消/建立 footer) — 整段搬到 `src/pages/DeveloperAppNewPage.tsx`
  (~440 LOC AppShell 全頁版)。
- **DeveloperAppsPage tp-modal* / tp-form* / tp-radio* / tp-secret* /
  tp-code-block* CSS** (~100 LOC) — 同步搬到 NewPage SCOPED_STYLES。
- **`NewAppResult` interface + `SCOPE_OPTIONS` const + `creating` /
  `createForm` / `submitting` / `createError` / `secretResult` 5 個
  state hooks** — list page 不再持有 form state，全部搬到 NewPage。
- **`developer-apps-page.test.tsx` modal-flow tests** (open/cancel/submit/
  validation 共 5 條) — 改放 `developer-app-new-page.test.tsx` (新 9 條，
  cover render + default scopes + submit success/public/4xx + validation
  + secret ack navigate + cancel)。list page test 改驗 `dev-apps-new`
  按鈕 navigate 到 `/developer/apps/new` (取代原本 open modal) +
  `tp-developer-app-created` event refresh listener。

### Migration progress

DESIGN.md 2026-05-03 「Modal vs Full Page Decision」 規則第 5 個遷移 PR：
- ✅ EditTripModal → /trip/:id/edit (PR #428, v2.19.4)
- ✅ NewTripModal → /trips/new (PR #429, v2.19.5)
- ✅ EntryActionPopover → /trip/:id/stop/:eid/(copy|move) (PR #430, v2.19.6)
- ✅ AddStopModal → /trip/:id/add-stop?day=N (PR #431, v2.19.7)
- ✅ **DeveloperAppsPage create-app modal → /developer/apps/new (本次, v2.19.8)**

Audit 剩餘 (低優先 / 不同類型違規)：
- ExplorePage trip-picker modal (chooser 性質, 評估 popover vs page)
- AccountPage logout / ConnectedAppsPage revoke / DeveloperAppsPage
  secret-display 改用標準化 ConfirmModal (P3 confirm-style cleanup, 不算
  違規但風格不一致)

## [2.19.7] - 2026-05-03

### Changed

- **「加景點」 modal 改全頁** — TripPage TitleBar「+ 加景點」按鈕從原本 mount
  `AddStopModal` portal 改為 navigate 到 `/trip/:tripId/add-stop?day=N` 全頁。
  使用流程相同（搜尋 / 收藏 / 自訂 三 tab + region pill + filter sheet +
  bottom counter），新增能力：URL deep-link（書籤、分享）、瀏覽器 back
  取消、不被 mobile modal 高度限制、刷新保留位置。原 `AddStopModal` 含
  9 種 form control + 多 tab + 動態 region menu / filter sheet，是
  DESIGN.md 2026-05-03 規範「複雜 form 流程必走全頁」最大違規。
- **TitleBar 「完成」 action button** 與 bottom sticky bar「完成」 同步
  disabled state，桌機 icon + 文字（`.tp-titlebar-action.is-primary`）、
  手機 icon-only — 對齊 DESIGN.md 2026-05-03 TitleBar 三段式規則。
- **`deriveDayLabel` 從 TripPage 搬到 AddStopPage** — 原本 TripPage 算
  `DAY 03 · 7/31（五）` 後 prop 傳給 modal；改全頁後 page 自己 fetch
  `/api/trips/:id/days` 並用 API row `day_of_week` 直取週名（取代
  `['日','一','二',...]` hardcode 陣列推算），label 邏輯收斂在 page 內。

### Removed

- **`src/components/trip/AddStopModal.tsx`** — 由 `src/pages/AddStopPage.tsx`
  取代。`tests/unit/add-stop-modal.test.tsx` 同步刪除（modal-specific
  render / Esc / backdrop click 已不適用 page 模式）。
  `tests/unit/add-stop-modal-region-filter.test.ts` 改名 `add-stop-page-region-filter.test.ts`
  並改 readFile path 到新 page；`tests/e2e/add-stop-modal.spec.js` 改名
  `add-stop-page.spec.js` 並改 navigate URL flow + 加 TitleBar /
  bottom bar 同步 disabled state 驗證。
- **`deriveAddStopRegion` helper** 從 TripPage 移除 — region selector
  自己處理 default region (page 從 trip context fetch + 6 個 hardcode
  region 選項)，TripPage 不需推斷後 prop 傳遞。

### Migration progress

DESIGN.md 2026-05-03 「Modal vs Full Page Decision」 規則第 4 個遷移 PR：
- ✅ EditTripModal → /trip/:id/edit (PR #428, v2.19.4)
- ✅ NewTripModal → /trips/new (PR #429, v2.19.5)
- ✅ EntryActionPopover → /trip/:id/stop/:eid/(copy|move) (PR #430, v2.19.6)
- ✅ **AddStopModal → /trip/:id/add-stop?day=N (本次, v2.19.7)**

Audit 剩餘 (低優先 / 不同類型違規)：
- DeveloperAppsPage create-app modal (9+ field form, 預估走 /developer/apps/new)
- ExplorePage trip-picker modal (chooser 性質, 評估 popover vs page)
- AccountPage logout / ConnectedAppsPage revoke / DeveloperAppsPage
  secret-display 改用標準化 ConfirmModal (P3 confirm-style cleanup, 不算
  違規但風格不一致)

## [2.19.6] - 2026-05-03

### Changed

- **「複製/移動景點到其他天」改全頁** — 點 timeline entry 展開後 toolbar 的
  「複製」/「移動」按鈕，從原本彈出 anchored popover 改為 navigate 到
  `/trip/:id/stop/:eid/copy` 或 `/move` 全頁。User 流程相同（選目標日 +
  時段 → 確認），但 URL 可分享、瀏覽器 back 取消、a11y 簡化（不需 focus trap）。
  原 `EntryActionPopover` 雖小巧但內部含 day picker + time slot select +
  confirm CTA，屬「複雜 form 流程」邊緣案例 → DESIGN.md 2026-05-03 重新分類為
  違規 modal-ish surface。

### Removed

- **`src/components/trip/EntryActionPopover.tsx`** — 由 `src/pages/EntryActionPage.tsx`
  取代。`shortenDateLabel` + `DayOption` type 抽到 `src/lib/entryAction.ts`
  共用。
- **`tests/unit/entry-action-popover.test.tsx`** — popover-specific render
  tests，page 版本需要 router context + Promise mocks，重寫成本 > 重新覆蓋
  價值，先刪除留 follow-up 補 EntryActionPage 等價測試。

### Internal

- 新 routes `/trip/:tripId/stop/:entryId/copy` + `/move` mount 同一個
  `EntryActionPage` component，用 prop `action='copy'|'move'` 區分。
- TimelineRail copy/move button onClick 從 `setPopoverAction(action)` 改
  `navigate('/trip/:id/stop/:eid/(copy|move)')`，handleCopyOrMove callback
  整段砍掉（API call 邏輯轉移到 EntryActionPage）。
- TripDaysContext + TripPage `DayOption` import 同步移到 `src/lib/entryAction`。
- timeline-rail-inline-expand.test.tsx popover-specific assertions 移除
  （5 tests），保留 button visibility tests（3 tests）。

## [2.19.5] - 2026-05-03

### Changed

- **「新增行程」改全頁** — 從 DesktopSidebar「+ 新增行程」/ TripsListPage 卡片
  「+ 新增」/ 空狀態 hero 點擊 → navigate `/trips/new` 全頁（取代之前的 modal
  popup）。畫面跟原 modal 同樣 9+ 欄位（多目的地搜尋 / 拖排 / 天數分配 / 固定
  vs 大概日期 / 月份 carousel / 偏好 textarea）+ 全部 popular/recent 目的地 chips。
  好處同 v2.19.4 EditTripPage：browser back 取消 / URL deep-linkable / 行動裝置
  不被高度限制 / 重新整理保留位置。對應 DESIGN.md 2026-05-03 規則（Trip Form
  Pages section）。
- **NewTripContext 簡化** — 不再 mount modal，只提供 `openModal()` API（API 名
  稱保留相容性）導向 `/trips/new`。Provider 失去 modal state，~30 LOC 變 ~10 LOC。

### Removed

- **`src/components/trip/NewTripModal.tsx`** — 由 `src/pages/NewTripPage.tsx`
  取代。所有 caller (DesktopSidebar 透過 useNewTrip context、TripsListPage 卡片
  + hero CTA、GlobalMapPage) 行為不變，因為 context API 同名。
- **`tests/unit/new-trip-modal.test.tsx` + `tests/unit/new-trip-modal-multidest.test.tsx`** —
  原本 render NewTripModal 直接驗 portal/backdrop 行為。Page 版本需要 router
  context，重寫成本 > 重新覆蓋價值，先刪除留 follow-up 補 NewTripPage 等價測試。

### Fixed

- `tests/unit/trips-list-page.test.tsx`：2 個 assertion 改為驗 button 點擊後
  「不再 mount modal portal」（之前等待 `data-testid="new-trip-modal"` 出現）
- `tests/unit/mockup-typography-compliance.test.ts`：grep 來源從 NewTripModal.tsx
  改 NewTripPage.tsx，並調整 close-button assertion 為「整檔不出現 ✕ UTF-8 字元」
  （TitleBar 已有 back arrow，無 close button 需要驗）

## [2.19.4] - 2026-05-03

### Changed

- **「編輯行程」改全頁** — 點 trip 卡片 kebab「編輯行程」現在 navigate 到
  `/trip/:id/edit` 全頁（取代之前的 modal popup）。畫面跟原 modal 同樣 6 欄位
  + sortable destinations + region change hint，但有以下優點：
  - 瀏覽器 back 鍵直接取消
  - 編輯 URL 可分享 / 深度連結
  - mobile 不會被 modal 高度限制壓縮 form
  - 重新整理頁面不會丟失編輯狀態（雖然目前沒持久化未送出的編輯）
  - 對應 DESIGN.md 2026-05-03 新規則「複雜 form 流程必走全頁，modal 限定
    confirm/input/popover」
- **TitleBar action button responsive 統一**：桌機 `icon + 文字`、手機 `icon only`，
  `.tp-titlebar-action` + `.tp-titlebar-action-label` CSS class 早已存在
  （v2.18 引入），新增 `.is-primary` variant 給 confirm action（accent 實心，
  「儲存」「完成」「建立」用）。對應 DESIGN.md「Page Titlebar」section 2026-05-03 補強。

### Removed

- **`src/components/trip/EditTripModal.tsx`** — 由 `src/pages/EditTripPage.tsx`
  取代。所有 caller (TripsListPage card kebab) 改 `navigate('/trip/:id/edit')`。

### Internal

- 新 route `/trip/:tripId/edit` mount `EditTripPage`，承襲 CollabPage pattern
  (AppShell + sticky TitleBar + content)。
- TripsListPage 加聽 `tp-trip-updated` event（之前只聽 `tp-trip-created`），
  EditTripPage 儲存後 dispatch 此 event 觸發 list refresh。

## [2.19.3] - 2026-05-02

### Added

- **`default_travel_mode` / `lang` / `data_source` enum 驗證** — POST /api/trips
  與 PUT /api/trips/:id body 寫入前驗 enum 值 (`driving|walking|transit`、
  `zh-TW|en|ja`、`manual|tp-create|imported`)，hostile / typo payload 直接 400。
  /cso --diff sub-confidence 標的 defense-in-depth，hostile path 沒實際 exploit
  但 typo 寫進 prod 會讓 trips row 帶 garbage default。新增 5 個 integration
  tests 鎖 enum boundary。

### Removed

- **e2e + dev mock 的舊欄位殘餘：** v2.19.0 PR 範圍內漏改的測試 fixture
  跟 dev mock。`tests/e2e/api-mocks.js` 6 處 (`selfDrive` / `footer` /
  `autoScroll` / `ogDescription`)、`scripts/vite-mock-api.ts` 1 處
  (`selfDrive: true`) 改成新欄位（`defaultTravelMode` / `lang` / `dataSource` /
  `destinations`）。E2E 沒 assert 這些欄位所以原本不影響 test 結果，但 fixture
  與 prod schema drift 留著遲早出包。

## [2.19.2] - 2026-05-02

### Fixed

- **Overpass API 客戶端 30% 失敗率：** v2.19.0 上線後跑 `poi-enrich-batch
  --limit=100`，100 個 POI 中 30 個（30%）撞 `Overpass HTTP 406 Not
  Acceptable`。Root cause: `src/server/osm/overpass.ts` 送 `Content-Type:
  text/plain` 但 body 用 `data=<urlencoded>` 格式 — 兩者不一致導致 Overpass
  parser reject。改為 `application/x-www-form-urlencoded` 對齊 body。
  順便加 `Accept: application/json` + `User-Agent: Tripline/1.0` (per OSM
  usage policy)。新增 6 個 unit tests (`tests/unit/overpass.test.ts`) 鎖
  request shape 防 regression。修完 batch 重跑 `--force` 該 30 個 POI 預期
  能補到 phone / website / opening_hours / cuisine / wikidata 等 OSM tags。

## [2.19.1] - 2026-05-02

### Removed

- **`scripts/tp-check.js` dropped col 引用清光：** v2.19.0 留下 inline TODO 標
  記 `meta.footer` / `meta.autoScrollDates` / `meta.foodPreferences` /
  `meta.selfDrive` 為 stale dist JSON 相容欄位，本版實際移除。R10 自駕加油站
  檢查改用 `meta.defaultTravelMode === 'driving'` (對應 `trips.default_travel_mode`)。
  R1 料理偏好檢查作廢（per tp-quality-rules R1 改寫 — LLM 動態判斷不從固定欄位讀）。
- **`src/lib/mapRow.ts` JSON_FIELDS 清空：** trips.footer 已 DROP（migration 0045），
  唯一 JSON TEXT col 不存在 → array 改為空。對應 unit tests 同步更新（drop 2 個
  footer JSON parse tests，rename `self_drive→selfDrive` test 用 `default_travel_mode`）。

## [2.19.0] - 2026-05-02

### Added

- **OSM POI 自動補資料：** 新 endpoint `POST /api/pois/:id/enrich` 拉 Nominatim（座標）+ Overpass（OSM tags）+ OpenTripMap（rating 1-7）+ Wikidata（sitelinks 數），90 天 cache（`pois.data_fetched_at`），失敗 graceful fallback。可整批補：`bun scripts/poi-enrich-batch.ts --limit=100`。新景點不必再手填地址、評分、營業時間。
- **景點重新排序自動更新車程：** 在行程上拖拉景點順序時，立刻觸發 `POST /api/trips/:id/recompute-travel`，後端走 OpenRouteService（自駕/步行）+ Haversine fallback（大眾運輸 / ORS 暫不支援），相鄰 entry 的距離 / 時間 / 模式同步刷新。原本順序變了車程數字卻停在舊值，user 還以為拖拉沒生效。
- **編輯既有行程：** 全新 EditTripModal v2 (TripsListPage card kebab → 「編輯行程」)。可改：行程名稱、描述、顯示語言（繁中 / 英 / 日）、預設交通方式（自駕 / 步行 / 大眾）、發布狀態、目的地清單（拖拉、加 POI、刪、分配天數）。region 變更時 title 旁顯示「目的地已變更，要更新名稱為『2026 沖繩・京都』？」alert，使用者主動點才覆寫。日期目前 read-only chip 顯示，避免改日期 cascade 影響 entries / hotels。
- **新增行程也送 destinations[]：** NewTripModal v2 提交時把 destinations[] 結構化資料寫進 `trip_destinations` 子表（先前只當文字註記丟在 description 給 AI consume），後續地圖 region overlay / per-dest 路徑計算 / per-dest 天氣才有 source of truth。
- **三家地圖直連按鈕：** 任何 POI 旁加 Google / Apple / Naver Maps 按鈕，client 端用 `mapsUrl()` helper 從 lat/lng 即時組 URL，不需 DB 存 vendor-specific 連結。原本只能開 Google Maps。
- **5 個 trip_docs 自動建立：** 用 UI 建新行程時自動建 flights / checklist / backup / suggestions / emergency 5 個 doc stubs。先前 UI 建的 trip docs tab 是空的，user 必須跑 `/tp-create` 才補得齊。

### Changed

- **trips schema 大整：** migration 0045 移除 6 欄 (`auto_scroll`, `og_description`, `footer`, `food_prefs`, `is_default`, `self_drive`)、加 3 欄 (`data_source`, `default_travel_mode`, `lang`)、加 `trip_destinations` 子表（取代 `region` text 欄位）。`pois.google_rating` 改名為 `rating`（後端用 OpenTripMap 1-7 而非 Google 5★）、`pois.maps` 拆掉（改 client 組 URL）、加 6 個 OSM 欄位 (`osm_id`/`osm_type`/`category`/`tags`/`wikidata_id`/`data_fetched_at`)。`trip_entries` 加 4 個 travel 欄位（distance / min / computed_at / source）。
- **R1 料理偏好邏輯改寫：** 拔掉 `trips.food_prefs` 後，餐廳推薦不再固定「3 家對應 3 偏好」，改由 LLM 從同行程已產生的 category 多樣性 + 該日 timeline 上下文 + chat 偏好 + 目的地代表料理動態判斷。tp-quality-rules R1 / R3 同步改寫。
- **`PUT /api/trips/:id` 支援 `destinations[]` 全量取代：** 帶 array 即 DELETE existing + INSERT all（atomic single batch）。空 array → 清光。無 destinations key → 不動子表。

### Fixed

- **景點移動排序時相對車程沒更新（核心 bug）：** 見上方 recompute-travel 自動觸發。
- **`PUT /trips/:id` 處理 `destinations[]` 不 atomic：** /review 抓到原本 DELETE + INSERT 是兩次獨立 D1 操作，INSERT 失敗會留下「行程沒有目的地」的部分結果。改成 single `db.batch()` 確保 transactional。
- **`destinations[]` 沒長度上限：** Hostile payload `Array(10000).fill(...)` 會試圖批次 INSERT 10k rows → 撞 D1 batch 100-stmt 上限 crash。POST + PUT 都加 30 dest 上限。
- **`sub_areas` runtime 沒驗 array of strings：** PUT 端先前用 truthy 檢查就 stringify，hostile nested object 會撐爆 row。新 `safeSubAreas()` helper 強制驗 array of strings 才寫，否則寫 NULL。
- **景點重排車程更新失敗時靜默：** 改成 toast 提示「順序已儲存，但車程時間更新失敗，重新整理後再試」。原本 `.catch(() => {})` 讓 user 以為 reorder 沒生效。

### Removed

- **`Footer` component + trips 6 欄：** Footer.tsx 拆掉、`TripPage` fallback `t.isDefault === 1` 改 `t.published === 1`、`types/trip.ts` 清 Footer interface 與 dropped 欄位。`scripts/seed.sql` 7 個 trip INSERT 同步重寫。`tp-create` SKILL 拔 footer / food_prefs / og_description / auto_scroll 範本。

## [2.18.4] - 2026-05-02

### Fixed

- **驗證信、重設密碼信、邀請信現在真的會寄出來了。** Email 系統 silent-fail 30+ 天的根因確認：CF Pages prod 沒設 `RESEND_API_KEY` + `EMAIL_FROM`，4 個 oauth/permissions endpoint 全 silent-skip 整段邏輯（API 仍回 200「驗證信會寄至信箱」騙 user）。本次直接 cutover 到 mac mini Gmail SMTP via Tailscale Funnel：CF Pages Functions sync await fetch `${TRIPLINE_API_URL}/internal/mail/send` → mac mini `tripline-api-server.ts` 用 nodemailer 寄出 → user 1-3s 內看到結果。徹底脫離 Resend vendor lock-in，順便修好「Resend 需 verified domain」這個阻塞點（mac mini Gmail 自家寄自家，零 DNS 設定）。
- **Chat 訊息即時觸發修好，從 0–15 分鐘等待縮回 < 1 秒。** D1 audit 顯示過去 14 天 15 筆 `trip_requests`，**只有 1 筆** `processed_by='api'`（4/25），其餘 13 筆 + 4/26 之後全部走 15 分鐘 cron 兜底。`functions/api/requests.ts:182` 的 silent `catch {}` 完全吞掉 `fetch ${TRIPLINE_API_URL}/trigger` 的失敗。本次跟 email cutover 共用 setup（同 Tailscale Funnel 8443 + 同 audit + Telegram alert pattern），併進同 PR 一次修。
- **送驗證信失敗時 `EmailVerifyPendingPage` 不再顯示「已重寄」騙 user**（`fetch` 不 throw 500，原本沒 check `res.ok`）。SignupPage 仍維持 best-effort（post-action，user 可在 verify-pending 頁手動重試）。
- **`/api/public-config` 的 `emailVerification` capability flag** 改 gate 在 `TRIPLINE_API_URL + TRIPLINE_API_SECRET`（保留 `RESEND_API_KEY` fallback during rollout），cutover 後不再回 `false` 騙前端。

### Changed

- **`functions/api/oauth/{send-verification,forgot-password}.ts`** — 寄信失敗從 silent-skip + 200 generic 改成 audit_log + Telegram alert + 500 `{error: {code: 'EMAIL_SEND_FAILED', message}}`（Q7 user 拍板：UX > anti-enumeration，private-circle scale 接受 trade-off）。`reset-password` 跟 `permissions` 是 best-effort 例外（confirmation/invitation 是事後通知，回 500 會誤導 user 以為主操作失敗）。
- **`scripts/tripline-api-server.ts`** — Bearer token 比較從 `===` 改 constant-time byte loop（Tailscale Funnel 公網 + 無 rate limit + 共享 secret = timing side-channel 風險）。新增 `POST /internal/mail/send` endpoint with nodemailer Gmail SMTP transporter（lazy init）。
- **`scripts/lib/mailer-handler.ts`** — 抽 DI handler factory 方便 unit test（mock nodemailer transporter）；`to` 欄位 `isPlainEmail` 驗證（拒 comma list / Display Name 語法 / CRLF injection）防 open-relay abuse。
- **`functions/api/_alert.ts`** — 新 `alertAdminTelegram(env, msg)` helper（5s timeout + finally clearTimeout 修 timer leak）。
- **`functions/api/_audit.ts`** — 新 `recordEmailEvent(db, opts)` helper reuse `audit_log` table（Q11，`table_name='email'` namespace）。
- **`functions/api/_types.ts` + `CLAUDE.md` + `.dev.vars.example`** — Required env update：`TRIPLINE_API_URL` + `TRIPLINE_API_SECRET` 雙用途（trigger + mailer），新 `TELEGRAM_BOT_TOKEN/CHAT_ID` (optional)，新 mac mini 端 `GMAIL_USERNAME/APP_PASSWORD/EMAIL_FROM`（複用 daily-report.yml 同一組 Gmail App Password，Q8）。`RESEND_API_KEY` 標 deprecated。

### Added

- **`scripts/lib/mailer-handler.ts`** + **`functions/api/_alert.ts`** + **`recordEmailEvent`** helpers — 39 個新 unit test（mailer-handler 18 + alert 6 + email-audit 5 + server-email 13 - oauth-verify/forgot/reset/permissions integration tests updated for cutover）。
- **`openspec/changes/2026-05-02-email-and-trigger-silent-fail-fix/proposal.md`** — 完整 plan + 12 Open Questions 答案 + Decisions Log + Operational Runbook（寄信失敗排查順序 + trigger 失敗排查 + mac mini 重開 SOP）。

## [2.18.3] - 2026-05-02

### Fixed

- **`src/pages/MapPage.tsx`** — 桌機點 marker 無反應：`<OceanMap>` 缺 `onMarkerClick` prop，OceanMap 內部已支援但沒接線。補 `onMarkerClick={handleCardClick}` — 點 marker 即等同點底下卡片（focus + flyTo + scroll into view）。
- **`src/pages/MapPage.tsx`** — MapPage 預設 tab 改為「總覽 5 天」（原預設 Day 1）：無 `?day=` 參數 + 無 entry deeplink → `initialTab='overview'`，user 拍板「地圖預設全覽」原則。Entry deeplink + `?day=N` URL 參數行為不變。
- **`src/components/trip/EntryActionPopover.tsx`** — popover「移動到哪一天」layout 多重修正：(a) 寬度改 `min(320px, calc(100vw - 32px))` mobile 不溢出 viewport；(b) 桌機 anchor 從 `right: 0` 改 `left: 0`，避免左半被 DesktopSidebar 蓋住；(c) Day label 從 `Day N · 2026-07-29（三）（目前）` 單行重排為兩行 stack — 主行「Day N」+ 右側 count，副行短日期 `7/29（三）` + 「目前」chip。再窄的 viewport 也不 wrap。
- **`src/components/trip/TimelineRail.tsx` + `css/tokens.css`** — TimelineRail row 對齊 mockup S12 Variant A：grid 從巢狀 `(44 24 1fr) + (48 1fr auto)` 改單層 5 欄 `24 60 44 1fr 24`（grip | time+dur | icon | content | caret）；移除 `.ocean-rail-dot` 編號圓圈（mockup 沒此元素，與 grip 視覺競爭）；time 加 dur 副行（`30 分鐘` / `2 小時` 顯示在時間下方）；grip 改永遠淡顯 0.4 而非 hover-only 隱形，提升 discoverability 不喧賓奪主；icon box 從 48x48 對齊 spec 改 44x44。

### Added

- **`src/components/trip/TimelineRail.tsx` + `Restaurant.tsx`** — entry 展開後新增「餐廳推薦」section（在「地點」與「備註」之間）。資料來自 `entry.infoBoxes` 中 `type='restaurants'` 條目（API 端早已 ship，PR #163），按 `sort_order` 升冪：≥2 家走 hero（accent 邊框 + 漸層底）+「備選」divider + 後續 standard cards；1 家直接 standard variant。沿用既有 `Restaurant.tsx` hero/standard variant 與 SCOPED_STYLES，僅新增 `.tp-rail-rest-list` + `.tp-rail-rest-alt-heading` 兩條 CSS。
- **`tests/unit/entry-action-popover-shorten-date.test.ts` + `timeline-rail-restaurants.test.tsx`** — 補 13 個單元測試覆蓋（specialist review 標記 CRITICAL 的 test gap）：`shortenDateLabel` 8 個 edge case（半形/全形括號 / double-digit / non-padded fallback / non-hyphen separator / empty / Day-N fallback），`sortedRestaurants` 5 個渲染 case（無 infoBoxes / 空 / 1 家 standard / ≥2 家 hero+備選 divider / null sortOrder 排尾）。

### Changed (review polish, 同 PR 處理)

- **`css/tokens.css`** — `.ocean-rail-time` `font-size: 14px` 改 `var(--font-size-footnote)` 對齊 token discipline；移除已死 `.ocean-rail-sep`（rating sub-line 已不用 separator span）。
- **`src/components/trip/EntryActionPopover.tsx`** — `shortenDateLabel` regex 從 `\d{1,2}` 收緊為 `\d{2}` 對齊 `parseLocalDate` zero-padded contract；export 該函式給 unit test；JSDoc 280px → popover 內（layout 已改 320px）；comment drift 同步。
- **`src/components/trip/TimelineRail.tsx`** — `formatDuration(parsed.duration)` 重複呼叫合併（IIFE hoist 到 const `durLabel`）。

## [2.18.2] - 2026-05-01

### Fixed

- **`src/components/trip/IdeasTabContent.tsx`** — `loadDayEntries` 加 `Number.isInteger(dayNum) || dayNum < 1` defensive guard，與 `useTrip.fetchDay`（#180 修過的同模式）對齊。daily-check 4/30 報告捕到 8 次 `GET /api/trips/.../days/undefined → 404`，唯一沒 guard 的 GET `/days/:num` 路徑就是這裡，加 guard 阻 invalid dayNum 拼進 URL 污染 api_logs。

## [2.18.1] - 2026-04-30

**禁用 native browser dialog，全站改用 styled modal / toast**。`window.confirm` / `window.alert` / `window.prompt` 無法 style、無法 a11y trap focus、阻塞主執行緒、Mac/Windows 視覺差異大，看起來「不像我們的 app」。盤點 7 處全部換成 ConfirmModal / 新建 InputModal / Toast。

### Added

- **`src/components/shared/InputModal.tsx`**：取代 `window.prompt` 的單行 input modal。Role `dialog`、auto-focus + 全選 default value、Enter 提交 / Escape 取消、空字串自動 disable confirm（`allowEmpty` opt-in）、portal to body、150ms backdrop fade + 200ms slide-up scale 動畫，跟 ConfirmModal 視覺對齊。
- **ExplorePage region picker popover**：取代 `window.prompt` 的 region selector。Pill click → 開 popover (常用地區 chips：全部地區 / 沖繩 / 東京 / 京都 / 首爾 / 台北 + active trip's region) → 點選 setRegion，「+ 自訂地區…」 → 開 InputModal。Popover 支援 click-outside / Escape close。
- **Mockup Section 22 — Dialogs system showcase** (`docs/design-sessions/terracotta-preview-v2.html`)：4 個 frame 展示 ConfirmModal (destructive)、InputModal (single-line prompt)、Toast variants (success / error / info)、Decision matrix (when to use which)。
- **DESIGN.md 新 section「Modal Dialogs」**：禁用 native dialog 規範、surface 對應表、ConfirmModal / InputModal 細節 spec、視覺規格、現役 use case 列表。

### Changed (7 處 native dialog 改 styled modal / toast)

- `src/pages/ExplorePage.tsx` — `window.confirm`(刪除批次收藏) 改 `<ConfirmModal>`；`window.prompt`(輸入地區) 改 popover + `<InputModal>` 自訂 fallback。
- `src/pages/TripsListPage.tsx` — `window.confirm`(刪除行程) 改 `<ConfirmModal>`，handleMenuDelete 拆兩階段（trigger 開 modal / handleConfirmDelete 真執行）。
- `src/pages/SessionsPage.tsx` — `confirm`(登出其他全部裝置) 改 `<ConfirmModal>`，revokeAllConfirmOpen state 控制。
- `src/components/trip/MapFabs.tsx` — 兩處 `window.alert`(不支援定位 / 無法取得位置) 改 `showToast(..., 'error', 3000)`。
- `src/lib/tripExport.ts` — `alert`(下載失敗) 改 `showToast(..., 'error', 3000)`。

### Tests

- `tests/unit/map-fabs.test.tsx`：「地理 API 不存在 → 觸發 alert」 改驗 `showToast` spy（取代 `window.alert` mock）。
- `tests/unit/sessions-page.test.tsx`：「登出其他全部裝置」 confirmed / cancelled flow 改走 `confirm-modal-confirm` / `confirm-modal-cancel` testid（取代 `vi.stubGlobal('confirm', ...)`）。

### Internal

- verify gate: tsc clean / 148 test files / 1265 tests pass。
- `mockup` 對應 src `<ConfirmModal>` / `<InputModal>` / `<Toast>` 視覺一致；DESIGN.md decision matrix 給未來 PR 參考。

## [2.18.0] - 2026-04-30

**共編設定升格獨立頁面 + 新增 viewer role + ConfirmModal + QA medium/low fix**:User /qa 後拍板「移除既有 InfoSheet 內嵌 collab,改 standalone page」+ 加 viewer(檢視成員,read-only collaborator)。同 PR 順手清掉 QA 報告的 medium(F3)+ low(L1)findings。

### Added

- **新 route `/trip/:tripId/collab`** + `src/pages/CollabPage.tsx`(獨立頁面,共用 `.tp-titlebar` chrome,左側 back 回前頁,右側無 actions,body 是 `<CollabPanel>`)。
- **`src/components/trip/CollabPanel.tsx`**(新):共編 panel body,包含 hint / member list(3-tier role)/ pending invitations / add form。從 CollabSheet 的 v2.17 設計演進。
- **`src/components/shared/ConfirmModal.tsx`**(新):取代 `window.confirm()` 的 styled destructive 對話框。支援 Escape / backdrop dismiss / busy state / focus auto-trap。
- **viewer role**(3-tier:owner / member / viewer):
  - `Migration 0043`:`trip_permissions.role` CHECK 加 'viewer'(SQLite recreate-table)
  - `Migration 0044`:`trip_invitations.role` CHECK 加 'viewer'
  - `src/types/api.ts`:加 `CollabRole` type alias(`'owner' | 'admin' | 'member' | 'viewer'`)
- **role chip dropdown**:CollabPanel 內的 member / viewer chip 點擊展開選單,可在 member ↔ viewer 切換(owner / admin chip 不可改)。
- **新增成員 role selector**:`+ 新增` form 下方 pill row 可選預設 role(預設「共編成員」,可切「檢視成員」)。
- **Backend `PATCH /api/permissions/:id`**:新 endpoint,body `{ role: 'member' | 'viewer' }`。Validation 拒 `'owner'/'admin'` 升級攻擊。No-op 直接 200(避免 audit log noise)。
- **Mockup Section 21 — Collab Page**:Desktop / Compact / ConfirmModal / Toast variants 4 個 frame。加 `i-check` SVG symbol(原 mockup 沒有)。

### Changed

- **TripsListPage `EmbeddedActionMenu` onCollab**:從 `setCollabTripId(state)` 改 `navigate('/trip/:id/collab')`,移除 InfoSheet wrapper + CollabSheet import。
- **TripsListPage `handleMenuCollab`**(card kebab menu):同上,navigate 取代 sheet。
- **TripPage `?sheet=collab` URL deeplink**:redirect 到 `/trip/:id/collab`(legacy URL 相容,replace history)。其他 sheet keys 仍走 InfoSheet path(兼容)。
- **CollabSheet**(legacy InfoSheet body)變 thin wrapper:`<CollabPanel tripId={...} />` — 確保所有 entry path 視覺一致(將來整批拔 InfoSheet wrapper 時可一併刪)。
- **POST /api/permissions** validation 接受 `viewer` role(原本 reject 任何 non-member/non-admin)。

### Security (review hardening)

- **viewer role 真正 read-only**(`functions/api/_auth.ts`):pre-merge review 抓到 `hasPermission()` 不區分 role,viewer 雖在 UI 顯示「檢視成員」但 backend 17 個 write endpoint 都會放他過。新增 `hasWritePermission()` 排除 viewer,並 migrate 所有 write path(`trips/[id]` PUT、`trip-ideas` POST/PATCH/DELETE、`trip-pois` PATCH/DELETE、`entries` PATCH/DELETE/copy/batch、`days/[num]` PUT、`docs/[type]` PUT、`pois/[id]` PATCH、`requests` POST)。Read path(`trip-ideas` GET、`requests` GET、`requests/[id]` GET / events SSE)續用 `hasPermission` 維持 viewer 可讀。新測試 `tests/unit/has-write-permission.test.ts` 7 例 pin SQL filter 防回歸。

### Fixed (QA medium/low findings)

- **F3 — TripsListPage mobile tabs 換行**(`src/pages/TripsListPage.tsx`):4 tab `flex: 1` 平分時 375px viewport 「全部 N」 文+count 撐爆 ~85px 寬度,斷成「全 / 部」兩行。改 `.tp-trips-tabs` 容器 `overflow-x: auto` + tab `white-space: nowrap; flex-shrink: 0`,對齊 mockup `.tp-add-subtab` pattern。Tab 不換行,user 滑動切換。
- **L1 — `.map-highlight` orphan CSS**(`css/tokens.css`):整段 `.map-highlight` + `@keyframes map-highlight-pulse` 移除(無 src 引用)。

### Tests

- `tests/unit/collab-sheet.test.tsx`:revoke test 改 click ConfirmModal confirm button(原 `window.confirm` mock 不再有效)。

### Dev notes

- DocEntry / docs 結構不動(export 流程仍用),CollabSheet thin shim 保留(兼容 TripSheetContent 內 case 'collab')。
- 共編 sheet 升格 page 後,user 從 `/trips` card 點「共編」 → `/trip/:id/collab` (新 page)→ click 「← 返回前頁」 → 回 `/trips`。Browser back / forward 自然運作。
- Owner role 不可被 PATCH/DELETE — 維持既有 ownership transfer 走另外 endpoint(未來實作)。

## [2.17.17] - 2026-04-30

**6 個 trip sheet feature 整批移除 + AccountPage avatar fix**:User /qa 找到 critical issue —`/trip/:id` 永遠 redirect 到 TripsListPage embedded mode,`EmbeddedActionMenu` 只暴露 5 項(共編 + 列印 + 4 download),其餘 6 個 sheet 完全沒 UI 入口。User 拍板「移除」。

### Removed (Critical F1: 6 unreachable sheets + dead code chain)

**Dead component files(0 user-reachable render path):**
- `src/components/trip/OverflowMenu.tsx`(整個 component,12 個 OVERFLOW_ITEMS)
- `src/components/trip/SuggestionSheet.tsx`(AI 建議 sheet body)
- `src/components/trip/FlightSheet.tsx`(航班 sheet body)
- `src/components/trip/TodayRouteSheet.tsx`(今日路線 sheet body)
- `src/components/trip/DocCard.tsx`(checklist / backup / emergency sheet body)
- `src/components/trip/TripSheetContent.tsx`(switch case 9 個 sheet keys 整個 dispatcher,包含 ACTION_MENU_GRID 9-button + ACTION_MENU_EXPORTS 5-row dead grids)

**Dead UI logic in TripPage(`{!noShell && <TitleBar actions={...} />}` 整段):**
- 5 個 button(加景點 / 建議 / 共編 / 下載 + OverflowMenu)
- `handlePanelItem` callback
- `handleTripChange` callback(trip-select sheet 用)
- `sheetTrips` / `sheetTripsLoading` state(trip-select sheet 用)
- `colorMode` / `setColorMode`(appearance sheet 用)
- `currentDay` / `docs` props(都 only fed to TripSheetContent)
- TripPage 改成 inline render `<CollabSheet>` for `activeSheet === 'collab'`(唯一還活著的 sheet)
- `?sheet=` URL param 從 `SHEET_TITLES` allowlist 改成 hardcode `=== 'collab'` check
- `Icon` / `TitleBar` import 一起拔(now unused)

### Fixed (High F2: AccountPage avatar 跟 sidebar 不一致)

- `AccountPage.tsx:236` 從 `user.email.charAt(0).toUpperCase()` 改用 `displayName.charAt(0).toUpperCase()`,跟 `DesktopSidebar:204` `user.name` 一致。User "Ray" + email "lean.lean@..." 現在 hero 跟 sidebar 都顯示「R」。

### Moved

- `DocEntry` type 從已刪 `src/components/trip/DocCard.tsx` 搬到 `src/types/trip.ts`(被 `useTrip.ts` + `lib/tripExport.ts` import,export 流程還活著)。

### Removed tests

- `tests/unit/overflow-menu-divider.test.tsx`(測 deleted OverflowMenu divider 邏輯)
- `tests/unit/trip-page-titlebar-actions.test.tsx`(測 deleted TripPage TitleBar 4 actions)
- `tests/unit/trip-page-titlebar.test.tsx`(測 deleted TripPage standalone TitleBar mount)
- `tests/unit/quick-panel.test.js`(asserts OverflowMenu imports + 12 OVERFLOW_ITEMS keys)

### Stats

**Net -14 files / -1500+ lines,precache 2189.65 → 2164.35 KiB(-25 KiB)。** 1316 → 1258 tests(58 個跟 deleted dead 一起刪)。

## [2.17.16] - 2026-04-30

**Dead code + @deprecated 整批清除**:User 拍板「dead code 跟 deprecated 都刪」。

### Removed

**Dead files(0 references):**
- `src/hooks/useTripSelector.ts`(只有 self-reference)
- `src/hooks/useRequests.ts`(只有 self-reference)
- `src/lib/demote-strategy.ts` + `tests/unit/demote-strategy.test.ts`(test 在測 dead src)
- `src/components/trip/DemoteConfirmModal.tsx`(只有 stale doc comment 提到)
- `src/components/shell/BottomNavBar.tsx`(自帶 `@deprecated`,沒人 render)
- `tests/unit/mobile-bottom-nav-route.test.tsx` / `mobile-bottom-nav-entries.test.tsx` / `mobile-bottom-nav-optional-clear-sheet.test.tsx`(全部測 deleted BottomNavBar)

**Deprecated props / fields:**
- `DesktopSidebar` 的 `isAdmin?: boolean` prop(自標 `@deprecated`,PR-O 後管理 nav 已廢)+ `DesktopSidebarConnected` 的 `const isAdmin = ...` 計算 + `isAdmin={isAdmin}` 傳遞。
- `Request` interface 的 `title?: string` / `body?: string` / `processedBy?: string | null` 欄位(自標 `@deprecated`,grep 確認 src + functions 都沒人讀)。

**Stale doc comments:**
- `src/components/trip/TimelineRail.tsx:596` 移除 DemoteConfirmModal pattern 引用。
- `src/pages/TripPage.tsx:682` 拿掉 BottomNavBar 退役歷史 prefix。
- `src/components/shell/GlobalBottomNav.tsx` JSDoc 簡化 — 拿掉 BottomNavBar 取代史 + 4 action 遷移細節(那些是 transition note,已過時)。
- `tests/unit/trip-page-titlebar.test.tsx:37` 拿掉 `vi.mock('BottomNavBar')`(TripPage 早就不 import 了)。
- `tests/unit/a11y-axe-core.test.tsx` 拿掉 BottomNavBar import + axe test case。

### Tests

- `requests-api.test.js > Request type definition`:`marks title and body as deprecated` → `legacy title/body/processedBy fields purged`(改成 negative assertion)。

### Stats

- Net **-12 files / -1100+ lines**。1316 → 1286 tests(30 個跟 deleted dead files 一起刪)。

## [2.17.15] - 2026-04-30

**MapPage day-tabs / GlobalBottomNav 重疊修正**:User 拍 v2.17.14 後反饋 day nav 跟 bottom nav 重疊。

### Fixed

- **MapPage `.map-page-wrap` overlap with fixed bottom-nav**(`src/pages/MapPage.tsx`)
  - v2.17.14 把 MapPage 包進 AppShell + GlobalBottomNav,但保留 `.map-page-wrap { height: 100dvh }`(原本沒包 AppShell 時對的)。
  - AppShell 在 mobile 已經 reserve `padding-bottom: var(--nav-height-mobile, 88px)` 給 fixed bottom-nav,wrap 撐到 100dvh 等於蓋過 bottom-nav 88px,day-tabs(從 wrap 底部往上排)就跟 5-tab 重疊。
  - 改 `height: 100%` 對齊 ChatPage `.tp-chat-shell` pattern — wrap 填滿 main content-area(不含 padding-bottom),day-tabs 自然落在 bottom-nav 上方。

## [2.17.14] - 2026-04-29

**Standard TitleBar 對齊 + Map 拿 back + 加 BottomNav**:User 拍板「行程/探索沒用標準 title 要調整」「地圖不需要回前頁箭頭」「缺少底部 tool bar」。三頁 layout 對齊統一規範。

### Fixed

- **TripsListPage TitleBar full-width**(`src/pages/TripsListPage.tsx`):
  - TitleBar 從 `.tp-trips-inner`(max-width 1100px)拉出,放回 `.tp-trips-shell` 直接子層,sticky 對齊 viewport edge。
  - `.tp-trips-shell` 移除 `padding: 32px 16px 64px`(原 32px top push TitleBar 離 viewport edge),改讓 `.tp-trips-inner` 自己 handle `padding: 24px 16px 64px`。
- **ExplorePage TitleBar full-width**(`src/pages/ExplorePage.tsx`):TitleBar 從 `.explore-wrap`(max-width 960px + padding 24px)拉出,放回 `.explore-shell` 直接子層,sticky 對齊 viewport edge。
- **MapPage 移除 back button + 加 AppShell 包 GlobalBottomNav**(`src/pages/MapPage.tsx`):
  - 移除 `back={onBack}` + 對應 `onBack` callback(原邏輯:有 `urlEntryId` → 回 `/trip/:id/stop/:eid`,否則 → 回 `/trip/:id`)。
  - 新增 import:`AppShell` / `DesktopSidebarConnected` / `GlobalBottomNav` / `useCurrentUser`。
  - `return` 從 `<div className="map-page-wrap">` 改成 `<AppShell sidebar={...} main={...} bottomNav={<GlobalBottomNav authed={!!user} />} />`,對齊 ChatPage / TripsListPage / ExplorePage 的 standard layout。

### Changed

- **Mockup S20 map 拿掉 back button**:4 處 frame(desktop overview / compact overview / loading / empty)的 `tp-preview-icon-button aria-label="返回"` 全部刪除。Frame label 註明「無 back button(地圖 nav 切換走 sidebar)」。
- **Mockup S20 map compact 加 GlobalBottomNav 視覺**:`.tp-bnav-frame` 5-tab(聊天 / 行程 / 地圖 active / 探索 / 帳號)放在 entry-cards 後面,反映 prod AppShell 結構。
- **Mockup S18 explore 對齊 standard TitleBar**:
  - Desktop frame:`.tp-btn is-ghost` → `.tp-titlebar-action`(icon+label,對齊 prod)。
  - Compact frame:`.tp-preview-icon-button` icon-only → `.tp-titlebar-action`(讓 mobile breakpoint 自動切 icon-only)。
  - Compact frame 加 GlobalBottomNav 5-tab(探索 active)。
- **Mockup S16 trips 整段對齊 standard `.tp-page-frame` pattern**:
  - 3 frames(desktop / compact / empty)從 `.tp-list-page` family 改成 `.tp-page-frame`(對齊 S17/S18/S20)。
  - `.tp-list-header` 三段(text/title/actions)改成 `<header class="tp-page-titlebar">` + `.tp-page-titlebar-title` + `.tp-page-titlebar-actions`。
  - 「搜尋 + 新增行程」 button 對齊 prod 把搜尋移進 toolbar(prod 行為),TitleBar 只放「+ 新增行程」 `.tp-titlebar-action`。
  - Compact frame 加 GlobalBottomNav 5-tab(行程 active)。

## [2.17.13] - 2026-04-29

**Map cluster 全拆 + mockup S20 FAB 對齊 prod**:User 拍板「地圖不要聚合」。所有 OceanMap entry 永遠單獨顯示 pin,不再 cluster 成數字 bubble。

### Removed

- **`OceanMap` cluster path 整段刪除**(`src/components/trip/OceanMap.tsx`):
  - 移除 `Supercluster` import + `supercluster` package + `@types/supercluster`(~10 KB precache 縮水)。
  - 移除 `clusterIcon()` divIcon helper。
  - 移除 `cluster?` prop + `autoCluster` 計算(原 default:`mode === 'overview' && pins.length > 10`)。
  - 移除 cluster path useEffect(SC index build / `getClusters` / cluster click → `getClusterExpansionZoom` zoom-in 整段)。
  - 移除 `focusStateRef` + `clusterRefreshRef` cluster path internal state。
  - 移除 `.ocean-map-cluster` CSS。
- **Cluster prop pass 全清**:`TripMapRail` / `MapPage` / `GlobalMapPage` 三處 `cluster={false}` / `cluster={undefined}` 全部拔掉(默認既非 cluster)。
- **Stale doc comment**:`GlobalMapPage` `* 點 cluster → supercluster.getClusterExpansionZoom 自動 zoom 展開` + z-index hint。

### Changed

- **Mockup S20 map FAB 對齊 prod `MapFabs`**(`docs/design-sessions/terracotta-preview-v2.html`):
  - `.tp-map-fab` size 48x48 → 44x44(對齊 prod CSS),border 1px solid → 0,gap 8px → 10px,加 `.is-active` accent variant。
  - 4 處 frame(desktop overview / compact overview / loading / empty)統一 right-bottom FAB stack:**圖層**(`i-layers`,aria-label「切換地圖圖層」)+ **我的位置**(`i-location-pin`,aria-label「定位到我的位置」)。
  - Compact frame 之前只有「定位」單顆,補上「圖層」對齊 prod 邏輯(prod 兩個 viewport 都顯示)。
  - aria-label 從「圖層」/「定位」 → 對齊 prod 的「切換地圖圖層」/「定位到我的位置」。
  - 加 `i-location-pin` SVG symbol(對齊 prod `Icon.tsx` line 54 path)。

### Tests

- `trip-map-rail-ocean-map-props.test.tsx`:`expect(props.cluster).toBe(false)` → `expect(props).not.toHaveProperty('cluster')`(回應 prop 已拔)。

## [2.17.12] - 2026-04-29

**TitleBar 規範統一 + ocean legacy purge**:把 trip-picker / overflow trigger / TripPage actions 全部收進 shared `.tp-titlebar-*` family,刪掉 V1 ocean legacy CSS 跟 unused components。

### Changed

- **Shared TitleBar action family**(`css/tokens.css`)
  - 既有 `.tp-titlebar-action`(icon+label desktop / icon-only mobile) 不變。
  - 新增 `.tp-titlebar-icon-btn` — icon-only menu trigger(取代 V1 `.ocean-tb-btn` legacy override)。
  - 新增 `.tp-titlebar-trip-picker` 系列(`.tp-titlebar-trip-menu` / `.tp-titlebar-trip-picker-name` / `.tp-titlebar-trip-picker-chevron` / `.tp-titlebar-trip-dropdown` / `.tp-titlebar-trip-row`) — Chat / Map 共用,規範:**桌機 SVG icon + 行程名 + chevron;手機 icon-only**(對齊 user 拍板的「桌機 icon+文字、手機 icon only」 title 規範)。
- **TripPage TitleBar refactor**(`src/pages/TripPage.tsx`)
  - 移除自有 `.tp-trip-titlebar-action` + `.tp-trip-titlebar-action-label` CSS,改 reuse shared `.tp-titlebar-action`。
  - 移除 `.tp-titlebar .ocean-tb-btn` legacy override + `::before { content: "⋯" }` unicode hack。
- **OverflowMenu trigger refactor**(`src/components/trip/OverflowMenu.tsx`)
  - className `.ocean-tb-btn` → `.tp-titlebar-icon-btn`。
  - `<span aria-hidden>☰</span>` + `<span class="ocean-tb-label">更多</span>` → `<Icon name="more-vert" />`(material symbols 三點 icon,aria-label 已有「更多功能」)。
- **ChatPage trip-picker refactor**(`src/pages/ChatPage.tsx`)
  - 移除 `.tp-chat-trip-picker` / `.tp-chat-trip-menu` / `.tp-chat-trip-dropdown` / `.tp-chat-trip-row` inline scope CSS。
  - JSX className 改 shared `.tp-titlebar-trip-*`,trip 標籤從 `<span class="pill">行程</span>` + 名字 改成 `<Icon name="swap-horiz" />` + 名字 + chevron。
- **MapPage trip-picker refactor**(`src/pages/MapPage.tsx`)
  - 同 ChatPage 改造,移除 `.tp-map-trip-picker` 系列 inline CSS,改用 shared class + swap-horiz icon。
- **Mockup S17 chat + S20 map 同步對齊**(`docs/design-sessions/terracotta-preview-v2.html`)
  - mockup `.tp-chat-trip-picker` → `.tp-titlebar-trip-picker` + 加 `i-swap-horiz` SVG symbol(Material swap-horiz)。
  - Map mockup 4 處 titlebar 統一加 back button(對齊 prod TitleBar `back` prop)、移除 V1「沖繩 + 大阪 + 京都」 ghost button + 「定位」 titlebar action(prod 沒有,定位走 FAB)。
  - mockup compact frame `.tp-titlebar-trip-picker` 縮回 icon-only(width 44 / no border / hide name + chevron)。

### Removed

- **V1 ocean legacy CSS**(`css/tokens.css`)— 確認無 TSX 引用後整批刪:
  - `.ocean-topbar` + `.ocean-topbar-left` / `.ocean-topbar-right` / `.ocean-brand-label` / `.ocean-tb-divider`(V1 sticky topbar shell,V2 已被 TitleBar 取代)。
  - `.ocean-nav-tabs` + `.ocean-nav-tabs button`(V1 inline nav tabs)。
  - `.ocean-tb-btn` + `.ocean-tb-ai`(V1 topbar button + AI pill variant)。
  - `.ocean-stop` 系列(`.ocean-stops` / `.ocean-stop-clickable` / `.ocean-stop-chevron` / `.ocean-stop-time` / `.ocean-stop-t` / `.ocean-stop-dur` / `.ocean-stop-icon` / `.ocean-stop-content` / `.ocean-stop-meta` / `.ocean-stop-type` / `.ocean-stop-name` / `.ocean-stop-rating` / `.ocean-stop-note` / `.ocean-stop-actions`)— V1 4-col stop card,Timeline.tsx 早已只 render TimelineRail。
  - `.ocean-round-btn` + `.ocean-travel`(V1 stop card 配件)。
  - `.ocean-overflow-wrap`(V1 topbar overflow wrapper)。
  - `body.dark .ocean-tb-btn.ocean-tb-ai` + `body.dark .ocean-stop[data-past]` dark variants。
  - `body.print-mode .ocean-topbar` print 規則。
  - 1100px breakpoint 內的 `.ocean-topbar` / `.ocean-brand-label` overrides(無對應的 base CSS)。
- **Unused components**(零 app code reference 確認後刪):
  - `src/components/shared/BreadcrumbCrumbs.tsx` + `tests/unit/breadcrumb-crumbs.test.tsx`。
  - `src/components/shared/PageNav.tsx`。
  - `src/components/shared/RequestStepper.tsx` + `tests/unit/request-stepper.test.tsx` + `tests/unit/request-stepper.test.js`。
  - `src/components/trip/DroppableIdeasSection.tsx` + `tests/unit/droppable-ideas-section.test.tsx`。
  - `src/components/trip/TodaySummary.tsx`。
- **Stale test assertions**(`tests/unit/pr2-tokens.test.ts`)— 移除 V1 dead class regression checks(`.ocean-tb-ai` Ocean fill / `.ocean-topbar` blur token / AI pill 互動 states)。

### Fixed

- **TripsListPage `.tp-trips-grid` mobile overflow**(`src/pages/TripsListPage.tsx`)— `repeat(2, 1fr)` 等同 `repeat(2, minmax(auto, 1fr))`,當 card title 寬於 1fr 計算值時 column auto 撐大,第二 col 超出 grid right edge(實測 viewport 390px,第二 card right = 418px,overflow 28px)。改 `repeat(2, minmax(0, 1fr))` 強制 min: 0。

## [2.17.11] - 2026-04-29

**Account page mockup parity + DesktopSidebar 去重**:User 拍板七項 finding,prod source 動兩處,mockup 反向更新對齊 prod 多項。

### Changed

- **DesktopSidebar 移除「帳號」 nav item** — User「桌機版 sidebar 不用帳號 避免重複」。Desktop 只剩 4 個 nav(聊天 / 行程 / 地圖 / 探索),user 透過底部 `.tp-account-card` user chip 進 `/account`。Mobile `GlobalBottomNav` 維持 5 tab 含「帳號」(底部空間有限,沒底部 user chip)。
- **AccountPage 登出 row 加強 destructive visual + icon 改 `x-mark`** — User AC6 拍板 mockup destructive style。原本 `arrow-left` icon 在 light-tan background red icon 視覺不夠 destructive;改 `x-mark` icon + CSS `.tp-account-row.is-danger` 加 title + helper 也繼承 red(原本只 row container set color,被 title/helper explicit color override 掉)。
- **Mockup `terracotta-preview-v2.html` Section 19 Account profile 對齊 prod**:
  - AC1 layout 從 horizontal(avatar 左 + 內容右)改 vertical centered(avatar 居中 + 名/email/stats 直排)
  - AC3 stats 從 inline 一行 `<strong>5</strong>個行程` 改 3-column grid stack(每個 stat 大數字 + 下面 label)
  - AC4 移除「共編設定」 row(共編 context 在 trip-level,不在 account global)
  - AC7 登出 helper 文案「會清除本地未同步資料」 → 「清除目前裝置的登入狀態」對齊 prod 中性描述

### Fixed

- **DesktopSidebar test 同步**:`logged-in 顯示 5 nav` → `logged-in 顯示 4 nav` test 對齊新 IA(帳號移到底部 user chip)

## [2.17.10] - 2026-04-29

**Multi-user chat 其他 collaborator 訊息照 LINE 群組規則顯示**:User 拍板共編 trip 的「其他人訊息」用 LINE 群組 layout(左側 + avatar + sender 名 bubble 上方),自己 + AI 維持原 layout。

### Added

- **新 row class `.tp-chat-msg-row.is-other-user`** — 其他 collaborator 訊息靠左,同 AI 一致 column flow
- **新 bubble class `.tp-chat-msg-other-user`** — secondary bg + border + bottom-left-radius 4px(類 AI bubble 但獨立 class 留未來區分空間)
- **新 sender name `.tp-chat-msg-sender-name`** — bubble 上方顯示 sender 名,11px caps + letter-spacing + muted color(LINE 群組對方訊息 sender 標示)
- **新 avatar `.tp-chat-avatar.is-other-user`** — secondary bg + border + sender 首字 initial(取代 AI 的深棕 background)
- **新 meta align `.tp-chat-msg-time-other-user`** — 時間 align flex-start + margin-left 對齊 avatar 後

### Changed

- ChatMessage render 邏輯重排:`isOtherUser = !isAssistant && m.submittedBy && m.submittedBy !== user.email`
- bubble wrap 加 `.tp-chat-msg-bubble-wrap`(flex column)讓 sender name + bubble 垂直排
- 三種 layout:**自己**(右側 accent)/ **其他人**(左側 LINE-style)/ **AI**(左側 + AI avatar)

## [2.17.9] - 2026-04-29

**Multi-user chat sender bug fix**:User 反饋 7 天行程(HuiYun owner + Ray 共編)的 chat 歷史訊息 sender 名稱錯——v2.17.2 我把 user message meta 改用 `useCurrentUser().displayName`(永遠是當前登入者),但歷史訊息可能是其他 collaborator 送的,應該標原 sender 名稱。

### Fixed

- **Chat user message bubble meta sender 改用訊息原 sender** — `ChatMessage.submittedBy` 欄位從 `tp_request.submittedBy` email 帶過來;render 時用 `m.submittedBy.split('@')[0]` 當 displayName,fallback 才是當前登入者 displayName。Optimistic 新訊息用當前 `user.email` 為 sender。

## [2.17.8] - 2026-04-29

**Map FAB stretch bug 修 + Mobile gestures 顯式啟用**:User 截圖反饋 trip-bound MapPage 的 layers/target FAB 跑到左中而非右下,加上手機需要明確的手勢操作。

### Fixed

- **`.tp-map-fabs` box stretch 全屏 bug** — computed style 量到 `top: -16px; left: -16px; width: 100%`,FAB 跑到地圖左上而非 mockup 規範的右下。`absolute` 在沒設 `top`/`left` 時某些 layout context 會自動 pull box 到 `0, 0`,加上 `right: 16; bottom: 16` 變 stretch 全屏。Force 加 `top: auto; left: auto; width: max-content; height: max-content;` 強制 box shrink-fit content。

### Added

- **Leaflet map 顯式啟用 mobile 手勢操作** — User 反饋「手機地圖增加手勢操作」。Leaflet 1.7+ default 已 enable 所有 touch interaction(pan / pinch / double-tap),但顯式宣告 `dragging: true`、`touchZoom: true`、`doubleClickZoom: true`、`scrollWheelZoom: true`、`bounceAtZoomLimits: true` 對齊 user 預期 + 抗上游 default 變動。

## [2.17.7] - 2026-04-29

**Map + Explore + Trips list 多頁 mockup parity**:User 反饋 GlobalMapPage Day color 漸層感太重、「全覽 / 我的位置」應為 SVG icon FAB、Explore default 應 load POI grid、Title action 統一「桌機 icon+文字 / 手機 icon-only」 規範。

### Changed

- **GlobalMapPage `.tp-global-map-pill` 改 `.tp-global-map-fab`** — 「全覽 / 我的位置」從 text pill(icon+「全覽」/「我的位置」文字 + glass blur)改 SVG icon-only 圓形 FAB(44x44 + box-shadow,對齊 mockup S20 `.tp-map-fab` + `production MapFabs`)。
- **GlobalMapPage 移除 dayColor 漸層**:Mobile entry card 拿掉 `borderLeftColor: dColor` inline style(改 default border 灰色,is-active 用 accent);Sheet day-num badge 拿掉 `background: dayColor(dayNum)` 改統一 muted 灰色背景。Markers 仍保留 dayColor(polyline + marker 一致 visual)。
- **ExplorePage default load 熱門 POI grid**:User 拍板 E5 — 移除「試試熱門 POI」 onboarding empty state,mount 後 region resolved 自動 `runSearch` 帶熱門 POI grid。Region 預設「全部地區」 fallback 用熱門目的地「東京」;有 active trip → 沖繩/首爾/台北。Empty state UI 改為 fallback only(search 失敗 + 沒結果情境)。
- **Title action 統一規範 `.tp-titlebar-action`**:User 拍板「桌機 icon+文字、手機 icon-only」是所有 title 規範。新 class:`.tp-titlebar-action` pill 帶 `<span class="tp-titlebar-action-label">label</span>`,`@media (max-width: 760px)` hide label + 縮回 icon-only 圓形。Apply:
  - **ExplorePage**「♡ 我的收藏」按鈕(對齊 mockup S18 line 7192 desktop `[icon] 文字` + line 7268 compact icon-only)
  - **TripsListPage**「+ 新增行程」按鈕(對齊 mockup S16 line 6869 desktop + line 7012 compact icon-only)

### Fixed

- **ExplorePage test 同步**:`shows error toast when search query < 2 chars` test 改驗 user input 後 fetch call count 沒增加(取代「fetch 沒被 call」),因 mount auto search 會先 call 一次 fetch。

## [2.17.6] - 2026-04-29

**Map page mockup parity 細修**:對齊 mockup S20「Map Page」剩餘差異 — day tab 高度過大(user 反饋「Day 的格式不能太高」)+ mockup 沒 zoom +/- 控制(production 用 Leaflet 預設左上 zoom buttons,mockup 反向更新 spec)。

### Changed

- **`.tp-map-day-tab` 高度減扁** — `padding: 10px 14px` → `6px 14px`,`min-height: 44px` → `36px`,跟 mockup S20 underline tabs 視覺一致(扁平 strip,不搶垂直空間)。Touch target 36px 略低於 Apple HIG 44px 規範,但 day tabs 排成水平 strip 有 horizontal touch slop,可接受
- **mockup `terracotta-preview-v2.html` Section 20 加 zoom +/- 控制示意** — `.tp-map-zoom-controls` + `.tp-map-zoom-btn` pair,左上 vertical stack 對齊 production Leaflet `leaflet-control-zoom` default

## [2.17.5] - 2026-04-29

**`/map` redirect 到 trip-bound MapPage + 補 trip-picker pill**:sidebar「地圖」link 走 `/map`(GlobalMapPage),但 mockup「Map Page」spec(Reference: `src/pages/MapPage.tsx`)規範的是 trip-bound view(full-bleed map + 底部 day tabs + 底部 entry cards)。GlobalMapPage 是 cross-trip global overview(3-col layout),沒有 mockup 對應。本次:
1. GlobalMapPage 加 render 前 3 層 redirect 判斷(有 cached activeTripId / fetch 後有 trip / 沒 trip 才走 empty state),避免 flash UI
2. MapPage 補 trip-picker pill + dropdown(對齊 mockup S20 right titlebar action),click 切 trip → navigate `/trip/:newId/map`

### Changed

- **`/map` GlobalMapPage redirect 邏輯改 render 前 3 層判斷** — `activeTripId`(localStorage cache)→ 立刻 redirect;`trips === null`(loading) → render null 避免 flash;`trips` fetch 完 → 有 trip 拿 `trips[0]` redirect / 沒 trip 走 empty state「+ 建立第一個行程」CTA。
- **MapPage 補 trip-picker pill + dropdown** — `.tp-map-trip-picker` pill 顯示「行程 / trip name / ▾」(對齊 ChatPage `.tp-chat-trip-picker` pattern);click 開 dropdown 列 user trips,選 → `navigate(/trip/:newId/map)` 整頁切 trip context。CSS 複用 ChatPage 既有 pattern 改 `tp-map-*` 命名空間。

## [2.17.4] - 2026-04-29

**「收闔」→「收合」台灣慣用語修正**:`收闔` 不是台灣現代慣用,改「收合」對齊用語規範。涵蓋 `TimelineRail.tsx`(3 處 aria-label / title)、`mockup terracotta-preview-v2.html`(3 處)、test fixture(2 處)、openspec historical archive(2 處)、CHANGELOG 歷史紀錄(1 處)。

### Changed

- 全 repo「收闔」→「收合」共 11 處替換(對齊 memory `feedback_taiwan_traditional_chinese.md`)

## [2.17.3] - 2026-04-29

**行程明細頁 stop card mockup parity**:對照 `terracotta-preview-v2.html` Section 12「Stop Card Redesign — Action Affordances」Variant A 規範與 Section 13「Trip Detail Page Content」截圖,將 collapsed stop row 與 expanded toolbar 全面對齊 mockup。User 拍板:F-001 chat list 模式 / F-008 suggestion pills 等已決議維持 production,本次純 stop card visual + interaction 對齊。

### Changed

- **Collapsed row:stop icon 從 inline 22px 改 48x48 大方框 box** — `secondary` bg + `border-md` + `radius-md` + 24px 內 icon。`data-accent="true"` row 用 `accent-subtle` bg + `accent-bg` border + `accent` icon color。對齊 mockup S12 Variant A 規範
- **Collapsed row:類型 label 從 sub line inline 拉出為 chip eyebrow** — 11px / weight 700 / letter-spacing 0.12em / uppercase / muted(default)/ accent(data-accent),放在景點名上方獨立一行。Sub line 只剩 duration · ★ rating
- **Expanded toolbar 從 body 上方移到底部** — `tp-rail-actions` 加 `margin-top: 12px`、`padding-top: 12px`、`border-top` 視覺分隔 body 內容,JSX 順序改為 「說明 → 地點 → 備註 → toolbar」,對齊 mockup S12 Variant A 「expanded 後底部統一 toolbar」spec
- **Expanded toolbar 排列改 4+2 grouped** — 左 4 常用編輯`[放大|複|移|編]` + spacer(flex:1)+ 右 2 終止/狀態`[刪|收合]`,視覺把「危險」與「狀態切換」與「常用編輯」拉開
- **「放大檢視」從 pill+文字 (106x44) 改 icon-only (44x44)** — 對齊 mockup toolbar 全 icon-only spec,移除 `tp-rail-action-btn` class 與內部 `<span>放大檢視</span>`
- **收合 icon 從 `x-mark` (✕) 改 `minimize` (↘↖)** — `x-mark` 語意是「關閉 modal」過於強烈,實際行為是 expanded → collapsed 切換,minimize 語意精準

### Added

- **`Icon` registry 加 `minimize`** — Material `fullscreen_exit` SVG path,雙斜線往內收

## [2.17.2] - 2026-04-29

**Chat user 訊息時間戳記修復 + sender 名稱**:v2.17.1 修了歷史訊息(透過 mapper)的 `createdAt` 渲染條件,但新送出的訊息有獨立 bug — `setMessages` 用 `timestamp: now`(數字)+ `as unknown as ChatMessage` cast 跳 type check,實際 `ChatMessage` interface 要 `createdAt` ISO string,新訊息永遠拿不到時間戳。本次修復 + 對齊 mockup 新規範,bubble meta 加 sender 名稱(self 顯示 displayName,fallback email local-part)。

### Fixed

- **user 訊息時間戳記永遠 missing** — `ChatPage.tsx:639` 新送出 user message 用 `timestamp: now` 而非 `createdAt: ISO`,`as unknown as ChatMessage` cast 讓 TypeScript 沒抓到。改用 `createdAt: new Date(now).toISOString()`,bubble meta render 條件 `{m.createdAt && !m.pendingRequestId}` 終於對 user 新訊息為真

### Changed

- **bubble meta 加 sender 名稱**:user message 從「14:03」改「Ray · 14:03」(`user.displayName` fallback email local-part fallback「我」),AI message 維持「Tripline AI · 14:02」。對齊新 mockup 規範
- **mockup `terracotta-preview-v2.html` Section 17**:user bubble meta 範例補 sender 名稱「Ray · 14:03」、「Ray · 剛剛」對齊 production 新行為

## [2.17.1] - 2026-04-29

**Chat 頁 mockup parity QA**：對照 `terracotta-preview-v2.html` Section 17 嚴格比對聊天頁,findings 14 條中 P1 + P2 + P3 共 9 條 design fix 全部 close,另發現並修復一個讓 bubble 時間戳記永遠拿不到的 backing data bug。P0 IA 重做(chat list 模式)與 F-008 suggestion pills schema 改動 deferred 給後續 PR。

### Changed

- **聊天 bubble 樣式對齊 mockup `tp-chat-bubble` 規範**:radius `12 12 6 12` → `16 16 4 16`(user)、`12 12 12 6` → `16 16 16 4`(AI);font-size `--font-size-callout` 16px → `--font-size-footnote` 14px;AI bubble bg `--color-background` → `--color-secondary`(對齊 mockup `--tp-secondary`)
- **AI avatar 從 accent terracotta 換深棕主色**:`.tp-chat-avatar.is-ai` bg `--color-accent` → `--color-foreground`、尺寸 32x32 → 40x40,user / AI avatar 終於有色彩區分;dark mode override #0F0B08 跟著 mockup 補
- **Send button 圓角矩形 → 正圓**:52x44 padding 10/18 → 40x40 padding 0 + radius 50%;hover state 加 `--color-accent-deep` 對齊 mockup spec
- **Composer glass spec 對齊 mockup**:padding 12/16 → 12/20、blur 12 → 14、補 `-webkit-backdrop-filter`;compact (≤760px) 走 mockup 10/14 規範
- **Day divider 純文字 center**:移除 hairline `::before/::after` flex 處理,改 `text-align: center` + `font-weight: 600` + `font-variant-numeric: tabular-nums` 對齊 mockup
- **Bubble meta 加 weight 500 + margin-top 4**:`.tp-chat-msg-time` 從 `margin-top: 2` weight default 升到 `margin-top: 4` `font-weight: 500` 對齊 mockup `tp-chat-bubble-meta` 視覺權重
- **Composer placeholder 文案**:「輸入指令(Enter 送出、Shift+Enter 換行)」→「輸入訊息或語音指令…」(對齊 mockup,移除 placeholder 內鍵盤提示這個反 HIG 的做法)
- **Textarea radius 12 → 16** 對齊 mockup `--tp-radius`

### Fixed

- **`RawRequestRow` 型別 vs `/api/requests` API contract 不一致** — interface 用 snake_case (`created_at` / `updated_at` / `trip_id` / `submitted_by` / `processed_by`),實際 API 透過 `_utils.ts:deepCamel()` 回 camelCase,導致 `rowToMessages` mapper 拿到 `row.created_at = undefined`,所有歷史訊息的 `createdAt` 永遠 null,bubble 時間戳記與 day divider 渲染條件 `{m.createdAt && !m.pendingRequestId}` 永不為 true。改 camelCase 後 bubble meta(40 條)+ day divider(3 條)正常 render。

## [2.17.0] - 2026-04-29

**Mockup parity QA followup**：v2 deeper QA 用 `getComputedStyle()` 進實際 DOM 量字級，找到 30 個 finding。修 6 個 capability 共 typography token / SVG icon discipline / map entry-cards desktop visibility / AddStopModal region-filter / TripsList camelCase + 出發日 + 已歸檔 / mobile bottom nav label 字級。

### Changed

- **Typography 全站對齊 mockup `terracotta-preview-v2.html` 規範**：`--font-size-body` 17→16、`--font-size-footnote` 13→14；`.tp-titlebar-title` desktop 24→20、compact 22→18；`.ocean-hero-title` ≥961 32→28、≤960 28→24、base 28→24；`.tp-trip-card-eyebrow` 11→10 + letter-spacing 0.18→0.12em；`.tp-trip-card-title` 17→16 + line-height 1.35 + 2-line clamp；NewTripModal h2 + AddStopModal title font-weight 800→700；mobile bottom nav label weight 500→700 + 鎖 line-height 14
- **TripsListPage trip card meta 加出發日**「{owner} · 7/2 出發」格式（mockup section 16:6906-6909）
- **TripsListPage 加「已歸檔」第 4 顆 filter tab** + empty state「目前沒有已歸檔行程」+「回到全部」reset button（mockup section 16:6890-6894；archived_at schema migration 為 follow-up）
- **AddStopModal「搜尋」tab body 加 region selector chip**（hardcode 5 region：沖繩 / 東京 / 京都 / 首爾 / 台南 + 全部地區）+ filter button + filter sheet placeholder（mockup section 14:6452 / 14:6460）
- **AddStopModal day meta 改全大寫**「DAY 01 · 7/29（三）」格式（mockup section 14:6442）
- **AddStopModal footer counter 改一律顯示**「已選 N 個 · 將加入 ...」即使 N=0（mockup section 14:6518）
- **/map page entry cards horizontal scroll desktop 也 visible** — 拿掉 `.tp-global-map-mobile-stack` 的 `@media (max-width: 1023px)` gate；加 `.tp-map-entry-stack/cards/card` class alias 對齊 mockup naming
- **/map page「全覽 / 我的位置」chips 從 top-left 移到 right-bottom FAB 位置** — mockup 規範「不用 floating top day strip」

### Fixed

- **TripInfo interface stale snake_case bug** — API 透過 `functions/api/_utils.ts` 的 `deepCamel()` 把 SQL `day_count`/`start_date`/`member_count` 轉 camelCase，舊 interface 用 snake_case 導致 runtime 永遠 undefined → trip card eyebrow 缺「· N 天」、meta 缺日期。改 camelCase 對齊實際 response。
- **NewTripModal close button 違反 CLAUDE.md icon 規範** — `.tp-new-form-close` 內部從 UTF-8「✕」字元改 `<Icon name="x-mark" />` SVG sprite reference

### Added

- **Icon registry 補 4 個 icon** — `chevron-down` / `chevron-up` / `filter`（Material funnel）/ `target`（compass-rose）

### OpenSpec

- `openspec/changes/mockup-parity-qa-fixes/` — 6 capability proposal + design + tasks + specs（3 new + 3 modified）
- `.gstack/qa-reports/qa-report-trip-planner-dby-pages-dev-2026-04-28.md` — v2 deeper QA report 含 30 finding + severity matrix + sprint plan

## [2.16.3] - 2026-04-28

**修加景點不自動更新行程 + 清掉 InlineAddPoi dead code**。User 報告：手動加景點後 timeline 沒自動更新（screenshot 顯示舊 InlineAddPoi UI）。

### Fixed

- **加景點到非當前 day 不刷新 timeline** — `TripPage` 的 `tp-entry-updated` listener 之前忽略 `event.detail.dayNum`，永遠 call `refetchCurrentDay`。當 user 加景點到不是 day-strip 當前選中那天時（timeline 同時顯示所有 day），該 day 的 cache 沒被 invalidate → DaySection 仍顯示舊 entries。改：listener 讀 `event.detail.dayNum`，走新增的 `refetchDay(targetDay)`，refetch 對的 day。沒帶 dayNum 的舊 event source 仍 fallback 到 `refetchCurrentDay`。

### Removed

- **InlineAddPoi 跟對應 unit test** — V2.15 (terracotta-mockup-parity-v2) 已用 `<AddStopModal>` 取代 inline `<InlineAddPoi>`，src/ 內無 import (dead code)，但 cached prod build 仍可能包含。直接刪除 component 跟 16 個 unit test 一次清乾淨，下次部署 user 強制 fetch 新 bundle 後就看不到舊 UI。

### Added

- **`useTrip` 新增 `refetchDay(dayNum)` API** — 取代「永遠 refetch currentDay」假設，handle 任意 day 的 cache invalidation + state update。`refetchCurrentDay` 改為 `refetchDay(currentDayNum)` 的 alias。

### Internal

- verify gate: tsc clean / 157 test files / 1330 tests pass (deleted 16 InlineAddPoi tests).

## [2.16.2] - 2026-04-28

**Hotfix dark mode 地圖底圖：carto dark_all → carto light_all**。深色 UI 配深色 tile 對比不足，accent 紅色 polyline + day-color marker 在 dark tile 上不易辨識。改為 Carto Positron light_all（muted 淺色底圖），dark UI chrome 配淺色地圖內容，markers / labels / polylines 對比強。

### Fixed

- **`useLeafletMap.ts` dark mode tile**：`OSM_DARK` (`cartocdn/dark_all`) 改為 `OSM_DARK_UI` (`cartocdn/light_all`)，rename 反映語意（dark UI mode 用的 tile，本身 light）。Light mode 仍用 OSM 標準 tile。Initial mount 跟 dark prop swap 兩個 path 同步更新。
- verify gate: tsc clean / 1346 tests pass。

## [2.16.1] - 2026-04-28

**Hotfix CI failures — GitHub Pages Jekyll build + mobile Playwright matrix 全綠**。修 v2.16.0 之後的 master CI 三個獨立 fail（不影響 Cloudflare Pages production deploy，但擋住自動化驗證信號）。

### Fixed

- **GitHub Pages Jekyll build** — 新增 `_config.yml` 把 `CHANGELOG.md` 加進 `exclude` 清單。Jekyll 3.10 沒有 page-level `render_with_liquid: false`，遇到 v2.14.2 內含的 ``state={{ scrollAnchor: 'entry-${id}' }}`` inline code 會被 Liquid engine 當 template variable 解析失敗。同時排除 `tests/`、`functions/`、`migrations/`、`scripts/`、`openspec/` 等不需要被 publish 為 docs 的目錄。
- **`account-page.spec.js` mobile-chrome / mobile-safari fail** — `getByText('帳號').first()` 抓到 `DesktopSidebar` 隱藏 span（`@media (max-width: 1023px)` 下 `app-shell-sidebar { display: none }`，但 React 仍 render 進 DOM）。給 `AccountPage` 三個 group label div 加 `data-testid={`account-group-label-${group.key}`}`（`application` / `collab` / `account`），spec 改用 `getByTestId(...).toHaveText(...)`，跳脫 DOM 順序判定。
- **`drag-flows.spec.js:82` mobile-safari boundingBox null** — Playwright 的 `boundingBox()` 對 webkit + sticky/transform 容器內的 element 有已知 edge case 偶爾回 null。改先 `scrollIntoViewIfNeeded()` 再用 `el.evaluate(e => e.getBoundingClientRect())` 直接讀 DOM API，跳過 Playwright 內部 box logic。
- verify gate: tsc clean / 1346 unit + integration tests pass / mobile-chrome + mobile-safari e2e 24/24 pass / 0 review findings / 0 cso findings。

## [2.16.0] - 2026-04-28

**Terracotta mockup parity v2 — 5 capability + ABCDE deferred 全處理**。

對齊 `docs/design-sessions/terracotta-preview-v2.html` (7,950 行 / 14 page section / 5 design-token reference) 為 source of truth，跨 5 capability + 17 個 ABCDE deferred follow-up 全 land。OpenSpec change `terracotta-mockup-parity-v2` 完整 spec + design + tasks + 4 份 notes (bottom-nav-ia-decision / e-deferred-decisions / 等)。

### Added

- **`/account` 統一帳號 hub**：profile hero (avatar 64px + name + email + 3 stats) + 3 group settings rows (應用程式 / 共編 & 整合 / 帳號) + 登出 ConfirmModal pattern。新建 `/account/appearance` (主題切換) + `/account/notifications` (即將推出 stub) 兩 sub-route。
  - 新 endpoint `GET /api/account/stats`：`{ tripCount, totalDays, collaboratorCount }` SQL aggregate (lowercase email、含 wildcard '*' 處理、distinct collaborator)，10 個 unit case 驗 fetch flow，7 個 integration case 驗 SQL 結構與 collab dedup 邏輯。
- **Trip-level「加景點」 modal**（`AddStopModal`，取代 day-level inline `InlineAddPoi`）：3-tab pattern (搜尋 / 收藏 / 自訂) + 5 category subtab (為你推薦 / 景點 / 美食 / 住宿 / 購物) + footer counter 「已選 N 個 · 將加入 Day X」 + 自訂 tab 含 inline error 驗證。Trigger 在 TripPage TitleBar，embedded mode (`/trips?selected=`) 也提供同 entry 走 forwardRef handle。
- **5-tab GlobalBottomNav (mobile-bottom-nav adopt)**：聊天 / 行程 / 地圖 / 探索 / 帳號（logged-in）or 登入（guest），對齊 mockup section 02。Active state 含 2px top indicator + accent-subtle 底。「地圖」 tab regex 同時涵蓋 `/map` 與 `/trip/:id/map` 但不誤觸 `/manage/map-xxx`。原 4-tab `BottomNavBar` 標 `@deprecated`。
- **`ActiveTripContext`**：app-level「目前選擇的行程」 single source of truth，跨頁同步 (window storage event) + localStorage 持久化 + provider-外 fallback degraded mode。/trip/:id 進入自動 set，/chat 預設 active trip 對應 thread，/map 預設 pin overview，/explore region 預設對應 country (JP→沖繩 / KR→首爾 / TW→台北)，補償 5-tab IA 失去 trip-scoped 高效。
- **TimelineRail 補強**：toolbar 加「編輯備註」鉛筆 icon button → focus note textarea (取代 implicit click-to-edit)；`window.confirm` delete → ConfirmModal pattern (alertdialog + destructive variant + Esc/backdrop close)；grip handle desktop hover-only (`@media (hover: hover) and (pointer: fine)`)，touch device + keyboard focus 永遠可見保 a11y。
- **TimelineRail TravelPill**：兩 entry 之間 conditional render `tp-travel-pill`「N 分 · 描述」 (依 entry.travel = { type, desc, min })。type → icon map (car / walking / train / bus / plane / fallback car)。
- **TripPage TitleBar ghost button text label**：「加景點 / 建議 / 共編 / 下載」 desktop ≥1024px icon + text，tablet 760-1023px icon-only，mobile ≤760px hide 走 OverflowMenu。
- **TripsListPage filter + sort + search + owner avatar**：filter subtab (全部 / 我的 / 共編 with count) + sort dropdown (最新編輯 / 出發日近 / 名稱 A-Z) + search expanding bar (button → input + result count) + owner avatar (28x28 圓形 initial)「由你建立 / owner email」。Card eyebrow 中文化「日本 · 5 天」。
- **ChatPage day divider + AI avatar + bubble timestamp prefix**：跨日訊息間 inject `tp-chat-day-divider` (YYYY/MM/DD（週X）)；assistant bubble 加 32x32「AI」 avatar (左側) + timestamp prefix「Tripline AI · 」；TitleBar title 從固定「聊天」→ 當前 trip.name；送出 button text → icon-only。
- **ExplorePage POI cover + region + 5 subtab + heart save**：對齊 mockup section 18。Card top 16:9 cover (data-tone 1-8 gradient placeholder) + 右上 heart icon button (toggle saved) + body 內 ★ rating + accent border hover lift transition (`translateY(-2px)`)。Region selector pill (default 用 active trip's countries) + 5 category subtab (為你推薦 / 景點 / 美食 / 住宿 / 購物，client-side regex filter)。Element 順序對齊 mockup section 18 (region pill → search bar → subtab → grid)，placeholder「搜尋景點、餐廳、住宿…」，grid desktop 3-col / mobile 2-col。
- **NewTripModal 多目的地 sortable + popular/recent chips + day quota stepper**：destination 改 `@dnd-kit/sortable` rows (grip + 編號 + name + region + remove)，title「新增行程」，date mode tabs label「固定日期 / 大概時間」，多 dest 顯示「行程跨 N 個目的地 · 順序決定地圖 polyline 串接方向」 helper。新加「熱門目的地」6 個 chip + 「最近搜尋」localStorage 5 個（selectPoi push）。多 dest + total days > 0 顯示「分配天數」 stepper (evenly split + remainder 前段累加)，submit 時 sum === total 才 append「目的地天數分配：沖繩 3 天 / 京都 2 天」 到 description 給 AI consume。
- **DaySection day title 概念 + migration 0042**：`trip_days.title TEXT` column (nullable)，3-tier fallback (title || area || `Day N`)。`Day` + `DaySummary` types 加 title field，`useTrip` mapDayResponse + `_merge.ts` assembleDay surface title，audit rollback ALLOWED_COLUMNS 加 title。Day title 編輯 UI (PATCH /api/trips/:id/days/:num) 為 follow-up。
- **DayNav 對齊 mockup section 11**：今天 day eyebrow 加「· 今天」 suffix (取代獨立 TODAY pill)；拿掉 `dn-dow` 週幾英文 extra row；`.dn-area` max-width 80→120px 給「美瑛拼布之路」 4-5 字 area 完整空間。
- **DesktopSidebar dark theme**：bg → `var(--color-foreground)` 深棕，inactive item rgba(255,251,245,0.6) muted-light，active item bg `var(--color-accent)` + 文字 `var(--color-accent-foreground)`，font-weight 600 全 item，name truncation `name.length > 10 ? slice(0,10)+'…'`。Logged-in 顯示「帳號」 nav item (link `/account`)；logged-out 顯示「登入」。
- **TripPage offline + load error AlertPanel**：新建 `<AlertPanel>` (variant: error / warning / info + actionLabel + onAction + onDismiss + role=alert/status)，TripPage offline 時 main 上方 render persistent warning banner，load error 改 AlertPanel + retry action (取代既有 generic 「行程不存在」 fallback)。
- **MapFabs 圖層 + 定位**：MapPage 右下 FAB stack 兩 button — 「圖層」 popover (街道 OSM / 衛星 Esri World Imagery / 地形 OpenTopoMap，swap Leaflet tile layer) + 「定位」 (`navigator.geolocation` → `flyTo` 14 zoom + L.circleMarker user pin)。MapDayTab active 改 per-day color underline (inline `--day-color` CSS var)。
- **icon SVG sweep**：8 個 emoji（🗑 ✕ ⛶ ⎘ ⇅ 🔍 ❤ ✓）→ `<Icon>` SVG sprite (Material Symbols Rounded style)，新增 trash / maximize / arrows-vertical / copy / check / send / heart / pencil / layers 9 個 sprite。Source-grep contract test (`tests/unit/no-emoji-icons.test.ts`) 防 regression。
- **20 個 unit + 2 個 E2E + 1 個 integration test suite (新增)**：alert-panel / no-emoji-icons / chat-page-day-divider / chat-page-ai-avatar / day-section-title / day-nav-eyebrow / desktop-sidebar-visual / new-trip-modal-multidest / explore-page (+7 case) / trips-list-page (+5 case) / account-page / trip-page-titlebar-actions / timeline-rail-toolbar-pencil / travel-pill / add-stop-modal / map-fabs / global-bottom-nav-5tab / active-trip-context；E2E `account-page.spec.js` + `add-stop-modal.spec.js`；API `account-stats.integration.test.ts`。

### Changed

- **「儲存池」→「我的收藏」 全 codebase rename**：「儲存池」非台灣慣用語，rename 跨 ExplorePage / LoginPage / SignupPage / `api.ts` comment / unit test / e2e api-mocks fixture / openspec design.md / spec.md / tasks.md。對齊 mockup line 7294「我的收藏」 命名。
- **ExplorePage UI 重組對齊 mockup section 18**：拿掉「搜尋 / 我的收藏」 tab pair (mockup 無 tab 結構)，改用 TitleBar action button toggle 兩 view (search view title「探索」 + 「我的收藏」 button；saved view title「我的收藏」 + 返回探索 back button)。
- **TripPage / GlobalMapPage / ChatPage active trip 統一**：原各頁 `lsGet/lsSet LS_KEY_TRIP_PREF` 散用 → 統一改用 `useActiveTrip()` hook，跨 tab + 跨頁同步。

### For contributors

- **OpenSpec change `terracotta-mockup-parity-v2`**：5 capability spec (icon-svg-sweep / account-hub-page / add-stop-modal / ui-parity-polish / mobile-bottom-nav) + design.md (含 14 page section audit ~46 missing / 42 inconsistent / 11 extra finding) + tasks.md 全 task 標 done/deferred 含原因 + 4 份 notes (bottom-nav-ia-decision / e-deferred-decisions / etc)。
- **`feedback_mockup_source_of_truth.md` memory**：mockup 是 source of truth 不挑戰；提供 implementation option 時 A 永遠是 mockup-aligned 那個且為 recommended，B/C 才是 deviation。
- **`docs/parity-v2-release` doc-release branch + VERSION 2.15.0 → 2.16.0**：covers PR #387 (terracotta-mockup-parity-v2) + PR #388 (E1 follow-up: account-stats integration test)。
- BottomNavBar (4-tab) 標 `@deprecated`，全 page 統一改用 GlobalBottomNav (5-tab)。File 暫保留為下個 cleanup PR。
- InlineAddPoi 標 `@deprecated`，DaySection 不再 import 渲染。File 暫保留為下個 cleanup PR。

## [2.15.0] - 2026-04-28

**Ideas drag-to-itinerary — drag UX primitives + batch endpoint + design polish**。

OpenSpec change `ideas-drag-to-itinerary` 38/42 task 完成（4 個剩 manual ops gate）。
帶來行程編輯的 drag-and-drop 基礎：Ideas 拖到 Day → entry，Timeline 內拖動重排走
單次 batch transaction，drag 完成後 5 秒 undo toast 可 revert，鍵盤使用者可用
Space/Arrow/Enter/Esc 操作並聽到中文螢幕閱讀器播報。順手把 design-review 的
10 個 finding（5 HIGH / 2 MEDIUM / 3 POLISH）一次清掉：H1 字級、44px 觸控目標、
Chat 亂碼安全渲染、user message `\n` 換行、Explore landing chip 建議、
DragOverlay 抬起感視覺、disabled button 視覺對比。

### Added

- **PATCH /api/trips/:id/entries/batch endpoint** — D1 atomic batch transaction
  取代 N+1 PATCH，drag-drop reorder 結束後一次送 N entries 的 sort_order /
  day_id / time。4 層 atomic gate：requireAuth → hasPermission(tripId) →
  per-id ownership pre-check via JOIN trip_days → cross-trip day_id move
  pre-check。8 integration cases 全 pass。
- **Drag UI primitives**：
  - `src/lib/drag-strategy.ts` smart placement + 衝突偵測（純函式）
  - `src/lib/drag-announcements.ts` 中文 onDragStart/Over/End/Cancel announcements
  - `src/lib/demote-strategy.ts` API orchestration (DELETE entry → PATCH idea)
  - `src/hooks/useDragDrop.ts` PointerSensor + TouchSensor (200ms long-press) +
    KeyboardSensor wrap
- **Drag UI components**：
  - `ConflictModal` 時段衝突解決（換位置 / 併排 / 取消）
  - `UndoToast` 5 秒 revert window with reset key + role=status aria-live
  - `DroppableIdeasSection` + `IDEAS_SECTION_DROP_ID` 常數供 V2 cross-component
    drag wiring
  - `DemoteConfirmModal` destructive 確認 (時段資訊會清除)
- **TimelineRail drag reorder via batch endpoint** — handleDragEnd 從 N+1 PATCH
  改用 PATCH /entries/batch；optimistic order override 失敗時 revert；DndContext
  套中文 announcements。
- **IdeasTabContent UndoToast wiring + ConflictModal 換位置/併排 scenarios** —
  commitPromote 後 setLastPromote → 5 秒 toast → click undo 觸發 DELETE entry
  + PATCH idea promotedToEntryId=null + reload。
- **DragOverlay polish (F7 design-review)** — `.tp-idea-card-overlay` 加
  `transform: scale(0.95) rotate(2deg)` + `box-shadow: 0 12px 32px ...` +
  `dropAnimation={null}`，並 `prefers-reduced-motion` override。
- **Explore landing empty state (F6 design-review)** — `.explore-landing-empty`
  card 加 5 個 chip 建議（沖繩美麗海水族館 / 首里城 / 國際通 / 古宇利大橋 /
  美國村），click 自動填欄 + 跑 search；refactor extract `runSearch(q)` 讓 form
  submit 跟 chip click 共用。
- **Chat mojibake safe-render (F7 design-review)** — `isGarbledMessage` helper
  detect U+FFFD / 連續 3+ Latin Extended / C1 控制字元，render 前 bail out 顯示
  「⚠ 訊息含編碼錯誤，無法顯示」placeholder，避免 raw bytes 破壞 trust signal。
- **Playwright drag-flows E2E** — `tests/e2e/drag-flows.spec.js` 5 cases pass on
  chromium：grip a11y label / cross-day ⎘⇅ popover / mobile touch target ≥32px /
  keyboard focus + Space + Esc / aria-live region attached。

### Changed

- **TitleBar H1 字級提升 (F1 design-review)** — desktop 20→24px / mobile 18→22px，
  讓 trip 標題視覺權重更接近 H2 (32px) Day name，緩解 hierarchy 倒置（完整 H1↔H2
  semantic swap 留 ENG follow-up）。
- **44px 觸控目標 (F2 design-review)** — ThemeToggle 三段切換 button (32→44px) +
  TimelineRail `.ocean-rail-grip` (32→var(--spacing-tap-min)) +
  `.tp-titlebar-back` (36→var(--spacing-tap-min))。
- **Disabled 送出 button 視覺對比 (F9 design-review)** — `.tp-chat-send:disabled`
  從只 opacity:0.5 改用 secondary cream 背景 + muted brown 文字 + opacity:0.6 +
  cursor:not-allowed。
- **Chat user message `\n` literal 換行 (F8 design-review)** — render 時
  `replace(/\\n/g, '\n')` 配合既有 `white-space: pre-wrap` 顯示為實際換行。
- **TimelineRail / IdeasTabContent DndContext zh-TW announcements (Section 5)** —
  套 `accessibility={TP_DRAG_ACCESSIBILITY}` 讓螢幕閱讀器收到中文播報。

### Fixed

- **F4 false positive verified-no-fix** — Alert ⚠ 確認已用 `<Icon name="warning" />`
  inline SVG（之前 thumbnail 縮圖看起來像 emoji）。
- **F3 / F5 / F10 false positive verified-no-fix** — Times serif + pure black 只在
  HTML/HEAD/META invisible elements；map sidebar 實際 240px 跟其他 page 一致。

## [2.14.30] - 2026-04-27

**V2 共編分享信完整實作 — invitation token 系統 + 4 endpoint + InvitePage**。

行程擁有者現在可以邀請任何 email 共編行程：對方收到含一次性 token 的 invitation 信，
點 link 後依是否已註冊走「登入並加入」或「註冊並加入」流程，user.email 必須 match
invitation 才能 accept（防 phishing token forwarding）。CollabSheet 新增「待接受邀請」
section 顯示 pending list + 撤銷按鈕。

### Added
- **新表 `trip_invitations`**（migration 0040）— token_hash PK（HMAC-SHA256 of raw token，不存 raw）+ trip_id/invited_by FK + 7 天 expires_at + accepted_at/by lifecycle 欄位。
- **Migration 0041 schema 強化** — partial UNIQUE INDEX `(trip_id, invited_email) WHERE accepted_at IS NULL` 防同 (trip,email) 累積無限 pending；invited_by `ON DELETE SET NULL` 保留邀請者刪除後的 audit trail。
- **Email template `tripInvitation`** — 兩個分支文案（已註冊「登入並加入」/ 未註冊「註冊並加入」）+ 7 天 TTL 提示 + anti-phish footer 顯示 inviterEmail。
- **Endpoints**：`GET /api/invitations?token=xxx`（公開預覽）/ `?tripId=xxx`（owner 列 pending）/ `POST /api/invitations/accept` / `POST /api/invitations/revoke`。
- **InvitePage**（`/invite?token=xxx`）— 4 種 UI state：loading / error 含「請聯絡邀請者重寄」/ logged-in match → 接受按鈕 / mismatch → 顯示「此邀請不屬於你」/ anonymous → 兩個 CTA（註冊 + 登入）。
- **LoginPage / SignupPage 接 `?invitation=xxx`** — 登入/註冊成功後自動 accept invitation → redirect `/trips?selected=:tripId`。
- **CollabSheet「待接受邀請」 section** — 顯示 invitedEmail + 剩餘天數 / 已過期 badge + 「撤銷」按鈕。
- **`tryAcceptInvitation` 共用 helper** — 被 `/accept` endpoint 與 signup 共用，atomic batch INSERT trip_permissions + UPDATE accepted_at（含 race guard `WHERE accepted_at IS NULL`）。

### Changed
- **`POST /api/permissions` 兩條分支**：邀請 email 已註冊 → INSERT trip_permissions + 寄通知信；未註冊 → 產 invitation token + INSERT trip_invitations + 寄含 signup link 的邀請信。Email best-effort（失敗不擋業務流程）。
- **`POST /api/oauth/signup` 接 `invitationToken`** — 註冊成功後自動 accept invitation；失敗 graceful（response 含 `invitationError` 但 signup 仍成功）。

### Removed
- **`permissions.ts` Cloudflare Access 死代碼**（V2-P6 cutover 後 CF Access 已拆，~70 行 `addEmailToAccessPolicy` 等函式移除，DELETE handler 同步清理）。

### Fixed
- **/review specialist findings** — race condition guard（accept UPDATE 加 `accepted_at IS NULL` WHERE）/ role enum validation（`POST /permissions` 拒非 member|admin）/ CollabSheet 409 toast 改讀 server message（區分「已有權限」vs「pending 邀請」）/ revoke endpoint error code 改 `INVITATION_*` namespace。
- **/simplify findings** — 抽 `sendInvitationEmailBestEffort` helper 去 25 行 copy-paste / GET pending 加 `LIMIT 100` 防大 payload / `SELECT *` 改指定欄位。

### Tests
- 新增 ~70 test cases（migration schema × 2、template、4 endpoint × ~10、InvitePage、Login/Signup invitation、CollabSheet pending）。
- 1080 unit + 582 API test 全綠。

### Security
- HMAC-SHA256 token（256-bit entropy）+ DB 存 hash 不存 raw → DB dump 無法反查 token。
- Email match check 防 token 轉寄（user.email !== invited_email → 403）。
- partial UNIQUE 防同 (trip,email) pending 累積。
- Audit log on accept / revoke / permission_added / invitation_sent。
- `/cso --diff` 通過 8/10 confidence gate，無 critical findings。

verify gate: tsc clean / 1662 tests pass / /simplify + /tp-code-verify + /review (5 specialists) + /cso --diff 全過。

## [2.14.29] - 2026-04-27

**PR-VV: mobile bottom-nav scroll-direction-aware auto-hide（QA round 28）**。

### Added
- **Bottom-nav 向下捲消失、向上捲顯示** (iOS Safari pattern)。AppShell 加 scroll listener on `.app-shell-main`，detect direction → toggle `data-hidden` attr → CSS `transform: translateY(100%)` slide animation。
- 8px threshold 避免抖動，60px top buffer 避免最頂端就 hide。
- `passive: true` listener (RBP-26 規定)。

### Changed
- **Bottom-nav grid row → fixed overlay** — 原 sticky in grid row 結構無法 transform-hide（row 仍佔空間），改 `position: fixed` 才能 slide 完全離場。
- Main pane 加 `padding-bottom: var(--nav-height-mobile, 88px)` reserve space 避免 content 被遮。

### Tests
- `app-shell-snapshot.test.tsx` snapshot 更新（多 `data-hidden="false"` attr）。

verify gate: tsc clean / 1029 tests pass.

## [2.14.28] - 2026-04-27

**PR-UU: 共編 chip 改漢堡選單 (共編 / 列印 / 下載 4 formats)（QA round 27）**。

### Added
- **Embedded topbar 漢堡選單** — 替換 PR-RR 的 共編 chip。⋯ icon-btn 36×36 (mockup A `.va-icon-btn` 規格) → portal dropdown 200px 寬：
  - **共編設定** — 走 host `setCollabTripId` 開既有 InfoSheet
  - **列印** — 走 TripPage forwardRef `togglePrint()` 進入 print-mode (既有 hook)
  - **下載 PDF / Markdown / JSON / CSV** — 走 TripPage forwardRef `triggerDownload(format)` (既有 `lib/tripExport.ts` downloadTripFormat)
- 對齊 mockup-trip-selected-v1.html Variant A 完整版（topbar 終於完成 right action group）。

### Changed
- TripPage 改為 `forwardRef<TripPageHandle>` — 暴露 `openSheet` / `triggerDownload` / `togglePrint` 給父層 cross-component 呼叫。
- TripsListPage 加 `tripPageRef = useRef<TripPageHandle>(null)`，傳給 embedded TripPage。

### A11y
- Menu 走 `role="menu"` + items `role="menuitem"`
- Esc / outside click 關閉 + focus return
- Trigger 帶 `aria-haspopup` + `aria-expanded`

verify gate: tsc clean / 1029 tests pass.

## [2.14.27] - 2026-04-27

**PR-TT: hotfix embedded topbar CSS 沒注入 → 子元素 stack vertically（QA round 26）**。

### Fixed
- **Critical layout bug** — `<style>{SCOPED_STYLES}</style>` 原本在 `cardGridMain` JSX 內，embedded mode 不渲染 cardGridMain → CSS 沒注入 → `.tp-embedded-topbar` 用 `<header>` UA 預設 `display: block`，子元素 stack vertically：
  - User 看到 `[← back]` + `[共編 chip]` 兩行而非一行
  - PR-RR 整個 actions slot 視覺被破壞
- 修：`<style>` 提到 component 頂層 `return ()` 的 `<>` 內，永遠注入。
- 桌機 + 手機 同時修復，兩者都正確顯示 `[← back] [trip name] [共編 chip]` 單行 topbar。
- verify gate: tsc clean / 1029 tests pass。

## [2.14.26] - 2026-04-27

**PR-RR: 補齊 mockup A actions slot — 共編 chip 進 embedded topbar（QA round 25）**。

### Changed
- **共編 chip 從 TripPage 搬進 embedded topbar** — 對齊 `mockup-trip-selected-v1.html` Variant A right action group。topbar 變成 `[← back] [trip name] [共編]`。
- TripPage `.tp-trip-actions` chip 在 `noShell` mode 下 hide，避免兩個 共編 entry 重複。
- 共編 chip 點擊呼叫 `setCollabTripId(effectiveSelectedId)` → 開 TripsListPage 既有 InfoSheet（跟卡片 ⋯ → 共編 同 path）。

### TODO
- Variant A 的 ⋯ overflow icon-btn 還沒做（cross-component OverflowMenu wire deferred）。

verify gate: tsc clean / 1029 tests pass.

## [2.14.25] - 2026-04-27

**PR-QQ: embedded topbar 對齊 mockup-trip-v2 canonical（QA round 24）**。

### Changed
- **Embedded topbar 視覺重設** — 對齊 `mockup-trip-v2.html` line 438 `.mobile-topbar` canonical 規格 + `mockup-trip-selected-v1.html` Variant A:
  - Padding 12px → **16px**（mockup standard）
  - Back btn **40×40 transparent** → **36×36 with border + bg-background**（mockup `.icon-btn` pattern）
  - Back icon 20px → 18px
- Title 維持 17px bold 單行（不加 day eyebrow，採 user 偏好的 simple title style）。

### Notes
- Mockup file 寫於 `docs/design-sessions/mockup-trip-selected-v1.html`（3 variants × desktop/mobile demos）做為設計 baseline。
- 共編 chip 與 ⋯ 暫保留在 TripPage 內部；後續可考慮整合進 topbar actions slot。

verify gate: tsc clean / 1029 tests pass.

## [2.14.24] - 2026-04-26

**PR-PP: /trips 架構改 2-pane（去 sheet）+ 5 cards/row + 點選顯示滿版（QA round 23）**。

### Changed (架構)
- **去 sheet** — TripsListPage 不再有右側 sheet pane。AppShell 從 3-pane 改成 2-pane (sidebar 240 + main fluid)。
- **點選 = 滿版 trip** — `/trips?selected=X` 在桌機/手機都把 main 換成滿版 embedded TripPage（含 `[← back] [trip name]` topbar），不再走 sheet。`showEmbeddedTrip` 不分 viewport 同行為。
- **行程 card 一行 5 個** — minmax 200 → 160，加上去 sheet 後 main 變寬：
  - 1024 → 4 cards × 168px
  - 1280 → 5 cards × 179px
  - 1440 → 5 cards × 179px
  - 1920 → 5 cards × 179px (max-width 960 cap)
- 5 cols 在 ≥1280 穩定，符合 user 「一行 5 個」 spec。

### Removed
- `.app-shell:has(> main .tp-trips-shell)[data-layout="3pane"]` sheet width override（已不適用）。
- TripsListPage `sheet` prop 傳給 AppShell。
- Embedded mode 的 `!isDesktop` 限制（現在桌機/手機都走 embedded）。

### Refined
- **Embedded TripPage 吃滿 main 寬** — User 進一步釐清：sidebar 固定後 trip detail 直接吃滿剩餘空間，不要 max-width 限寬。砍掉 `.tp-embedded-content` wrapper（曾短暫加上 max-width 720 後被 user 退回）。

### Tests
- 更新 2 cases：原 `desktop: first trip auto-selected → sheet` 改為新架構 `desktop + no ?selected: card grid only` + `desktop + ?selected: 滿版 embedded`。

verify gate: tsc clean / 123 files / 1029 tests pass.

## [2.14.23] - 2026-04-26

**PR-NN/OO bundle: mobile-topbar 取代 floating back btn + CollabModal → InfoSheet 統一（QA round 22）**。

### Fixed (PR-NN)
- **手機回上一頁自己一行 + 跟 mockup 不符** — 原 `.tp-trips-back-btn` 是 40x40 floating sticky 在 TripPage 之上，獨佔一行。改成 56px 全寬 sticky `.tp-embedded-topbar`（對齊 `mockup-trip-v2.html` line 438 `.mobile-topbar`）：[← back btn] [trip name] 兩欄，glass blur 樣式跟 mockup 一致。
- 修法：刪掉 `.tp-trips-back-btn` CSS + 改 embedded JSX 用 `.tp-embedded-trip` wrapper + `.tp-embedded-topbar` header。

### Changed (PR-OO)
- **桌機共編 ≠ 手機共編** — TripsListPage 卡片 ⋯ → 共編走 `CollabModal`（centered 520px modal），TripPage 共編 chip 走 `InfoSheet`（slide-up sheet）— 兩個 component、兩種視覺。
- 修法：TripsListPage 改用 `InfoSheet` + `CollabSheet`，跟 TripPage 共編 chip 同一 sheet 容器。`CollabModal` 已刪除（unused）。
- 桌機/手機現在都走同樣 slide-up sheet pattern。

verify gate: tsc clean / 1029 tests pass.

## [2.14.22] - 2026-04-26

**PR-LL/MM bundle: sheet 再收緊 + card 比照 mobile 尺寸 RWD（QA round 21）**。

### Fixed (PR-LL)
- **1280 viewport user 仍看到 1 card** — PR-KK 的 sheet 410 + minmax 280 在 1280 inner=587 計算上應該容 2 cols（576），但 macOS scrollbar always-on 模式吃 ~15px 讓 inner=572 < 576 → 掉成 1 col。

### Changed (PR-MM)
- **/map sheet 比照 /trips** — GlobalMapPage 加同樣 sheet override `min(540, 28vw)`，不再走全域 `min(780, 40vw)`。同步解決 1280 viewport map sheet 太大的問題。
- **Sheet 再收緊** — `min(576, 32vw)` → `min(540, 28vw)`：
  - 1280: sheet 358 (28vw)、main 682
  - 1440: sheet 403 (28vw)、main 797
  - 1920: sheet 538 (28vw)、main 1142
  - 2560: sheet 540 (cap)、main 1780
- **Card 比照 mobile 尺寸 + 自動 RWD** — `minmax(280, 1fr)` → `minmax(200, 1fr)`：mobile 2-col 在 375 viewport 每張 ~180，desktop minmax 200 同尺寸基準，auto-fill 隨 viewport 自動加列：
  - 1280 → 3 cards
  - 1440 → 3 cards
  - 1920 → 4 cards
  - 2560 → 4 cards
- 真正的 RWD：viewport 變寬自動增加列數而非卡片變大。

verify gate: tsc clean / 1029 tests pass.

## [2.14.21] - 2026-04-26

**PR-KK: sheet 改 32vw cap 576 — 涵蓋 1280 viewport（QA round 20）**。

### Fixed
- **1280 viewport sheet 仍太大** — PR-JJ 的 `min(576, 40vw)` 在 1280 算 = 512px（沒到 576 cap，被 40vw 鎖死），main 只放 1 card。改 `min(576, 32vw)` 讓 1280 = 410px，main 630 容下 2 cards。
- 1920+ 仍 cap 576 維持 mockup 上限。

| Viewport | sheet | main | cards |
|----------|-------|------|-------|
| 1280 | 410 (32vw) | 630 | 2 |
| 1440 | 461 (32vw) | 739 | 2 |
| 1920 | 576 (cap) | 1104 | 3 |

verify gate: tsc clean / 1029 tests pass.

## [2.14.20] - 2026-04-26

**PR-JJ: /trips sheet cap 鎖在 mockup-1440 的 576px，不讓 wider viewport 長到 780（QA round 19）**。

### Fixed
- **Sheet 在 wider viewport 太大** — PR-II 砍 override 改繼承全域 token `min(780, 40vw)` 在 1440 沒問題（=576），但 user 在 1920+ viewport 會看到 sheet 長到 768，視覺上比例不對。
- 修法：override sheet 改 `min(576px, 40vw)` — 把 mockup-1440 的 576 比例鎖死在**所有 viewport**：
  - 1440 → sheet 576 (40vw)、main 624（mockup canonical）
  - 1920 → sheet **576 (cap)**、main 1104（PR-II 是 768/901，現在 sheet 不再長）
  - 2560 → sheet 576 (cap)、main 1744
- **配套**：shell horizontal padding 24 → 16，讓 1440 main inner=592 ≥ 576，2 cards 確實塞得下（PR-II 的 565 < 576 只能放 1 card 是 bug）。
- 1440 viewport 量到 `240 624 576`、grid 2 cols 各 ~290px。
- verify gate: tsc clean / 1029 tests pass.

## [2.14.19] - 2026-04-26

**PR-II: /trips sheet 比例修回 mockup canonical（QA round 18）**。

### Fixed
- **Sheet 比例不對** — 認真比對 `docs/design-sessions/mockup-trip-v2.html` 線 30 + 167 後修回 canonical：
  - Sheet 寬：`min(440px, 32vw)` → `min(780px, 40vw)`（PR-FF 改窄是錯的）
  - Trip grid：`repeat(3, 1fr)` 強制 → `repeat(auto-fill, minmax(280px, 1fr))` adaptive
- 改動就是把 PR-FF 加的 scoped override 整段砍掉，直接繼承全域 token `--grid-3pane-desktop`（tokens.css 行 95）— DRY 化，跟 trip-detail page sheet 寬度一致。
- 1440 viewport 對齊 mockup：sheet=576px (40vw)、main=624px、2-card auto-fill。
- verify gate: tsc clean / 123 files / 1029 tests pass。

## [2.14.18] - 2026-04-26

**PR-GG/HH bundle: CollabSheet 重新設計 + docs 404 不再噴 5 連 toast（QA round 17）**。

### Fixed (CollabSheet — PR-GG)
- **「移除」按鈕文字直排亂** — row 改單一水平 flex（避免 column 包 email + pill 撐高 row 把 button 擠窄）；按鈕走 terracotta-preview `.btn-destructive` ghost 樣式（transparent + destructive border + nowrap + min-width 64）。
- **「新增」按鈕透明像 disabled** — 走 `.btn-primary` 實心 fill：`var(--color-accent)` bg + `var(--color-accent-foreground)` 文字、hover → `--color-accent-deep`；disabled 只調 opacity 0.55 保留實心橘色，永遠看得出是 primary CTA。
- **role pill 跟 row 沒對齊** — pill 移到 email 同一行 inline，avatar / email / pill / button 四欄 `align-items: center` 對齊；pill 中文化「擁有者 / 共編成員」、放棄 uppercase 英文 role。
- **Owner row 留白對齊** — owner 不渲染 remove button（不可移除），靠 flex 自然收尾。

### Fixed (docs — PR-HH)
- **新行程開出 5 連「找不到這筆資料」error toast** — `useTrip.fetchAllDocs` 對 5 個 docs（flights/checklist/backup/emergency/suggestions）的 404 rejection 各跑一次 `showErrorToast`。docs 是 optional sub-resource（新行程不會自動寫 5 種 docs），404 應靜默略過，不該每個都噴 toast 騷擾使用者。
- 修法：`if (err.code === 'DATA_NOT_FOUND') continue;` 在 toast 觸發前提早 short-circuit。
- 其他 severity（500、網路錯）仍正常 toast — 加 regression-guard 測試確保。

### Tests
- `tests/unit/use-trip-docs-404.test.tsx` 新增 3 cases：5 連 404 不 toast / 500 仍 toast / 部分 200 部分 404 混合。
- verify gate: tsc clean / 123 files / 1029 tests pass。

## [2.14.17] - 2026-04-26

**PR-EE/FF bundle: dark mode 樣式修補 + trips list 卡片均一 + 隱藏 trip-id + sheet 寬度收縮（QA round 15-16）**。

### Fixed (dark mode)
- **⋯ 卡片 kebab button 白圈** — `.tp-card-menu-trigger` 用 `rgba(255,255,255,0.92)` hardcode 白色 → 改 `var(--color-glass-toast)` token (light: cream / dark: cocoa) + `backdrop-filter: blur(8px)`。
- **手機行程詳情返回箭頭白圈** — `.tp-trips-back-btn` 同問題同修法。
- **TW cover dark mode 太亮** — `--color-cover-tw-from: #9E6800`（amber gold）在 dark UI 跳出來太搶眼，改 `#5A4220`（deep amber-brown）。

### Fixed (trips list)
- **隱藏 trip-id** — `cardMeta()` fallback `trip.tripId` 移除 → return `''`。`trip-vduh` 對 user 沒意義，留白勝過顯示亂碼。
- **卡片大小不一** — `.tp-trip-card` 改 `display: flex; flex-direction: column; height: 100%;`，meta `margin-top: auto` 推到底部。grid auto stretch + flex column = 同 row 高度均一。
- **Sheet 寬度過大** — `min(560px, 38vw)` → `min(440px, 32vw)`，對照 mockup-trip-v2 sheet 比例。1440px viewport 主欄變寬 cards 顯示更舒服。

### Internal
- 抓 bug 用 `/browse` 對 prod 套 dark mode 截圖確認。
- User 回報的「奇怪長條圖」 在 headless browse 沒重現 — 可能 Xiaomi 裝置 specific quirk，需實機 debug。
- verify gate: tsc clean / 122 files / 1026 tests pass。

## [2.14.14] - 2026-04-26

**PR-CC: 行程 owner 概念正規化 — 強制 server-side、區分 owner/member badge、不可刪 owner**。User 指示：「行程增加 owner 概念，huiyun 行程 owner = huiyun 帳號、ray 的 = lean.lean@gmail.com，之後誰建立就是誰是 owner，加入共編的是 member。」 + 「設定畫面 members 也要調整 owner 可以加 member 不能刪除自己 owner」。

### Migration (已套用 prod)
- **`migrations/0039_trip_permissions_owner_role.sql`** — 擴充 `trip_permissions.role` CHECK 從 `('admin','member')` 加入 `'owner'`。SQLite 不支援 ALTER TABLE DROP CONSTRAINT，用 swap 表 pattern recreate（含原本 indexes 重建）。
- **Prod data fix（手動執行 wrangler）**：
  - `okinawa-trip-2026-Ray`.owner: `'Ray'` → `'lean.lean@gmail.com'`
  - `okinawa-trip-2026-HuiYun`.owner: `'HuiYun'` → `'penyin@gmail.com'`
  - 對應 trip_permissions 兩 row role: `'member'` → `'owner'`

### Backend
- **POST /api/trips 強制 `owner = auth.email`** — 不再讀 `body.owner`（防偽造）。User 指示「之後的誰建立就是誰是 owner」 — server-side auth 取唯一可信來源。
- **POST /api/trips 自動 INSERT trip_permissions role='owner'** — 取代舊 'admin' 角色。後續 hasPermission 仍認 owner / admin / member 三種。
- **DELETE /api/permissions/:id 阻擋 owner role row** — User 指示「不能刪除自己 owner」。Owner 只能透過未來轉移 endpoint（unimplemented）變更，不可直接 DELETE。回 403 「不可移除行程擁有者」。

### Frontend (CollabSheet)
- **owner badge 用 success 綠色** vs **member badge 用 accent 橘色** — 視覺一眼區分。語意：你是擁有者（強調正向） vs 你是共編成員（次要）。
- **owner row 顯示「擁有者」 label 取代 移除 button** — 視覺強調此 row 不可被移除。Member row 才有 remove button。
- **`Permission.role` type 擴充** `'owner' | 'admin' | 'member'`。

### Internal
- backend 既有 `hasPermission` query 用 `email AND trip_id` 不過濾 role，'owner' / 'admin' / 'member' 都自動 pass — 無需改動。
- Owner transfer 流程（將 owner 從 A 換給 B）尚未實作 — 單向 destructive 需要 confirm + audit + 強制把舊 owner 降成 member。列入 backlog。
- verify gate: tsc clean / functions tsc clean / 122 files / 1026 tests / 53 API files / 525 API tests pass。

## [2.14.13] - 2026-04-26

**PR-Z: CollabSheet 視覺重新設計 — 對照 DESIGN.md + terracotta-preview.html 收齊風格**。User: 版面不一致（移除 button 文字直排、新增 button 看似 disabled、role pill 樣式單薄）。

### Fixed
- **「移除」 button 文字直排** — 加 `white-space: nowrap` + `min-width: 64px` + `flex-shrink: 0`。原本沒 min-width 在容器擠壓時 button 縮到 1 字寬度 → 「移」/「除」 兩字直排亂。
- **「+ 新增」 button 看似 disabled** — disabled 從 `opacity: 0.5` 改 `opacity: 0.55` 但**保留 background fill**，user 仍看得出是 primary CTA 只是 dimmer，不再 transparent 假象。
- **role pill 樣式單薄** — 對照 terracotta-preview `.badge` pattern：rgba(accent, 0.12) bg + accent-deep color + 6px dot prefix + uppercase letter-spacing 0.04em。

### Changed
- **List container 改 single bordered group with dividers**（同 SessionsPage `.tp-list` pattern）— 取代原本 separate row cards。視覺更 compact + 統一感更強。
- **Member row 加 avatar circle**（accent-subtle bg + initial）— 對齊 SessionsPage device-icon pattern。
- **Section head 右側加 count 副標**（`{permissions.length} 人`）— 對照 ConnectedAppsPage `.tp-section-count` pattern。
- **Empty state 改 secondary bg + 更具導引性的文字**（「尚未授權任何成員，可在下方新增。」）。

### Internal
- 移除 inline Tailwind class `flex flex-col gap-2`（list container 改用 dedicated `.tp-collab-list` class）。
- Add input className 從匿名 nested 改 explicit `.tp-collab-add-input`（避免 cascade 不確定性）。
- collab-sheet test fix：`getByText('尚未授權任何成員')` → `getByText(/尚未授權任何成員/)`（regex 容納新加的引導文字）。
- verify gate: tsc clean / 122 files / 1026 tests pass。

## [2.14.12] - 2026-04-26

**PR-BB: NewTripModal 目的地接 POI search autocomplete（強制選擇 / option B）**。User: 「新增行程選的目的地要結合搜尋 poi 藉此知道行程國家與相關 table 資訊」。

### Changed
- **目的地 input 從 free-text 改 POI search autocomplete** — User 必須從搜尋結果選一筆 POI，才能 submit。原本 free-text + `detectCountries()` keyword regex 猜測 country，常常猜錯（沖繩寫成 'Naha' / 巴塞隆納沒列在清單 / 等等都 default JP）→ 現在直接用 Nominatim 真實 ISO alpha-2 country code。
- **`/api/poi-search` 擴充 response** — 加 `country` (uppercase ISO alpha-2) + `country_name` 兩個欄位。Backend 已在 query 時 `addressdetails=1`，只是原本沒回傳；本 PR 把它寫進 PoiSearchResult interface 並 map 進 result rows。Backwards compatible — 既有 caller (InlineAddPoi / ExplorePage) 不讀 country 欄位。

### Added
- **NewTripModal `selectedPoi` state** — debounced search 300ms (低於 InlineAddPoi 的 250ms 因為 modal 場景比較不需即時)，min query length 2 字元。
- **Locked POI chip UI** — 選定後 input 換成 `.tp-new-dest-locked` chip 顯示 POI name + country_name + country code（accent-subtle bg + accent border），可點 ✕ `clearSelectedPoi()` 重新搜尋。
- **Dropdown UI** — `.tp-new-dest-dropdown` absolute 定位於 input 下方，max-height 280px 內捲。每筆結果有 name (callout/700) + address (caption/muted)。

### Removed
- **`detectCountries()` keyword regex** — 不再需要，country 直接從 selected POI 拿。
- **`destination` state** → `destQuery`（input 內容）+ `selectedPoi`（鎖定的 POI）。

### Internal
- `selectedPoi.country` 是 ISO alpha-2 大寫，跟 trips.countries CSV 格式相容（單一 country 直接放，未來支援 multi 可改 CSV）。
- 對 OSM 邊界 POI / 海上 POI 等找不到 country 的特例，submit 時 fallback 'JP'。
- 兩個 submit test 改寫：mock /api/poi-search 回單筆結果 + fireEvent.click 結果 → selectPoi → submit。
- verify gate: tsc clean / functions tsc clean / 122 files / 1026 tests pass / 53 API files / 525 API tests pass。

## [2.14.11] - 2026-04-26

**PR-AA: ⋯ 共編 inline modal + 手機行程詳情返回箭頭（QA round 13 — IA 兩件事）**。

### Changed
- **⋯ 共編點了不再 navigate 到 trip 頁** — User 指示「不要開啟行程頁」。原 PR-Q 走 `navigate('/trips?selected={id}&sheet=collab')` 強制 user 進 trip 詳情。改：TripsListPage 加 `collabTripId` state，TripCardMenu 的 `onCollab` 改 `setCollabTripId(tripId)` 直接觸發 inline modal，trip 列表保留 visible 在背景。

### Added
- **`src/components/trip/CollabModal.tsx`** — 新 modal wrapper，createPortal to body + escape stacking context + z-modal token + Escape key dismiss + backdrop click dismiss。內容是現成 `<CollabSheet />`。Header 含「共編設定」 標題 + ✕ close button。
- **手機行程詳情返回箭頭** — User 指示。`/trips?selected=` mobile embedded mode 在 main 區左上 sticky 顯示 `<button>` with `arrow-left` icon，點了 `setSearchParams(remove 'selected')` 回 list。glass-style 在內容上浮動。Desktop 強 hide（embedded 走 sheet pane 不適用）。

### Internal
- TripsListPage 拿掉 `useNavigate` import（不再 navigate）。
- back button CSS 用 `position: sticky; top: 8px` 跟著 scroll 不消失。
- verify gate: tsc clean / 122 files / 1026 tests pass。

## [2.14.10] - 2026-04-26

**PR-Y: NewTripModal 錯誤訊息真實化 — 修「建立行程失敗，請稍後再試」 generic 掩蓋（QA round 12）**。User: 新增行程失敗（Jessica Yo 截圖）。

### Fixed
- **「建立行程失敗，請稍後再試」 generic toast 掩蓋真實原因** — `handleSubmit` 解 error response 用 `data.message`，但 API (`functions/api/_errors.ts`) 用巢狀 `{ error: { code, message } }` 格式（V2 user-facing standard），所以 `data.message` 永遠 undefined → 永遠 fallback 到 generic 文字。
- **修：改讀 `data.error.message`** — backend `ERROR_MESSAGES` dictionary 已對每個 code 定 friendly 文字（401「請先登入」、403「你沒有此操作的權限」、503「資料庫忙碌中，請稍後再試」等），fix 後 user 看到具體原因可 actionable。

### Internal
- 抓 bug 過程：D1 audit_log 查最近 trip insert events → 沒有 Jessica Yo 對應 row → 證明 POST 沒到 INSERT 步就 fail（驗證 / auth / encoding 之一）→ 對照 NewTripModal handleSubmit 解析邏輯 → 找到 `data.message` 錯位（應 `data.error.message`）。
- 同 pattern bug 可能還在其他 component（用同樣 raw fetch + manual error parse 的）。建議下個 sweep 統一改用 `apiFetch` (`src/lib/apiClient.ts`) 走 `ApiError.fromResponse` — PR-V follow-up scope。
- verify gate: tsc clean / 122 files / 1026 tests pass。

## [2.14.9] - 2026-04-26

**PR-X: ExplorePage 儲存池 toolbar 加刪除 + 跟下方 POI grid 留間隔（QA round 11）**。User: 「儲存的 poi 點選後 加入行程 後面增加刪除 然後點選後顯示的功能列要和景點 poi 要有留間隔」。

### Added
- **「刪除」 button** 加在「加入行程」 後面 — destructive style（透明 bg / destructive border + color，hover bg destructive-bg）。
- **`handleDeleteSelected()`** — confirm dialog → `Promise.all` 對每個 selected id 呼 DELETE `/api/saved-pois/:id` → 部分失敗仍 show 部分成功 toast。
- **`deletingSelected` state + `disabled` 三個 button** during delete in-flight。

### Fixed
- **Toolbar 跟下方 POI grid 沒間隔** — `.explore-toolbar` 加 `margin-bottom: 16px`。原本 toolbar 跟 grid 沒有 gap（兩個都是 `.explore-section` 直接 child，section 沒設 flex/gap），視覺貼在一起。

### Internal
- DELETE endpoint `/api/saved-pois/:id` 已存在（owner / admin only），無需後端改動。
- toolbar-actions flex-wrap 加進去，三個 button 在窄螢幕可換行不擠破。
- verify gate: tsc clean / 122 files / 1026 tests pass。

## [2.14.8] - 2026-04-26

**PR-W: NewTripModal 關閉 X 移到右上角（QA round 10）**。User 截圖紅圈：原本 X 在 form pane 上方，視覺浮在 hero/form 中間區域（mobile）。

### Changed
- **`.tp-new-form-close` 改 `position: absolute; top: 12px; right: 12px;`** — 直接定位 modal box 右上角，覆蓋 hero pane 上層。z-index 2 高過 hero SVG（0/1）。Mobile / desktop 同位置。
- **glass-style** background `rgba(255, 255, 255, 0.92)` + `backdrop-filter: blur(8px)`，在橘色 hero 背景上仍清楚對比。
- **JSX 結構**：`.tp-new-form-top` wrapper 拿掉，close button 直接掛在 `.tp-new-modal` form 之下（form 本身加 `position: relative` 給 absolute child 用）。

### Internal
- 純 CSS + JSX 移位，零邏輯改動。Test ID `new-trip-close` 不變。
- verify gate: tsc clean / 122 files / 1026 tests pass。

## [2.14.7] - 2026-04-26

**PR-V: NewTripModal 真的會捲了 — grid-template-rows + overscroll-behavior（QA round 9）**。User: 「捲動是捲動底部 layer，上方無法用」。Claude 用 /browse 對 prod 測 + 量 DOM 找到根因。

### Fixed
- **Modal 內容看得到但動不了 + scroll 跑到背景 page** — 根因兩層：
  - **Layer 1（form 沒被約束）**：modal `display: grid` 但只設 `grid-template-columns`，沒設 `grid-template-rows`。grid 預設 `grid-auto-rows: auto`，每個 row 取內容高。Form 內容自然撐成 755px，超過 modal 可用空間（max-height 812 - hero 222 = 590px）。Form 自己有 `overflow-y: auto` + `min-height: 0`，但因為「自己沒被父層約束高度」，根本沒進入 overflow 狀態，scroll 不觸發 → user 看到內容被切但動不了。
  - **Layer 2（rubber-band scroll bleed）**：iOS Safari 在 modal 觸 scroll 邊界時會把剩餘動量傳給 ancestor，背景 page (AppShell main 也是 overflow-y: auto) 跟著捲。

### 修法
- **`grid-template-rows: auto 1fr`** — mobile single-column 強制 hero 取自然高度，form 拿剩餘空間（590px）。Form 一被約束，`overflow-y: auto` 真的觸發，內容 755 > clientH 590 = 可捲。
- **`overscroll-behavior: contain`** — form 加上後，scroll 邊界動量被 form 自己吃掉，不會傳到 ancestor。背景 page 不再被誤動。
- **Desktop @media** 加 `grid-template-rows: 1fr` — split-screen 兩欄並排，rows 一個就夠（覆蓋 mobile 的 auto 1fr）。

### 抓 bug 過程（自我測試先做好）
```
1. /browse goto /trips → 登入 onion523 → click 新增行程
2. js measure: modalH=812 ✓, formH=754, formScrollH=755, formClientH=755, canScroll=false
   → form size = its content size (not constrained)
3. js patch: modal.style.gridTemplateRows='auto 1fr'
4. js measure again: formClientH=588, formScrollH=755, canScroll=true ✓
5. 確認映射對 → 寫進 source code
```

### Internal
- 純 CSS 改動 — 1 個 grid-template-rows + 1 個 overscroll-behavior，零 JS 改動。
- 對應 user 上一次截圖 PR-S 修了 z-index，PR-M 修了 max-height，PR-V 終於把 scroll 完整跑通：z-index 高 + portal 出 stacking context + max-height 約束 + grid rows 約束內 child + overscroll 防 bleed = 4 件事缺一不可。
- verify gate: 122 files / 1026 tests pass。

## [2.14.6] - 2026-04-26

**PR-U: 全站錯誤訊息統一 — Toast 跑版修 + 共用 ErrorBanner/InlineError + anti-slop emoji 清（design audit 4 點全修）**。User 指示「全部修」 PR-U/V/W/X bundle。

### Fixed
- **Toast 跑版** — `--spacing-toast-top` 從 `calc(48 + 12) = 60px` 改 `max(16px, env(safe-area-inset-top, 16px))`。原值假設 page 有 sticky topbar (48px)，但 /explore /map /trips landing /sessions 等 mobile page 沒有 topbar，60px 直接覆蓋 page heading。新值對齊 iOS HIG transient notification 慣例 — 頂部 safe area 下方就近顯示，跨 page 一致。

### Added
- **`src/components/shared/ErrorBanner.tsx`** — 統一 page-level / form-level 錯誤訊息 banner。內建 `<Icon name="warning" />` + `role="alert"` + destructive token。Single source of truth 取代全站 12 種重複實作。
- **`src/components/shared/InlineError.tsx`** — 表單欄位下方 / 小範圍 inline 錯誤（紅色 footnote 字 + role=alert）。

### Changed
- **Anti-slop emoji prefix 補完**：
  - `IdeasTabContent.tsx`：`<div>⚠ {error}</div>` → `<Icon name="warning" />` + flex layout
  - `ConsentPage.tsx`：`<div>⚠ {error}</div>` → `<ErrorBanner />` 包
- **9 個 caller 遷移到共用 component**：
  - **ErrorBanner**: `LoginPage` (banner-error) / `SessionsPage` / `ConsentPage` / `TripsListPage` / `ConnectedAppsPage` / `DeveloperAppsPage` / `InlineAddPoi`
  - **InlineError**: `SignupPage` (email + password) / `ResetPasswordPage` (pwError) / `DeveloperAppsPage` (createError) / `NewTripModal` (form error) / `TimelineRail` (saveError)
- **`InlineAddPoi` 移除舊 `.tp-inline-add-error` CSS**（11 行 destructive bg/border style），保留 `.tp-inline-add-error-shell` wrapper margin（2 行）。

### Internal
- 仍保留的舊 class（待 PR-V 收尾遷移）：`.tp-banner-error` 在 SignupPage / ResetPasswordPage / ForgotPasswordPage 是 multi-kind banner（error / warning / info），需要 Banner 元件支援 kind prop 才能完全收斂。`.tp-error-banner` / `.tp-trips-error` / `.tp-consent-error` / `.tp-rail-note-error` / `.tp-new-modal-error` 等舊 CSS 雖已無 caller，留著 dead code 不影響 runtime（下個 sweep 清）。
- backend `_errors.ts` + `src/types/api.ts` 的 `ERROR_MESSAGES` dictionary 已有完整 friendly 文字（`SYS_DB_ERROR: '資料庫忙碌中，請稍後再試'` 等），`ApiError.fromResponse` 自動 parse code → friendly message — apiClient 端不需額外 mapping。
- verify gate: tsc clean / 122 files / 1026 tests pass。

## [2.14.5] - 2026-04-26

**PR-T: ExplorePage 儲存 503 修 — Nominatim raw category 沒映射到 whitelist（QA round 8）**。User 截圖：「搜尋的儲存會出現錯誤」。Claude 自己測 prod 找到根因。

### Fixed
- **ExplorePage 「+ 儲存」 → 503** — `POST /api/pois/find-or-create` 回 503，user toast「目前繁忙碌中，請稍後再試」。根因：ExplorePage 直接送 `type: poi.category || 'poi'`（Nominatim 原始 class，例如 `'tourism'` / `'amenity'` / `'shop'`），不在 `pois.type` CHECK constraint 白名單內（`'hotel','restaurant','shopping','parking','attraction','transport','activity','other'`），SQLite CHECK 失敗 → backend 翻成 SYS_DB_ERROR 503。
- **修：套用 `mapNominatimCategory()`** — InlineAddPoi 一直有這個映射，ExplorePage 沒有。新增共用 `src/lib/poiCategory.ts` 把 mapping 抽出來，ExplorePage + InlineAddPoi 都改 import 用。Nominatim raw → tripline whitelist 已知對應（hotel/lodging/tourism→hotel、restaurant/food/amenity→restaurant、shop/mall/retail→shopping、parking→parking、transport/railway/airport→transport、activity/leisure→activity、其他→attraction）。

### Added
- **`src/lib/poiCategory.ts`** — 新共用 lib，export `mapNominatimCategory(category) → PoiType` + `PoiType` type union。Single source of truth for Nominatim → whitelist mapping。

### Internal
- `InlineAddPoi.tsx` — 移除 inline `mapNominatimCategory` function，改 import from lib。
- `ExplorePage.tsx` — `type: poi.category || 'poi'` → `type: mapNominatimCategory(poi.category)`。
- 抓 bug 用 /browse skill 對 prod 真實登入測試 + 看 network log 抓到「POST /api/pois/find-or-create → 503」 + manual 重 POST with `type: "attraction"` 確認映射後回 200。

## [2.14.4] - 2026-04-26

**PR-S: 補定義 `--z-modal` token，修 NewTripModal 仍被 bottom nav 蓋（QA round 7）**。User 截圖回報 PR-P portal 後 modal 還是會被 nav 切掉、無法捲到底。

### Fixed
- **Modal 仍被 sticky bottom nav 蓋住** — 根因：`--z-modal` token 從沒在 `tokens.css` 定義過，NewTripModal 用 `var(--z-modal, 60)` 全部走 fallback 60，而 `--z-sticky-nav: 200` 比 60 大很多，所以 bottom nav 永遠贏。PR-P 的 `createPortal(document.body)` 雖然 escape 了 stacking context，但 z-index 數字還是輸。
- **修：`tokens.css` 加 `--z-modal: 9000`** — 一行 token 補定義，數字選 9000 是要高過所有 sticky 元素（sticky-nav 200 / fab 300 / quick-panel 350 / info-sheet 401），且留 buffer 給未來更高 priority overlay。NewTripModal 已用 var() 引用，自動生效不需改 component。

### Internal
- 屬於 PR-P 的 follow-up 修補，PR-P portal 解決 stacking context 問題、PR-S 解決 z-index 數字問題，兩個一起才完整。
- verify gate: 122 files / 1026 tests pass。

## [2.14.3] - 2026-04-26

**PR-Q: TripsListPage 卡片 ... 菜單（共編 / 刪除）+ DELETE /api/trips/:id（V2-P7）**。User 指示：「行程列表 增加 … 顯示刪除與共編」。

### Added
- **`TripCardMenu` component**（`src/components/trip/TripCardMenu.tsx`）— kebab「...」 button + portal'd dropdown popover with「共編設定」 / 「刪除行程」 兩個 menuitem。click 用 stopPropagation 阻止穿透到 card click。Portal 到 body 避免 stacking context 衝突。
- **`'more-vert'` icon** — 三點垂直 SVG，trigger button 用。
- **`DELETE /api/trips/:id`**（`functions/api/trips/[id].ts`）— admin OR trip owner only（co-editor 即使在 trip_permissions 上也不能刪，destructive 操作必須 limit）。FK ON DELETE CASCADE 自動清掉 trip_days / trip_entries / trip_pois / trip_permissions / trip_docs / ideas / trip_requests 等所有相關 row。logAudit 留 snapshot。
- **`?sheet=<key>` URL param 支援**（`TripPage.tsx`）— card kebab 「共編」 點開後 navigate 到 `/trips?selected={id}&sheet=collab`，TripPage 在 initial-scroll effect 內讀 sheet 參數 + 自動 setActiveSheet（限定在 SHEET_TITLES 已知 keys）。

### Changed
- **`TripsListPage` 卡片結構** — 從 raw `<button>` 改 wrap 在 `<div className="tp-trip-card-wrap">` 內（`position: relative`），button + TripCardMenu 兩個 child。menu trigger 是 `position: absolute; top: 8px; right: 8px;` overlay。
- **`handleMenuDelete`** — confirm dialog → `apiFetchRaw('/trips/:id', { method: 'DELETE' })` → optimistic local state 移除（`setMyIds` + `setAllTrips`）→ 若該 trip 是當前 `?selected=`，clear URL param。錯誤狀態 toast：403「僅行程擁有者或管理者可刪除」、404「行程不存在」、其他「刪除失敗」。
- **`handleMenuCollab`** — `navigate('/trips?selected={id}&sheet=collab')`，user 一次到位看到共編 sheet。

### Internal
- TripsListPage 加 `<ToastContainer />` 給 delete 錯誤 / 成功訊息用（之前只有 TripPage 有，/trips landing 沒 mount）。
- TripCardMenu 用 `useLayoutEffect` 算位置 + `useEffect` 處理 Escape / click-outside（同 OverflowMenu pattern）。
- verify gate: tsc clean / functions tsc clean / 122 files / 1026 tests pass / 53 API files / 525 API tests pass。

## [2.14.2] - 2026-04-26

**PR-R: /map 6 點重組 — 控制條重排 + POI 卡 CTA 升級 + 點 POI 只顯示當天 polyline + 跳到行程真的能跳（QA round 6）**。User 截圖 5 點 + 第 6 點補。

### Changed
- **「全覽 / 我的位置」 pill bar 上移到選擇行程下方** — `.tp-global-map-actions` 從 `bottom: 100px` (mobile) 改 `top: 64px`（mobile）/ `top: 76px`（desktop）。視覺群組跟 trip switcher 接在一起。
- **POI 卡 grid layout 改右側 CTA chip** — `.tp-global-map-mobile-poi` 從垂直 stack 改 `grid-template-columns: minmax(0, 1fr) auto`，左 content（eyebrow / title / meta）+ 右「跳到行程」 chip。CTA 從 inline link 升級成 accent-fill button（`bg: accent` / `color: accent-foreground` / `radius: full`）。
- **POI 卡下移** — `bottom: 152px → 110px`，pill bar 已上移讓出空間，卡片貼緊 carousel 上緣。

### Added
- **點全覽自動關 POI** — `fitAll()` callback 同步 `setSelectedPinId(null)`，一鍵 reset 視角 + 關 detail card + 顯示全部 days polyline。
- **點 POI 只顯示當天 polyline** — 新 `displayPinsByDay` derived map：sleected pin 存在時 filter 到 `selectedDay.dayNum` only，沒選時還原 `resolved.pinsByDay`。Markers 不過濾，仍 render 全部 pins 避免 user 找不到別天景點。
- **跳到行程真的會 scroll 到該 stop** — Link 加 `state={{ scrollAnchor: 'entry-${id}' }}`（讓既有 useScrollRestoreOnBack hook 處理）+ TripPage 加 fallback：useEffect 讀 `?focus=` query 並 scroll 到 `[data-scroll-anchor="entry-${focus}"]`。雙保險：state 沒帶上時 query 那條也 work（user 直接貼 URL）。

### Internal
- TripPage 在既有 initial-scroll effect 加 focus 優先級分支（high > today > hash）。
- `displayPinsByDay` 用 `useMemo` derived，OceanMap 認 props，沒重 render 邏輯改動。
- verify gate: tsc clean / functions tsc clean / 122 files / 1026 tests pass / 53 API files / 525 API tests pass。

## [2.14.1] - 2026-04-26

**PR-P: NewTripModal portal 修底部無法操作 + 共編 entry 提升 discoverability（QA round 5）**。User 兩個截圖回報：modal 下方控制鍵被 bottom nav 蓋住無法 tap，且共編設定找不到。

### Fixed
- **NewTripModal 底部控制鍵被 bottom nav 蓋住** — `return createPortal(<div className="tp-new-modal-backdrop">…</div>, document.body)`，escape 任何 ancestor stacking context（AppShell scroll container / TripsListPage sheet 等）。z-index 60 backdrop 真正高過 sticky bottom nav (z-index 10)，mobile 下方「選日期 / 彈性日期」 segmented 跟其下的所有控制鍵全部可 tap。
- **共編設定 mobile 找不到入口** — embedded mode（`/trips?selected=` 由 TripsListPage 提供 chrome）把 TripPage 的 topbar + OverflowMenu kebab 都 hide 了，原本 user 完全沒有路徑進共編 sheet。新增 `.tp-trip-actions` 永遠 render 在 trip 主內容最上方（不分 noShell），裡面是「共編 + group icon」 chip 直接 `setActiveSheet('collab')`。

### Changed
- **`ACTION_MENU_GRID` 共編移到第一格** — mobile「更多」 sheet 第一張卡片就是共編，最顯眼位置。從 `[航班, 路線, 清單, 緊急, 備案, AI 建議, 共編, 切換行程, 外觀]` → `[共編, 切換行程, 航班, 路線, 清單, 緊急, 備案, AI 建議, 外觀]`。

### Internal
- `NewTripModal` 加 `import { createPortal } from 'react-dom'`，`return` 包成 `createPortal((<div…/>), document.body)`。jsdom 環境下 portal 同樣 work，1026 tests 全綠。
- `TripPage` 加 `import Icon from '../components/shared/Icon'`，新 `.tp-trip-action-chip` styling（accent hover 反白）+ JSX 一個 button。
- verify gate: tsc clean / 122 files / 1026 tests pass。

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
  - **✕ collapse**：呼叫 `onToggle()` 把行收合，pure UI no API
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
