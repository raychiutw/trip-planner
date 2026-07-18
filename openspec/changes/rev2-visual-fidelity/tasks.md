## 0. 建立視覺保真檢視方法（先做，之後每項都照它驗）

- [ ] 0.1 在 `DESIGN.md` 新增「Visual Fidelity Review」段：雙視窗必截（手機 390 = iOS HIG / 桌機 1440 = macOS HIG）、逐頁態、逐元件 3× zoom + `getComputedStyle` dump（寬高/bg/border/padding/對齊 vs 44pt tap 區 + DESIGN.md token）、mockup 並排、sticky 捲動態、禁止把偏離合理化。
- [ ] 0.2 建 `openspec/specs/visual-fidelity-review/spec.md`（capability spec：SHALL 雙視窗 / SHALL 逐元件 computed 對 token / SHALL mockup 並排 / SHALL 捲動態 / SHALL NOT 合理化偏離）。
- [ ] 0.3 更新記憶 `feedback_qa_visual_fidelity_blindspot`：把此方法納入（連兩輪漏 → 方法化）。

## 1. 搜尋按鈕破版（#2，根因已確認）

- [x] 1.1 `.tp-trips-search` collapsed 態改 44×44（或 40×40）圓、icon 置中（拔不對稱 padding / `place-items:center`），展開態維持 220px；`.tp-trips-search-toggle` 不再被 `overflow:hidden` 裁。
- [x] 1.2 雙視窗 3× zoom 驗證 icon 置中、tap 區 ≥44、展開輸入正常。

## 2. filter tabs「一片白色」（#1）

- [ ] 2.1 開 mockup（`docs/design-sessions/terracotta-preview-v2.html` 或 trips list 相關）截 filter tabs，比對現況 `.tp-trips-tabs`（`--color-secondary` 容器 + `is-active` 白 pill）對比與 segmented control 形制。
- [ ] 2.2 依 mockup 調整（容器對比 / active thumb / 間距），使其為清楚 segmented control 而非「白色色塊」。同步 DESIGN.md/mockup。

## 3. 行程頁 timeline 破版（#3，已 pinpoint）

- [x] 3.1 已定位：長 entry（時間區間 + 時數 + 評分）副標超 390px → `★ 4.1` 整組換行 + 第一行尾掛孤懸 `·`。根因 = `.tp-rail-sub` 分隔符是獨立 flex child。
- [x] 3.2 修法：把每個「`·` + token」綁成 nowrap 單位（分隔符不再獨立孤懸），或副標超長時的 graceful 收斂（對 `2026-07-17-...timeline-route-spine.html` mockup）。雙視窗 before/after 驗（含長 entry 3 那種）。

## 6b. 桌機 favorites 重複搜尋（#7，新找到）

- [ ] 6b.1 桌機 favorites 同時有 titlebar 🔍 + 頁內 search bar（computed 皆 true）→ 擇一（保留頁內 bar、拔 titlebar 🔍,或反之），對齊 DESIGN.md search pattern。手機態一併確認不重複。

## 4. day tab 中欄置中（#4，根因已確認）

- [x] 4.1 `.tp-map-day-tabs` `margin: 6px 12px 8px` → 置中（`margin: 6px auto 8px`；如需手機靠左/桌機置中則加 media query）。
- [x] 4.2 桌機截圖驗證 day-tab pill 在中欄水平置中（computed: pill 中心 ≈ 中欄中心）。

## 5. 捲動時 day tab 與 header 間距（#5，根因已確認）

- [x] 5.1 `.tp-map-day-tabs--sticky` `top: var(--titlebar-h)` → 加 gap（`top: calc(var(--titlebar-h) + Npx)`），確保捲動時與（玻璃）titlebar 有可見間距、不被玻璃層蓋/透。
- [x] 5.2 捲動態截圖驗證（sticky 後 day-tab 與 titlebar 間有間距、無重疊/穿透）。

## 6. 地圖 auth 失敗優雅降級（#6）

- [ ] 6.1 `useGoogleMap`：`Promise.all([...])` 補 `.catch()` set loadError；註冊 `window.gm_authFailure = () => setLoadError(...)`（Google referer/key 失敗的官方 callback）。
- [ ] 6.2 `TpMap`：`loadError` 時 render 頁面內「地圖暫停服務」placeholder（乾淨、非 Google 灰底 error、非 ErrorBoundary 紅屏），地圖容器不掛載（避免 Google 自畫 error overlay）。文案對齊 DESIGN.md Empty/error 語氣。
- [ ] 6.3 桌機 + 手機驗證：localhost 下右欄/地圖頁顯「地圖暫停服務」、頁面其餘（行程/timeline）完全正常可用。

## 8. workflow 稽核新確認的破版（computed 驗過）

- [ ] 8.1 op-edit 桌機 DAY tab 蓋 day-header:中欄 DAY 膠囊列與「DAY 01/日期」標題重疊 → 補垂直間距/修 z-index/sticky top（與 #5 同源機制）。
- [ ] 8.2 桌機操作頁浮動 nav 被 stack panel 切（op-move/op-changepoi,nav 右緣進 panel 182px）:stack panel 開啟時桌機底部 nav **隱藏**（或置於 panel 之上不被裁）。對齊 rev2 operation stacking（[[project_rev2_operation_stacking]]）。
- [ ] 8.3 favorites 桌機卡片動作列底部對齊:卡片等高 + 動作列 pin 到底（flex column + margin-top:auto / grid align-items:stretch）,加入行程 y 一致。
- [ ] 8.4 login/signup 桌機裝飾圓 edge 橫切 hero 標題:調圓位置/標題位置/層級讓 edge 不穿過字身。
- [ ] 8.5 new-trip 桌機底部 sticky 列後 nav bleed:sticky 列不透明或 nav 該頁隱藏,消除重影。

## 9. concrete HIG 違規（要修）

- [ ] 9.1 ⋮ kebab → iOS `…`（SF ellipsis,可置圓內）:tripdetail / op-overflow 的 more menu trigger（手機態）。
- [ ] 9.2 44pt 觸控區補足:explore POI 卡 `+`/`♥`(~32pt)、op-overflow nav 三控、trip-notes trash/chevron。
- [ ] 9.3 signup 密碼規則改常駐 helper/footnote（不只 placeholder）。
- [ ] 9.4 op-changepoi disabled 主鈕提高對比（淺 peach on white → 可辨）。
- [ ] 9.5 tripdetail nav bar trailing 控制精簡（+/⇆/⋮ 擠掉標題）→ 移部分進 overflow/toolbar,讓標題可讀。

## 10. HIG 偏離 — rev2 owner 決策

- [ ] 10.1 **桌機導覽改 macOS sidebar/toolbar**（owner 2026-07-18 **拍板要改**:9 HIG agent 一致點名底部浮動 tab bar 是桌機最大 macOS 違規）。**獨立工作線、踩 mockup-first hard gate（≥1 layout 變化）**:
    - [ ] 10.1a 產桌機 macOS sidebar 導覽 mockup:4-tab（聊天/行程/地圖/收藏）從底部玻璃膠囊搬進**左 sidebar**（或頂部 toolbar/segmented）;**手機維持底部 tab bar 不動**。用 /tp-claude-design 產 HTML → SendUserFile 截圖給 owner sign-off。
    - [ ] 10.1b sign-off 後改 code:`AppShell`（桌機不傳 bottomNav / 改 sidebar nav）+ `DesktopSidebar`（加 4-tab 主導覽）+ `GlobalBottomNav`（@≥1024 收起）;手機分支不變。同步 DESIGN.md + mockup。
    - [ ] 10.1c 桌機各頁雙視窗驗:nav 在 sidebar、底部無膠囊、內容不被遮。**此改一併解掉桌機底部 nav 相關破版**（#9 操作頁 nav 被 panel 切、桌機底部 nav 遮內容),故 #9 桌機部分歸這條做（手機 op-page 若也有 nav 遮則另處理）。
- [ ] 10.2 操作 sheet 手機 ‹+✕ 雙 dismiss:維持 rev2 StackPanelHeader vs 收斂單一 dismiss。
- [ ] 10.3 桌機 sidebar vibrancy vs 現有 deep cocoa 不透明:owner 確認（多半維持）。
- [ ] 10.4 macOS 單欄窄置中 vs 用滿橫向空間（account/new-trip）。
- [ ] 10.5 macOS settings 子頁 back-chevron vs sidebar/toolbar（collab/explore）。

## 7. 收尾

- [ ] 7.1 每項雙視窗 before/after 截圖歸檔;computed-vs-token 對齊表更新。
- [ ] 7.2 UI 改動同步 DESIGN.md + 對應 mockup（同 PR）。
- [ ] 7.3 `openspec validate rev2-visual-fidelity --strict` 過;tsc + 相關 unit/token-gate 測試綠。
